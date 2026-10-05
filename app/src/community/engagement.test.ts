import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { prose } from '../content/terms';
import { sources } from '../styles/rules';
import { FORBIDDEN_MECHANICS } from './governance';

/**
 * The structural test `docs/ETHICAL-ENGAGEMENT-AND-NOTIFICATIONS.md` describes
 * and the blueprints require: the forbidden mechanics never reach a student
 * as words. It reads the app's user-facing text — JSX text and string
 * literals, comments blanked, the same extraction the vocabulary audit uses —
 * and refuses a leaderboard, a streak, a rank among people, or a shaming
 * reminder anywhere in it.
 *
 * Three exclusions, each said out loud. `community/governance.ts` is the
 * list of what is forbidden and `lib/communitiesregister.ts` records where
 * the refusal stands, so both name the things. Refusals in the app itself —
 * "no streak", "never a leaderboard" — are the product saying so and are
 * allowed by the negation rule below; a planted "Your streak: 4 days" is not.
 */

const SRC = join(import.meta.dirname, '..');
const SKIP = ['data/', 'content/', 'community/governance.ts', 'lib/communitiesregister.ts'];

export const FORBIDDEN_WORDS: readonly { id: string; match: RegExp }[] = [
  { id: 'leaderboard', match: /\bleader\s?boards?\b/i },
  { id: 'streak', match: /\bstreaks?\b/i },
  { id: 'rank among', match: /\brank(?:ed|ing)?\s+(?:among|against)\b/i },
  { id: 'falling behind', match: /\b(?:you'?re|you are)\s+falling behind\b/i },
  { id: "don't break", match: /\bdon'?t break (?:your|the)\b/i },
  { id: 'percentage of you', match: /\d+\s?% of you\b/i },
];

/** "no streak", "never a leaderboard", "without a streak", "not a ranking" — the product refusing, not offering. */
const NEGATED = /\b(?:no|never|not|without|nor|zero|isn'?t|aren'?t|forbids?|refuses?|bans?|banned)\s+(?:a\s+|an\s+|any\s+|the\s+)?(?:\w+\s+){0,2}$/i;

/** `r.streak` in `lib/review.ts` is the spaced-repetition card field — an algorithm input, never rendered. A property access is code the extractor mistook for text. */
const PROPERTY_ACCESS = /\.\w*$/;

function hits(): { file: string; line: number; id: string; text: string }[] {
  const out: { file: string; line: number; id: string; text: string }[] = [];
  for (const f of sources(SRC, { ext: ['.tsx', '.ts'], tests: false })) {
    const rel = f.path.slice(f.path.lastIndexOf('/src/') + 5);
    if (SKIP.some((d) => rel.startsWith(d))) continue;
    for (const p of prose(f.text)) {
      for (const w of FORBIDDEN_WORDS) {
        const m = w.match.exec(p.text);
        if (!m) continue;
        const before = p.text.slice(0, m.index);
        if (NEGATED.test(before) || PROPERTY_ACCESS.test(before)) continue;
        out.push({ file: rel, line: f.text.slice(0, p.at).split('\n').length, id: w.id, text: p.text.trim().slice(0, 80) });
      }
    }
  }
  return out;
}

describe('the forbidden mechanics never reach a student as words', () => {
  it('names the words the forbidden mechanics arrive as', () => {
    const forbidden = FORBIDDEN_MECHANICS.map((m) => m.what.toLowerCase()).join(' ');
    for (const w of ['streak', 'leaderboard']) expect(forbidden).toContain(w);
  });

  it('the negation rule tells a refusal from an offer', () => {
    const offer = 'Your streak: 4 days';
    const refusal = 'There is no streak, no percentage of you, and no comparison with anybody.';
    const w = FORBIDDEN_WORDS.find((x) => x.id === 'streak')!;
    expect(NEGATED.test(offer.slice(0, w.match.exec(offer)!.index))).toBe(false);
    expect(NEGATED.test(refusal.slice(0, w.match.exec(refusal)!.index))).toBe(true);
  });

  it('finds none in the app', () => {
    const found = hits();
    expect(found, found.map((h) => `${h.file}:${h.line} [${h.id}] ${h.text}`).join('\n')).toEqual([]);
  });
});
