import { ChevronRight, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { api } from "../../api";
import type { Toast } from "../../types";
import { LogoMark } from "../brand/LogoMark";
import "./auth.css";

type LoginScreenProps = {
  onSignedIn: () => Promise<void>;
  notify: (message: string, tone?: Toast["tone"]) => void;
};

export function LoginScreen({ onSignedIn, notify }: LoginScreenProps) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api("/api/auth/login", { method: "POST", body: JSON.stringify({ password }) });
      await onSignedIn();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Sign-in failed.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-layout">
      <div className="login-art" aria-hidden="true">
        <div className="price-contours"><i /><i /><i /><i /></div>
        <div className="login-brand"><LogoMark /><span>DRIFTLINE</span></div>
        <p>Signals measured from<br />the price that matters.</p>
      </div>
      <form className="login-card" onSubmit={(event) => void submit(event)}>
        <p className="eyebrow">PRIVATE LISTENER</p>
        <h1>Welcome back.</h1>
        <p>Your watch rules and purchase prices are protected behind this password.</p>
        <label>
          <span>App password</span>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required autoFocus />
        </label>
        <button className="primary-button full" disabled={busy}>
          {busy ? "Listening…" : "Open Driftline"}
          <ChevronRight size={18} />
        </button>
        <small><ShieldCheck size={14} /> Session stays signed in for 30 days on this device.</small>
      </form>
    </div>
  );
}
