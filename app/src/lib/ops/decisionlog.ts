import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Where the programme's decisions are written, and how a new one is numbered.
 *
 * D-001 to D-160 are sections of `docs/DECISION-LOG.md`, numbered in turn.
 * That scheme collided whenever two pull requests were open at once: both
 * took the next number and both appended to the end of the same file. On 30
 * September one pull request was renumbered nine times, from D-139 to D-154,
 * each time rerunning CI. Once, D-148, a rebase went through cleanly with
 * two sections both called D-148, and nothing noticed.
 *
 * So every later decision has a file of its own, `docs/decisions/D-<n>.md`,
 * and `n` is the number of the pull request that records it. A pull request
 * number is unique, is known the moment the pull request is opened, and is
 * already far above 160. Two open pull requests can therefore neither take
 * the same number nor edit the same lines. The log keeps its first 160 and
 * takes no more.
 *
 * Read by the tests that hold a register's `decisions` to something written
 * down; nothing the app ships imports it.
 */

/** The last decision numbered in the log itself. */
export const LAST_IN_LOG = 160;

export const LOG = 'docs/DECISION-LOG.md';
export const DIR = 'docs/decisions';

/** A decision file's name: `D-1015.md`. */
export const FILE = /^D-(\d+)\.md$/;

/** Every `## D-n · title` heading in some text, in order. */
export function headings(text: string): number[] {
  return [...text.matchAll(/^## D-(\d+) ·/gm)].map((m) => Number(m[1]));
}

/** The log and every decision file, as `[path, text]`. */
export function sources(root: string): [string, string][] {
  const out: [string, string][] = [[LOG, readFileSync(join(root, LOG), 'utf8')]];
  const dir = join(root, DIR);
  if (existsSync(dir)) {
    for (const f of readdirSync(dir).sort()) {
      if (FILE.test(f)) out.push([`${DIR}/${f}`, readFileSync(join(dir, f), 'utf8')]);
    }
  }
  return out;
}

/** Whether `D-n` is written down, in the log or in its own file. */
export function written(root: string, id: string): boolean {
  const m = /^D-(\d+)$/.exec(id);
  if (!m) return false;
  const n = Number(m[1]);
  return sources(root).some(([, text]) => headings(text).includes(n));
}

/** Numbers that are the heading of more than one decision, anywhere. */
export function duplicates(numbers: number[]): number[] {
  const seen = new Set<number>();
  const twice = new Set<number>();
  for (const n of numbers) (seen.has(n) ? twice : seen).add(n);
  return [...twice].sort((a, b) => a - b);
}
