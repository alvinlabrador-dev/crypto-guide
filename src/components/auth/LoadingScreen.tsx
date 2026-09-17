import { LogoMark } from "../brand/LogoMark";
import "./auth.css";

export function LoadingScreen() {
  return (
    <div className="center-screen">
      <LogoMark />
      <span className="micro-label">TUNING MARKET SIGNALS</span>
      <div className="loading-line"><i /></div>
    </div>
  );
}
