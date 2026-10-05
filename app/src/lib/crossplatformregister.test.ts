import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FEATURES, SOURCE, STATUSES, present } from './crossplatformregister';

/**
 * Holds the cross-platform features register to the rule the service register
 * keeps: every cited file exists, each status cites the kind of file it
 * claims, a capability is present only where the feature cites code, and no
 * feature claims all of its capabilities. The supplied document is never
 * evidence.
 *
 * `docs/CROSS-PLATFORM-FEATURES-REGISTER.md` is rendered from the data; run
 * `npm run registers` from app/ to rewrite it. The last test fails while stale.
 */

const root = join(import.meta.dirname, '../../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const DOC = 'docs/CROSS-PLATFORM-FEATURES-REGISTER.md';

const isDoc = (p: string) => /\.(md|pdf|json)$/.test(p) && !p.startsWith('.github/');
const isTest = (p: string) => /\.test\.tsx?$/.test(p) || /^supabase\/[^/]+\.check\.sql$/.test(p);
const isCode = (p: string) => !isDoc(p);

describe('the cross-platform features register', () => {
  it('has the fifteen features once each, in order', () => {
    expect(FEATURES).toHaveLength(15);
    expect(FEATURES.map((f) => f.id)).toEqual(Array.from({ length: 15 }, (_, i) => `X${String(i + 1).padStart(2, '0')}`));
    for (const f of FEATURES) {
      expect(f.capabilities.length, f.id).toBeGreaterThanOrEqual(3);
      expect(f.gap.trim().length, f.id).toBeGreaterThan(20);
    }
  });

  it('ranks the document’s ten priorities; its fifth is two features, the contract and the fairness engine', () => {
    const ranks = FEATURES.map((f) => f.priority).filter((p): p is number => p !== null).sort((a, b) => a - b);
    expect(ranks).toEqual([1, 2, 3, 4, 5, 5, 6, 7, 8, 9, 10]);
  });

  it('cites only files that exist, and never the supplied document', () => {
    expect(SOURCE.title.length).toBeGreaterThan(0);
    for (const f of FEATURES) for (const ev of f.evidence) {
      expect(existsSync(join(root, ev.path)), `${f.id} cites ${ev.path}`).toBe(true);
      expect(/\.pdf$/.test(ev.path), `${f.id} cites a PDF`).toBe(false);
    }
  });

  it('holds each status to the kind of file it claims', () => {
    for (const f of FEATURES) {
      const paths = f.evidence.map((x) => x.path);
      expect(STATUSES, f.id).toContain(f.status);
      if (f.status === 'designed') expect(paths.some(isDoc), `${f.id} is designed and cites no document`).toBe(true);
      if (f.status === 'building') expect(paths.some(isCode), `${f.id} is building and cites no code`).toBe(true);
      if (f.status === 'tested') expect(paths.some(isTest), `${f.id} is tested and cites no test`).toBe(true);
      if (f.status === 'not-started') expect(paths.every(isDoc), `${f.id} is not started yet cites code`).toBe(true);
    }
  });

  it('marks a capability present only where the feature cites code, and never all of them', () => {
    for (const f of FEATURES) {
      if (present(f) > 0) expect(f.evidence.some((x) => isCode(x.path)), `${f.id} marks capabilities present with no code cited`).toBe(true);
      expect(present(f), `${f.id} claims every capability`).toBeLessThan(f.capabilities.length);
      if (f.status === 'not-started') expect(present(f), f.id).toBe(0);
    }
  });

  it(`is what ${DOC} says`, () => {
    const rendered = render();
    if (process.env.REGISTERS === 'write') writeFileSync(join(root, DOC), rendered);
    expect(read(DOC), `${DOC} is stale; run \`npm run registers\` from app/`).toBe(rendered);
  });
});

// ── rendering ────────────────────────────────────────────────────────────────

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');

function render(): string {
  const caps = FEATURES.reduce((n, f) => n + f.capabilities.length, 0);
  const have = FEATURES.reduce((n, f) => n + present(f), 0);
  const count = (s: string) => FEATURES.filter((f) => f.status === s).length;
  const out: string[] = [
    '# Cross-platform Features Register',
    '',
    '<!-- Rendered from app/src/lib/crossplatformregister.ts by crossplatformregister.test.ts. Edit the data, then run `npm run registers` from app/. -->',
    '',
    '> Decision: D-156 in [`DECISION-LOG.md`](DECISION-LOG.md) (proposed, needs owner).',
    '',
    `The fifteen features in a document of 30 September 2026 — “${SOURCE.title}” — and where the repository stands on each. ${SOURCE.what} The document is not cited as evidence.`,
    '',
    'A status describes the *best* piece of a feature; the capability marks say how',
    'much is there. A capability the student cannot yet set or see on a screen is',
    'marked absent even where the model for it exists.',
    `Across the register, ${have} of ${caps} capabilities have something in the tree.`,
    '',
    '| ID | Feature | Priority | Status | Present |',
    '| --- | --- | ---: | --- | ---: |',
  ];
  for (const f of FEATURES) out.push(`| [${f.id}](#${f.id.toLowerCase()}) | ${cell(f.title)} | ${f.priority ?? '—'} | ${f.status} | ${present(f)} / ${f.capabilities.length} |`);
  out.push(`| **total** | | | ${STATUSES.map((s) => `${s} ${count(s)}`).join(', ')} | **${have} / ${caps}** |`, '', '## The register', '');
  for (const f of FEATURES) {
    out.push(`### ${f.id}`, '', `**${f.title}.** *Home:* ${f.home}.`, '', `*Status.* ${f.status}, ${present(f)} of ${f.capabilities.length} capabilities present.`, '');
    for (const x of f.capabilities) out.push(`- [${x.have ? 'x' : ' '}] ${x.what}`);
    if (f.evidence.length) {
      out.push('', '| Evidence | Shows |', '| --- | --- |');
      for (const ev of f.evidence) out.push(`| \`${ev.path}\` | ${cell(ev.shows)} |`);
    }
    out.push('', `*Gap.* ${f.gap}`, '', `*Overlaps.* ${f.overlaps}`, '');
  }
  return out.join('\n');
}
