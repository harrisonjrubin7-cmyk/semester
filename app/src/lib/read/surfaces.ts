/**
 * Today, tasks and the calendar, as read envelopes.
 *
 * These three read the student's own store, so they are never "verified" and
 * never denied; what the envelope settles for them is the part each screen
 * used to decide for itself:
 *
 * - **loading** — the sample course is still arriving. `nothingYet` reads an
 *   empty catalogue as "nothing there", so a first run drew "nothing yet" for
 *   the moment before the courses landed. Not-yet is not never.
 * - **empty** — each screen's own rule, passed in, never reinvented here:
 *   `nothingOnToday`, `nothingYet`, and "no tasks, no form open". Moving a
 *   screen onto the envelope must not change when it counts as empty.
 * - **sources** — what the content rests on, in words. A deadline checked
 *   against its syllabus is `imported`; one that is not is `needs_review`;
 *   anything the student typed is `student_entered`; a campus feed is
 *   `imported` and cannot refresh offline.
 *
 * Sync and offline for the student's own data are said once by the shell
 * (`OfflineBanner`, `SyncStrip`); repeating them per screen would be three
 * more places to disagree. The one offline fact that belongs to a screen is
 * the calendar's, because the campus feed really does stop refreshing.
 */

import { SOURCE_TEXT, type SourceLabel } from '../source';
import { envelope, type Authority, type ReadEnvelope } from './envelope';

export type SourceMix = Partial<Record<SourceLabel, number>>;

export interface SurfaceSummary {
  /** How many things the screen has to show; 0 exactly when the envelope is empty. */
  count: number;
  sources: SourceMix;
}

export interface SurfaceInput {
  loading: boolean;
  /** The screen's own emptiness rule. */
  empty: boolean;
  count: number;
  sources: SourceMix;
  online: boolean;
  now: number;
}

const ORDER: SourceLabel[] = ['institution_verified', 'imported', 'student_entered', 'estimated', 'needs_review'];

const entries = (mix: SourceMix) => ORDER.map((k) => [k, mix[k] ?? 0] as const).filter(([, n]) => n > 0);

/** "2 imported · 1 needs review" — text, in the app's one vocabulary. */
export function sourceMixLine(mix: SourceMix): string | null {
  const parts = entries(mix).map(([k, n]) => `${n} ${SOURCE_TEXT[k].toLowerCase()}`);
  return parts.length ? `Sources: ${parts.join(', ')}.` : null;
}

/** The single label when there is one kind of source, else `mixed`. */
function kindOf(mix: SourceMix): SourceLabel | 'mixed' {
  const e = entries(mix);
  return e.length === 1 ? e[0][0] : 'mixed';
}

/** A course item is `imported` once checked against its syllabus, `needs_review` until then. */
export function itemSources(items: Iterable<{ checked?: { confirmed: boolean } }>): SourceLabel[] {
  return [...items].map((i) => (i.checked?.confirmed === true ? 'imported' : 'needs_review'));
}

export function countSources(labels: Iterable<SourceLabel>): SourceMix {
  const mix: SourceMix = {};
  for (const l of labels) mix[l] = (mix[l] ?? 0) + 1;
  return mix;
}

interface Surface {
  id: string;
  label: string;
  authority: Authority;
  /** A fact about this screen that is true only offline, if any. */
  offline?: string;
}

function build(s: Surface, i: SurfaceInput): ReadEnvelope<SurfaceSummary> {
  const common = {
    authority: s.authority,
    source: { id: s.id, label: s.label, kind: kindOf(i.sources) },
    permission: { canRead: true, allowedActions: [] as string[] },
  };
  // Loading stands in for "empty" and for nothing else. Somebody who already
  // has content must never see it replaced while the sample arrives.
  if (i.loading && i.empty) return envelope<SurfaceSummary>({ ...common, state: 'loading' });

  const observedAt = new Date(i.now).toISOString();
  const mix = sourceMixLine(i.sources);
  const limitations = [
    ...(mix ? [mix] : []),
    ...(i.sources.needs_review ? ['Dates marked “needs review” have not been checked against a syllabus.'] : []),
  ];
  if (i.empty) return envelope<SurfaceSummary>({ ...common, state: 'empty', observedAt, limitations });

  const offline = !i.online && s.offline;
  return envelope<SurfaceSummary>({
    ...common,
    state: offline ? 'offline' : 'connected',
    data: { count: i.count, sources: i.sources },
    observedAt,
    limitations: offline ? [s.offline as string, ...limitations] : limitations,
  });
}

export const todayEnvelope = (i: SurfaceInput) =>
  build({ id: 'device.today', label: 'Worked out on this device from your courses and what you added', authority: 'derived' }, i);

export const tasksEnvelope = (i: SurfaceInput) =>
  build({ id: 'device.tasks', label: 'Added by you', authority: 'student' }, i);

export const calendarEnvelope = (i: SurfaceInput & { hasCampusFeed: boolean }) =>
  build(
    {
      id: 'device.calendar',
      label: 'Your courses, what you added and any campus feed',
      authority: 'derived',
      offline: i.hasCampusFeed
        ? 'You are offline. Campus events can’t refresh, so they show what this device last held; when that was is not recorded.'
        : undefined,
    },
    i,
  );
