import { Check, X } from "lucide-react";
import { useState } from "react";
import type { Alert } from "../../../shared/types";
import "./modals.css";

type TradeDialogProps = {
  mode: "purchase" | "sale";
  alert: Alert;
  busy: boolean;
  onClose: () => void;
  onSubmit: (body: { price: number; quantity: number | null; date: string | null }) => Promise<void>;
};

export function TradeDialog({ mode, alert, busy, onClose, onSubmit }: TradeDialogProps) {
  const [price, setPrice] = useState(alert.lastPrice?.toString() ?? "");
  const [quantity, setQuantity] = useState(alert.purchaseQuantity?.toString() ?? "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <form
        className="modal-sheet compact"
        role="dialog"
        aria-modal="true"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit({ price: Number(price), quantity: quantity ? Number(quantity) : null, date: date || null });
        }}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">{alert.symbol.toUpperCase()} · {mode === "purchase" ? "NEW POSITION" : "CLOSE POSITION"}</p>
            <h2>{mode === "purchase" ? "Record purchase" : "Record sale"}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose}><X size={20} /></button>
        </div>
        <p className="dialog-copy">Use the actual filled price. Driftline will use it for purchase-price comparisons.</p>
        <div className="purchase-fields">
          <label>
            <span>{mode === "purchase" ? "Purchase" : "Sale"} price (USD)</span>
            <input type="number" min="0" step="any" value={price} onChange={(event) => setPrice(event.target.value)} required autoFocus />
          </label>
          {mode === "purchase" && (
            <label>
              <span>Quantity <em>optional</em></span>
              <input type="number" min="0" step="any" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
            </label>
          )}
          {mode === "purchase" && (
            <label>
              <span>Purchase date</span>
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </label>
          )}
        </div>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
          <button className="primary-button" disabled={busy}>{busy ? "Saving…" : mode === "purchase" ? "Activate sell line" : "Mark sold"}<Check size={17} /></button>
        </div>
      </form>
    </div>
  );
}
