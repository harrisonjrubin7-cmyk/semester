import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BUILT_HERE,
  DECISION_FILES,
  DEFER,
  ITEMS,
  PLATFORM,
  POINTS,
  PRIORITIES,
  RULE,
  RULE_MINIMUM,
  SOURCES,
  STANDINGS,
  STANDING_MEANING,
  TIER_TITLE,
  WAVES,
  prioritised,
  type Item,
  type Tier,
} from './blueprint';
import { REGISTER } from './masterregister';

/**
 * The blueprint crosswalk is worth having only if it cannot claim more than
 * the tree shows, and cannot point at a master row that is not there. So:
 *
 *   - every cited path exists, with a control that a missing one reads missing;
 *   - every cited master row is a row of the master register;
 *   - `built` cites a test, `partial` cites code, `not-built` cites no code,
 *     and `held` cites one of the files a decision is written in;
 *   - the decision rule refuses one criterion, an unknown one and a deferral,
 *     and everything this change built passes it.
 *
 * `docs/MODERNIZATION-BLUEPRINT.md` is rendered from the data; run
 * `npm run registers` from app/ to rewrite it. The last test fails while stale.
 */

const root = join(import.meta.dirname, '../../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const DOC = 'docs/MODERNIZATION-BLUEPRINT.md';

const isDoc = (p: string) => /\.(md|pdf|json)$/.test(p) && !p.startsWith('.github/');
const isTest = (p: string) =>
  /\.test\.tsx?$/.test(p) || /^supabase\/[^/]+\.check\.sql$/.test(p) || /^app\/scripts\/.*smoke.*\.mjs$/.test(p) || p === 'supabase/restore.sh';
const isCode = (p: string) => !isDoc(p);
const rowIds = new Set(REGISTER.map((r) => r.id));

describe('the modernization blueprint crosswalk', () => {
  describe('its shape', () => {
    it('keeps the three supplied documents, and they are where it says', () => {
      expect(SOURCES).toHaveLength(3);
      for (const s of SOURCES) expect(existsSync(join(root, s.path)), s.path).toBe(true);
    });

    it('has twelve points, twenty-seven priorities in tier order, and the platform items, each id once', () => {
      expect(POINTS).toHaveLength(12);
      expect(PRIORITIES).toHaveLength(27);
      const ids = ITEMS.map((i) => i.id);
      expect(new Set(ids).size).toBe(ids.length);
      const order: Tier[] = ['P0', 'P1', 'P2', 'P3'];
      const tiers = PRIORITIES.map((p) => order.indexOf(p.tier));
      expect(tiers.every((t, i) => t >= 0 && (i === 0 || t >= tiers[i - 1]))).toBe(true);
      expect(PRIORITIES.filter((p) => p.tier === 'P0')).toHaveLength(8);
      for (const p of PRIORITIES) expect(TIER_TITLE[p.tier]).toBeTruthy();
      expect(PLATFORM.map((i) => i.id.split('-')[0])).toEqual(expect.arrayContaining(['BE', 'OC', 'CO']));
    });

    it('says what each item asks, where it stands, and what is missing', () => {
      for (const i of ITEMS) {
        expect(i.item.trim(), i.id).toBeTruthy();
        expect(i.asks.trim(), i.id).toBeTruthy();
        expect(STANDINGS, i.id).toContain(i.standing);
        expect(i.gap.trim().length, `${i.id} names no gap`).toBeGreaterThan(12);
      }
      for (const s of STANDINGS) expect(STANDING_MEANING[s]).toBeTruthy();
    });

    it('lists the five waves in order', () => {
      expect(WAVES.map((w) => w.id)).toEqual(['Wave 0', 'Wave 1', 'Wave 2', 'Wave 3', 'Wave 4']);
      for (const w of WAVES) expect(w.items.length, w.id).toBeGreaterThan(0);
    });
  });

  describe('its evidence', () => {
    it('can tell a missing file from a present one', () => {
      expect(existsSync(join(root, 'README.md'))).toBe(true);
      expect(existsSync(join(root, 'app/src/lib/no-such-blueprint-evidence.ts'))).toBe(false);
    });

    it('cites only files that exist', () => {
      for (const i of ITEMS) {
        for (const { path } of i.evidence) expect(existsSync(join(root, path)), `${i.id} cites ${path}, which is missing`).toBe(true);
      }
    });

    it('points only at master rows that exist', () => {
      expect(rowIds.has('STU-001')).toBe(true);
      expect(rowIds.has('STU-999')).toBe(false);
      for (const i of ITEMS) for (const row of i.rows) expect(rowIds.has(row), `${i.id} points at ${row}`).toBe(true);
    });

    it('holds each standing to the kind of file it claims', () => {
      for (const i of ITEMS) {
        const paths = i.evidence.map((e) => e.path);
        if (i.standing === 'built') expect(paths.some(isTest), `${i.id} is built and cites no test`).toBe(true);
        if (i.standing === 'partial') expect(paths.some(isCode), `${i.id} is partial and cites no code`).toBe(true);
        if (i.standing === 'not-built') expect(paths.filter(isCode), `${i.id} is not-built but cites code`).toEqual([]);
        if (i.standing === 'held') expect(paths.some((p) => DECISION_FILES.includes(p)), `${i.id} is held and cites no decision`).toBe(true);
      }
    });

    it('would refuse a standing the tree does not show', () => {
      // The guard against the fault it exists for: a not-built item citing code.
      const claim: Item = { ...POINTS[0], standing: 'not-built' };
      expect(claim.evidence.map((e) => e.path).filter(isCode).length).toBeGreaterThan(0);
      const held: Item = { ...PRIORITIES[1], standing: 'held' };
      expect(held.evidence.some((e) => DECISION_FILES.includes(e.path))).toBe(false);
    });
  });

  describe('the decision rule', () => {
    it('has the ten criteria and the five deferrals', () => {
      expect(RULE).toHaveLength(10);
      expect(DEFER).toHaveLength(5);
      expect(RULE_MINIMUM).toBe(2);
    });

    it('passes on two criteria and refuses one, a repeat, an unknown one, or a deferral', () => {
      expect(prioritised([RULE[0], RULE[3]])).toBe(true);
      expect(prioritised([RULE[0]])).toBe(false);
      expect(prioritised([RULE[0], RULE[0]])).toBe(false);
      expect(prioritised([RULE[0], 'Looks impressive in a demo.'])).toBe(false);
      // Two real reasons do not carry a made-up third.
      expect(prioritised([RULE[0], RULE[3], 'Looks impressive in a demo.'])).toBe(false);
      expect(prioritised([RULE[0], RULE[3]], [DEFER[2]])).toBe(false);
    });

    it('is passed by everything this change built', () => {
      expect(BUILT_HERE.length).toBeGreaterThan(0);
      for (const b of BUILT_HERE) expect(prioritised(b.criteria), b.what).toBe(true);
    });
  });

  it('is what docs/MODERNIZATION-BLUEPRINT.md says', () => {
    const rendered = render();
    if (process.env.REGISTERS === 'write') writeFileSync(join(root, DOC), rendered);
    expect(read(DOC), `${DOC} is stale; run \`npm run registers\` from app/`).toBe(rendered);
  });
});

// ── rendering ────────────────────────────────────────────────────────────────

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const rows = (i: Item) => (i.rows.length ? i.rows.map((r) => `\`${r}\``).join('<br>') : '—');
const evidence = (i: Item) => (i.evidence.length ? i.evidence.map((e) => `\`${e.path}\` — ${cell(e.shows)}`).join('<br>') : '—');

function table(items: readonly Item[]): string[] {
  return [
    '| ID | Item | The blueprint asks for | Master rows | Standing | Evidence | Gap |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...items.map((i) => `| ${i.id} | ${cell(i.item)} | ${cell(i.asks)} | ${rows(i)} | ${i.standing} | ${evidence(i)} | ${cell(i.gap)} |`),
    '',
  ];
}

function render(): string {
  const count = (items: readonly Item[], s: string) => items.filter((i) => i.standing === s).length;
  const rowless = ITEMS.filter((i) => i.rows.length === 0);
  const out: string[] = [
    '# Modernization Blueprint — the crosswalk',
    '',
    '<!-- Rendered from app/src/lib/blueprint.ts by blueprint.test.ts. Edit the data, then run `npm run registers` from app/. -->',
    '',
    'Three documents arrived on 28 September 2026 and are kept under `docs/expansion/`',
    'as supplied. Nearly everything they ask for is already a row of the',
    '[master launch readiness register](MASTER-LAUNCH-READINESS-REGISTER.md): the two',
    'plans describe the same platform. So this is not a second register. It is the',
    'blueprint\'s own structure with each item pointed at the master rows that carry',
    'it, and a standing read off the tree, so a reader of the blueprint can find where',
    'each thing it names actually is. Where the blueprint conflicts with a decision',
    'already on main, the decision holds until the owner reopens it',
    '([DECISION-LOG.md](DECISION-LOG.md) D-108).',
    '',
    '| Supplied document | What it holds |',
    '| --- | --- |',
    ...SOURCES.map((s) => `| [${s.title}](${s.path.replace(/^docs\//, '')}) | ${cell(s.what)} |`),
    '',
    '## Where it stands',
    '',
    'Standings were read at `origin/main` `fd8fc0b`, before the changes in the same pull',
    'request as this file, except where the evidence names those changes. A test holds',
    'every cited file to existing, every cited row to the master register, and each',
    'standing to the kind of file it cites.',
    '',
    '| Standing | Meaning | Points | Priorities | Platform |',
    '| --- | --- | ---: | ---: | ---: |',
    ...STANDINGS.map((s) => `| ${s} | ${STANDING_MEANING[s]} | ${count(POINTS, s)} | ${count(PRIORITIES, s)} | ${count(PLATFORM, s)} |`),
    `| **total** | | **${POINTS.length}** | **${PRIORITIES.length}** | **${PLATFORM.length}** |`,
    '',
    rowless.length
      ? `Items no master row carries: ${rowless.map((i) => `\`${i.id}\``).join(', ')}. Each is a finding about the master register.`
      : 'Every item is carried by at least one master row.',
    '',
    '## The twelve points',
    '',
    ...table(POINTS),
    '## The front-end order',
    '',
    'The blueprint\'s twenty-seven priorities in its four tiers. A feature cannot leave',
    'preview without shared components, 320px behaviour, keyboard success, a screen-reader',
    'pass, focus and contrast, every state, source and privacy treatment, monitoring, a',
    'flag and rollback, and a help route — the gate in',
    '[COMPONENT-RELEASE-CHECKLIST.md](COMPONENT-RELEASE-CHECKLIST.md), which no test yet enforces.',
    '',
  ];
  for (const tier of Object.keys(TIER_TITLE) as Tier[]) {
    out.push(`### ${tier} — ${TIER_TITLE[tier]}`, '', ...table(PRIORITIES.filter((p) => p.tier === tier)));
  }
  out.push(
    '## Backend, console and company',
    '',
    ...table(PLATFORM),
    '## The waves',
    '',
    '| Wave | Title | Items |',
    '| --- | --- | --- |',
    ...WAVES.map((w) => `| ${w.id} | ${w.title} | ${w.items.map(cell).join('<br>')} |`),
    '',
    '## The decision rule',
    '',
    `Prioritise work that does at least ${RULE_MINIMUM} of the following (\`prioritised()\` in \`blueprint.ts\`):`,
    '',
    ...RULE.map((r) => `- ${r}`),
    '',
    'Defer work that is:',
    '',
    ...DEFER.map((d) => `- ${d}`),
    '',
    '### What this change built, by the rule',
    '',
    '| Built | Criteria |',
    '| --- | --- |',
    ...BUILT_HERE.map((b) => `| ${cell(b.what)} | ${b.criteria.map(cell).join('<br>')} |`),
    '',
  );
  return out.join('\n');
}
