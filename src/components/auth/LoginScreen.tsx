import { SignIn, useAuth, useClerk } from "@clerk/react";
import { ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../api";
import type { Toast } from "../../types";
import { LogoMark } from "../brand/LogoMark";
import "./auth.css";

type LoginScreenProps = {
  onSignedIn: () => Promise<void>;
  notify: (message: string, tone?: Toast["tone"]) => void;
};

export function LoginScreen({ onSignedIn, notify }: LoginScreenProps) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { signOut } = useClerk();
  const [busy, setBusy] = useState(false);
  const exchanging = useRef(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || exchanging.current) return;
    exchanging.current = true;
    setBusy(true);
    void (async () => {
      try {
        const clerkToken = await getToken();
        if (!clerkToken) throw new Error("Clerk session is missing.");
        await api("/api/auth/login", { method: "POST", body: JSON.stringify({ clerkToken }) });
        await onSignedIn();
      } catch (error) {
        exchanging.current = false;
        await signOut();
        notify(error instanceof Error ? error.message : "Sign-in failed.", "error");
      } finally {
        setBusy(false);
      }
    })();
  }, [getToken, isLoaded, isSignedIn, notify, onSignedIn, signOut]);

  return (
    <div className="login-layout">
      <div className="login-art" aria-hidden="true">
        <div className="price-contours"><i /><i /><i /><i /></div>
        <div className="login-brand"><LogoMark /><span>DRIFTLINE</span></div>
        <p>Signals measured from<br />the price that matters.</p>
      </div>
      <div className="login-card">
        <p className="eyebrow">PRIVATE LISTENER</p>
        <h1>Welcome back.</h1>
        <p>Sign in with email or phone. Only allowlisted emails can open Driftline.</p>
        {isSignedIn || busy ? (
          <p className="login-status">{busy ? "Checking access…" : "Connecting…"}</p>
        ) : (
          <SignIn
            routing="hash"
            fallbackRedirectUrl="/"
            appearance={{
              variables: {
                colorPrimary: "#1c6e78",
                colorForeground: "#123331",
                colorBackground: "#f8fbf9",
                colorInput: "#f8fbf9",
                colorDanger: "#c8432e",
                fontFamily: "\"Archivo Variable\", Arial, sans-serif",
                borderRadius: "0px",
              },
              elements: {
                rootBox: { width: "100%" },
                cardBox: { boxShadow: "none", width: "100%" },
                card: { boxShadow: "none", border: "1px solid #c7d6d1", background: "#f8fbf9" },
                headerTitle: { display: "none" },
                headerSubtitle: { display: "none" },
                footer: { background: "transparent" },
              },
            }}
          />
        )}
        <small><ShieldCheck size={14} /> Session stays signed in for 30 days on this device.</small>
      </div>
    </div>
  );
}
