import { TrendingDown, TrendingUp } from "lucide-react";
import { money, relativeTime } from "../../lib/format";
import type { AlertEvent } from "../../../shared/types";
import "./history.css";

export function EventList({ events }: { events: AlertEvent[] }) {
  if (events.length === 0) {
    return <div className="event-empty">Signals and position changes will appear here.</div>;
  }

  return (
    <div className="event-list">
      {events.map((event) => (
        <div className="event-row" key={event.id}>
          <span className={`event-icon type-${event.eventType}`}>
            {event.eventType.includes("sell") || event.eventType === "sold" ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
          </span>
          <div>
            <strong>{event.coinName} · {event.eventType.replaceAll("_", " ")}</strong>
            <small>{event.note ?? (event.price ? money(event.price) : "Status changed")}</small>
          </div>
          <time>{relativeTime(event.createdAt)}</time>
        </div>
      ))}
    </div>
  );
}
