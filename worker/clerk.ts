import { createClerkClient, verifyToken } from "@clerk/backend";
import { emailIsAllowed, parseEmailAllowlist } from "../shared/allowlist";

export type ClerkEnv = {
  CLERK_PUBLISHABLE_KEY?: string;
  CLERK_SECRET_KEY?: string;
  CLERK_FE_URL?: string;
  CLERK_BE_URL?: string;
  CLERK_JWKS_URL?: string;
  ALLOWED_EMAILS?: string;
  SESSION_SECRET?: string;
};

const DEFAULT_BACKEND_API = "https://api.clerk.com";
const STATIC_AUTHORIZED_PARTIES = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:8787",
  "http://driftline.alvinlabrador.dev",
  "https://driftline.alvinlabrador.dev",
  "https://driftline.alvinlabrador-dev.workers.dev",
];

export function clerkAuthConfigured(env: ClerkEnv): boolean {
  return Boolean(env.CLERK_PUBLISHABLE_KEY && env.CLERK_SECRET_KEY && parseEmailAllowlist(env.ALLOWED_EMAILS).size > 0 && env.SESSION_SECRET);
}

function authorizedParties(env: ClerkEnv, request: Request): string[] {
  const origin = request.headers.get("Origin") ?? new URL(request.url).origin;
  return [...new Set([origin, env.CLERK_FE_URL, ...STATIC_AUTHORIZED_PARTIES].filter((value): value is string => Boolean(value)))];
}

async function pemFromJwks(jwksUrl: string, token: string): Promise<string> {
  const headerPart = token.split(".")[0];
  if (!headerPart) throw new Error("Clerk session is invalid.");
  const padded = headerPart.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - headerPart.length % 4) % 4);
  const header = JSON.parse(atob(padded)) as { kid?: string };
  const response = await fetch(jwksUrl, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Clerk JWKS could not be loaded.");
  const body = await response.json() as { keys?: Array<JsonWebKey & { kid?: string }> };
  const jwk = body.keys?.find((key) => key.kid === header.kid) ?? body.keys?.[0];
  if (!jwk) throw new Error("Clerk JWKS did not include a usable key.");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, true, ["verify"]);
  const spki = await crypto.subtle.exportKey("spki", key);
  const bytes = new Uint8Array(spki);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const b64 = btoa(binary).replace(/(.{64})/g, "$1\n").replace(/\n$/g, "");
  return `-----BEGIN PUBLIC KEY-----\n${b64}\n-----END PUBLIC KEY-----`;
}

export async function assertClerkEmailAllowed(env: ClerkEnv, clerkToken: string, request: Request): Promise<void> {
  if (!env.CLERK_SECRET_KEY || !env.CLERK_PUBLISHABLE_KEY) {
    throw Object.assign(new Error("Clerk is not configured yet."), { status: 503 });
  }
  const parties = authorizedParties(env, request);
  const issuer = env.CLERK_FE_URL;
  const backendOptions = {
    secretKey: env.CLERK_SECRET_KEY,
    apiUrl: env.CLERK_BE_URL || DEFAULT_BACKEND_API,
    authorizedParties: parties,
    issuer,
  };
  let userId: string | undefined;
  try {
    const payload = env.CLERK_JWKS_URL
      ? await verifyToken(clerkToken, {
          jwtKey: await pemFromJwks(env.CLERK_JWKS_URL, clerkToken),
          authorizedParties: parties,
          issuer,
        }).catch(async () => verifyToken(clerkToken, backendOptions))
      : await verifyToken(clerkToken, backendOptions);
    userId = payload.sub;
  } catch {
    throw Object.assign(new Error("Clerk session is invalid."), { status: 401 });
  }
  if (!userId) throw Object.assign(new Error("Clerk session is invalid."), { status: 401 });

  const clerk = createClerkClient({
    secretKey: env.CLERK_SECRET_KEY,
    publishableKey: env.CLERK_PUBLISHABLE_KEY,
    apiUrl: env.CLERK_BE_URL || DEFAULT_BACKEND_API,
  });
  const user = await clerk.users.getUser(userId);
  const emails = user.emailAddresses
    .filter((entry) => entry.verification?.status === "verified")
    .map((entry) => entry.emailAddress);
  if (emails.length === 0) {
    throw Object.assign(new Error("This Clerk account has no verified email address."), { status: 403 });
  }
  if (!emailIsAllowed(emails, parseEmailAllowlist(env.ALLOWED_EMAILS))) {
    throw Object.assign(new Error("This account is not allowed to use Driftline."), { status: 403 });
  }
}
