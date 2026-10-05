import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A duration is a token unless somebody wrote down why it is not (DD-007).
 *
 * The stylesheets and the inline styles carried transition times from 90 ms to
 * 1.6 s, and no two components agreed on how long "a panel opens" takes. The
 * tokens exist — `--duration-fast`, `-standard`, `-slow`, `-sheet`, and the
 * `--motion-*` roles in `tokens.css` — and the reduced-motion and Less motion
 * rules zero every one of them. What did not exist was anything that stopped a
 * new literal arriving.
 *
 * So this is a ledger, in the same shape as `styles/budget.ts` and
 * `styles/hex.test.ts`: every literal time inside a `transition` or
 * `animation` declaration is either gone or listed below with its reason, and
 * an entry that no longer matches anything is itself a failure, so the list can
 * only get shorter. The `0.001ms` the blanket reduced-motion rules write is
 * the one value that is always allowed: it is how motion is switched off.
 */

interface Owed {
  file: string;
  /** The declaration's value, as written. */
  value: string;
  why: string;
}

/** Literals that stay. Each one is choreography or a measurement, not a UI transition. */
export const LEDGER: Owed[] = [
  { file: 'ai/Turns.tsx', value: 'aiPulse 1.1s ${i * 0.16}s infinite ease-in-out', why: 'The three-dot "thinking" pulse: a loop staggered by index, not a state change. Stilled by the blanket reduced-motion rule.' },
  { file: 'screens/Gap.tsx', value: 'width 500ms linear', why: 'A bar that follows elapsed time; a 180ms tween would stutter between one-second ticks and a longer one would misstate progress.' },
  { file: 'screens/call/Green.tsx', value: 'width 90ms linear', why: 'A live microphone level meter. It has to track the signal, so it is faster than any UI duration on purpose.' },
  { file: 'styles/app.css', value: 'micLive 1.6s ease-in-out infinite', why: 'The "microphone is live" indicator loop. Only runs under prefers-reduced-motion: no-preference.' },
  { file: 'styles/app.css', value: 'opacity 340ms ease', why: 'The splash curtain leaving; part of the one-off launch sequence below.' },
  { file: 'styles/app.css', value: 'splash-rise 520ms cubic-bezier(0.22, 0.61, 0.36, 1) both', why: 'Launch splash choreography, timed against its own slab; see the note above these rules.' },
  { file: 'styles/app.css', value: 'splash-slab 560ms cubic-bezier(0.22, 0.61, 0.36, 1) both', why: 'Launch splash choreography, timed against its own rise; see the note above these rules.' },
  { file: 'styles/app.css', value: '90ms', why: 'Splash stagger offset: a delay between two parts of one sequence, not a duration.' },
  { file: 'styles/app.css', value: '180ms', why: 'Splash stagger offset: a delay between two parts of one sequence, not a duration.' },
];

const SRC = new URL('..', import.meta.url).pathname;

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(css|tsx?)$/.test(e.name) && !/\.test\./.test(e.name) && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

const strip = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`])\/\/[^\n]*/g, (m, a) => a + ' '.repeat(m.length - a.length));

/**
 * Every transition/animation declaration whose value holds a literal time.
 *
 * The whole declaration is read, not the line it starts on: a stylesheet writes
 * `transition:` and puts the value on the next line (`app.css` does), and a
 * line-by-line read saw an empty value there and let a literal through. CSS
 * runs to its `;` or `}`. In a `.tsx` style object there is no `;`, so the
 * value is the rest of its line, and the next line too when it opens empty.
 */
export function literals(): { file: string; line: number; value: string }[] {
  const found: { file: string; line: number; value: string }[] = [];
  const HEAD = /\b(?:transition|animation)(?:-duration|-delay)?\s*:/g;
  for (const path of walk(SRC)) {
    const text = strip(readFileSync(path, 'utf8'));
    const file = path.slice(SRC.length);
    const css = path.endsWith('.css');
    for (const m of text.matchAll(HEAD)) {
      const from = m.index! + m[0].length;
      let end: number;
      if (css) {
        const semi = text.indexOf(';', from);
        const brace = text.indexOf('}', from);
        end = Math.min(...[semi, brace].filter((i) => i >= 0), text.length);
      } else {
        let eol = text.indexOf('\n', from);
        if (eol < 0) eol = text.length;
        end = eol;
        // `transition:` alone on its line: the value is on the next one.
        if (text.slice(from, eol).trim() === '') {
          const next = text.indexOf('\n', eol + 1);
          end = next < 0 ? text.length : next;
        }
      }
      const value = text
        .slice(from, end)
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/[;,]$/, '')
        .replace(/^['"`]|['"`]$/g, '')
        .trim();
      // A literal time: digits then s/ms, not the tail of a var() name.
      const times = [...value.matchAll(/(?<![\w-])(\d*\.?\d+)(ms|s)\b/g)].filter((t) => t[0] !== '0.001ms' && t[0] !== '0ms');
      if (times.length) found.push({ file, line: text.slice(0, m.index!).split('\n').length, value });
    }
  }
  return found;
}

describe('durations are tokens, or they are on the ledger', () => {
  const now = literals();

  it('has no literal time that is not listed with a reason', () => {
    const unlisted = now.filter((f) => !LEDGER.some((o) => o.file === f.file && o.value === f.value));
    expect(
      unlisted.map((f) => `${f.file}:${f.line}  ${f.value}`),
      'use var(--duration-fast|standard|slow|sheet) or a --motion-* role, or add the value to LEDGER with a reason',
    ).toEqual([]);
  });

  it('lists nothing that has since been fixed', () => {
    const stale = LEDGER.filter((o) => !now.some((f) => f.file === o.file && f.value === o.value));
    expect(stale.map((o) => `${o.file}  ${o.value}`), 'delete the entry: the literal is gone').toEqual([]);
  });

  it('gives every entry a reason', () => {
    for (const o of LEDGER) expect(o.why.trim().length, `${o.file}  ${o.value}`).toBeGreaterThan(15);
  });

  it('reads the tree at all', () => {
    // A scan over nothing passes without checking anything.
    expect(walk(SRC).length).toBeGreaterThan(200);
    expect(readFileSync(join(SRC, 'styles/tokens.css'), 'utf8')).toContain('--duration-standard');
  });
});
