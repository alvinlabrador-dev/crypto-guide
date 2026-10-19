import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        const key = line.slice(0, separator).trim();
        let value = line.slice(separator + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        return [key, value];
      }),
  );
}

const root = new URL("..", import.meta.url);
const values = {
  ...parseEnvFile(fileURLToPath(new URL(".dev.vars", root))),
  ...parseEnvFile(fileURLToPath(new URL(".env", root))),
};

const publishable = values.CLERK_PUBLISHABLE_KEY || values.VITE_CLERK_PUBLISHABLE_KEY;
const secrets = {
  CLERK_PUBLISHABLE_KEY: publishable,
  CLERK_SECRET_KEY: values.CLERK_SECRET_KEY,
  CLERK_FE_URL: values.CLERK_FE_URL,
  CLERK_BE_URL: values.CLERK_BE_URL,
  CLERK_JWKS_URL: values.CLERK_JWKS_URL,
};

for (const required of ["CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"]) {
  if (!secrets[required]) throw new Error(`${required} is missing from .env or .dev.vars`);
}

if (values.ALLOWED_EMAILS) secrets.ALLOWED_EMAILS = values.ALLOWED_EMAILS;

const wrangler = fileURLToPath(new URL("node_modules/wrangler/bin/wrangler.js", root));
for (const [name, value] of Object.entries(secrets)) {
  if (!value) continue;
  const result = spawnSync(process.execPath, [wrangler, "secret", "put", name], {
    cwd: fileURLToPath(root),
    input: `${value}\n`,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    throw new Error(`Could not upload ${name}: ${result.error?.message || result.stderr || result.stdout || "unknown error"}`);
  }
  console.log(`Configured ${name}`);
}
