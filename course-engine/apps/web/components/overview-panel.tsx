import Link from "next/link";
import { AlertTriangle, BookOpen, CalendarDays, Files } from "lucide-react";
import { SourceStatusBadge } from "./source-status";
import type { Course, Event, Review } from "./workspace-types";

function Metric({ label, value, icon, note }: { label: string; value: number; icon: React.ReactNode; note: string }) {
  return <article className="panel p-5"><div className="flex items-center justify-between"><span className="eyebrow">{label}</span><span className="text-[color:var(--semester-700)]">{icon}</span></div><p className="mono mt-4 text-3xl font-semibold">{value}</p><p className="muted mt-2 text-xs">{note}</p></article>;
}

export function OverviewPanel({ course, events, reviews }: { course: Course; events: Event[]; reviews: Review[] }) {
  const unresolved = reviews.filter((item) => item.status === "needs_review");
  return <>
    <section aria-label="Course status" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Metric icon={<Files aria-hidden="true" />} label="Original files" note="Preserved source records" value={course.counts.files} />
      <Metric icon={<AlertTriangle aria-hidden="true" />} label="Needs review" note="Uncertainty before action" value={unresolved.length} />
      <Metric icon={<BookOpen aria-hidden="true" />} label="Study assets" note="Generated records only" value={course.counts.study_assets} />
      <Metric icon={<CalendarDays aria-hidden="true" />} label="Calendar items" note="Confirmed and review states" value={course.counts.calendar_events} />
    </section>
    <section className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
      <article className="panel overflow-hidden">
        <header className="border-b border-[color:var(--border-default)] p-6"><p className="eyebrow">What is due next</p><h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold">Course calendar</h2></header>
        <div className="divide-y divide-[color:var(--border-default)]">
          {events.slice(0, 5).map((event) => <div className="grid gap-3 p-5 sm:grid-cols-[1fr_auto] sm:items-center" key={event.id}><div><h3 className="font-medium">{event.title}</h3><p className="muted mono mt-1 text-xs">{event.event_date ?? event.start_at ?? "Date needs review"}{event.time_unspecified ? " · Time unspecified" : ""}</p></div><SourceStatusBadge detail="This calendar record carries its stored review state." status={event.status} /></div>)}
          {!events.length ? <p className="muted p-6 text-sm">No published events. Ambiguous dates remain in Review until confirmed.</p> : null}
        </div>
      </article>
      <article className="panel p-6">
        <p className="eyebrow">Primary action</p><h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold">{unresolved.length ? `Review ${unresolved.length} uncertain ${unresolved.length === 1 ? "item" : "items"}` : "Source review is clear"}</h2>
        <p className="muted reading-width mt-3 text-sm">{unresolved.length ? "These records may affect deadlines or study materials. Check the source before relying on them." : "New conflicts, low-confidence extraction, and unreadable source sections will appear here."}</p>
        <Link className="button button-primary mt-6 no-underline" href={`/courses/${course.id}/review`}>{unresolved.length ? "Open review queue" : "View source status"}</Link>
        <div className="mt-7 border-t border-[color:var(--border-default)] pt-5"><p className="eyebrow">Source line</p><p className="mt-2 text-sm"><strong>What is true:</strong> {course.counts.files} source {course.counts.files === 1 ? "file is" : "files are"} recorded.</p><p className="mt-2 text-sm"><strong>What that means:</strong> Study assets can be traced to stored course evidence.</p><p className="mt-2 text-sm"><strong>What you can do:</strong> Review uncertain extraction before using it.</p></div>
      </article>
    </section>
  </>;
}
