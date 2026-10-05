/**
 * The Community feed: finite, explained, and blind to where you are.
 *
 * A hyperlocal feed ranks by proximity and reaction. On a campus that makes
 * the loudest post about the nearest person the most visible thing in the app.
 * This feed ranks by why a student is here — their courses, their path, the
 * communities they chose, how soon something matters — and by nothing that
 * describes their body, their movements, their health or their popularity.
 *
 *   rank = 0.30·path/course + 0.25·time + 0.20·explicit follow
 *        + 0.15·verified source + 0.10·preference
 *        − fatigue − duplication − safety
 *
 * ## The exclusions are enforced, not documented
 *
 * Items arrive as JSON from the server, so a type alone does not stop a
 * `distanceKm` or `replyCount` riding along and being read by a later edit.
 * `rankItem` refuses any candidate carrying a forbidden signal. A test walks
 * every name in FORBIDDEN_SIGNALS, and a structural test checks this file
 * never imports the account safety state.
 *
 * ## Finite
 *
 * A page is at most PAGE_LIMIT items and says when it is the end. There is no
 * cursor into a global stream: the feed is built only from the student's own
 * communities, courses and saved items.
 */

export const RANKER_VERSION = 'community-rank-2026.09.1';

export const WEIGHTS = {
  pathOrCourse: 0.3,
  time: 0.25,
  explicitFollow: 0.2,
  verifiedSource: 0.15,
  preference: 0.1,
} as const;

export type Signal = keyof typeof WEIGHTS;

export const FEED_SURFACES = [
  'for_your_courses',
  'for_your_path',
  'from_your_communities',
  'study_with_others',
  'campus_this_week',
  'saved_for_later',
] as const;
export type FeedSurface = (typeof FEED_SURFACES)[number];

export const SOURCE_LABELS = [
  'institution_verified',
  'organization_verified',
  'faculty_approved',
  'student_created',
  'ai_assisted_source_linked',
  'illustrative_example',
] as const;
export type SourceLabel = (typeof SOURCE_LABELS)[number];

/**
 * Inputs the ranker may never see. Grouped by why, for the explanation page;
 * the list is flat for the check.
 */
export const FORBIDDEN_SIGNALS = [
  // location and movement
  'gps', 'latitude', 'longitude', 'lat', 'lng', 'distance', 'distanceKm', 'proximity', 'geohash',
  'residence', 'housing', 'movement',
  // schedule and attendance
  'schedule', 'attendance', 'classTimes',
  // private and sensitive
  'privateMessages', 'dmCount', 'counseling', 'disability', 'health', 'financialAid',
  'immigration', 'conduct', 'grades', 'gpa', 'academicRisk',
  // popularity and virality
  'followerCount', 'karma', 'likes', 'upvotes', 'downvotes', 'reactionCount', 'replyCount',
  'reportCount', 'controversy', 'outrage', 'watchTime', 'shares',
  // inference about the person
  'inferredPolitics', 'inferredIdentity', 'inferredWellbeing', 'vulnerability',
  // enforcement state
  'safetyState', 'safetyScore',
] as const;

export class ForbiddenSignal extends Error {}

export interface FeedItem {
  id: string;
  communityId: string;
  surface: FeedSurface;
  label: SourceLabel;
  title: string;
  postedAt: string;
  /** Each 0..1, computed server-side from allowed inputs only. */
  signals: Record<Signal, number>;
  /** Why each signal fired, in words, for "Why am I seeing this?". */
  reasons: Partial<Record<Signal, string>>;
  /** 0..1 penalties. */
  fatigue: number;
  duplication: number;
  /** Set by moderation. An item under review is never recommended. */
  moderation: 'clear' | 'under_review' | 'reduced' | 'held' | 'removed';
  authorRef: string;
  /** For duplicate suppression. */
  topicKey?: string;
}

function clamp(n: number): number {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}

export function assertAllowedSignals(candidate: object): void {
  const walk = (value: unknown, path: string) => {
    if (!value || typeof value !== 'object') return;
    for (const [k, v] of Object.entries(value)) {
      if ((FORBIDDEN_SIGNALS as readonly string[]).includes(k)) {
        throw new ForbiddenSignal(`Feed item carries forbidden signal ${path}${k}`);
      }
      walk(v, `${path}${k}.`);
    }
  };
  walk(candidate, '');
}

/** Safety penalty from moderation state: under review sinks, held and removed never rank. */
function safetyPenalty(item: FeedItem): number {
  return item.moderation === 'clear' ? 0 : item.moderation === 'reduced' ? 0.5 : 1;
}

export function rankItem(item: FeedItem): number {
  assertAllowedSignals(item);
  let score = 0;
  for (const s of Object.keys(WEIGHTS) as Signal[]) score += WEIGHTS[s] * clamp(item.signals[s]);
  return score - clamp(item.fatigue) - clamp(item.duplication) - safetyPenalty(item);
}

/** The student's own controls. Nothing here is visible to anyone else. */
export interface FeedPreferences {
  hiddenItems: string[];
  /** "Show less like this" per community: each step multiplies that community's scores by 0.5. */
  showLess: Record<string, number>;
  blockedRefs: string[];
  mutedRefs: string[];
  mode: 'personalized' | 'chronological';
}

export const EMPTY_PREFERENCES: FeedPreferences = {
  hiddenItems: [],
  showLess: {},
  blockedRefs: [],
  mutedRefs: [],
  mode: 'personalized',
};

export type Feedback = 'helpful' | 'not_relevant' | 'show_less' | 'hide';

/**
 * Apply one tap. "Not relevant" and "hide" change only this student's feed;
 * "helpful" changes nothing about the item's standing — it is recorded for
 * discovery tuning server-side and is never a credibility or enforcement
 * signal. None of these creates a report.
 */
export function applyFeedback(prefs: FeedPreferences, item: FeedItem, feedback: Feedback): FeedPreferences {
  if (feedback === 'helpful') return prefs;
  if (feedback === 'show_less') {
    return { ...prefs, showLess: { ...prefs.showLess, [item.communityId]: (prefs.showLess[item.communityId] ?? 0) + 1 } };
  }
  return { ...prefs, hiddenItems: [...new Set([...prefs.hiddenItems, item.id])] };
}

export const PAGE_LIMIT = 20;

export interface FeedPage {
  surface: FeedSurface | 'community';
  mode: FeedPreferences['mode'];
  items: { item: FeedItem; score: number }[];
  /** Always true: there is no next page into a global stream. */
  end: true;
  rankerVersion: string;
}

/** A finite page for one surface (or one community, chronologically if asked). */
export function buildFeed(args: {
  items: FeedItem[];
  surface: FeedSurface | 'community';
  communityId?: string;
  preferences: FeedPreferences;
  limit?: number;
}): FeedPage {
  const { items, surface, communityId, preferences } = args;
  const limit = Math.min(args.limit ?? PAGE_LIMIT, PAGE_LIMIT);
  const hidden = new Set(preferences.hiddenItems);
  const silenced = new Set([...preferences.blockedRefs, ...preferences.mutedRefs]);

  const eligible = items.filter(
    (i) =>
      (surface === 'community' ? i.communityId === communityId : i.surface === surface) &&
      !hidden.has(i.id) &&
      !silenced.has(i.authorRef) &&
      // Reported or risky content is never recommended; a community's own
      // chronological view still omits held and removed items.
      (i.moderation === 'clear' || (preferences.mode === 'chronological' && i.moderation === 'under_review')),
  );

  let scored = eligible.map((item) => {
    const damp = 0.5 ** (preferences.showLess[item.communityId] ?? 0);
    return { item, score: rankItem(item) * damp };
  });

  if (preferences.mode === 'chronological') {
    scored.sort((a, b) => b.item.postedAt.localeCompare(a.item.postedAt));
  } else {
    scored.sort((a, b) => b.score - a.score);
    // Duplicate suppression: one item per topic in a ranked page.
    const seen = new Set<string>();
    scored = scored.filter(({ item }) => {
      if (!item.topicKey) return true;
      if (seen.has(item.topicKey)) return false;
      seen.add(item.topicKey);
      return true;
    });
  }

  return { surface, mode: preferences.mode, items: scored.slice(0, limit), end: true, rankerVersion: RANKER_VERSION };
}

const LABEL_TEXT: Record<SourceLabel, string> = {
  institution_verified: 'Institution verified',
  organization_verified: 'Organization verified',
  faculty_approved: 'Faculty approved',
  student_created: 'Student-created',
  ai_assisted_source_linked: 'AI-assisted · source linked',
  illustrative_example: 'Illustrative example',
};

export function labelText(label: SourceLabel): string {
  return LABEL_TEXT[label];
}

/** "Why am I seeing this?" — the signals that contributed most, in words. */
export function explain(item: FeedItem, max = 3): { reasons: string[]; controls: string[] } {
  const contributions = (Object.keys(WEIGHTS) as Signal[])
    .map((s) => ({ s, v: WEIGHTS[s] * clamp(item.signals[s]) }))
    .filter(({ s, v }) => v > 0 && item.reasons[s])
    .sort((a, b) => b.v - a.v)
    .slice(0, max);
  const reasons = contributions.map(({ s }) => item.reasons[s] as string);
  if (reasons.length === 0) reasons.push('It was posted recently in a community you joined.');
  return { reasons, controls: ['Hide this', 'Show less like this', 'Adjust interests', 'Switch to chronological'] };
}
