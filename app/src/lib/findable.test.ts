import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { DESTINATIONS } from './nav';
import { SETTINGS_SCREENS } from './settings';
import type { Screen } from './types';

/**
 * Every screen is findable, or is named here with the reason it is not.
 *
 * The app has eighty-two screens. Thirty-one of them were, at one point,
 * reachable only by knowing the tap that opened them — a screen could exist,
 * work, and be invisible to the directory, to search and to the shelves all
 * at once, and nothing would say so. `lib/nav.ts` fixed that by being one
 * registry; this is what stops it drifting back, because a registry is only
 * the single source of truth for as long as everything is actually in it.
 *
 * A new screen therefore has two ways to pass: put it in `DESTINATIONS` — one
 * line, and it appears in the directory, in search, on the shelves and in the
 * guidebook at once — or put it in the list below with a sentence saying what
 * opens it. What it cannot do is neither.
 */

/**
 * The screens you arrive at from another screen rather than look up.
 *
 * Each is here because a directory entry for it would be a dead link: there
 * is no such thing as "the item screen" until you have picked an item. Every
 * one of them is still reachable, still deep-linkable, and still comes back
 * in search results *through the thing it belongs to* — searching a card's
 * text lands on its unit, not on a bare "Cards" entry that could not know
 * which cards you meant.
 */
const OPENED_FROM_SOMEWHERE_ELSE: Record<string, string> = {
  onboarding: 'The first run. It opens itself, once, and Settings → About can replay it.',
  course: 'One course. Opened from Courses, from a deadline, or from a search result.',
  item: 'One deadline. Opened from the course it belongs to, or from Today.',
  event: 'One calendar entry. Opened from the calendar.',
  note: 'One note. Opened from Notes, or made by the + button.',
  guide: 'A course’s field guide. Opened from Study, for a course.',
  quiz: 'A quiz on one unit. Opened from Study.',
  drill: 'Cards for one unit. Opened from Study.',
  guess: 'The recall drill for one unit. Opened from Study.',
  gap: 'What a drill showed you do not know yet. Opened when a drill ends.',
  lesson: 'A narrated lesson for one unit. Opened from Study or from Watch.',
  slides: 'One unit as a deck. Opened from Study.',
  search:
    'The workspace’s search home — the wordmark, the one field and the shortcuts. ' +
    'What a new tab opens on, and what the Search home row in the sidebar returns to. ' +
    'Not a destination for the same reason a browser’s new-tab page is not a bookmark.',
  directory:
    'Every app this student has, as a list or a grid. Opened from All apps in the ' +
    'sidebar, from the launcher, and from Explore all apps on the search home. It is ' +
    'the index of the registry rather than a row in it.',
  /*
   * The one entry here that is not opened from another screen, and the reason
   * is worth more than the row. Every other line above says "you arrive at
   * this from the thing it belongs to". This one says the app is not allowed
   * to know who should see it.
   *
   * Being an administrator is a fact about `public.app_admins`, which has no
   * select policy — a browser cannot read whether the account it is signed in
   * as is on that list, and that is exactly what makes the queue's policy
   * un-spoofable. So there is no honest gate for a directory entry: listing it
   * offers a report queue to every student, and `lib/reveal.ts` gates on facts
   * about a semester, which this is not and cannot be made into.
   *
   * The address is the door, `SETUP.md` writes it down beside making somebody
   * an administrator, and the server answers the query for administrators and
   * for nobody else.
   */
  moderation:
    'The report queue. Reached at `#/moderation` by an administrator, and deliberately ' +
    'not offered: whether somebody is one is a fact the client is not allowed to read. ' +
    'See `screens/Moderation.tsx` and SETUP.md.',
};

/** The `Screen` union, read from the source that defines it. */
function everyScreen(): string[] {
  const src = readFileSync('src/lib/types.ts', 'utf8');
  const block = /export type Screen =([\s\S]*?);\n/.exec(src);
  if (!block) throw new Error('The Screen union has moved; this test needs to be pointed at it.');
  return [...block[1].matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1]);
}

describe('every screen the app has', () => {
  it('is in the directory, in settings, or named as one you arrive at', () => {
    const filed = new Set<string>([
      ...DESTINATIONS.map((d) => d.screen),
      ...SETTINGS_SCREENS,
      ...Object.keys(OPENED_FROM_SOMEWHERE_ELSE),
      // Home is the first screen. Which screen that *is* depends on the
      // navigation, so it is `lib/chrome.ts`'s answer rather than an entry.
      'home',
    ]);
    const stranded = everyScreen().filter((s) => !filed.has(s));
    expect(
      stranded,
      'Put it in DESTINATIONS in lib/nav.ts, or in OPENED_FROM_SOMEWHERE_ELSE above with the reason',
    ).toEqual([]);
  });

  it('has no exemption for a screen that no longer exists', () => {
    const real = new Set(everyScreen());
    const stale = Object.keys(OPENED_FROM_SOMEWHERE_ELSE).filter((s) => !real.has(s));
    expect(stale, 'These are exempted and gone. Delete the lines.').toEqual([]);
  });

  it('gives every exemption a reason somebody can read', () => {
    for (const [screen, why] of Object.entries(OPENED_FROM_SOMEWHERE_ELSE)) {
      expect(why.length, `${screen} needs a real sentence`).toBeGreaterThan(20);
      expect(why.trim().endsWith('.'), `${screen}: write it as a sentence`).toBe(true);
    }
  });

  /*
   * The directory's entries are what search matches on and what the shelves
   * draw, so an entry with no words in it is a screen that exists and cannot
   * be found by anybody who does not already know its name.
   */
  it('gives every directory entry a label, a sentence and words to search for', () => {
    for (const d of DESTINATIONS) {
      expect(d.label.trim().length, `${d.screen} has no label`).toBeGreaterThan(0);
      expect(d.blurb.trim().length, `${d.screen} has no sentence`).toBeGreaterThan(10);
      expect(d.keywords.trim().length, `${d.screen} has no keywords`).toBeGreaterThan(0);
    }
  });

  it('names each screen once — no screen filed on two shelves', () => {
    const seen = new Map<Screen, number>();
    for (const d of DESTINATIONS) seen.set(d.screen, (seen.get(d.screen) ?? 0) + 1);
    expect([...seen].filter(([, n]) => n > 1).map(([s]) => s)).toEqual([]);
  });
});
