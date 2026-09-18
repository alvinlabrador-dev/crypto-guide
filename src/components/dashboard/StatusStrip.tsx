import { Bell, BellRing } from "lucide-react";
import "./dashboard.css";

type StatusStripProps = {
  tracked: number;
  listening: number;
  signals: number;
  busy: boolean;
  pushState: "idle" | "enabled" | "unsupported" | "denied";
  onEnablePush: () => void;
};

export function StatusStrip({ tracked, listening, signals, busy, pushState, onEnablePush }: StatusStripProps) {
  const pushLabel = pushState === "enabled"
    ? "Notifications on"
    : pushState === "denied"
      ? "Notifications blocked"
      : pushState === "unsupported"
        ? "Notifications unavailable"
        : "Enable notifications";

  return (
    <section className="status-strip" aria-label="Listener status">
      <div><span>TRACKED</span><strong>{String(tracked).padStart(2, "0")}</strong></div>
      <div><span>LISTENING</span><strong>{String(listening).padStart(2, "0")}</strong></div>
      <div className={signals > 0 ? "has-signal" : ""}><span>SIGNALS</span><strong>{String(signals).padStart(2, "0")}</strong></div>
      <div className="strip-action">
        <button className={pushState === "enabled" ? "text-action enabled" : "text-action"} onClick={onEnablePush} disabled={busy}>
          {pushState === "enabled" ? <BellRing size={17} /> : <Bell size={17} />}
          {pushLabel}
        </button>
      </div>
    </section>
  );
}
