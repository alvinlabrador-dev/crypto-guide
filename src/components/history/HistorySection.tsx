import { Activity, ChevronRight } from "lucide-react";
import type { AlertEvent } from "../../../shared/types";
import { EventList } from "./EventList";
import "./history.css";

type HistorySectionProps = {
  events: AlertEvent[];
  open: boolean;
  flash: boolean;
  onToggle: () => void;
};

export function HistorySection({ events, open, flash, onToggle }: HistorySectionProps) {
  return (
    <section
      id="signal-log"
      className={`history-section${open ? " open" : ""}${flash ? " flash" : ""}`}
    >
      <button className="history-toggle" onClick={onToggle} aria-expanded={open}>
        <span><Activity size={18} /> Signal log</span>
        <span>{events.length} events <ChevronRight size={18} /></span>
      </button>
      {open && <EventList events={events} />}
    </section>
  );
}
