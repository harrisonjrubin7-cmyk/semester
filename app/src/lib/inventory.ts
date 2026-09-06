import type { Persisted } from '../state/shape';

/**
 * Every record the app holds, counted and weighed.
 *
 * Not the insight engine and deliberately nothing like it. This answers "what
 * is in here and how big is it", and stops. No trends, no advice, no "you
 * should" — a screen that interprets is a screen you have to trust, and the
 * point of this one is that you do not have to: it is counts, sizes and dates,
 * and everything on it can be checked against the thing it describes.
 *
 * ## Derived rather than listed
 *
 * The rows come from the keys of the persisted state itself, not from a list
 * kept alongside it. A list would go stale the first time somebody added a
 * collection and forgot, and the row nobody remembered to add is exactly the
 * one eating the quota. Adding a field to `Persisted` puts it on this screen
 * with no other change.
 */

export interface Row {
  key: string;
  /** What it is called on screen — "Practice papers", not "sittings". */
  label: string;
  /**
   * How many records. Arrays count their length, maps their keys, and a single
   * value counts as one — a setting is a record too, it is just a small one.
   */
  count: number;
  /** Bytes, as this would be stored: the serialised length in UTF-8. */
  bytes: number;
  /** Whether a row can be opened into a list of its records. */
  browsable: boolean;
}

export interface Inventory {
  rows: Row[];
  /** Bytes across everything, which should be near what the browser reports. */
  bytes: number;
  /** Oldest and newest timestamp found anywhere, so the screen can say the span. */
  span: { from: number; to: number } | null;
}

/**
 * The names people would use, for the collections whose field name is not one.
 *
 * Only where they differ. A key with no entry here is title-cased, so a new
 * collection reads sensibly on this screen before anybody names it.
 */
const LABELS: Record<string, string> = {
  courses: 'Courses',
  updates: 'Added material',
  notes: 'Notes',
  sittings: 'Practice papers',
  reviews: 'Card reviews',
  done: 'Ticked deadlines',
  tickedAt: 'When you ticked them',
  spent: 'Time logged',
  tasks: 'Your tasks',
  appointments: 'Appointments',
  commitments: 'Clubs, jobs and teams',
  feedEvents: 'Calendar events',
  feeds: 'Calendar feeds',
  places: 'Saved places',
  sources: 'Sources',
  returned: 'Work that came back',
  attendance: 'Attendance',
  requirements: 'Degree requirements',
  taken: 'Courses taken',
  applications: 'Applications',
  costs: 'What things cost',
  balances: 'Meal plan balances',
  residences: 'Housing',
  extraLinks: 'Links you added',
  linkUrls: 'Corrected addresses',
  windows: 'Work windows',
  answers: 'Answers',
  grades: 'Grades',
  gradeSystems: 'Grade scales',
  visits: 'Office hours visits',
  people: 'People',
  letters: 'Letters',
  myRules: 'Your rules',
  archivedTerms: 'Closed terms',
};

/** Anything that is a list or a map of records rather than one setting. */
function measure(value: unknown): { count: number; browsable: boolean } {
  if (Array.isArray(value)) return { count: value.length, browsable: true };
  if (value && typeof value === 'object') {
    return { count: Object.keys(value).length, browsable: true };
  }
  // A setting. One record, and there is nothing to open.
  return { count: value === undefined || value === null || value === '' ? 0 : 1, browsable: false };
}

/**
 * Bytes as stored.
 *
 * `JSON.stringify().length` counts UTF-16 code units and undercounts every
 * character outside ASCII — which in this app is every em dash, every curly
 * apostrophe and every course title that has one. `TextEncoder` is what the
 * browser actually writes.
 */
const encoder = typeof TextEncoder === 'undefined' ? null : new TextEncoder();

export function bytesOf(value: unknown): number {
  let json: string;
  try {
    json = JSON.stringify(value) ?? '';
  } catch {
    // A cycle, which nothing in the persisted shape has, but a crash on this
    // screen would be a crash on the screen you open when something is wrong.
    return 0;
  }
  return encoder ? encoder.encode(json).length : json.length;
}

const titleCase = (key: string) =>
  key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim();

/** Timestamps found on a record, for the span at the bottom. */
function timesIn(value: unknown, into: number[], depth = 0): void {
  if (depth > 3 || into.length > 5000) return;
  if (Array.isArray(value)) {
    for (const v of value) timesIn(v, into, depth + 1);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    // Milliseconds since 1970, in the range the app could plausibly hold.
    if (typeof v === 'number' && /^(at|created|updated|tickedAt|started|finishedAt)$/.test(k)) {
      if (v > 946_684_800_000 && v < Date.now() + 31_536_000_000) into.push(v);
    } else if (typeof v === 'object') {
      timesIn(v, into, depth + 1);
    }
  }
}

export function inventory(state: Persisted): Inventory {
  const rows: Row[] = [];
  const times: number[] = [];

  for (const [key, value] of Object.entries(state)) {
    const { count, browsable } = measure(value);
    rows.push({
      key,
      label: LABELS[key] ?? titleCase(key),
      count,
      bytes: bytesOf(value),
      browsable: browsable && count > 0,
    });
    timesIn(value, times);
  }

  rows.sort((a, b) => b.bytes - a.bytes);

  return {
    rows,
    bytes: rows.reduce((n, r) => n + r.bytes, 0),
    span: times.length > 0 ? { from: Math.min(...times), to: Math.max(...times) } : null,
  };
}

/** What the browser will say about space, where it will say anything. */
export interface Space {
  /** Bytes used and available, when the browser reports them. */
  used: number | null;
  quota: number | null;
  /** Whether the browser has promised not to evict this data. */
  persisted: boolean | null;
  /** Which store is actually live. */
  backend: 'indexeddb' | 'localstorage' | 'none';
  /** True when the browser refuses to say — a private window, mostly. */
  unknown: boolean;
}

export async function space(): Promise<Space> {
  const out: Space = {
    used: null,
    quota: null,
    persisted: null,
    backend: 'none',
    unknown: true,
  };

  try {
    out.backend = typeof indexedDB !== 'undefined' ? 'indexeddb' : 'localstorage';
  } catch {
    out.backend = 'localstorage';
  }

  const nav = typeof navigator === 'undefined' ? null : navigator;
  if (nav?.storage?.estimate) {
    try {
      const e = await nav.storage.estimate();
      out.used = typeof e.usage === 'number' ? e.usage : null;
      out.quota = typeof e.quota === 'number' ? e.quota : null;
      out.unknown = out.used === null;
    } catch {
      // Some browsers throw here rather than returning nothing.
    }
  }
  if (nav?.storage?.persisted) {
    try {
      out.persisted = await nav.storage.persisted();
    } catch {
      out.persisted = null;
    }
  }
  return out;
}
