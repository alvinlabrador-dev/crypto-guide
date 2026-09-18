import { Plus } from "lucide-react";
import type { Alert } from "../../../shared/types";
import { AlertCard } from "./AlertCard";
import { EmptyState } from "./EmptyState";
import "./watch.css";

type WatchSectionProps = {
  alerts: Alert[];
  busy: boolean;
  onAdd: () => void;
  onEdit: (alert: Alert) => void;
  onPurchase: (alert: Alert) => void;
  onSale: (alert: Alert) => void;
  onAction: (path: string, label: string) => void;
  onDelete: (alert: Alert) => void;
};

export function WatchSection({ alerts, busy, onAdd, onEdit, onPurchase, onSale, onAction, onDelete }: WatchSectionProps) {
  return (
    <section className="watch-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">YOUR LINES</p>
          <h2>Market watch</h2>
        </div>
        <button className="primary-button" onClick={onAdd}>
          <Plus size={18} /> Add a coin
        </button>
      </div>

      {alerts.length === 0 ? (
        <EmptyState onAdd={onAdd} />
      ) : (
        <div className="watch-grid">
          {alerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              busy={busy}
              onEdit={() => onEdit(alert)}
              onPurchase={() => onPurchase(alert)}
              onSale={() => onSale(alert)}
              onAction={onAction}
              onDelete={() => onDelete(alert)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
