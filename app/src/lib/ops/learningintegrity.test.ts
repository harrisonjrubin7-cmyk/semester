import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The learning-science and academic-integrity pack, held to what it cites.
 *
 * `docs/learning-integrity/` is a set of requirements, each marked Held,
 * Partial or Absent against the tree. A pack that says "Held" and cites a file
 * that is not there, or counts its own rows wrongly, is the failure this file
 * exists to refuse: the status column is a claim about the repository, so the
 * repository is what it is checked against.
 *
 * What it holds:
 *   - every requirement id is written once, and carries a status;
 *   - a Held requirement names the file that holds it, or says it is held by
 *     absence (no grading tool exists, so none can grade);
 *   - every path the pack cites, in backticks or as a link, exists;
 *   - the roll-up in 08 is the count of the rows, not a figure somebody typed.
 *
 * It does not run the tests it cites. A Held row means the file exists and
 * states the property; `npm test` is what runs it.
 */

const root = join(import.meta.dirname, '../../../..');
const PACK = join(root, 'docs/learning-integrity');
const read = (f: string) => readFileSync(join(PACK, f), 'utf8');
const packFiles = () => readdirSync(PACK).filter((f) => f.endsWith('.md')).sort();

type Status = 'Held' | 'Partial' | 'Absent';
interface Row {
  id: string;
  today: string;
  status: Status | null;
}

/** A requirement row: `| LI-XXX-nn | text … | Today |`, status is the first word of the last cell. */
export function requirementRows(markdown: string): Row[] {
  const rows: Row[] = [];
  for (const line of markdown.split('\n')) {
    const m = /^\|\s*(LI-[A-Z]+-\d+)\s*\|(.*)\|\s*([^|]*?)\s*\|\s*$/.exec(line);
    if (!m) continue;
    const today = m[3]!;
    const word = /^(Held|Partial|Absent)\b/.exec(today)?.[1] as Status | undefined;
    rows.push({ id: m[1]!, today, status: word ?? null });
  }
  return rows;
}

/** A path as the pack writes it: from the repo root, or short from `app/src` or `app`. */
const PATH = /^(?:app|docs|supabase|packages|ops|lib|server|src)\/[A-Za-z0-9_./-]+$/;
const ROOTS = ['', 'app/src', 'app'];
const resolves = (p: string) => ROOTS.some((r) => existsSync(join(root, r, p)));
export const citedPaths = (text: string): string[] => [...text.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]!).filter((s) => PATH.test(s));

const linkTargets = (text: string): string[] =>
  [...text.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]!).filter((t) => !/^(https?:|mailto:|#)/.test(t)).map((t) => t.split('#')[0]!).filter(Boolean);

const heldEvidence = (today: string): boolean => /\bby (absence|design)\b/.test(today) || citedPaths(today).length > 0;

const requirementDocs = () => packFiles().filter((f) => /^0[1-7]-/.test(f));
const all = () => requirementDocs().flatMap((f) => requirementRows(read(f)).map((r) => ({ ...r, file: f })));

describe('the learning and integrity pack', () => {
  it('writes each requirement id once and gives it a status', () => {
    const rows = all();
    expect(rows.length).toBeGreaterThan(100);
    const seen = new Map<string, string>();
    for (const r of rows) {
      expect(seen.has(r.id), `${r.id} is written in ${seen.get(r.id)} and in ${r.file}`).toBe(false);
      seen.set(r.id, r.file);
    }
    // LI-PRC rows are conditions for enabling an integration, not statuses.
    const bad = rows.filter((r) => r.status === null && !r.id.startsWith('LI-PRC-'));
    expect(bad.map((r) => r.id), 'these rows do not start their Today cell with Held, Partial or Absent').toEqual([]);
  });

  it('says what holds a Held requirement: a file that exists, or that nothing can do it', () => {
    const bare = all().filter((r) => r.status === 'Held' && !heldEvidence(r.today));
    expect(bare.map((r) => r.id), 'name the file, or write "by absence" or "by design"').toEqual([]);
  });

  it('cites only files that exist', () => {
    const missing: string[] = [];
    for (const f of packFiles()) {
      const text = read(f);
      for (const p of citedPaths(text)) if (!resolves(p)) missing.push(`${f}: ${p}`);
      for (const t of linkTargets(text)) if (!existsSync(join(PACK, t))) missing.push(`${f}: link ${t}`);
    }
    expect(missing).toEqual([]);
  });

  it('rolls up to the rows: the table in 08 is the count, not a figure typed beside it', () => {
    const counts = new Map<string, Record<Status, number>>();
    for (const r of all()) {
      if (!r.status) continue;
      const area = r.id.split('-')[1]!;
      const c = counts.get(area) ?? { Held: 0, Partial: 0, Absent: 0 };
      c[r.status]++;
      counts.set(area, c);
    }
    const table = read('08-GOVERNANCE-AND-REQUIREMENTS-TRACE.md');
    let total = 0;
    for (const [area, c] of counts) {
      const line = table.split('\n').find((l) => new RegExp(`^\\|\\s*${area}\\s+—`).test(l));
      expect(line, `08 has no roll-up row for ${area}`).toBeDefined();
      const cells = line!.split('|').slice(2, 6).map((s) => Number(s.trim()));
      expect(cells, `08 row ${area}: total, held, partial, absent`).toEqual([c.Held + c.Partial + c.Absent, c.Held, c.Partial, c.Absent]);
      total += cells[0]!;
    }
    const sum = counts.size ? [...counts.values()].reduce((n, c) => n + c.Held + c.Partial + c.Absent, 0) : 0;
    expect(total).toBe(sum);
    expect(table, 'the bold total row').toContain(`| **Total** | **${sum}** |`);
  });

  // The controls: a parser that found nothing would pass every test above, so
  // each is shown the defect it is there to catch.
  describe('its checks see what they are for', () => {
    it('reads a row, its status and its evidence', () => {
      const [a, b, c] = requirementRows(
        [
          '| LI-X-01 | a thing | Held: `app/src/lib/cite.ts` |',
          '| LI-X-02 | another | Held |',
          '| LI-X-03 | a third | Partial: some of it |',
        ].join('\n'),
      );
      expect([a!.status, b!.status, c!.status]).toEqual(['Held', 'Held', 'Partial']);
      expect(heldEvidence(a!.today)).toBe(true);
      expect(heldEvidence(b!.today), 'a bare Held names nothing').toBe(false);
      expect(heldEvidence('Held by absence')).toBe(true);
    });

    it('finds a path that is not there, and one that is', () => {
      expect(citedPaths('see `app/src/lib/cite.ts` and `lib/no/such/file.ts` and `not/a/root.ts`')).toEqual([
        'app/src/lib/cite.ts',
        'lib/no/such/file.ts',
      ]);
      expect(resolves('lib/cite.ts')).toBe(true);
      expect(resolves('lib/no/such/file.ts')).toBe(false);
    });
  });
});
