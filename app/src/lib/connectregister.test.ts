import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AREAS, ASSESSED_AT, FIRST, ITEMS, STATUSES, areaOf } from './connectregister';
import { ITEMS as COMMUNITY_ITEMS } from './communitiesregister';
import { CHALLENGES, CONTRIBUTION_SIGNALS, HUB_SECTIONS, INSTEAD, MENTOR_FLOW, POSITIONING, QUESTIONS, ROLLOUT, ROOM_PARTS, SHOWCASE_VISIBILITY, VISIBILITY_MEANS } from '../community/connect';
import { FUNNELS, NEVER_IN_MARKETING, PILLARS, PLATFORMS, PRINCIPLE } from './gtm/social';

/**
 * Holds the Connect register to the communities register's rule: every cited
 * file exists, each status cites the kind of file it claims, every overlap
 * names a communities-register item that exists, and the rendered document
 * is what the data says.
 *
 * `docs/SEMESTER-CONNECT-REGISTER.md` is rendered from the data; run
 * `npm run registers` from app/ to rewrite it. The last test fails while stale.
 */

const root = join(import.meta.dirname, '../../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const DOC = 'docs/SEMESTER-CONNECT-REGISTER.md';

const isDoc = (p: string) => /\.(md|pdf|json)$/.test(p) && !p.startsWith('.github/');
const isTest = (p: string) => /\.test\.tsx?$/.test(p) || /^supabase\/[^/]+\.check\.sql$/.test(p);
const isCode = (p: string) => !isDoc(p);

describe('the connect register', () => {
  it('has the brief’s ten app additions, six site additions, the plan and the controls, each with items', () => {
    expect(AREAS.filter((a) => a.where === 'app')).toHaveLength(10);
    expect(AREAS.filter((a) => a.where === 'site')).toHaveLength(6);
    expect(AREAS.filter((a) => a.where === 'plan')).toHaveLength(1);
    expect(AREAS.filter((a) => a.where === 'controls')).toHaveLength(1);
    expect(new Set(AREAS.map((a) => a.id)).size).toBe(AREAS.length);
    for (const a of AREAS) {
      expect(ITEMS.filter((i) => areaOf(i.id) === a).length, a.id).toBeGreaterThan(1);
      expect(a.why.length, a.id).toBeGreaterThan(40);
    }
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
  });

  it('records the fourteen controls the brief wants before broad social functions', () => {
    expect(ITEMS.filter((i) => areaOf(i.id).id === 'CTL')).toHaveLength(14);
  });

  it('can tell a missing file from a present one', () => {
    expect(existsSync(join(root, 'README.md'))).toBe(true);
    expect(existsSync(join(root, 'docs/no-such-connect-evidence.md'))).toBe(false);
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

  it('overlaps only communities-register items that exist, and says what is missing for every item', () => {
    const ids = new Set(COMMUNITY_ITEMS.map((i) => i.id));
    for (const i of ITEMS) {
      for (const o of i.overlaps) expect(ids.has(o), `${i.id} overlaps ${o}`).toBe(true);
      expect(i.gap.trim().length, i.id).toBeGreaterThanOrEqual(5);
    }
    expect(ITEMS.some((i) => i.overlaps.length > 0)).toBe(true);
  });

  it('names, for each of the brief’s first builds, areas that exist', () => {
    expect(FIRST).toHaveLength(10);
    const ids = new Set(AREAS.map((a) => a.id));
    for (const f of FIRST) for (const a of f.areas) expect(ids.has(a), `${f.build} → ${a}`).toBe(true);
  });

  it(`is what ${DOC} says`, () => {
    const rendered = render();
    if (process.env.REGISTERS === 'write') writeFileSync(join(root, DOC), rendered);
    expect(read(DOC), `${DOC} is stale; run \`npm run registers\` from app/`).toBe(rendered);
  });
});

// ── rendering ────────────────────────────────────────────────────────────────

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const WHERE = { app: 'In the app', site: 'On the company site', plan: 'The plan around both', controls: 'The controls' } as const;

function render(): string {
  const count = (s: string, rows = ITEMS) => rows.filter((i) => i.status === s).length;
  const out: string[] = [
    '# Semester Connect Register',
    '',
    '<!-- Rendered from app/src/lib/connectregister.ts, app/src/community/connect.ts and app/src/lib/gtm/social.ts by connectregister.test.ts. Edit the data, then run `npm run registers` from app/. -->',
    '',
    '> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).',
    '',
    'Every addition the community brief of 29 September 2026 asks for — ten in',
    'the app, six on the company site, the social media ecosystem, the fourteen',
    'controls it wants before broad social functions, and the order it wants',
    'them built — and where the repository stands on each. Most of what it asks',
    'for in the app is an item of the [communities',
    'register](COMMUNITIES-REGISTER.md) under another name; a row here names the',
    'item it overlaps rather than restating it.',
    '',
    `**Positioning:** ${POSITIONING}`,
    '',
    '**What it helps a student answer:**',
    '',
    ...QUESTIONS.map((q) => `- ${q}`),
    '',
    '**The distinction:**',
    '',
    '| Avoid | Build instead |',
    '| --- | --- |',
    ...INSTEAD.map((i) => `| ${cell(i.avoid)} | ${cell(i.build)} |`),
    '',
    `Statuses were assessed against \`origin/main\` at \`${ASSESSED_AT}\`; a test holds each`,
    'to the kind of file it cites. Nothing is above `tested`, because nothing has',
    'an artifact under `docs/evidence/`.',
    '',
    '## Where it stands',
    '',
    `| Area | Where | Items | ${STATUSES.join(' | ')} |`,
    `| --- | --- | ---: | ${STATUSES.map(() => '---:').join(' | ')} |`,
  ];
  for (const a of AREAS) {
    const rows = ITEMS.filter((i) => areaOf(i.id) === a);
    out.push(`| [${a.id}](#${a.id.toLowerCase()}) ${a.title} | ${WHERE[a.where]} | ${rows.length} | ${STATUSES.map((s) => count(s, rows)).join(' | ')} |`);
  }
  out.push(`| **total** | | **${ITEMS.length}** | ${STATUSES.map((s) => `**${count(s)}**`).join(' | ')} |`, '');

  out.push('## The register', '');
  for (const a of AREAS) {
    out.push(`### ${a.id}`, '', `**${a.title}.** ${a.why} ${WHERE[a.where]}.`, '');
    out.push('| ID | Item | Status | Evidence | Gap | Overlaps |', '| --- | --- | --- | --- | --- | --- |');
    for (const i of ITEMS.filter((x) => areaOf(x.id) === a)) {
      const ev = i.evidence.length ? i.evidence.map((e) => `\`${e.path}\` — ${cell(e.shows)}`).join('<br>') : '—';
      const ov = i.overlaps.length ? i.overlaps.map((o) => `[${o}](COMMUNITIES-REGISTER.md#${o.split('-')[0].toLowerCase()})`).join(', ') : '—';
      out.push(`| ${i.id} | ${cell(i.item)} | ${i.status} | ${ev} | ${cell(i.gap)} | ${ov} |`);
    }
    out.push('');
  }

  out.push(
    '## The hub',
    '',
    'Where Connect appears: inside Search, the Community screen and Me, never as',
    'a root. Its sections, and the screen each opens today:',
    '',
    '| Section | Answers | Screen | Gap |',
    '| --- | --- | --- | --- |',
    ...HUB_SECTIONS.map((s) => `| ${cell(s.title)} | ${cell(QUESTIONS[s.answers])} | ${s.screen ? `\`${s.screen}\`` : '—'} | ${cell(s.gap) || '—'} |`),
    '',
    '## The showcase',
    '',
    'An item starts private and only the student moves it. Employer visibility',
    'rests on a talent-profile opt-in that expires.',
    '',
    '| Visibility | Who sees it |',
    '| --- | --- |',
    ...SHOWCASE_VISIBILITY.map((v) => `| ${v} | ${cell(VISIBILITY_MEANS[v])} |`),
    '',
    '## A collaboration room',
    '',
    ...ROOM_PARTS.map((p) => `- ${p.label}`),
    '',
    '## The mentor flow',
    '',
    ...MENTOR_FLOW.map((s, i) => `${i + 1}. ${s}`),
    '',
    '## Challenges',
    '',
    'Optional, private by default, shared a milestone at a time, and never a comparison.',
    '',
    '| Challenge | Outcome |',
    '| --- | --- |',
    ...CHALLENGES.map((c) => `| ${cell(c.name)} | ${cell(c.outcome)} |`),
    '',
    '## Recognition',
    '',
    '| Signal | Verified by |',
    '| --- | --- |',
    ...CONTRIBUTION_SIGNALS.map((s) => `| ${cell(s.signal)} | ${s.verifiedBy.replace('_', ' ')} |`),
    '',
    '## The social media ecosystem',
    '',
    PRINCIPLE,
    '',
    NEVER_IN_MARKETING,
    '',
    '| Pillar | Purpose | Example |',
    '| --- | --- | --- |',
    ...PILLARS.map((p) => `| ${cell(p.pillar)} | ${cell(p.purpose)} | ${cell(p.example)} |`),
    '',
    '| Platform | Best role for Semester |',
    '| --- | --- |',
    ...PLATFORMS.map((p) => `| ${cell(p.platform)} | ${cell(p.role)} |`),
    '',
    'Every post leads to a useful next step, and `social.test.ts` holds every',
    'step to a route the site builds or a screen the app has:',
    '',
    ...FUNNELS.map((f) => `- ${f.steps.map((s) => ('path' in s ? `${s.what} (\`${s.path}\`)` : 'screen' in s ? `${s.what} (\`${s.screen}\`)` : s.what)).join(' → ')}`),
    '',
    '## The order things are built',
    '',
    'Density around useful, verified connections before anything broad; commerce last.',
    '',
    ...ROLLOUT.map((r, i) => `${i + 1}. ${r}`),
    '',
    '**Best immediate additions**, in the brief’s words, and the areas that carry each:',
    '',
    ...FIRST.map((f) => `- ${f.build} — ${f.areas.map((a) => `[${a}](#${a.toLowerCase()})`).join(', ')}`),
    '',
  );
  return out.join('\n');
}
