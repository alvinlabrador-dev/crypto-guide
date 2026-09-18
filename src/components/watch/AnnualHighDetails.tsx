import { RefreshCw } from "lucide-react";
import { money, shortDate, signedPercent } from "../../lib/format";
import { percentFromAth } from "../../../shared/rules";
import type { AnnualHistoryState } from "../../types";
import "./watch.css";

type AnnualHighDetailsProps = {
  state: AnnualHistoryState;
  currentPrice: number | null;
};

export function AnnualHighDetails({ state, currentPrice }: AnnualHighDetailsProps) {
  if (state.status === "idle" || state.status === "loading") {
    return <div className="annual-history-state" aria-live="polite"><RefreshCw size={13} className="spin" /> Loading five-year highs…</div>;
  }
  if (state.status === "error") {
    return <div className="annual-history-state error" aria-live="polite">{state.message}</div>;
  }

  return (
    <div className="annual-history">
      <div className="annual-history-heading">
        <span>YEARLY HIGHS</span>
        <small>{state.data.sourceSymbol}</small>
      </div>
      <table>
        <thead><tr><th>Year</th><th>High</th><th>Now vs high</th></tr></thead>
        <tbody>
          {state.data.rows.map((row) => {
            const difference = percentFromAth(currentPrice, row.high);
            return (
              <tr key={row.year}>
                <th scope="row">{row.year}<small>{shortDate(row.highDate)}</small></th>
                <td>{money(row.high)}</td>
                <td className={difference !== null && difference >= 0 ? "positive" : "negative"}>{signedPercent(difference)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p>{state.data.rows.length < 5 ? `Only ${state.data.rows.length} year${state.data.rows.length === 1 ? "" : "s"} of market history are available. ` : ""}Daily USD highs from {state.data.source}.</p>
    </div>
  );
}
