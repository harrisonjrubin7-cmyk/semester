import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DIR, FILE, LAST_IN_LOG, LOG, duplicates, headings, sources, written } from './decisionlog';

/**
 * Decisions are numbered so that two open pull requests cannot collide: the
 * log keeps D-001 to D-160, and each later decision is its own file named for
 * the pull request that records it. See `decisionlog.ts` for why.
 */

const root = join(import.meta.dirname, '../../../..');

const ADR_SIDECARS = new Set([
  'ADR_TEMPLATE.md',
  'ADR_INDEX.md',
  'DECISION_BACKLOG.md',
  'proposed',
  'accepted',
  'superseded',
  'deprecated',
]);

describe('the decision record', () => {
  it('has no number written down twice, in the log or across the files', () => {
    const all = sources(root).flatMap(([, text]) => headings(text));
    expect(all.length).toBeGreaterThan(100);
    expect(duplicates(all)).toEqual([]);
  });

  it('takes no new decision into the log: after D-160 each is a file in docs/decisions/', () => {
    const late = headings(readFileSync(join(root, LOG), 'utf8')).filter((n) => n > LAST_IN_LOG);
    expect(late, `write these as ${DIR}/D-<pull request number>.md instead`).toEqual([]);
  });

  it('names each decision file for the one decision it holds, numbered past the log', () => {
    for (const f of readdirSync(join(root, DIR))) {
      if (f === 'README.md') continue;
      // The ADR program (docs/decisions/README.md, "ADR program") keeps its own
      // template, index, backlog and status folders here; ADR files live in the
      // folders and are numbered ADR-nnnn, a separate namespace from D-n.
      if (ADR_SIDECARS.has(f)) continue;
      const m = FILE.exec(f);
      expect(m, `${DIR}/${f} is not named D-<pull request number>.md`).not.toBeNull();
      const n = Number(m![1]);
      expect(n, `${f}: a file's number is its pull request's, past ${LAST_IN_LOG}`).toBeGreaterThan(LAST_IN_LOG);
      expect(headings(readFileSync(join(root, DIR, f), 'utf8')), `${f} must hold exactly its own heading, ## D-${n} · …`).toEqual([n]);
    }
  });

  it('finds a decision in either place, and nothing that is not written', () => {
    expect(written(root, 'D-001')).toBe(true);
    expect(written(root, `D-${LAST_IN_LOG}`)).toBe(true);
    expect(written(root, 'D-99999')).toBe(false);
    expect(written(root, 'ADR-0001')).toBe(false);
  });

  // The control: a checker that found nothing would pass the first test on
  // any record, so it is shown the duplicate that did land once.
  it('sees a duplicate when there is one', () => {
    expect(duplicates(headings('## D-147 · a\n\n## D-148 · b\n\n## D-148 · c\n'))).toEqual([148]);
    expect(duplicates([1, 2, 3])).toEqual([]);
  });
});
