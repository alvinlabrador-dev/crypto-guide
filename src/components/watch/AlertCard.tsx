import {
  Activity,
  ChevronRight,
  MoreHorizontal,
  Pause,
  Pencil,
  RotateCcw,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { api } from "../../api";
import { money, relativeTime, ruleText, statusLabels } from "../../lib/format";
import { calculateTarget } from "../../../shared/rules";
import type { Alert, AnnualHighHistory } from "../../../shared/types";
import type { AnnualHistoryState } from "../../types";
import { PriceRailMarker } from "./PriceRailMarker";
import "./watch.css";

type AlertCardProps = {
  alert: Alert;
  busy: boolean;
  onEdit: () => void;
  onPurchase: () => void;
  onSale: () => void;
  onAction: (path: string, label: string) => void;
  onDelete: () => void;
};

export function AlertCard({ alert, busy, onEdit, onPurchase, onSale, onAction, onDelete }: AlertCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [annualHistory, setAnnualHistory] = useState<AnnualHistoryState>({ status: "idle" });
  const buyTarget = calculateTarget(alert.buyRule, alert.allTimeHigh, alert.purchasePrice);
  const sellTarget = calculateTarget(alert.sellRule, alert.allTimeHigh, alert.purchasePrice);
  const target = ["holding", "sell_alerted"].includes(alert.status) ? sellTarget : buyTarget;
  const current = alert.lastPrice;
  const ath = alert.allTimeHigh;
  const drawdown = current !== null && ath ? (current / ath - 1) * 100 : null;
  const scaleTop = Math.max(ath ?? 0, target ?? 0, current ?? 0, 1);
  const currentPos = current === null ? 0 : Math.min(100, Math.max(2, current / scaleTop * 100));
  const targetPos = target === null ? 0 : Math.min(100, Math.max(2, target / scaleTop * 100));
  const isSignal = alert.status === "buy_alerted" || alert.status === "sell_alerted";

  const revealAnnualHistory = () => {
    if (annualHistory.status !== "idle") return;
    setAnnualHistory({ status: "loading" });
    void api<AnnualHighHistory>(`/api/alerts/${alert.id}/annual-highs`)
      .then((history) => setAnnualHistory({ status: "ready", data: history }))
      .catch((error: unknown) => setAnnualHistory({
        status: "error",
        message: error instanceof Error ? error.message : "Five-year history could not be loaded.",
      }));
  };

  return (
    <article className={`watch-card status-${alert.status}`} id={`alert-${alert.id}`}>
      <div className="card-topline">
        <div className="coin-ident">
          {alert.imageUrl ? <img src={alert.imageUrl} alt="" /> : <span className="coin-fallback">{alert.symbol.slice(0, 1)}</span>}
          <div><h3>{alert.name}</h3><span>{alert.symbol.toUpperCase()} / USD</span></div>
        </div>
        <div className="card-menu-wrap">
          <button className="icon-button small" onClick={() => setMenuOpen((value) => !value)} aria-label={`Actions for ${alert.name}`}>
            <MoreHorizontal size={19} />
          </button>
          {menuOpen && (
            <div className="card-menu">
              <button onClick={() => { onEdit(); setMenuOpen(false); }}><Pencil size={15} /> Edit lines</button>
              {alert.status === "paused"
                ? <button onClick={() => onAction(`/api/alerts/${alert.id}/resume`, `${alert.name} resumed.`)}><Activity size={15} /> Resume</button>
                : <button onClick={() => onAction(`/api/alerts/${alert.id}/pause`, `${alert.name} paused.`)}><Pause size={15} /> Pause</button>}
              <button className="danger" onClick={onDelete}><Trash2 size={15} /> Delete</button>
            </div>
          )}
        </div>
      </div>

      <div className="price-row">
        <div><span className="micro-label">CURRENT PRICE</span><strong>{money(current)}</strong></div>
        <span className={`status-chip ${isSignal ? "pulse" : ""}`}>{statusLabels[alert.status]}</span>
      </div>

      <div className="distance-readout">
        <span>Distance from ATH</span>
        <strong className={drawdown !== null && drawdown >= 0 ? "positive" : "negative"}>{drawdown === null ? "—" : `${drawdown.toFixed(1)}%`}</strong>
      </div>

      <div className="price-rail" aria-label={`Current price ${money(current)}, target ${money(target)}, all-time high ${money(ath)}`}>
        <div className="rail-line" />
        {ath !== null && <PriceRailMarker alertId={alert.id} kind="ath" label="ATH" price={ath} position={Math.min(98, ath / scaleTop * 100)} annualHistory={annualHistory} currentPrice={current} onReveal={revealAnnualHistory} />}
        {target !== null && <PriceRailMarker alertId={alert.id} kind="target" label="TARGET" price={target} position={targetPos} />}
        {current !== null && <PriceRailMarker alertId={alert.id} kind="current" label="NOW" price={current} position={currentPos} />}
      </div>

      <div className="rule-grid">
        <div className={["watching_buy", "buy_alerted"].includes(alert.status) ? "active" : ""}>
          <span><TrendingDown size={14} /> BUY LINE</span>
          <strong>{money(buyTarget)}</strong>
          <small>{ruleText(alert.buyRule)}</small>
        </div>
        <div className={["holding", "sell_alerted"].includes(alert.status) ? "active" : ""}>
          <span><TrendingUp size={14} /> SELL LINE</span>
          <strong>{money(sellTarget)}</strong>
          <small>{ruleText(alert.sellRule)}</small>
        </div>
      </div>

      {alert.purchasePrice !== null && (
        <div className="position-line">
          <span>Entry {money(alert.purchasePrice)}{alert.purchaseQuantity ? ` · ${alert.purchaseQuantity} ${alert.symbol.toUpperCase()}` : ""}</span>
          {current !== null && <strong className={current >= alert.purchasePrice ? "positive" : "negative"}>{((current / alert.purchasePrice - 1) * 100).toFixed(2)}%</strong>}
        </div>
      )}

      <div className="card-footer">
        <span>Checks every {alert.checkIntervalMinutes} min · {relativeTime(alert.lastCheckedAt)}</span>
        {alert.status === "watching_buy" && <button disabled={busy} onClick={onPurchase}>I already bought <ChevronRight size={15} /></button>}
        {alert.status === "buy_alerted" && (
          <>
            <button disabled={busy} onClick={() => onAction(`/api/alerts/${alert.id}/rearm`, "Buy line re-armed.")}><RotateCcw size={14} /> Re-arm</button>
            <button className="signal-action" disabled={busy} onClick={onPurchase}>Record purchase <ChevronRight size={15} /></button>
          </>
        )}
        {alert.status === "holding" && <button disabled={busy} onClick={onSale}>Mark sold <ChevronRight size={15} /></button>}
        {alert.status === "sell_alerted" && <button className="signal-action" disabled={busy} onClick={onSale}>Record sale <ChevronRight size={15} /></button>}
        {alert.status === "paused" && <button disabled={busy} onClick={() => onAction(`/api/alerts/${alert.id}/resume`, `${alert.name} resumed.`)}>Resume <ChevronRight size={15} /></button>}
      </div>
    </article>
  );
}
