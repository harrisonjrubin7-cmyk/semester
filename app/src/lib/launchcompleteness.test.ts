import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROUTES } from '../site/render';
import { DEAL_POLICY } from './governance/deal-desk';
import {
  ACCEPTANCE, AGENDA, ATTACHMENTS, CLAIM_WORDS, COMMAND_CENTER, CONVERSIONS, DECISION_FILES, DOD_QUESTIONS, DOD_RULE, EXCLUSIONS, FIELD_MAP, FINAL_GATE,
  GATE_GROUPS, GO_LIVE, GUARDRAILS, HECVAT, HECVAT_DOMAINS, HELD_ELSEWHERE, INSTITUTIONAL_DOCS, INVENTORY, ITEMS, JOURNEYS, JOURNEY_STATES, LMS,
  MIGRATION_ARTIFACTS, MIGRATION_SEQUENCE, NEXT_ACTIONS, PACKAGES, PARALLEL_RUN, PILOT_SCOPE, PILOT_TERM, PRICING_PRINCIPLES, PUBLIC_LEGAL, READ_AT,
  REGISTRATION, REGISTRATION_GROUPS, SITE_PAGES, SOURCES, STANDINGS, STANDING_MEANING, SUCCESS_MEASURES, SUPPORT_TABLE, TRUST_ROOM, weakest,
  type Item,
} from './launchcompleteness';
import { SEATS } from './launchreadiness';
import { CLAIMS } from './ops/claims';
import { cell, controlLine, link, renderedFrom, table } from './ops/render';
import { PLANS } from './plans';

/**
 * Holds the launch-completeness crosswalk to the tree: the three supplied
 * documents are where the module says and are never cited as evidence; every
 * item cites files that exist and the kind of file its standing claims; every
 * HECVAT row has a real seat and a real readiness control or none; every claim
 * word names real claims; every site page names a real route of either site;
 * every package a real plan or deal tier; every command-center field a real
 * PilotPlan field. `docs/LAUNCH-COMPLETENESS.md` and `docs/DEFINITION-OF-DONE.md`
 * are rendered from the data; `npm run registers` from app/ rewrites them, and
 * the last two tests fail while either is stale.
 */

const root = join(import.meta.dirname, '../../..');
const at = (p: string) => join(root, p);
const read = (p: string) => readFileSync(at(p), 'utf8');
const DOC = 'docs/LAUNCH-COMPLETENESS.md';
const DOD = 'docs/DEFINITION-OF-DONE.md';

const isDoc = (p: string) => /\.(md|pdf|json)$/.test(p) && !p.startsWith('.github/');
const isTest = (p: string) => /\.test\.tsx?$/.test(p) || /^supabase\/[^/]+\.check\.sql$/.test(p);
const isCode = (p: string) => !isDoc(p);

const SECTIONS = [
  '1. The go-live decision standard',
  '2. The HECVAT tracker',
  '3. The registration go-live checklist',
  '4. The LMS and Course Studio go-live checklist',
  '5. The student-data migration playbook',
  '6. The first pilot agreement',
  '7. The SLA and packaging matrix',
  '8. The go-live command center',
  '9. The final launch gate',
  '10. The claim register, keyed on nine words',
  '11. Documents, the Trust Room and the site',
  '12. Next actions',
];

describe('the launch-completeness crosswalk', () => {
  describe('its shape', () => {
    it('keeps the three supplied documents where it says, and never cites them as evidence', () => {
      expect(SOURCES).toHaveLength(3);
      for (const s of SOURCES) expect(existsSync(at(s.path)), s.path).toBe(true);
      const supplied = new Set(SOURCES.map((s) => s.path));
      for (const i of ITEMS) for (const e of i.evidence) expect(supplied.has(e.path), `${i.id} cites a supplied PDF`).toBe(false);
    });

    it('has the briefs’ counts, each id once', () => {
      expect(GO_LIVE).toHaveLength(8);
      expect(HECVAT_DOMAINS.map((d) => HECVAT.filter((h) => h.domain === d).length)).toEqual([10, 14, 9, 12, 12, 12, 12]);
      expect(REGISTRATION_GROUPS.map((g) => REGISTRATION.filter((r) => r.group === g).length)).toEqual([14, 9, 9]);
      expect(LMS).toHaveLength(24);
      expect(MIGRATION_SEQUENCE).toHaveLength(12);
      expect(INVENTORY).toHaveLength(11);
      expect(MIGRATION_ARTIFACTS).toHaveLength(17);
      expect(FIELD_MAP).toHaveLength(5);
      expect(PARALLEL_RUN).toHaveLength(8);
      expect(GUARDRAILS).toHaveLength(5);
      expect(PILOT_SCOPE).toHaveLength(7);
      expect(EXCLUSIONS).toHaveLength(11);
      expect(ATTACHMENTS.map((a) => a.letter).join('')).toBe('ABCDEFGHIJ');
      expect(SUPPORT_TABLE).toHaveLength(7);
      expect(SUCCESS_MEASURES).toHaveLength(10);
      expect(PACKAGES).toHaveLength(7);
      expect(PRICING_PRINCIPLES).toHaveLength(7);
      expect(COMMAND_CENTER).toHaveLength(23);
      expect(AGENDA).toHaveLength(10);
      expect(GATE_GROUPS.map((g) => FINAL_GATE.filter((r) => r.group === g).length)).toEqual([8, 10, 5, 8]);
      expect(FINAL_GATE).toHaveLength(31);
      expect(CLAIM_WORDS).toHaveLength(9);
      expect(PUBLIC_LEGAL).toHaveLength(14);
      expect(INSTITUTIONAL_DOCS).toHaveLength(11);
      expect(TRUST_ROOM).toHaveLength(18);
      expect(SITE_PAGES).toHaveLength(22);
      expect(CONVERSIONS).toHaveLength(10);
      expect(DOD_QUESTIONS).toHaveLength(9);
      expect(ACCEPTANCE).toHaveLength(10);
      expect(JOURNEY_STATES).toHaveLength(11);
      expect(JOURNEYS).toHaveLength(12);
      expect(NEXT_ACTIONS.filter((a) => a.from === 'playbook')).toHaveLength(10);
      expect(NEXT_ACTIONS.filter((a) => a.from === 'summary')).toHaveLength(5);
      const ids = ITEMS.map((i) => i.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(id).toMatch(/^(LC-[A-Z0-9]+-(\d{2}|TERM)|DOD-\d{2})$/);
    });
  });

  describe('what a standing may claim', () => {
    it('can tell a missing file from a present one', () => {
      expect(existsSync(at('README.md'))).toBe(true);
      expect(existsSync(at('docs/NO-SUCH-LAUNCH-COMPLETENESS-EVIDENCE.md'))).toBe(false);
    });

    it('cites only files that exist, and holds each standing to the kind of file it claims', () => {
      for (const i of ITEMS) {
        expect(STANDINGS, i.id).toContain(i.standing);
        expect(i.evidence.length, `${i.id} cites nothing`).toBeGreaterThan(0);
        const paths = i.evidence.map((e) => e.path);
        for (const p of paths) expect.soft(existsSync(at(p)), `${i.id} cites ${p}`).toBe(true);
        if (i.standing === 'tested') expect.soft(paths.some(isTest), `${i.id} is tested and cites no test`).toBe(true);
        if (i.standing === 'building') expect.soft(paths.some(isCode), `${i.id} is building and cites no code`).toBe(true);
        if (i.standing === 'designed') expect.soft(paths.some(isDoc), `${i.id} is designed and cites no document`).toBe(true);
        if (i.standing === 'not-started') expect.soft(paths.filter(isTest), `${i.id} is not started yet cites a test`).toEqual([]);
        if (i.standing === 'held') expect.soft(paths.some((p) => DECISION_FILES.includes(p)), `${i.id} is held and cites no decision`).toBe(true);
        expect(i.gap.trim().length, i.id).toBeGreaterThan(3);
      }
      for (const p of DECISION_FILES) expect(existsSync(at(p)), p).toBe(true);
      for (const s of STANDINGS) expect(STANDING_MEANING[s]).toMatch(/./);
    });

    it('cites only files that exist wherever a list names what carries something', () => {
      const carried = [
        ...MIGRATION_ARTIFACTS.map((a) => a.carriedBy), ...EXCLUSIONS.map((e) => e.keptOutBy), ...ATTACHMENTS.map((a) => a.carriedBy),
        ...PUBLIC_LEGAL.map((d) => d.carriedBy), ...INSTITUTIONAL_DOCS.map((d) => d.carriedBy), ...TRUST_ROOM.map((t) => t.carriedBy), ...HELD_ELSEWHERE.map((h) => h.heldBy),
      ];
      for (const p of carried) if (p) expect.soft(existsSync(at(p)), p).toBe(true);
      const supplied = new Set(SOURCES.map((s) => s.path));
      for (const p of carried) expect(supplied.has(p ?? ''), `${p} is a supplied PDF`).toBe(false);
      for (const x of [...MIGRATION_ARTIFACTS, ...EXCLUSIONS, ...ATTACHMENTS, ...PUBLIC_LEGAL, ...INSTITUTIONAL_DOCS]) expect(x.note.trim().length).toBeGreaterThan(3);
    });

    it('holds the pilot’s 12–26 weeks to the code’s exactly 26', () => {
      expect(PILOT_TERM.standing).toBe('tested');
      const pilot = read('app/src/lib/gtm/pilot.ts');
      expect(pilot).toMatch(/export const PILOT_WEEKS = 26;/);
      expect(read('docs/PAID-PILOT-FRAMEWORK.md')).toMatch(/exactly 26 weeks/);
      expect(PILOT_TERM.gap).toMatch(/D-134/);
      // Twenty-six weeks is the top of the brief's 12–26, and inside the deal desk's six months.
      expect(26).toBeGreaterThanOrEqual(12);
      expect(26).toBeLessThanOrEqual(26);
      expect(26 * 7).toBeLessThanOrEqual(DEAL_POLICY.maxPilotMonths * 31);
      expect(DEAL_POLICY.maxPilotMonths).toBe(6);
    });
  });

  describe('what names what', () => {
    it('gives every HECVAT row a council seat, a readiness control that exists or none, and no due date nobody set', () => {
      const register = read('docs/market-readiness/HECVAT_READINESS.md');
      for (const h of HECVAT) {
        expect(SEATS, `${h.id} → ${h.owner}`).toContain(h.owner);
        if (h.control) expect(register, `${h.id} → ${h.control}`).toContain(`| ${h.control} |`);
        if (h.due) {
          expect(h.due, h.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          expect(h.due > READ_AT.date, `${h.id} is due before it was read`).toBe(true);
        }
      }
      // The control: a made-up id is not in the register.
      expect(register).not.toContain('| GOV-99 |');
      // Rows with no readiness control are exactly the ones the brief adds.
      expect(HECVAT.filter((h) => h.control === null).length).toBe(40);
    });

    it('names only claims the claims register has, and says why where it names none', () => {
      const ids = new Set(CLAIMS.map((c) => c.id));
      for (const w of CLAIM_WORDS) {
        for (const c of w.claims) expect(ids.has(c), `${w.word} → ${c}`).toBe(true);
        expect(w.note.trim().length, w.word).toBeGreaterThan(5);
      }
      expect(CLAIM_WORDS.filter((w) => w.claims.length === 0).map((w) => w.word)).toEqual(['Replaces', 'Improves student success', 'Trusted by', 'Compliant']);
      expect(ids.has('no-such-claim')).toBe(false);
    });

    it('names only routes the app’s site renders and paths the company site lists', () => {
      const routes = new Set(ROUTES.map((r) => r.path));
      const sitemap = new Set([...read('company-site/sitemap.xml').matchAll(/<loc>https?:\/\/[^/<]+(\/[^<]*)<\/loc>/g)].map((m) => m[1]));
      expect(sitemap.size).toBeGreaterThan(20);
      expect(sitemap.has('/no-such-page')).toBe(false);
      for (const p of SITE_PAGES) {
        if (p.app) expect(routes.has(p.app), `${p.page} → ${p.app}`).toBe(true);
        if (p.company) expect(sitemap.has(p.company), `${p.page} → ${p.company}`).toBe(true);
      }
      expect(SITE_PAGES.filter((p) => !p.app && !p.company).map((p) => p.page)).toEqual(['Pilot program', 'Changelog']);
      for (const c of CONVERSIONS) if (c.route) expect(routes.has(c.route), `${c.point} → ${c.route}`).toBe(true);
      expect(CONVERSIONS.filter((c) => !c.route).map((c) => c.point)).toEqual(['Join the pilot', 'Download security overview', 'Join student advisory council']);
    });

    it('names only plans that exist and deal tiers the desk prices', () => {
      const plans = new Set<string>(PLANS.map((p) => p.id));
      for (const p of PACKAGES) {
        if (p.plan) expect(plans.has(p.plan), `${p.name} → ${p.plan}`).toBe(true);
        if (p.tier) expect(Object.keys(DEAL_POLICY.minimumAcvCents), `${p.name} → ${p.tier}`).toContain(p.tier);
        expect(p.plan || p.tier, p.name).toBeTruthy();
      }
    });

    it('names only PilotPlan fields for the command center', () => {
      const plan = read('app/src/lib/gtm/pilot.ts');
      const block = plan.slice(plan.indexOf('export interface PilotPlan'), plan.indexOf('\n}', plan.indexOf('export interface PilotPlan')));
      for (const c of COMMAND_CENTER) if (c.carriedBy) expect(block, `${c.field} → ${c.carriedBy}`).toMatch(new RegExp(`^\\s+${c.carriedBy}\\??:`, 'm'));
      expect(block).not.toMatch(/^\s+technicalOwner\??:/m);
      expect(COMMAND_CENTER.filter((c) => c.carriedBy).length).toBe(6);
    });

    it('answers every agenda step with a section of the page, and every next action with rows that exist', () => {
      for (const a of AGENDA) expect(SECTIONS, a.step).toContain(a.answeredBy);
      const ids = new Set(ITEMS.map((i) => i.id));
      for (const a of NEXT_ACTIONS) for (const m of a.answeredBy.matchAll(/LC-[A-Z0-9]+-\d{2}/g)) expect(ids.has(m[0]), `${a.action} → ${m[0]}`).toBe(true);
    });

    it('computes a group’s word as its weakest row', () => {
      const t = (standing: Item['standing']): Item => ({ id: 'x', item: 'x', standing, evidence: [], gap: 'x' });
      expect(weakest([t('tested'), t('designed'), t('building')])).toBe('designed');
      expect(weakest([t('held'), t('tested')])).toBe('held');
      expect(weakest([t('tested'), t('not-started')])).toBe('not-started');
      expect(() => weakest([])).toThrow();
    });
  });

  it(`is what ${DOC} says`, () => {
    const rendered = render();
    if (process.env.REGISTERS === 'write') writeFileSync(at(DOC), rendered);
    expect(read(DOC), `${DOC} is stale; run \`npm run registers\` from app/`).toBe(rendered);
  });

  it(`is what ${DOD} says`, () => {
    const rendered = renderDod();
    if (process.env.REGISTERS === 'write') writeFileSync(at(DOD), rendered);
    expect(read(DOD), `${DOD} is stale; run \`npm run registers\` from app/`).toBe(rendered);
    expect(rendered).toContain(DOD_RULE);
  });
});

// ── rendering ────────────────────────────────────────────────────────────────

const refFrom = (doc: string) => (p: string) => `[\`${p}\`](${link(doc, p)})`;
const ref = refFrom(DOC);
const evFrom = (doc: string) => (i: { evidence: readonly { path: string; shows: string }[] }) => i.evidence.map((e) => `${refFrom(doc)(e.path)} — ${cell(e.shows)}`).join('<br>');
const ev = evFrom(DOC);
const counts = (items: readonly { standing: string }[]) => STANDINGS.map((s) => `${s} ${items.filter((i) => i.standing === s).length}`).join(' · ');
const itemTable = (items: readonly Item[]) => table(['ID', 'Item', 'Standing', 'Evidence', 'Gap'], items.map((i) => [i.id, cell(i.item), i.standing, ev(i), cell(i.gap)]));
const orNone = (p: string | null) => (p ? ref(p) : '**none**');
const code = (s: string | null) => (s ? `\`${s}\`` : '**none**');

function groupedSection(items: readonly (Item & { group: string })[], groups: readonly string[]): string[] {
  return groups.flatMap((g) => {
    const rs = items.filter((i) => i.group === g);
    return [`### ${g}`, '', `${rs.length} items, the weakest ${weakest(rs)}: ${counts(rs)}.`, '', ...itemTable(rs), ''];
  });
}

function render(): string {
  const hecvatTable = (d: string) => {
    const rs = HECVAT.filter((h) => h.domain === d);
    return [`### ${d}`, '', `${rs.length} rows, the weakest ${weakest(rs)}: ${counts(rs)}.`, '',
      ...table(['ID', 'Control', 'Owner', 'Readiness control', 'Due', 'Standing', 'Evidence', 'Gap'],
        rs.map((h) => [h.id, cell(h.item), `\`${h.owner}\``, code(h.control), h.due ?? 'owner sets', h.standing, ev(h), cell(h.gap)])), ''];
  };
  return [
    '# Launch completeness',
    '',
    renderedFrom('app/src/lib/launchcompleteness.ts', 'launchcompleteness.test.ts'),
    '',
    controlLine(DOC),
    '',
    'Three documents of 29 September 2026 ask what is still missing before Semester can',
    'launch at a university: a HECVAT tracker with an owner on every row, registration',
    'and LMS go-live checklists, a student-data migration playbook, a first pilot',
    'agreement, an SLA and packaging matrix, a per-pilot command center, a company-wide',
    'final gate, a claim register keyed on nine words, the pages the company site needs,',
    `and one internal standard, rendered separately as [the Semester Definition of Done](${link(DOC, DOD)}).`,
    'They are kept under `docs/expansion/` as supplied. This page holds each thing they',
    'ask for to what the tree already has, under the rule of',
    '[D-108](DECISION-LOG.md#d-108--the-modernization-blueprint-is-a-crosswalk-onto-the-master-register-not-a-second-register)',
    'and [D-111](DECISION-LOG.md#d-111--five-research-documents-are-held-to-the-tree-as-crosswalks-and-the-pdfs-are-never-their-own-evidence):',
    'a supplied PDF is never its own evidence, every cited file exists, and every',
    `standing is held to the kind of file it cites. Standings were read at \`origin/main\` \`${READ_AT.commit}\` on ${READ_AT.date}.`,
    '',
    '**This is an operational planning crosswalk, not legal advice, a HECVAT completion,',
    'a WCAG conformance claim, a FERPA determination or a contract.** Nothing here may be',
    'signed; counsel, the institution’s privacy officer, security and accessibility',
    'specialists and procurement come before any agreement or representation.',
    '',
    '| Supplied document | What it holds |',
    '| --- | --- |',
    ...SOURCES.map((s) => `| [${cell(s.title)}](${link(DOC, s.path)}) | ${cell(s.what)} |`),
    '',
    '## Standings',
    '',
    ...table(['Standing', 'Meaning'], STANDINGS.map((s) => [s, STANDING_MEANING[s]])),
    '',
    `Across the ${ITEMS.length} items with a standing: ${counts(ITEMS)}.`,
    '',
    '## The finding',
    '',
    'Most of what the briefs ask for exists on main as a part, and the part is usually',
    'held by a test. What does not exist is concentrated: customer data migration,',
    'the MSA, counsel’s review of every public policy, a human accessibility pass, a',
    'production restore, error tracking, and anything with an institution’s name on it.',
    'Those are not code the repository can write; they are the owner’s, counsel’s and a',
    'first customer’s. The one conflict with the code, the pilot’s length, the owner settled (D-134).',
    '',
    `## ${SECTIONS[0]}`,
    '',
    `A university launch is approved only when all eight are true. Today the weakest is **${weakest(GO_LIVE)}**.`,
    '',
    ...itemTable(GO_LIVE),
    '',
    `## ${SECTIONS[1]}`,
    '',
    'Every row of the brief’s seven domains, with the council seat that owns it and the',
    `control of ${ref('docs/market-readiness/HECVAT_READINESS.md')} it moves. ${HECVAT.filter((h) => h.control === null).length} of the ${HECVAT.length} rows`,
    'have no readiness control today: those are what the brief adds to the thirty.',
    'The due date is the seat’s to set; a date typed here on nobody’s behalf is a claim',
    'nobody made.',
    '',
    `All ${HECVAT.length}: ${counts(HECVAT)}.`,
    '',
    ...HECVAT_DOMAINS.flatMap(hecvatTable),
    `## ${SECTIONS[2]}`,
    '',
    ...groupedSection(REGISTRATION, REGISTRATION_GROUPS),
    `## ${SECTIONS[3]}`,
    '',
    ...groupedSection(LMS, ['Learning experience', 'Faculty experience', 'Integration and standards']),
    `## ${SECTIONS[4]}`,
    '',
    `No production load path for customer data exists (${ref('docs/market-readiness/MIGRATION_PLAYBOOK.md')}); the Migration Center records evidence and roster staging is a foundation. This is its shape, for the first pilot, even one that uses only curated or manual data. The principle: migrate only data needed for the approved scope.`,
    '',
    `**Sequence:** ${MIGRATION_SEQUENCE.join(' → ')}.`,
    '',
    '### The inventory',
    '',
    ...table(['Data domain', 'Pilot default', 'Expansion option', 'High-risk considerations', 'The tree today'], INVENTORY.map((d) => [d.domain, cell(d.pilot), cell(d.expansion), cell(d.risk), cell(d.tree)])),
    '',
    '### The seventeen artifacts',
    '',
    `${MIGRATION_ARTIFACTS.filter((a) => a.carriedBy).length} carried by something, ${MIGRATION_ARTIFACTS.filter((a) => !a.carriedBy).length} by nothing.`,
    '',
    ...table(['Artifact', 'Carried by', 'Note'], MIGRATION_ARTIFACTS.map((a) => [a.artifact, orNone(a.carriedBy), cell(a.note)])),
    '',
    '### The field-mapping template',
    '',
    ...table(['Source field', 'Semester field', 'Classification', 'Transformation', 'Owner', 'Retention', 'Validation', 'The tree today'],
      FIELD_MAP.map((f) => [f.source, `\`${f.target}\``, f.classification, f.transformation, f.owner, f.retention, f.validation, cell(f.tree)])),
    '',
    '### The parallel run',
    '',
    'For any future authoritative replacement, in order:',
    '',
    ...PARALLEL_RUN.map((s, i) => `${i + 1}. ${s}`),
    '',
    `Each forward move of a school is already one step with the leaving state’s exit evidence (${ref('supabase/tenant-rollout.check.sql')}).`,
    '',
    '### The guardrails',
    '',
    ...itemTable(GUARDRAILS),
    '',
    `## ${SECTIONS[5]}`,
    '',
    `The brief’s first pilot is a **Registration and Path Pilot**. ${ref('docs/trust/PILOT-AGREEMENT-OUTLINE.md')} carries the twenty-six sections; its sample is an LMS/course pilot. This is the second shape, held to the same code.`,
    '',
    ...table(['Term', 'The brief', 'The tree'], PILOT_SCOPE.map((p) => [p.term, cell(p.brief), cell(p.tree)])),
    '',
    `**${PILOT_TERM.id} · ${PILOT_TERM.standing}.** ${PILOT_TERM.item}. ${PILOT_TERM.gap}`,
    '',
    ...table(['Evidence', 'Shows'], PILOT_TERM.evidence.map((e) => [ref(e.path), cell(e.shows)])),
    '',
    '### Explicit exclusions',
    '',
    `${EXCLUSIONS.filter((e) => e.keptOutBy).length} already kept out by something in the tree; the rest by the contract alone.`,
    '',
    ...table(['Exclusion', 'Kept out by', 'Note'], EXCLUSIONS.map((e) => [cell(e.exclusion), orNone(e.keptOutBy), cell(e.note)])),
    '',
    '### Attachments',
    '',
    ...table(['', 'Attachment', 'Nearest in the tree', 'Note'], ATTACHMENTS.map((a) => [a.letter, a.attachment, orNone(a.carriedBy), cell(a.note)])),
    '',
    '### Success measures',
    '',
    'The brief’s ten, which a PilotPlan’s metrics would carry, each with a baseline:',
    '',
    ...SUCCESS_MEASURES.map((m) => `- ${m}`),
    '',
    'The agreement must not promise grades, retention, graduation, persistence or employment.',
    '',
    `## ${SECTIONS[6]}`,
    '',
    `### Pilot support, against ${ref('docs/trust/SLA.md')}`,
    '',
    'Do not promise 24/7 or an uptime percentage until monitoring, on-call and staffing support it.',
    '',
    ...table(['Service level', 'Suggested pilot commitment', 'SLA.md today'], SUPPORT_TABLE.map((s) => [s.level, cell(s.commitment), cell(s.tree)])),
    '',
    '### Packages',
    '',
    `Each held to a plan in ${ref('app/src/lib/plans.ts')} or a tier the deal desk prices (${ref('app/src/lib/governance/deal-desk.ts')}).`,
    '',
    ...table(['Package', 'Buyer', 'Scope', 'Support', 'Integrations', 'Commercial model', 'Plan', 'Deal tier'],
      PACKAGES.map((p) => [p.name, p.buyer, cell(p.scope), cell(p.support), cell(p.integrations), cell(p.model), code(p.plan), code(p.tier)])),
    '',
    '### Pricing principles',
    '',
    ...itemTable(PRICING_PRINCIPLES),
    '',
    `## ${SECTIONS[7]}`,
    '',
    `One page per pilot launch. ${COMMAND_CENTER.filter((c) => c.carriedBy).length} of its ${COMMAND_CENTER.length} fields are a \`PilotPlan\` field today (${ref('app/src/lib/gtm/pilot.ts')}); the rest would be added there, not to a spreadsheet. The launch-wide board is ${ref('docs/LAUNCH-WAR-ROOM.md')}.`,
    '',
    ...table(['Field', 'PilotPlan field'], COMMAND_CENTER.map((c) => [c.field, code(c.carriedBy)])),
    '',
    '### The go/no-go meeting',
    '',
    ...table(['#', 'Step', 'Answered by'], AGENDA.map((a, i) => [String(i + 1), a.step, a.answeredBy])),
    '',
    `The gates themselves are ${ref('docs/GO-NO-GO-CHECKLIST.md')}.`,
    '',
    `## ${SECTIONS[8]}`,
    '',
    `The brief’s thirty-one lines. A launch is go only when all are; today the weakest is **${weakest(FINAL_GATE)}**.`,
    '',
    ...groupedSection(FINAL_GATE, GATE_GROUPS),
    `## ${SECTIONS[9]}`,
    '',
    `Each word the brief says must not outrun its evidence, and the rows of ${ref('ops/claims/README.md')} it rests on. A word with no rows may not be said.`,
    '',
    ...table(['Word', 'Evidence required', 'Claims', 'Note'], CLAIM_WORDS.map((w) => [`“${w.word}”`, cell(w.needs), w.claims.length ? w.claims.map((c) => `\`${c}\``).join(', ') : '**none — may not be said**', cell(w.note)])),
    '',
    `## ${SECTIONS[10]}`,
    '',
    '### Public legal documents',
    '',
    `${PUBLIC_LEGAL.filter((d) => d.carriedBy).length} of ${PUBLIC_LEGAL.length} have something in the tree; every one needs counsel before publication.`,
    '',
    ...table(['Document', 'Nearest in the tree', 'Note'], PUBLIC_LEGAL.map((d) => [d.doc, orNone(d.carriedBy), cell(d.note)])),
    '',
    '### Institutional documents',
    '',
    ...table(['Document', 'Nearest in the tree', 'Note'], INSTITUTIONAL_DOCS.map((d) => [d.doc, orNone(d.carriedBy), cell(d.note)])),
    '',
    '### The Trust Room',
    '',
    `${TRUST_ROOM.filter((t) => t.carriedBy).length} of ${TRUST_ROOM.length} artifacts have a file to publish into the procurement room (${ref('supabase/trust-room.check.sql')}).`,
    '',
    ...table(['Artifact', 'Carried by'], TRUST_ROOM.map((t) => [t.artifact, orNone(t.carriedBy)])),
    '',
    '### Site pages',
    '',
    `Each held to a route of the app’s site (${ref('app/src/site/render.tsx')}) and a path of the deployed company site (${ref('company-site/sitemap.xml')}).`,
    '',
    ...table(['Page', 'App site', 'Company site'], SITE_PAGES.map((p) => [p.page, code(p.app), code(p.company)])),
    '',
    '### Conversion points',
    '',
    ...table(['Point', 'Route'], CONVERSIONS.map((c) => [c.point, code(c.route)])),
    '',
    '### Held elsewhere',
    '',
    'The complete-company brief also covers these; each already has a register, and is not held twice.',
    '',
    ...table(['Area', 'Held by'], HELD_ELSEWHERE.map((h) => [cell(h.area), ref(h.heldBy)])),
    '',
    `## ${SECTIONS[11]}`,
    '',
    ...table(['From', 'Action', 'Where it stands'], NEXT_ACTIONS.map((a) => [a.from, cell(a.action), cell(a.answeredBy)])),
    '',
  ].join('\n');
}

function renderDod(): string {
  const r = refFrom(DOD);
  const e = evFrom(DOD);
  return [
    '# The Semester Definition of Done',
    '',
    renderedFrom('app/src/lib/launchcompleteness.ts', 'launchcompleteness.test.ts'),
    '',
    controlLine(DOD),
    '',
    'The one standard every feature, launch, contract, integration and claim must meet,',
    `as the complete-company brief of 29 September 2026 asks for it. Beside each question is`,
    'where the tree already asks it, and what it does not. The engineering checklist a',
    `pull request meets is ${r('docs/operating-model/QUALITY-MANAGEMENT.md')}; this is the question behind it.`,
    `The crosswalk that holds the rest of the brief is ${r(DOC)}.`,
    '',
    '## The nine questions',
    '',
    ...table(['#', 'Question', 'Standing', 'Where the tree asks it', 'Gap'], DOD_QUESTIONS.map((q, i) => [String(i + 1), cell(q.item), q.standing, e(q), cell(q.gap)])),
    '',
    `**${DOD_RULE}**`,
    '',
    '## The launch acceptance rule',
    '',
    'A feature is not launch-complete because it looks built. It is launch-complete only when it has:',
    '',
    ...ACCEPTANCE.map((a) => `- ${a}`),
    '',
    '## The core journeys',
    '',
    'Launch only after the major journeys work end to end, not on individual screens.',
    `${JOURNEYS.length} journeys; the weakest is **${weakest(JOURNEYS)}**: ${counts(JOURNEYS)}.`,
    '',
    ...table(['ID', 'User', 'Must complete', 'Standing', 'Evidence', 'Gap'], JOURNEYS.map((j) => [j.id, j.user, cell(j.steps), j.standing, e(j), cell(j.gap)])),
    '',
    'Every journey needs:',
    '',
    ...JOURNEY_STATES.map((s) => `- ${s}`),
    '',
    `The states are specified in ${r('docs/EMPTY-LOADING-ERROR-SUCCESS-STATES.md')}; no journey has been walked through all eleven.`,
    '',
    '> The final difference between a compelling vision and a market-defining company is',
    '> not another feature. It is the discipline to make every existing feature real,',
    '> trustworthy, operational, supported, and provable.',
    '',
  ].join('\n');
}
