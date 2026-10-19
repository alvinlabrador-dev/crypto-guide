interface Env {
  CLERK_PUBLISHABLE_KEY?: string;
  CLERK_SECRET_KEY?: string;
  CLERK_FE_URL?: string;
  CLERK_BE_URL?: string;
  CLERK_JWKS_URL?: string;
  ALLOWED_EMAILS?: string;
  SESSION_SECRET?: string;
  LOCAL_DEV?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}
