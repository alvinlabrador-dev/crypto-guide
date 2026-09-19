import { TrendingDown, TrendingUp } from "lucide-react";
import type { OffsetDirection, PriceRule, ReferenceKind } from "../../../shared/types";
import "./modals.css";

type RuleFieldsProps = {
  kind: "buy" | "sell";
  value: PriceRule;
  onChange: (rule: PriceRule) => void;
};

export function RuleFields({ kind, value, onChange }: RuleFieldsProps) {
  return (
    <div className={`rule-builder ${kind}`}>
      <div className="rule-builder-heading">
        <span className="rule-icon">{kind === "buy" ? <TrendingDown size={17} /> : <TrendingUp size={17} />}</span>
        <div>
          <strong>{kind === "buy" ? "Buy line" : "Sell line"}</strong>
          <small>{kind === "buy" ? "Alerts when price falls to this line" : "Alerts when price rises to this line"}</small>
        </div>
      </div>
      <div className="sentence-rule">
        <span>{kind === "buy" ? "Buy at" : "Sell at"}</span>
        <label>
          <span className="sr-only">Percentage</span>
          <input type="number" min="0" max="999" step="0.1" value={value.percent} onChange={(event) => onChange({ ...value, percent: Number(event.target.value) })} />
        </label>
        <span>%</span>
        <label>
          <span className="sr-only">Position</span>
          <select value={value.offset} onChange={(event) => onChange({ ...value, offset: event.target.value as OffsetDirection })}>
            <option value="below">below</option>
            <option value="above">above</option>
          </select>
        </label>
        <label>
          <span className="sr-only">Reference price</span>
          <select value={value.reference} onChange={(event) => onChange({ ...value, reference: event.target.value as ReferenceKind })}>
            <option value="ath">all-time high</option>
            <option value="purchase">purchase price</option>
          </select>
        </label>
      </div>
    </div>
  );
}
