import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { prose } from '../content/terms';
import { sources } from '../styles/rules';

/**
 * The calm-language guard: Semester never tells a student they are failing,
 * behind, or in trouble.
 *
 * What it reads is what `community/engagement.test.ts` reads, the app's
 * user-facing text — JSX text and string literals with comments blanked, by
 * the same `prose` extraction — under `components/`, `screens/` and `lib/`.
 * It refuses the phrases below. They are the ones that turn a planning tool
 * into a verdict: a forecast of failure, a standing declared at risk, a
 * judgement of effort, a percentage that frames progress as shortfall, or a
 * streak used to make someone feel guilty. What the app can say instead is
 * the plain fact and the next step ("3 of 8 readings done", "this is due
 * Friday").
 *
 * ## Refusals are allowed, offers are not
 *
 * The product saying it will never say these things is fine, and a quoted
 * example in a comment-turned-string is fine, but each must be written down.
 * `ALLOWED` is keyed by file and phrase, carries a reason, and must still
 * match something: an entry that stops matching fails the test, so the list
 * cannot rot into a blanket permission. A new phrase in a new file is not
 * allowed until someone has read it and said why.
 *
 * ## Out of scope, said out loud
 *
 * `*.test.*` files (they quote the phrases to test this), `data/` and
 * `content/` (a student's own course material and the vocabulary lists), and
 * `governance/` (the lists of what is forbidden name the things). Source
 * comments are blanked by `prose`, so a docstring describing a banned phrase
 * is not a hit.
 */

const SRC = join(import.meta.dirname, '..');
const ROOTS = ['components/', 'screens/', 'screens.tsx', 'lib/'];
const SKIP = ['data/', 'content/', 'governance/', 'docs/'];

export const BANNED: readonly { id: string; match: RegExp }[] = [
  { id: 'you will fail', match: /\byou\s+(?:will|are\s+going\s+to|'ll|’ll)\s+fail\b/i },
  { id: 'you are likely to fail', match: /\byou(?:\s+are|'re|’re)\s+likely\s+to\s+fail\b/i },
  { id: 'you need intervention', match: /\byou\s+need\s+(?:an\s+)?intervention\b/i },
  { id: 'your gpa will become', match: /\byour\s+gpa\s+will\s+(?:become|drop|fall|go)\b/i },
  { id: 'academic standing is at risk', match: /\bacademic\s+standing\s+(?:is|may\s+be|could\s+be)\s+at\s+risk\b/i },
  { id: 'your effort is insufficient', match: /\byour\s+effort\s+(?:is|was)\s+(?:insufficient|not\s+enough)\b/i },
  { id: 'you are behind', match: /\byou(?:\s+are|'re|’re)\s+(?:so\s+|way\s+|very\s+)?behind\b/i },
  { id: 'you are falling behind', match: /\byou(?:\s+are|'re|’re)\s+falling\s+behind\b/i },
  { id: 'you are not working enough', match: /\byou(?:\s+are\s+not|'re\s+not|’re\s+not|\s+aren'?t|\s+aren’t)\s+working\s+enough\b/i },
  { id: 'only N% complete', match: /\bonly\s+\d+\s?%\s+(?:complete|done|finished)\b/i },
  {
    id: 'streak guilt',
    match: /\b(?:you\s+(?:have\s+|'ve\s+|’ve\s+)?(?:broke|broken|lost|missed)\b[^.]{0,24}\bstreak|(?:don'?t|don’t|do\s+not)\s+(?:break|lose)\s+(?:your|the)\s+streak|streak\s+(?:is\s+)?(?:lost|broken|at\s+risk)|keep\s+(?:your|the)\s+streak)/i,
  },
];

/**
 * Permitted uses: the product refusing, or a phrase quoted to be refused.
 * Keyed by file (relative to `src/`) and phrase id. Empty is the goal.
 */
export const ALLOWED: readonly { file: string; id: string; reason: string }[] = [
  {
    file: 'lib/rollout-capabilities.ts',
    id: 'you are behind',
    reason:
      'The capability register entry CAP-006, "When You Are Behind", named as the supplied requirement names it. The student-facing screen is now "Catching up"; the register keeps the requirement\'s own name because the rollout documents generated from it and their traceability links use it, and it is never shown to a student.',
  },
];

export interface Hit {
  file: string;
  line: number;
  id: string;
  text: string;
}

/** Every banned phrase in one file's text. Exported for the checks below, which need to show the edges on snippets. */
export function findIn(file: string, text: string): Hit[] {
  const out: Hit[] = [];
  for (const p of prose(text)) {
    // Curly and straight apostrophes are the same word to a reader.
    const flat = p.text.replace(/[‘’]/g, "'");
    for (const b of BANNED) {
      if (!b.match.test(flat) && !b.match.test(p.text)) continue;
      out.push({ file, line: text.slice(0, p.at).split('\n').length, id: b.id, text: p.text.trim().slice(0, 90) });
    }
  }
  return out;
}

const inScope = (rel: string) => ROOTS.some((r) => rel === r || rel.startsWith(r)) && !SKIP.some((d) => rel.startsWith(d) || rel.includes(`/${d}`));

function scan(): Hit[] {
  const out: Hit[] = [];
  for (const f of sources(SRC, { ext: ['.tsx', '.ts'], tests: false })) {
    const rel = f.path.slice(f.path.lastIndexOf('/src/') + 5);
    if (!inScope(rel)) continue;
    out.push(...findIn(rel, f.text));
  }
  return out;
}

const allowed = (h: Hit) => ALLOWED.some((a) => a.file === h.file && a.id === h.id);

describe('the calm-language guard', () => {
  it('names every phrase, and each one matches an example of itself', () => {
    const examples: Record<string, string> = {
      'you will fail': 'You will fail this course.',
      'you are likely to fail': "You're likely to fail the exam.",
      'you need intervention': 'You need intervention now.',
      'your gpa will become': 'Your GPA will become 2.1.',
      'academic standing is at risk': 'Your academic standing is at risk.',
      'your effort is insufficient': 'Your effort is insufficient.',
      'you are behind': 'You are behind.',
      'you are falling behind': "You're falling behind.",
      'you are not working enough': "You aren't working enough.",
      'only N% complete': 'Only 40% complete',
      'streak guilt': "Don't break your streak!",
    };
    expect(BANNED.map((b) => b.id).sort()).toEqual(Object.keys(examples).sort());
    for (const b of BANNED) expect(findIn('x.ts', `const s = ${JSON.stringify(examples[b.id])};`).map((h) => h.id), b.id).toContain(b.id);
  });

  it('does not flag calm wording that shares words with the banned phrases', () => {
    const calm = [
      'This is due Friday.',
      '3 of 8 readings are done.',
      'Your streak is not tracked.',
      'You can catch up at your own pace.',
      'Behind the scenes, Semester stores nothing.',
      '40% complete',
    ];
    for (const c of calm) expect(findIn('x.ts', `const s = ${JSON.stringify(c)};`), c).toEqual([]);
  });

  it('blanks comments, so describing a phrase is not using it', () => {
    expect(findIn('x.ts', "// never say 'you will fail to a student'\nconst a = 1;")).toEqual([]);
  });

  it('finds the phrase in JSX text as well as in strings', () => {
    expect(findIn('x.tsx', '<p>You are falling behind.</p>').map((h) => h.id)).toContain('you are falling behind');
  });

  it('reads the app, so an empty scan cannot pass', () => {
    const files = sources(SRC, { ext: ['.tsx', '.ts'], tests: false }).map((f) => f.path.slice(f.path.lastIndexOf('/src/') + 5)).filter(inScope);
    expect(files.length).toBeGreaterThan(100);
    expect(files.some((f) => f.startsWith('components/'))).toBe(true);
    expect(files.some((f) => f.startsWith('screens/'))).toBe(true);
    expect(files.some((f) => f.startsWith('lib/'))).toBe(true);
    expect(files.some((f) => f.startsWith('data/') || f.startsWith('content/'))).toBe(false);
  });

  it('finds no banned phrase in student-facing text outside the allowlist', () => {
    const found = scan().filter((h) => !allowed(h));
    expect(found, found.map((h) => `${h.file}:${h.line} [${h.id}] ${h.text}`).join('\n')).toEqual([]);
  });

  it('holds no allowance that no longer matches anything, and gives a reason for each', () => {
    const live = scan();
    for (const a of ALLOWED) {
      expect(a.reason.trim().length, `${a.file} ${a.id}`).toBeGreaterThan(20);
      expect(live.some((h) => h.file === a.file && h.id === a.id), `stale allowance: ${a.file} [${a.id}]`).toBe(true);
    }
  });
});
