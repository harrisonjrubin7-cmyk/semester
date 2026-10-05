import { obj, textValue } from './device-library';
import { inQuiet, type Quiet } from './notify';

/**
 * Calm controls: what the Semester Guide may say, when, and how much, all
 * decided by the student and kept on the device.
 *
 * The defaults are the calmest the product can be, on purpose. A guide that
 * starts loud and offers a way to quiet it has already taught somebody to
 * ignore it; one that starts quiet and offers more has not. So a fresh device
 * gets no morning briefing, a minimal digest, one category of notification
 * (dates somebody else set), quiet hours overnight, and a horizon of one day.
 *
 * ## Two channels, because they are different promises
 *
 * - **notification** is the guide reaching out: it respects the category
 *   list, quiet hours and every pause.
 * - **surface** is the guide being where the student already is, on a screen
 *   they opened. Quiet hours do not hide it (they are about being
 *   interrupted, and nobody is interrupted by a screen they chose), and the
 *   category list does not either (that is a list of what may *interrupt*).
 *   The pauses and "hide study blocks" do apply, because they say "not this,
 *   anywhere".
 *
 * ## A read that fails is the library's problem, not a default's
 *
 * `readCalm` throws on a record that is not a settings object at all, which
 * `useDeviceLibrary` turns into "show defaults, refuse writes, keep the bad
 * bytes". A *field* that is wrong (a time of 99:99, a digest that is not one of
 * the three) falls back to its calm default instead, so a hand-edited or
 * half-migrated record still opens, never loudly.
 *
 * Nothing here is uploaded.
 */

export const CALM_KEY = 'semester.calm.v1';

/**
 * The information budget. A guide that shows everything it knows is a feed.
 * One thing is most important; a few next actions follow; interruptions are
 * rare. These are limits on what any surface may show, not suggestions.
 */
export const INFORMATION_BUDGET = {
  /** The one thing that matters most today. Never two. */
  mostImportant: 1,
  /** The next actions shown under it: at least three when there are three, at most five. */
  nextActionsMin: 3,
  nextActionsMax: 5,
  /** Notifications per day by default. The student may raise it; it starts low. */
  notificationsPerDay: 1,
} as const;

/** Trim a list of next actions to the budget. A shorter list is returned as it is. */
export function withinBudget<T>(items: readonly T[]): T[] {
  return items.slice(0, INFORMATION_BUDGET.nextActionsMax);
}

export const CATEGORIES = ['deadlines', 'plan', 'study', 'scenarios', 'career', 'campus'] as const;
export type Category = (typeof CATEGORIES)[number];

export const DIGESTS = ['daily', 'weekly', 'minimal'] as const;
export type Digest = (typeof DIGESTS)[number];

export const HORIZONS = ['day', 'week', 'term'] as const;
export type Horizon = (typeof HORIZONS)[number];

export type Channel = 'notification' | 'surface';

export const MEMORY_LIMITS = { notes: 30, text: 200 } as const;

/** One thing the student let the assistant remember. Theirs to read and clear. */
export interface MemoryNote {
  id: string;
  text: string;
  at: number;
}

export interface CalmSettings {
  version: 1;
  /** A morning summary at a time the student chose. Off until they turn it on. */
  briefing: { on: boolean; /** Minutes after midnight, 0–1439. */ at: number };
  /** No notifications in this window. Wraps midnight. Null is "no quiet hours". */
  quiet: Quiet | null;
  digest: Digest;
  /** The categories that may send a notification. Surfaces ignore this. */
  categories: Category[];
  pauseScenarios: boolean;
  pauseCareer: boolean;
  hideStudyBlocks: boolean;
  /** Collapse the guide to one line everywhere. */
  minimalMode: boolean;
  horizon: Horizon;
  /** What the assistant remembers about the student's preferences. */
  memory: MemoryNote[];
}

export const EMPTY_CALM: CalmSettings = {
  version: 1,
  briefing: { on: false, at: 8 * 60 },
  quiet: { from: 22 * 60, to: 8 * 60 },
  digest: 'minimal',
  categories: ['deadlines'],
  pauseScenarios: false,
  pauseCareer: false,
  hideStudyBlocks: false,
  minimalMode: false,
  horizon: 'day',
  memory: [],
};

const bad = () => new Error('Saved guide settings are not valid.');

const minuteOfDay = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 1440;
const oneOf = <T extends string>(list: readonly T[], v: unknown, fallback: T): T =>
  typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : fallback;
const flag = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

export function readCalm(value: unknown): CalmSettings {
  if (!obj(value) || value.version !== 1) throw bad();
  const d = EMPTY_CALM;

  const b = value.briefing;
  const briefing = obj(b) ? { on: flag(b.on, d.briefing.on), at: minuteOfDay(b.at) ? b.at : d.briefing.at } : { ...d.briefing };

  // `null` is a real answer ("no quiet hours"); a missing or malformed value is not.
  let quiet: Quiet | null = d.quiet ? { ...d.quiet } : null;
  if (value.quiet === null) quiet = null;
  else if (obj(value.quiet) && minuteOfDay(value.quiet.from) && minuteOfDay(value.quiet.to)) {
    quiet = { from: value.quiet.from, to: value.quiet.to };
  }

  const categories = Array.isArray(value.categories)
    ? CATEGORIES.filter((c) => (value.categories as unknown[]).includes(c))
    : [...d.categories];

  const memory = Array.isArray(value.memory)
    ? value.memory
        .filter(
          (m): m is Record<string, unknown> =>
            obj(m) && textValue(m.id, 100) && !!m.id && textValue(m.text, MEMORY_LIMITS.text) && !!m.text && typeof m.at === 'number' && Number.isFinite(m.at),
        )
        .slice(-MEMORY_LIMITS.notes)
        .map((m) => ({ id: m.id as string, text: m.text as string, at: m.at as number }))
    : [];

  return {
    version: 1,
    briefing,
    quiet,
    digest: oneOf(DIGESTS, value.digest, d.digest),
    categories,
    pauseScenarios: flag(value.pauseScenarios, d.pauseScenarios),
    pauseCareer: flag(value.pauseCareer, d.pauseCareer),
    hideStudyBlocks: flag(value.hideStudyBlocks, d.hideStudyBlocks),
    minimalMode: flag(value.minimalMode, d.minimalMode),
    horizon: oneOf(HORIZONS, value.horizon, d.horizon),
    memory,
  };
}

/** Settings from whatever is stored, or the calm defaults when it cannot be read. */
export function calmOrDefault(value: unknown): CalmSettings {
  try {
    return readCalm(value);
  } catch {
    return EMPTY_CALM;
  }
}

const minutesOf = (now: Date) => now.getHours() * 60 + now.getMinutes();

/**
 * Whether the guide may show something in this category, now, on this channel.
 * See the file comment for why the channels differ.
 */
export function allows(category: Category, settings: CalmSettings, now: Date, channel: Channel = 'notification'): boolean {
  if (category === 'scenarios' && settings.pauseScenarios) return false;
  if (category === 'career' && settings.pauseCareer) return false;
  if (category === 'study' && settings.hideStudyBlocks) return false;
  if (channel === 'surface') return true;
  if (!settings.categories.includes(category)) return false;
  return !inQuiet(minutesOf(now), settings.quiet);
}

/**
 * Whether the morning briefing is due: switched on, at or after the chosen
 * time, and not inside quiet hours (a briefing set for 7am under quiet hours
 * ending at 8am waits for 8, rather than quietly breaking the promise of
 * either).
 */
export function briefingDue(settings: CalmSettings, now: Date): boolean {
  if (!settings.briefing.on) return false;
  const m = minutesOf(now);
  return m >= settings.briefing.at && !inQuiet(m, settings.quiet);
}

/** The assistant's memory, emptied. Nothing else about the settings changes. */
export function clearMemory(settings: CalmSettings): CalmSettings {
  return { ...settings, memory: [] };
}

/** The settings as they may leave the device in a backup: the assistant's memory is the student's to keep or clear, so it stays. */
export function withoutMemory(settings: CalmSettings): CalmSettings {
  return clearMemory(settings);
}

/**
 * Restored settings, keeping the memory this device already holds. A backup
 * never carries it, so restoring one must not erase what the assistant
 * remembers here, nor give it anything the student did not tell it on this device.
 */
export function keepMemory(incoming: CalmSettings, existing: unknown): CalmSettings {
  let before: CalmSettings;
  try {
    before = readCalm(existing);
  } catch {
    return incoming;
  }
  return { ...incoming, memory: before.memory };
}

/** Add one remembered preference. The oldest go first once the limit is reached; blank text is ignored. */
export function remember(settings: CalmSettings, text: string, now: number, id: string): CalmSettings {
  const t = text.trim().slice(0, MEMORY_LIMITS.text);
  if (!t) return settings;
  return { ...settings, memory: [...settings.memory, { id, text: t, at: now }].slice(-MEMORY_LIMITS.notes) };
}
