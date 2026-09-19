import { Activity, ChevronRight, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../api";
import type { Alert, CoinSearchResult, PriceRule } from "../../../shared/types";
import { RuleFields } from "./RuleFields";
import "./modals.css";

type AlertComposerProps = {
  alert: Alert | null;
  busy: boolean;
  onClose: () => void;
  onSaved: (save: () => Promise<unknown>) => Promise<void>;
};

export function AlertComposer({ alert, busy, onClose, onSaved }: AlertComposerProps) {
  const [step, setStep] = useState(alert ? 2 : 1);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CoinSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<CoinSearchResult | null>(alert ? { id: alert.coinId, name: alert.name, symbol: alert.symbol, thumb: alert.imageUrl, marketCapRank: null } : null);
  const [buyRule, setBuyRule] = useState<PriceRule>(alert?.buyRule ?? { reference: "ath", offset: "below", percent: 40 });
  const [sellRule, setSellRule] = useState<PriceRule>(alert?.sellRule ?? { reference: "purchase", offset: "above", percent: 5 });
  const [interval, setIntervalValue] = useState(alert?.checkIntervalMinutes ?? 5);
  const [trackFrom, setTrackFrom] = useState<"watching_buy" | "holding">(alert?.status === "holding" || alert?.status === "sell_alerted" ? "holding" : "watching_buy");
  const [purchasePrice, setPurchasePrice] = useState(alert?.purchasePrice?.toString() ?? "");
  const [purchaseQuantity, setPurchaseQuantity] = useState(alert?.purchaseQuantity?.toString() ?? "");
  const [purchaseDate, setPurchaseDate] = useState(alert?.purchaseDate ?? new Date().toISOString().slice(0, 10));
  const [error, setError] = useState("");

  useEffect(() => {
    if (alert || query.trim().length < 2) {
      if (query.trim().length < 2) setResults([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await api<{ coins: CoinSearchResult[] }>(`/api/coins/search?q=${encodeURIComponent(query)}`);
        setResults(response.coins);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Coin search failed.");
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [query, alert]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) {
      setError("Choose a coin first.");
      setStep(1);
      return;
    }
    if ((trackFrom === "holding" || buyRule.reference === "purchase") && !Number(purchasePrice)) {
      setError("Enter the purchase price used by this rule.");
      return;
    }
    const payload = {
      buyRule,
      sellRule,
      checkIntervalMinutes: interval,
      ...(!alert ? {
        coinId: selected.id,
        symbol: selected.symbol,
        name: selected.name,
        imageUrl: selected.thumb,
        trackFrom,
        purchasePrice: purchasePrice ? Number(purchasePrice) : null,
        purchaseQuantity: purchaseQuantity ? Number(purchaseQuantity) : null,
        purchaseDate: purchasePrice ? purchaseDate : null,
      } : {}),
    };
    await onSaved(() => api(alert ? `/api/alerts/${alert.id}` : "/api/alerts", {
      method: alert ? "PATCH" : "POST",
      body: JSON.stringify(payload),
    }));
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className="modal-sheet" role="dialog" aria-modal="true" aria-labelledby="composer-title">
        <div className="modal-header">
          <div>
            <p className="eyebrow">{alert ? "ADJUST WATCHER" : `NEW WATCHER · ${step}/2`}</p>
            <h2 id="composer-title">{step === 1 ? "Choose a market" : "Draw the signal lines"}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>

        {step === 1 ? (
          <div className="coin-picker">
            <label className="search-field">
              <Search size={18} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Bitcoin, ETH, Solana…" autoFocus />
              <span>{searching ? "Searching" : "Public data"}</span>
            </label>
            <div className="search-results">
              {results.map((coin) => (
                <button key={coin.id} onClick={() => { setSelected(coin); setStep(2); setError(""); }}>
                  {coin.thumb ? <img src={coin.thumb} alt="" /> : <span className="coin-fallback">{coin.symbol.slice(0, 1)}</span>}
                  <span>
                    <strong>{coin.name}</strong>
                    <small>{coin.symbol} {coin.marketCapRank ? `· Rank #${coin.marketCapRank}` : ""}</small>
                  </span>
                  <ChevronRight size={18} />
                </button>
              ))}
              {!searching && query.trim().length < 2 && <div className="search-hint"><Search size={24} /><p>Type at least two characters to find a coin.</p></div>}
              {!searching && query.trim().length >= 2 && results.length === 0 && <div className="search-hint"><p>No matching coins. Try the full name or ticker.</p></div>}
            </div>
            {error && <p className="form-error">{error}</p>}
          </div>
        ) : (
          <form className="rule-form" onSubmit={(event) => void submit(event)}>
            {selected && (
              <div className="selected-coin">
                {selected.thumb ? <img src={selected.thumb} alt="" /> : <span className="coin-fallback">{selected.symbol.slice(0, 1)}</span>}
                <div><strong>{selected.name}</strong><small>{selected.symbol.toUpperCase()} / USD</small></div>
                {!alert && <button type="button" onClick={() => setStep(1)}>Change</button>}
              </div>
            )}
            <RuleFields kind="buy" value={buyRule} onChange={setBuyRule} />
            <RuleFields kind="sell" value={sellRule} onChange={setSellRule} />

            {!alert && (
              <div className="field-group">
                <span className="field-label">Starting point</span>
                <div className="segmented">
                  <button type="button" className={trackFrom === "watching_buy" ? "selected" : ""} onClick={() => setTrackFrom("watching_buy")}>Waiting to buy</button>
                  <button type="button" className={trackFrom === "holding" ? "selected" : ""} onClick={() => setTrackFrom("holding")}>I already own it</button>
                </div>
              </div>
            )}

            {!alert && (trackFrom === "holding" || buyRule.reference === "purchase") && (
              <div className="purchase-fields">
                <label><span>Purchase price (USD)</span><input type="number" min="0" step="any" value={purchasePrice} onChange={(event) => setPurchasePrice(event.target.value)} placeholder="0.00" required /></label>
                <label><span>Quantity <em>optional</em></span><input type="number" min="0" step="any" value={purchaseQuantity} onChange={(event) => setPurchaseQuantity(event.target.value)} placeholder="0" /></label>
                <label><span>Purchase date</span><input type="date" value={purchaseDate} onChange={(event) => setPurchaseDate(event.target.value)} /></label>
              </div>
            )}

            <label className="interval-field">
              <span>
                <strong>Check frequency</strong>
                <small>One keyless batch price request serves the whole watchlist.</small>
              </span>
              <select value={interval} onChange={(event) => setIntervalValue(Number(event.target.value))}>
                <option value={5}>Every 5 min</option>
                <option value={10}>Every 10 min</option>
                <option value={15}>Every 15 min</option>
                <option value={30}>Every 30 min</option>
                <option value={60}>Every hour</option>
                <option value={360}>Every 6 hours</option>
                <option value={1440}>Every day</option>
              </select>
            </label>
            {error && <p className="form-error">{error}</p>}
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
              <button className="primary-button" disabled={busy}>{busy ? "Saving…" : alert ? "Save changes" : "Start listening"}<Activity size={17} /></button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
