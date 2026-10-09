import { EmptyState } from "./workspace-states";
import { SourceStatusBadge } from "./source-status";
import type { Event } from "./workspace-types";

export function CalendarPanel({ events }: { events: Event[] }) {
  if (!events.length) return <EmptyState detail="Confirmed dates appear here. Ambiguous dates remain in Review instead of being assigned an invented time." title="No calendar events" />;
  return <section className="panel overflow-hidden"><header className="border-b border-[color:var(--border-default)] p-6"><p className="eyebrow">Agenda</p><h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold">Course calendar</h2><p className="muted mt-2 text-sm">All-day work remains all-day when the source does not specify a time.</p></header><div className="divide-y divide-[color:var(--border-default)]">{events.map((event) => <article className="grid gap-4 p-5 md:grid-cols-[10rem_1fr_auto] md:items-center" key={event.id}><time className="mono text-sm text-[color:var(--semester-700)]">{event.event_date ?? event.start_at?.slice(0, 10) ?? "Unscheduled"}</time><div><h3 className="font-medium">{event.title}</h3><p className="muted mt-1 text-xs">{event.event_type.replaceAll("_", " ")}{event.time_unspecified ? " · Time unspecified" : ""}</p></div><SourceStatusBadge status={event.status} /></article>)}</div></section>;
}
