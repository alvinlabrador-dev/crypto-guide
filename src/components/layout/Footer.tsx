import { ShieldCheck } from "lucide-react";
import "./Footer.css";

export function Footer() {
  return (
    <footer>
      <span><ShieldCheck size={15} /> Alerts only — Driftline never places trades.</span>
      <span>
        Live prices and ATH by <a href="https://www.coinlore.com/cryptocurrency-data-api" target="_blank" rel="noreferrer">CoinLore</a>
        {" "}· annual highs by <a href="https://finance.yahoo.com/markets/crypto/all/" target="_blank" rel="noreferrer">Yahoo Finance</a>.
      </span>
    </footer>
  );
}
