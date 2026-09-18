import { money } from "../../lib/format";
import type { AnnualHistoryState } from "../../types";
import { AnnualHighDetails } from "./AnnualHighDetails";
import "./watch.css";

type PriceRailMarkerProps = {
  alertId: string;
  kind: "ath" | "target" | "current";
  label: string;
  price: number;
  position: number;
  annualHistory?: AnnualHistoryState;
  currentPrice?: number | null;
  onReveal?: () => void;
};

export function PriceRailMarker({
  alertId,
  kind,
  label,
  price,
  position,
  annualHistory,
  currentPrice = null,
  onReveal,
}: PriceRailMarkerProps) {
  const edge = position < 15 ? "edge-left" : position > 85 ? "edge-right" : "";
  const tooltipId = `rail-tooltip-${alertId}-${kind}`;

  return (
    <span
      className={`rail-marker ${kind} ${edge}`}
      style={{ left: `${position}%` }}
      tabIndex={0}
      aria-describedby={tooltipId}
      aria-label={`${label} price ${money(price)}`}
      onPointerEnter={onReveal}
      onFocus={onReveal}
    >
      <span className={`rail-tooltip ${annualHistory ? "annual-history-tooltip" : ""}`} id={tooltipId} role="tooltip">
        <span>{label}</span>
        <strong>{money(price)}</strong>
        {annualHistory && <AnnualHighDetails state={annualHistory} currentPrice={currentPrice} />}
      </span>
      <i aria-hidden="true" />
      <span className="rail-marker-label" aria-hidden="true">{label}</span>
    </span>
  );
}
