import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ALLOWED_MECHANICS, COMMUNITY_PHASES, DESIGN_PRINCIPLE, FORBIDDEN_MECHANICS, LAUNCH_GATES, NON_GOALS, NOT_AN_EMERGENCY_SERVICE,
  NOT_PRIMARY_METRICS, OUTCOME_MEASURES, PACKAGES, READINESS_BRIEF, REVENUE_NOT_TAKEN, SEVERITY_LADDER, type CommunityPhase,
} from '../community/governance';
import { AREAS, ASSESSED_AT, ITEMS, STATUSES, areaOf } from './communitiesregister';
import { REGISTER } from './masterregister';

/**
 * Holds the Communities register to the same rule as the master and
 * expansion registers: every cited file exists, and each status cites the
 * kind of file it claims — `designed` a document, `building` code, `tested`
 * a test.
 *
 * `docs/COMMUNITIES-REGISTER.md` is rendered from the data; run
 * `npm run registers` from app/ to rewrite it. The last test fails while stale.
 */

const root = join(import.meta.dirname, '../../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const DOC = 'docs/COMMUNITIES-REGISTER.md';

const isDoc = (p: string) => /\.(md|pdf|json)$/.test(p) && !p.startsWith('.github/');
const isTest = (p: string) => /\.test\.tsx?$/.test(p) || /^supabase\/[^/]+\.check\.sql$/.test(p);
const isCode = (p: string) => !isDoc(p);

describe('the communities register', () => {
  it('has the eighteen areas of the blueprints, each with items, each in a blueprint phase', () => {
    expect(AREAS).toHaveLength(18);
    expect(new Set(AREAS.map((a) => a.id)).size).toBe(18);
    for (const a of AREAS) {
      expect(ITEMS.filter((i) => areaOf(i.id) === a).length, a.id).toBeGreaterThan(4);
      expect(Object.keys(COMMUNITY_PHASES).map(Number)).toContain(a.phase);
      expect(a.why.length, a.id).toBeGreaterThan(40);
    }
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
  });

  it('names only master-register rows that exist', () => {
    const ids = new Set(REGISTER.map((r) => r.id));
    for (const a of AREAS) {
      expect(a.master.length, `${a.id} names no master row`).toBeGreaterThan(0);
      for (const id of a.master) expect(ids.has(id), `${a.id} names ${id}`).toBe(true);
    }
  });

  it('can tell a missing file from a present one', () => {
    expect(existsSync(join(root, 'README.md'))).toBe(true);
    expect(existsSync(join(root, 'docs/no-such-communities-evidence.md'))).toBe(false);
  });

  it('cites only files that exist', () => {
    for (const i of ITEMS) for (const e of i.evidence) expect(existsSync(join(root, e.path)), `${i.id} cites ${e.path}`).toBe(true);
  });

  it('holds each status to the kind of file it claims', () => {
    for (const i of ITEMS) {
      const paths = i.evidence.map((e) => e.path);
      expect(STATUSES, i.id).toContain(i.status);
      if (i.status === 'designed') expect(paths.some(isDoc), `${i.id} is designed and cites no document`).toBe(true);
      if (i.status === 'building') expect(paths.some(isCode), `${i.id} is building and cites no code`).toBe(true);
      if (i.status === 'tested') expect(paths.some(isTest), `${i.id} is tested and cites no test`).toBe(true);
      if (i.status === 'not-started') expect(paths.some(isCode), `${i.id} is not started and cites code`).toBe(false);
    }
  });

  it('says what is missing for every item, since nothing here is evidenced', () => {
    for (const i of ITEMS) expect(i.gap.trim().length, i.id).toBeGreaterThanOrEqual(5);
  });

  it('puts phase 5 last and nothing tested in it that the deferred list forbids', () => {
    const five = AREAS.filter((a) => a.phase === 5);
    expect(five.map((a) => a.id)).toEqual(['INT']);
    const items = ITEMS.filter((i) => areaOf(i.id).phase === 5 && i.status === 'tested');
    for (const i of items) expect(i.item.toLowerCase()).not.toMatch(/marketplace|payment|ride|social feed/);
  });

  it('is what docs/COMMUNITIES-REGISTER.md says', () => {
    const rendered = render();
    if (process.env.REGISTERS === 'write') writeFileSync(join(root, DOC), rendered);
    expect(read(DOC), `${DOC} is stale; run \`npm run registers\` from app/`).toBe(rendered);
  });
});

// ── rendering ────────────────────────────────────────────────────────────────

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');

function render(): string {
  const count = (s: string, rows = ITEMS) => rows.filter((i) => i.status === s).length;
  const out: string[] = [
    '# Semester Communities Register',
    '',
    '<!-- Rendered from app/src/lib/communitiesregister.ts and app/src/community/governance.ts by communitiesregister.test.ts. Edit the data, then run `npm run registers` from app/. -->',
    '',
    '> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).',
    '',
    'Every capability the four community blueprints of September 2026 name —',
    'discovery, clubs, recognition, events, circles, mentorship, questions, safety,',
    'moderation, privacy, services, opportunity, the life graph, accessibility,',
    'supporters and employers, integrations, governance and engagement — and',
    'where the repository stands on each. What must be true **at launch** is the',
    '[master register](MASTER-LAUNCH-READINESS-REGISTER.md) and what makes',
    'Semester durable after it is the [strategic expansion',
    'register](STRATEGIC-EXPANSION-REGISTER.md); each area here names the master',
    'rows it overlaps rather than restating them.',
    '',
    `**The design principle:** ${DESIGN_PRINCIPLE}`,
    '',
    '**What it is not:**',
    '',
    ...NON_GOALS.map((n) => `- ${n}`),
    '',
    `Statuses were assessed against \`origin/main\` at \`${ASSESSED_AT}\`; a test holds each`,
    'to the kind of file it cites. Nothing is above `tested`, because nothing has',
    'an artifact under `docs/evidence/`.',
    '',
    '## Where it stands',
    '',
    `| Area | Phase | Items | ${STATUSES.join(' | ')} |`,
    `| --- | ---: | ---: | ${STATUSES.map(() => '---:').join(' | ')} |`,
  ];
  for (const a of AREAS) {
    const rows = ITEMS.filter((i) => areaOf(i.id) === a);
    out.push(`| [${a.id}](#${a.id.toLowerCase()}) ${a.title} | ${a.phase} | ${rows.length} | ${STATUSES.map((s) => count(s, rows)).join(' | ')} |`);
  }
  out.push(`| **total** | | **${ITEMS.length}** | ${STATUSES.map((s) => `**${count(s)}**`).join(' | ')} |`, '');

  out.push('## The five phases', '', 'Do not launch every social and community function at once. An area sits in the phase of its first useful build.', '', '| Phase | Build | Why | Areas |', '| ---: | --- | --- | --- |');
  for (const p of Object.keys(COMMUNITY_PHASES).map(Number) as CommunityPhase[]) {
    const ph = COMMUNITY_PHASES[p];
    out.push(`| ${p} — ${ph.name} | ${cell(ph.build)} | ${cell(ph.why)} | ${AREAS.filter((a) => a.phase === p).map((a) => a.id).join(', ') || '—'} |`);
  }
  out.push('');

  out.push('## The register', '');
  for (const a of AREAS) {
    out.push(`### ${a.id}`, '', `**${a.title}.** ${a.why} Phase ${a.phase}. Overlaps master rows ${a.master.map((m) => `\`${m}\``).join(', ')}.`, '');
    out.push('| ID | Item | Status | Evidence | Gap |', '| --- | --- | --- | --- | --- |');
    for (const i of ITEMS.filter((x) => areaOf(x.id) === a)) {
      const ev = i.evidence.length ? i.evidence.map((e) => `\`${e.path}\` — ${cell(e.shows)}`).join('<br>') : '—';
      out.push(`| ${i.id} | ${cell(i.item)} | ${i.status} | ${ev} | ${cell(i.gap)} |`);
    }
    out.push('');
  }

  out.push(
    '## The Feature Readiness Brief',
    '',
    'Before any community, AI, campus-life, career, payments or operations feature',
    'is developed, `brief()` in `community/governance.ts` needs a written answer to',
    'each of these. A blank is a no; so is a bare "yes".',
    '',
    ...READINESS_BRIEF.map((q) => `- [ ] ${q.ask}`),
    '',
    '## Launch gates',
    '',
    'Before a community or mentorship programme is enabled for a tenant,',
    '`readyToEnable()` needs each of these signed, dated and evidenced.',
    '`community_programs.approved_ref` is where the record is cited.',
    '',
    ...LAUNCH_GATES.map((g) => `- [ ] ${g.ask}`),
    '',
    '## Severity',
    '',
    `${NOT_AN_EMERGENCY_SERVICE}`,
    '',
    '| Level | Example | Immediate response | Human owner | Target | Opens a case |',
    '| --- | --- | --- | --- | --- | --- |',
    ...SEVERITY_LADDER.map((s) => `| ${s.level} | ${cell(s.example)} | ${cell(s.response)} | ${cell(s.owner)} | ${cell(s.target)} | ${s.opensCase ? 'yes' : 'no'} |`),
    '',
    'The target is what a tenant\'s staffed operation commits to at the `sla` gate,',
    'never a promise the app makes; `community_cases` implements P0–P3, and P4 is',
    'the level that opens no case.',
    '',
    '## Engagement mechanics',
    '',
    '| Mechanic | Use | Rule |',
    '| --- | --- | --- |',
    ...ALLOWED_MECHANICS.map((m) => `| ${cell(m.mechanic)} | ${cell(m.use)} | ${cell(m.rule)} |`),
    '',
    'Never built, and `community/engagement.test.ts` reads the app\'s rendered text for the words they arrive as:',
    '',
    ...FORBIDDEN_MECHANICS.map((f) => `- **${f.what}.** ${f.why}`),
    '',
    '## Packaging',
    '',
    'Sold to institutions; never funded by students. Shape, not price: there is no approved price book.',
    '',
    '| Package | Includes | Buyer | Pricing logic | Phase |',
    '| --- | --- | --- | --- | ---: |',
    ...PACKAGES.map((p) => `| ${p.name} | ${cell(p.includes)} | ${cell(p.buyer)} | ${cell(p.pricing)} | ${p.phase} |`),
    '',
    '**Revenue not taken:**',
    '',
    ...REVENUE_NOT_TAKEN.map((r) => `- ${r}`),
    '',
    '## What it is measured by',
    '',
    `Never ${NOT_PRIMARY_METRICS.join(', ')} as the primary metric. Activity is paired with an outcome:`,
    '',
    ...OUTCOME_MEASURES.map((m) => `- ${m}`),
    '',
  );
  return out.join('\n');
}
