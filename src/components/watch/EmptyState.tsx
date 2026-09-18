import { Plus, TrendingDown } from "lucide-react";
import "./watch.css";

export function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="empty-state">
      <div className="empty-instrument"><TrendingDown size={30} /><span>−40%</span><i /></div>
      <div>
        <h3>Your first line starts with a coin.</h3>
        <p>Add Bitcoin, Ethereum, or another CoinLore-listed asset. The first sweep will calculate its live ATH distance.</p>
      </div>
      <button className="secondary-button" onClick={onAdd}><Plus size={17} /> Build first watcher</button>
    </div>
  );
}
