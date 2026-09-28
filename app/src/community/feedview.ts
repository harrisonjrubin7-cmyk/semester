/**
 * From server posts to a ranked, explained, finite page.
 *
 * The signals are computed here from things the student chose — which
 * communities they joined, which are course communities — plus how recent a
 * post is and whether its source is verified. Nothing else is available to
 * compute them from, by design: the post rows carry no reaction counts, no
 * location and no author standing.
 *
 * Preferences (hidden posts, "show less", chronological mode) stay on this
 * device. They are one viewer's conveniences, not something anybody else
 * should be able to read — and losing them costs a few taps, not a record.
 */

import { buildFeed, EMPTY_PREFERENCES, type FeedItem, type FeedPage, type FeedPreferences } from './feed';
import type { CommunityRow, PostRow } from './client';

const WEEK_HOURS = 24 * 7;

const MODERATION: Record<PostRow['status'], FeedItem['moderation']> = {
  published: 'clear',
  pending: 'under_review',
  reduced: 'reduced',
  held: 'held',
  removed: 'removed',
  withdrawn: 'removed',
};

export function toFeedItem(post: PostRow, community: CommunityRow, now: Date): FeedItem {
  const ageHours = Math.max(0, (now.getTime() - new Date(post.createdAt).getTime()) / 3_600_000);
  const verified = post.label !== 'student_created' && post.label !== 'illustrative_example';
  const course = community.kind === 'course';
  const recent = ageHours < 24;
  return {
    id: post.id,
    communityId: post.communityId,
    surface: course ? 'for_your_courses' : 'from_your_communities',
    label: post.label,
    title: post.body.slice(0, 80),
    postedAt: post.createdAt,
    signals: {
      pathOrCourse: course ? 1 : 0,
      time: Math.max(0, 1 - ageHours / WEEK_HOURS),
      explicitFollow: 1,
      verifiedSource: verified ? 1 : 0,
      preference: 0,
    },
    reasons: {
      explicitFollow: `You joined ${community.name}.`,
      ...(course ? { pathOrCourse: 'It’s in one of your course communities.' } : {}),
      ...(recent ? { time: 'It was posted in the last day.' } : {}),
      ...(verified ? { verifiedSource: 'It comes from a verified source.' } : {}),
    },
    fatigue: 0,
    duplication: 0,
    moderation: MODERATION[post.status],
    authorRef: post.authorRef,
  };
}

export function communityPage(
  posts: PostRow[],
  community: CommunityRow,
  preferences: FeedPreferences,
  now: Date,
): FeedPage {
  return buildFeed({
    items: posts.filter((p) => !p.mine).map((p) => toFeedItem(p, community, now)),
    surface: 'community',
    communityId: community.id,
    preferences,
  });
}

const KEY = 'semester.community-feed.v1';

export function loadPreferences(): FeedPreferences {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return EMPTY_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<FeedPreferences>;
    return {
      ...EMPTY_PREFERENCES,
      hiddenItems: Array.isArray(parsed.hiddenItems) ? parsed.hiddenItems.filter((x) => typeof x === 'string').slice(-500) : [],
      showLess:
        parsed.showLess && typeof parsed.showLess === 'object'
          ? Object.fromEntries(Object.entries(parsed.showLess).filter(([, v]) => typeof v === 'number' && v >= 0 && v <= 5))
          : {},
      mode: parsed.mode === 'chronological' ? 'chronological' : 'personalized',
    };
  } catch {
    return EMPTY_PREFERENCES;
  }
}

/** Blocks and mutes are server-side; only the device-local parts are saved here. */
export function savePreferences(prefs: FeedPreferences): void {
  try {
    globalThis.localStorage?.setItem(
      KEY,
      JSON.stringify({ hiddenItems: prefs.hiddenItems, showLess: prefs.showLess, mode: prefs.mode }),
    );
  } catch {
    // Private windows and blocked storage: the feed still works, it just forgets.
  }
}
