"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CalendarClock, PencilLine, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { SourceStatusBadge } from "./source-status";
import { EmptyState } from "./workspace-states";
import type { Event } from "./workspace-types";

type CalendarPayload = {
  title: string;
  event_type: string;
  start_at: string | null;
  end_at: string | null;
  event_date: string | null;
  all_day: boolean;
  time_unspecified: boolean;
  status: "confirmed" | "needs_review" | "rejected";
};

type Draft = { title: string; eventType: string; date: string; time: string; status: CalendarPayload["status"] };

function eventDraft(event: Event): Draft {
  return {
    title: event.title,
    eventType: event.event_type,
    date: event.event_date ?? event.start_at?.slice(0, 10) ?? "",
    time: event.time_unspecified ? "" : event.start_at?.slice(11, 16) ?? "",
    status: event.status as Draft["status"],
  };
}

function eventPayload(event: Event): CalendarPayload {
  return {
    title: event.title,
    event_type: event.event_type,
    start_at: event.start_at ?? null,
    end_at: event.end_at ?? null,
    event_date: event.event_date ?? null,
    all_day: event.all_day ?? Boolean(event.event_date),
    time_unspecified: event.time_unspecified,
    status: event.status as CalendarPayload["status"],
  };
}

function draftPayload(draft: Draft, original: Event): CalendarPayload {
  const hasTime = Boolean(draft.date && draft.time);
  const before = eventDraft(original);
  const temporalChanged = before.date !== draft.date || before.time !== draft.time;
  const newStart = hasTime && temporalChanged ? new Date(`${draft.date}T${draft.time}:00`) : null;
  const originalDuration = original.start_at && original.end_at ? Date.parse(original.end_at) - Date.parse(original.start_at) : null;
  return {
    title: draft.title.trim(),
    event_type: draft.eventType.trim(),
    start_at: hasTime ? newStart?.toISOString() ?? original.start_at ?? `${draft.date}T${draft.time}:00` : null,
    end_at: hasTime && temporalChanged && newStart && originalDuration !== null
      ? new Date(newStart.getTime() + originalDuration).toISOString()
      : hasTime ? original.end_at ?? null : null,
    event_date: hasTime ? null : draft.date || null,
    all_day: Boolean(draft.date && !hasTime),
    time_unspecified: Boolean(draft.date && !hasTime),
    status: draft.status,
  };
}

export function CalendarPanel({ courseId, events }: { courseId: string; events: Event[] }) {
  const client = useQueryClient();
  const [editing, setEditing] = useState<Event | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [undo, setUndo] = useState<{ id: string; payload: CalendarPayload } | null>(null);
  const changes = useMemo(() => {
    if (!editing || !draft) return [];
    const before = eventDraft(editing);
    return (["title", "eventType", "date", "time", "status"] as const)
      .filter((key) => before[key] !== draft[key])
      .map((key) => ({ field: key === "eventType" ? "Type" : key[0].toUpperCase() + key.slice(1), before: before[key] || "Unspecified", after: draft[key] || "Unspecified" }));
  }, [draft, editing]);

  function beginEdit(event: Event) {
    setEditing(event);
    setDraft(eventDraft(event));
    setPreviewing(false);
    setError("");
  }

  async function applyChange() {
    if (!editing || !draft || !draft.title.trim() || !draft.eventType.trim() || !changes.length) return;
    setSaving(true); setError("");
    try {
      await api(`/calendar-events/${editing.id}`, { method: "PATCH", body: JSON.stringify(draftPayload(draft, editing)) });
      setUndo({ id: editing.id, payload: eventPayload(editing) });
      setEditing(null); setDraft(null); setPreviewing(false);
      await Promise.all([client.invalidateQueries({ queryKey: ["events", courseId] }), client.invalidateQueries({ queryKey: ["course", courseId] })]);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Calendar change could not be saved."); }
    finally { setSaving(false); }
  }

  async function undoChange() {
    if (!undo) return;
    setSaving(true); setError("");
    try {
      await api(`/calendar-events/${undo.id}`, { method: "PATCH", body: JSON.stringify(undo.payload) });
      setUndo(null);
      await Promise.all([client.invalidateQueries({ queryKey: ["events", courseId] }), client.invalidateQueries({ queryKey: ["course", courseId] })]);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The calendar change could not be undone."); }
    finally { setSaving(false); }
  }

  if (!events.length) return <EmptyState detail="Confirmed dates appear here. Ambiguous dates remain in Review instead of being assigned an invented time." title="No calendar events" />;
  return <section className="panel overflow-hidden"><header className="border-b border-[color:var(--border-default)] p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">Agenda</p><h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold">Course calendar</h2><p className="muted mt-2 text-sm">All-day work remains all-day when the source does not specify a time.</p></div>{undo ? <button className="button button-secondary" disabled={saving} onClick={() => void undoChange()} type="button"><RotateCcw aria-hidden="true" size={16} />Undo last change</button> : null}</div>{error ? <p className="mt-3 text-sm text-[color:var(--danger)]" role="alert">{error}</p> : null}</header><div className="divide-y divide-[color:var(--border-default)]">{events.map((event) => <article className="grid gap-4 p-5 md:grid-cols-[10rem_1fr_auto] md:items-center" key={event.id}><time className="mono text-sm text-[color:var(--semester-700)]">{event.event_date ?? event.start_at?.slice(0, 10) ?? "Unscheduled"}</time><div><h3 className="font-medium">{event.title}</h3><p className="muted mt-1 text-xs">{event.event_type.replaceAll("_", " ")}{event.time_unspecified ? " · Time unspecified" : ""}</p></div><div className="flex flex-wrap items-center gap-2"><SourceStatusBadge status={event.status} /><button className="button button-secondary min-h-9 px-3 py-2 text-xs" onClick={() => beginEdit(event)} type="button"><PencilLine aria-hidden="true" size={15} />Edit</button></div></article>)}</div>
    {editing && draft ? <div className="border-t border-[color:var(--border-default)] bg-[color:var(--surface-canvas)] p-5 sm:p-6"><div className="flex items-center gap-2"><CalendarClock aria-hidden="true" className="text-[color:var(--semester-700)]" size={18} /><h3 className="font-semibold">Edit calendar event</h3></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm font-medium">Title<input className="min-h-11 rounded border border-[color:var(--border-strong)] bg-[color:var(--surface-panel)] px-3" onChange={(event) => setDraft({ ...draft, title: event.target.value })} value={draft.title} /></label><label className="grid gap-2 text-sm font-medium">Type<input className="min-h-11 rounded border border-[color:var(--border-strong)] bg-[color:var(--surface-panel)] px-3" onChange={(event) => setDraft({ ...draft, eventType: event.target.value })} value={draft.eventType} /></label><label className="grid gap-2 text-sm font-medium">Date<input className="min-h-11 rounded border border-[color:var(--border-strong)] bg-[color:var(--surface-panel)] px-3" onChange={(event) => setDraft({ ...draft, date: event.target.value })} type="date" value={draft.date} /></label><label className="grid gap-2 text-sm font-medium">Time <span className="muted font-normal">(optional, device time zone)</span><input className="min-h-11 rounded border border-[color:var(--border-strong)] bg-[color:var(--surface-panel)] px-3" onChange={(event) => setDraft({ ...draft, time: event.target.value })} type="time" value={draft.time} /></label><label className="grid gap-2 text-sm font-medium sm:col-span-2">Status<select className="min-h-11 rounded border border-[color:var(--border-strong)] bg-[color:var(--surface-panel)] px-3" onChange={(event) => setDraft({ ...draft, status: event.target.value as Draft["status"] })} value={draft.status}><option value="confirmed">Confirmed</option><option value="needs_review">Needs review</option><option value="rejected">Rejected</option></select></label></div>
      {previewing ? <div className="panel mt-5 p-4"><p className="eyebrow">Consequence preview</p>{changes.length ? <ul className="mt-3 space-y-2 text-sm">{changes.map((change) => <li key={change.field}><strong>{change.field}:</strong> <span className="muted">{change.before}</span> → {change.after}</li>)}</ul> : <p className="muted mt-3 text-sm">No changes to apply.</p>}<p className="muted mt-3 text-xs">The saved course calendar and its next ICS export will use these values. A blank time remains explicitly unspecified.</p></div> : null}
      <div className="mt-5 flex flex-wrap gap-2">{previewing ? <button className="button button-primary" disabled={saving || !changes.length || !draft.title.trim() || !draft.eventType.trim()} onClick={() => void applyChange()} type="button">{saving ? "Saving…" : "Apply calendar change"}</button> : <button className="button button-primary" onClick={() => setPreviewing(true)} type="button">Review changes</button>}<button className="button button-secondary" disabled={saving} onClick={() => { setEditing(null); setDraft(null); setPreviewing(false); }} type="button">Cancel</button></div></div> : null}
  </section>;
}
