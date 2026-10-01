import type { Screen } from './types';

/**
 * Service notices, in the app, only where they apply.
 *
 * `public/status.html` reads `status-incidents.json` beside it and lists every
 * incident. That page is deliberately outside the bundle, so it renders when
 * the app cannot; but a student in the app during an incident does not go
 * looking for a status page. They see a calendar that will not sync and a
 * banner that says nothing, or — the other failure — a red bar across every
 * screen for a slow feed that does not concern the one they are on.
 *
 * So an incident may say which screens it touches, and only those screens say
 * anything: one line, what is affected, and what still works. A notice with no
 * screens is about the whole service and shows everywhere. A notice whose
 * window has passed shows nowhere, whatever the file still says.
 *
 * The file's shape is the status page's, extended: `date` and `status` were
 * always there, and `kind`, `screens`, `from`, `until`, `affects` and `still`
 * are new and optional, so an incident posted the old way still renders on
 * both pages. `readIncidents` drops anything malformed rather than repairing
 * it, the way every device library here does.
 */

export interface Incident {
  id: string;
  /** `YYYY-MM-DD`, as the status page shows it. */
  date: string;
  title: string;
  /** The status page's word: investigating, identified, monitoring, resolved, scheduled. */
  status: string;
  kind: 'incident' | 'maintenance';
  /** The screens it touches; empty means the whole service. */
  screens: Screen[];
  /** Epoch ms, when it started or will start; null when unknown. */
  from: number | null;
  /** Epoch ms, when it ended or will end; null when open. */
  until: number | null;
  /** "Course source sync is delayed." */
  affects: string;
  /** "Your saved plan is still available." */
  still: string;
}

const time = (v: unknown): number | null => {
  if (typeof v !== 'string') return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
};

/**
 * The status page's own record of an incident (`scripts/status-history.mjs`)
 * carries `started`, `resolved` and dated `updates` rather than `date`,
 * `status` and `until`. Read that shape here too, so an incident posted once
 * shows in the app as well as on the page. A notice from it is about the
 * whole service unless it names `screens`, which is optional there too; the
 * newest update's text is the line the student reads.
 */
function fromRecorded(o: Record<string, unknown>): Record<string, unknown> {
  if (typeof o.date === 'string' || typeof o.started !== 'string') return o;
  const updates = Array.isArray(o.updates) ? (o.updates as Record<string, unknown>[]) : [];
  const last = updates[updates.length - 1];
  return {
    ...o,
    date: o.started.slice(0, 10),
    status: typeof o.resolved === 'string' ? 'resolved' : typeof last?.status === 'string' ? last.status : 'investigating',
    kind: o.impact === 'maintenance' ? 'maintenance' : 'incident',
    from: o.started,
    until: typeof o.resolved === 'string' ? o.resolved : typeof o.until === 'string' ? o.until : null,
    affects: typeof o.affects === 'string' ? o.affects : typeof last?.body === 'string' ? last.body : '',
  };
}

/** The incidents in a parsed `status-incidents.json`, made safe. */
export function readIncidents(value: unknown): Incident[] {
  if (typeof value !== 'object' || value === null) return [];
  const items = (value as { incidents?: unknown }).incidents;
  if (!Array.isArray(items)) return [];
  const out: Incident[] = [];
  for (const v of items) {
    if (typeof v !== 'object' || v === null) continue;
    const o = fromRecorded(v as Record<string, unknown>);
    if (typeof o.title !== 'string' || typeof o.date !== 'string') continue;
    out.push({
      id: typeof o.id === 'string' ? o.id : `${o.date}-${o.title}`.slice(0, 80),
      date: o.date,
      title: o.title.slice(0, 160),
      status: typeof o.status === 'string' ? o.status : 'investigating',
      kind: o.kind === 'maintenance' ? 'maintenance' : 'incident',
      screens: Array.isArray(o.screens) ? (o.screens.filter((s): s is Screen => typeof s === 'string') as Screen[]) : [],
      from: time(o.from),
      until: time(o.until),
      affects: typeof o.affects === 'string' ? o.affects.slice(0, 200) : '',
      still: typeof o.still === 'string' ? o.still.slice(0, 200) : '',
    });
  }
  return out;
}

/** Whether a notice is live at `now`: resolved ones and passed windows are not. */
export function live(i: Incident, now: number): boolean {
  if (i.status === 'resolved') return false;
  if (i.until !== null && i.until < now) return false;
  // Maintenance is announced ahead: show it from a day before it starts.
  if (i.kind === 'maintenance' && i.from !== null && i.from - now > 24 * 60 * 60 * 1000) return false;
  return true;
}

/** The notices this screen should carry right now. */
export function noticesFor(screen: Screen, incidents: readonly Incident[], now: number): Incident[] {
  return incidents.filter((i) => live(i, now) && (i.screens.length === 0 || i.screens.includes(screen)));
}

/** "Maintenance: calendar sync will be unavailable Saturday 1–2 AM. No action required." */
export function say(i: Incident): { head: string; body: string } {
  const head = i.kind === 'maintenance' ? 'Maintenance' : 'Status';
  const affects = i.affects || i.title;
  const still = i.still || (i.kind === 'maintenance' ? 'No action required.' : 'Everything saved on this device is still available.');
  return { head, body: `${affects} ${still}`.trim() };
}
