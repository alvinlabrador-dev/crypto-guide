import { Activity, RefreshCw } from "lucide-react";
import { relativeTime } from "../../lib/format";
import "./dashboard.css";

type CommandDeckProps = {
  lastSweep: string | null;
  busy: boolean;
  onRefresh: () => void;
};

export function CommandDeck({ lastSweep, busy, onRefresh }: CommandDeckProps) {
  return (
    <section className="command-deck">
      <div className="command-copy">
        <p className="eyebrow"><span className="live-dot" /> PERSONAL MARKET LISTENER</p>
        <h1>Know the distance.<br /><span>Act on your line.</span></h1>
        <p className="lede">Set quiet, precise buy and sell signals from each coin’s all-time high or your own purchase price.</p>
      </div>
      <div className="sweep-panel">
        <div className="sweep-orbit" aria-hidden="true"><Activity size={28} /></div>
        <div>
          <span className="micro-label">LAST MARKET SWEEP</span>
          <strong>{relativeTime(lastSweep)}</strong>
          <small>{lastSweep ? new Date(lastSweep).toLocaleString() : "Waiting for first check"}</small>
        </div>
        <button className="refresh-button" disabled={busy} onClick={onRefresh}>
          <RefreshCw size={16} className={busy ? "spin" : ""} /> Check now
        </button>
      </div>
    </section>
  );
}
