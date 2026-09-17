import { Download, LogOut, Menu } from "lucide-react";
import { LogoMark } from "../brand/LogoMark";
import "./Topbar.css";

type TopbarProps = {
  busy: boolean;
  onInstall: () => void;
  onShowActivity: () => void;
  onSignOut: () => void;
};

export function Topbar({ busy, onInstall, onShowActivity, onSignOut }: TopbarProps) {
  return (
    <header className="topbar">
      <a className="brand" href="/" aria-label="Driftline home">
        <LogoMark />
        <span>DRIFTLINE</span>
      </a>
      <div className="topbar-actions">
        <button className="icon-button" onClick={onInstall} aria-label="Install app" title="Install app">
          <Download size={18} />
        </button>
        <nav className="topbar-nav" aria-label="Account">
          <button className="icon-button" onClick={onShowActivity} aria-label="Show activity" title="Activity">
            <Menu size={19} />
          </button>
          <button className="icon-button" onClick={onSignOut} disabled={busy} aria-label="Sign out" title="Sign out">
            <LogOut size={16} />
          </button>
        </nav>
      </div>
    </header>
  );
}
