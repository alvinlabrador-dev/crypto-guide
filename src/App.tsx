import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "./api";
import { LoginScreen } from "./components/auth/LoginScreen";
import { LoadingScreen } from "./components/auth/LoadingScreen";
import { SetupScreen } from "./components/auth/SetupScreen";
import { CommandDeck } from "./components/dashboard/CommandDeck";
import { StatusStrip } from "./components/dashboard/StatusStrip";
import { HistorySection } from "./components/history/HistorySection";
import { Footer } from "./components/layout/Footer";
import { ToastStack } from "./components/layout/ToastStack";
import { Topbar } from "./components/layout/Topbar";
import { AlertComposer } from "./components/modals/AlertComposer";
import { TradeDialog } from "./components/modals/TradeDialog";
import { WatchSection } from "./components/watch/WatchSection";
import { base64UrlToArrayBuffer } from "./lib/push";
import type { AuthState, BeforeInstallPromptEvent, Toast } from "./types";
import type { Alert, BootstrapData } from "../shared/types";

const emptyBootstrap: BootstrapData = {
  alerts: [],
  events: [],
  lastSweep: null,
  vapidPublicKey: null,
  pushConfigured: false,
};

function App() {
  const [auth, setAuth] = useState<AuthState>("loading");
  const [data, setData] = useState<BootstrapData>(emptyBootstrap);
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [composer, setComposer] = useState<{ open: boolean; editing: Alert | null }>({ open: false, editing: null });
  const [purchaseAlert, setPurchaseAlert] = useState<Alert | null>(null);
  const [saleAlert, setSaleAlert] = useState<Alert | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [activityFlash, setActivityFlash] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [pushState, setPushState] = useState<"idle" | "enabled" | "unsupported" | "denied">("idle");

  const notify = useCallback((message: string, tone: Toast["tone"] = "success") => {
    const id = Date.now();
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4200);
  }, []);

  const loadBootstrap = useCallback(async () => {
    const next = await api<BootstrapData>("/api/bootstrap");
    setData(next);
  }, []);

  useEffect(() => {
    const initialize = async () => {
      try {
        const session = await api<{ authenticated: boolean; configured: boolean }>("/api/auth/session");
        if (!session.configured) {
          setAuth("unconfigured");
          return;
        }
        if (!session.authenticated) {
          setAuth("signed-out");
          return;
        }
        setAuth("signed-in");
        await loadBootstrap();
      } catch (error) {
        setAuth("signed-out");
        notify(error instanceof Error ? error.message : "Could not reach Driftline.", "error");
      }
    };
    void initialize();
  }, [loadBootstrap, notify]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js");
    }
    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onInstallPrompt);
  }, []);

  useEffect(() => {
    if (!("Notification" in window) || !("PushManager" in window)) {
      setPushState("unsupported");
    } else if (Notification.permission === "denied") {
      setPushState("denied");
    } else if (Notification.permission === "granted") {
      void navigator.serviceWorker.ready.then(async (registration) => {
        if (await registration.pushManager.getSubscription()) setPushState("enabled");
      });
    }
  }, [auth]);

  const runAction = useCallback(async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await action();
      await loadBootstrap();
      notify(success);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) setAuth("signed-out");
      notify(error instanceof Error ? error.message : "Action failed.", "error");
    } finally {
      setBusy(false);
    }
  }, [loadBootstrap, notify]);

  const enablePush = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setPushState("unsupported");
      notify("Web push is unavailable here. On iPhone, install Driftline to the Home Screen first.", "error");
      return;
    }
    if (Notification.permission === "denied") {
      setPushState("denied");
      notify("Notifications are blocked. Allow them in this site's browser settings, then try again.", "error");
      return;
    }
    setBusy(true);
    try {
      const latest = await api<BootstrapData>("/api/bootstrap");
      setData(latest);
      if (!latest.pushConfigured || !latest.vapidPublicKey) {
        throw new Error("Push keys are unavailable. Refresh the app and try again.");
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushState(permission === "denied" ? "denied" : "idle");
        if (permission === "denied") notify("Notifications were blocked. You can allow them later in the browser's site settings.", "error");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToArrayBuffer(latest.vapidPublicKey),
      });
      const serialized = subscription.toJSON();
      if (!serialized.endpoint || !serialized.keys?.p256dh || !serialized.keys.auth) {
        throw new Error("The browser returned an incomplete push subscription.");
      }
      await api("/api/push/subscribe", {
        method: "POST",
        body: JSON.stringify({ endpoint: serialized.endpoint, keys: serialized.keys }),
      });
      setPushState("enabled");
      notify("Notifications enabled on this device.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not enable notifications.", "error");
    } finally {
      setBusy(false);
    }
  };

  const refresh = () => runAction(
    () => api("/api/refresh", { method: "POST", body: "{}" }),
    "Prices checked.",
  );

  const install = async () => {
    if (!installPrompt) {
      notify("On iPhone, use Share → Add to Home Screen. On desktop, use the install icon in the address bar.", "error");
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") notify("Driftline installed.");
    setInstallPrompt(null);
  };

  const signOut = async () => {
    setBusy(true);
    try {
      await api("/api/auth/logout", { method: "POST", body: "{}" });
      setAuth("signed-out");
      notify("Signed out.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not sign out.", "error");
    } finally {
      setBusy(false);
    }
  };

  const showActivity = () => {
    setHistoryOpen(true);
    setActivityFlash(true);
    window.setTimeout(() => {
      const section = document.getElementById("signal-log");
      if (!section) return;
      const top = section.getBoundingClientRect().top + window.scrollY - 12;
      window.scrollTo({ top, behavior: "smooth" });
    }, 80);
    window.setTimeout(() => setActivityFlash(false), 1600);
  };

  if (auth === "loading") return <LoadingScreen />;
  if (auth === "unconfigured") return <SetupScreen />;
  if (auth === "signed-out") {
    return <LoginScreen onSignedIn={async () => { setAuth("signed-in"); await loadBootstrap(); }} notify={notify} />;
  }

  const activeCount = data.alerts.filter((alert) => alert.status !== "paused").length;
  const signalCount = data.alerts.filter((alert) => ["buy_alerted", "sell_alerted"].includes(alert.status)).length;

  return (
    <div className="app-shell">
      <div className="ambient-grid" aria-hidden="true" />
      <Topbar busy={busy} onInstall={() => void install()} onShowActivity={showActivity} onSignOut={() => void signOut()} />

      <main>
        <CommandDeck lastSweep={data.lastSweep} busy={busy} onRefresh={() => void refresh()} />
        <StatusStrip
          tracked={data.alerts.length}
          listening={activeCount}
          signals={signalCount}
          busy={busy}
          pushState={pushState}
          onEnablePush={() => void enablePush()}
        />
        <WatchSection
          alerts={data.alerts}
          busy={busy}
          onAdd={() => setComposer({ open: true, editing: null })}
          onEdit={(alert) => setComposer({ open: true, editing: alert })}
          onPurchase={setPurchaseAlert}
          onSale={setSaleAlert}
          onAction={(path, label) => void runAction(() => api(path, { method: "POST", body: "{}" }), label)}
          onDelete={(alert) => {
            if (window.confirm(`Delete the ${alert.name} watcher and its history?`)) {
              void runAction(() => api(`/api/alerts/${alert.id}`, { method: "DELETE" }), `${alert.name} removed.`);
            }
          }}
        />
        <HistorySection
          events={data.events}
          open={historyOpen}
          flash={activityFlash}
          onToggle={() => setHistoryOpen((value) => !value)}
        />
        <Footer />
      </main>

      {composer.open && (
        <AlertComposer
          alert={composer.editing}
          busy={busy}
          onClose={() => setComposer({ open: false, editing: null })}
          onSaved={async (save) => {
            await runAction(save, composer.editing ? "Watcher updated." : "Watcher added.");
            setComposer({ open: false, editing: null });
          }}
        />
      )}
      {purchaseAlert && (
        <TradeDialog
          mode="purchase"
          alert={purchaseAlert}
          busy={busy}
          onClose={() => setPurchaseAlert(null)}
          onSubmit={async (body) => {
            await runAction(() => api(`/api/alerts/${purchaseAlert.id}/mark-bought`, { method: "POST", body: JSON.stringify(body) }), "Purchase recorded. Sell line is active.");
            setPurchaseAlert(null);
          }}
        />
      )}
      {saleAlert && (
        <TradeDialog
          mode="sale"
          alert={saleAlert}
          busy={busy}
          onClose={() => setSaleAlert(null)}
          onSubmit={async (body) => {
            await runAction(() => api(`/api/alerts/${saleAlert.id}/mark-sold`, { method: "POST", body: JSON.stringify({ price: body.price }) }), "Sale recorded. Buy line re-armed.");
            setSaleAlert(null);
          }}
        />
      )}

      <ToastStack toasts={toasts} />
    </div>
  );
}

export default App;
