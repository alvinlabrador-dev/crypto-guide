import { LogoMark } from "../brand/LogoMark";
import "./auth.css";

export function SetupScreen() {
  return (
    <div className="center-screen setup-screen">
      <LogoMark />
      <p className="eyebrow">ONE LAST CONNECTION</p>
      <h1>Server secrets are not configured.</h1>
      <p>Set <code>CLERK_PUBLISHABLE_KEY</code>, <code>CLERK_SECRET_KEY</code>, <code>ALLOWED_EMAILS</code>, and <code>SESSION_SECRET</code> with Wrangler, then reload this page.</p>
    </div>
  );
}
