import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EDGE_CASES } from './governance/edgecases';
import { CONTROLS } from './governance/maturity';
import { GAME_DAYS, RISKS } from './governance/risk';
import { SEATS } from './launchreadiness';
import { MODULES as KIT_MODULES } from './launchkit';
import {
  BOTTOM_LINE, BRAND, CAPACITY_RULE, DATA_QUALITY, DECISION_FILES, DOSSIER, DRI_RULE, FACTORY, FAILURES, FINAL_CHECKLIST, FUNCTIONS, IMPLEMENTATION, ITEMS,
  LOAD_SCENARIOS, OPERATING_SYSTEM, PACKAGES, PEOPLE, PLAN_FIELDS, PRIORITIES, PROOFS, PROOF_ENGINE, PUBLIC_WORKS, READINESS_TEST, RECOVERY_RULE, REVIEW_DECISIONS,
  REVOPS, SCENARIO_FIELDS, SERVICE_TIERS, SOURCES, STANDINGS, STANDING_MEANING, SUCCESS_PLAN, SUPPORT, THRESHOLDS, TICKET_FIELDS, TIER_DEFINITIONS, VERIFICATION,
  VERIFICATION_RULE, WORKSTREAMS,
} from './operationalreality';
import { cell, controlLine, link, renderedFrom, table } from './ops/render';

/**
 * Holds the operational-reality register to the tree: the two supplied
 * documents are where the module says and are never cited as evidence; every
 * item cites files that exist and the kind of file its standing claims; every
 * verification guard is a test, a check or a CI script that exists; every
 * failure scenario names edge cases, risks, game days and maturity controls
 * that exist in the register that owns them; workstreams and functions name
 * real seats; and packages name real launch-kit modules.
 * `docs/OPERATIONAL-REALITY-REGISTER.md` is rendered from the data; `npm run
 * registers` from app/ rewrites it, and the last test fails while it is stale.
 */

const root = join(import.meta.dirname, '../../..');
const at = (p: string) => join(root, p);
const read = (p: string) => readFileSync(at(p), 'utf8');
const DOC = 'docs/OPERATIONAL-REALITY-REGISTER.md';

const isDoc = (p: string) => /\.(md|pdf|json)$/.test(p) && !p.startsWith('.github/');
const isTest = (p: string) =>
  /\.test\.tsx?$/.test(p) || /^supabase\/[^/]+\.check\.sql$/.test(p) || /^app\/scripts\/.*\.mjs$/.test(p) || p === 'supabase/restore.sh' || p.startsWith('.github/workflows/');
const isCode = (p: string) => !isDoc(p);

const REGISTER_IDS = new Set([...EDGE_CASES.map((e) => e.id), ...RISKS.map((r) => r.id), ...GAME_DAYS.map((g) => g.id), ...CONTROLS.map((c) => c.id)]);

describe('the operational reality register', () => {
  describe('its shape', () => {
    it('keeps the two supplied documents where it says, and never cites them as evidence', () => {
      expect(SOURCES).toHaveLength(2);
      for (const s of SOURCES) expect(existsSync(at(s.path)), s.path).toBe(true);
      const supplied = new Set(SOURCES.map((s) => s.path));
      for (const i of ITEMS) for (const e of i.evidence) expect(supplied.has(e.path), `${i.id} cites a supplied PDF`).toBe(false);
    });

    it('has the documents’ counts, each id once', () => {
      expect(WORKSTREAMS).toHaveLength(5);
      expect(PLAN_FIELDS).toHaveLength(13);
      expect(OPERATING_SYSTEM).toHaveLength(5);
      expect(FUNCTIONS).toHaveLength(8);
      expect(PROOF_ENGINE).toHaveLength(5);
      expect(PROOFS).toHaveLength(3);
      expect(SERVICE_TIERS).toHaveLength(5);
      expect(TIER_DEFINITIONS).toHaveLength(12);
      expect(FACTORY).toHaveLength(17);
      expect(PACKAGES).toHaveLength(1);
      expect(BRAND).toHaveLength(4);
      expect(PUBLIC_WORKS).toHaveLength(6);
      expect(READINESS_TEST).toHaveLength(12);
      expect(PRIORITIES).toHaveLength(8);
      expect(REVIEW_DECISIONS).toHaveLength(3);
      expect(new Set(VERIFICATION.map((v) => v.domain)).size).toBe(7);
      expect(FAILURES).toHaveLength(18);
      expect(SCENARIO_FIELDS).toHaveLength(10);
      expect(LOAD_SCENARIOS).toHaveLength(11);
      expect(THRESHOLDS).toHaveLength(12);
      expect(DATA_QUALITY).toHaveLength(13);
      expect(SUPPORT).toHaveLength(14);
      expect(TICKET_FIELDS).toHaveLength(8);
      expect(IMPLEMENTATION).toHaveLength(14);
      expect(SUCCESS_PLAN).toHaveLength(11);
      expect(REVOPS).toHaveLength(19);
      expect(PEOPLE).toHaveLength(11);
      expect(DOSSIER).toHaveLength(11);
      expect(FINAL_CHECKLIST).toHaveLength(12);
      expect(BOTTOM_LINE).toHaveLength(11);
      const ids = ITEMS.map((i) => i.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(id).toMatch(/^OR-[A-Z]+-\d{2}$/);
      for (const s of STANDINGS) expect(STANDING_MEANING[s]).toMatch(/./);
      for (const r of [DRI_RULE, VERIFICATION_RULE, RECOVERY_RULE, CAPACITY_RULE]) expect(r.length).toBeGreaterThan(40);
    });
  });

  describe('what a standing may claim', () => {
    it('can tell a missing file from a present one', () => {
      expect(existsSync(at('README.md'))).toBe(true);
      expect(existsSync(at('docs/NO-SUCH-REALITY-EVIDENCE.md'))).toBe(false);
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
        expect.soft(i.gap.trim().length, `${i.id} gap`).toBeGreaterThan(5);
      }
      for (const p of DECISION_FILES) expect(existsSync(at(p)), p).toBe(true);
    });

    it('holds every verification guard to a test, a check or a CI script that exists', () => {
      for (const v of VERIFICATION) {
        if (!v.guard) continue;
        expect.soft(existsSync(at(v.guard)), `${v.domain}: ${v.check} → ${v.guard}`).toBe(true);
        expect.soft(isTest(v.guard), `${v.domain}: ${v.check} cites ${v.guard}, which is not a test`).toBe(true);
      }
      expect(VERIFICATION.filter((v) => v.guard === null).length).toBe(15);
      expect(VERIFICATION.filter((v) => v.domain === 'Payment' && v.guard === null).length).toBe(7);
    });

    it('names only edge cases, risks, game days and maturity controls that exist', () => {
      expect(REGISTER_IDS.size).toBeGreaterThan(300);
      expect(REGISTER_IDS.has('EC-NO-SUCH-99')).toBe(false);
      for (const f of FAILURES) {
        for (const id of f.ids) expect.soft(REGISTER_IDS.has(id), `${f.scenario} → ${id}`).toBe(true);
        if (f.runbook) expect.soft(existsSync(at(f.runbook)), `${f.scenario} → ${f.runbook}`).toBe(true);
      }
      expect(FAILURES.filter((f) => f.ids.length === 0).map((f) => f.scenario)).toEqual([]);
      expect(GAME_DAYS.every((g) => g.held === null), 'a game day has been held; re-read the recovery rule').toBe(true);
    });
  });

  describe('what names what', () => {
    it('names only seats that exist', () => {
      for (const w of WORKSTREAMS) for (const s of w.seats) expect(SEATS, `${w.workstream} → ${s}`).toContain(s);
      for (const f of FUNCTIONS) {
        if (f.seat) expect(SEATS, `${f.fn} → ${f.seat}`).toContain(f.seat);
        else expect(f.note, f.fn).toMatch(/No seat/);
      }
      expect(FUNCTIONS.filter((f) => f.seat === null)).toHaveLength(0);
    });

    it('names only launch-kit modules that exist in the packages', () => {
      const ids = new Set(KIT_MODULES.map((m) => m.id));
      for (const p of PACKAGES) {
        expect(p.kitModules.length, p.package).toBeGreaterThan(0);
        for (const m of p.kitModules) expect(ids.has(m), `${p.package} → ${m}`).toBe(true);
      }
    });

    it('holds the three review decisions to the three verdicts the code has', () => {
      const code = read('app/src/lib/launchreadiness.ts');
      expect(code).toMatch(/'go' \| 'go-with-conditions' \| 'no-go'/);
      expect(REVIEW_DECISIONS.map((d) => d.decision)).toEqual(['GO', 'GO WITH CONDITIONS', 'NO-GO']);
      expect(REVIEW_DECISIONS[1].tree).toMatch(/go-with-conditions/);
    });

    it('counts what nobody carries', () => {
      expect(PLAN_FIELDS.filter((f) => f.carriedBy === null).map((f) => f.field)).toEqual(['Backup owner', 'Budget']);
      expect(TIER_DEFINITIONS.filter((d) => d.tree === null).length).toBe(4);
      expect(SCENARIO_FIELDS.filter((f) => f.carriedBy === null).length).toBe(3);
      expect(THRESHOLDS.filter((t) => t.tree === null).length).toBe(5);
      expect(TICKET_FIELDS.filter((f) => f.carriedBy === null).length).toBe(3);
      expect(SUCCESS_PLAN.filter((f) => f.carriedBy === null).length).toBe(3);
      expect(REVOPS.filter((r) => r.tree === null).length).toBe(7);
      expect(PEOPLE.filter((p) => p.tree === null).length).toBe(3);
      expect(DOSSIER.every((d) => d.carriedBy)).toBe(true);
      expect(FINAL_CHECKLIST.filter((f) => f.answer === 'yes')).toHaveLength(1);
      expect(FINAL_CHECKLIST.filter((f) => f.answer === 'no')).toHaveLength(3);
      for (const f of FINAL_CHECKLIST) expect(f.why.length, f.line).toBeGreaterThan(10);
    });
  });

  it(`is what ${DOC} says`, () => {
    const rendered = render();
    if (process.env.REGISTERS === 'write') writeFileSync(at(DOC), rendered);
    expect(read(DOC), `${DOC} is stale; run \`npm run registers\` from app/`).toBe(rendered);
  });
});

// ── rendering ────────────────────────────────────────────────────────────────

const ref = (p: string) => `[\`${p}\`](${link(DOC, p)})`;
const ev = (i: { evidence: readonly { path: string; shows: string }[] }) => i.evidence.map((e) => `${ref(e.path)} — ${cell(e.shows)}`).join('<br>');
const counts = (items: readonly { standing: string }[]) => STANDINGS.map((s) => `${s} ${items.filter((i) => i.standing === s).length}`).join(' · ');
const itemTable = (items: readonly { id: string; item: string; asks: string; standing: string; evidence: readonly { path: string; shows: string }[]; gap: string }[]) =>
  table(['ID', 'Item', 'The document asks', 'Standing', 'Evidence', 'Gap'], items.map((i) => [i.id, cell(i.item), cell(i.asks), i.standing, ev(i), cell(i.gap)]));
const none = (s: string | null) => (s ? cell(s) : '**nothing**');

function render(): string {
  const guarded = VERIFICATION.filter((v) => v.guard).length;
  return [
    '# Operational reality register',
    '',
    renderedFrom('app/src/lib/operationalreality.ts', 'operationalreality.test.ts'),
    '',
    controlLine(DOC),
    '',
    'Two documents of 28 September 2026 say, from different ends, that the vision,',
    'the domains, the compliance architecture and the commercial model are',
    'described and that what is missing is the execution, validation and evidence',
    'layer: owners, a hard launch definition, verified production behaviour,',
    'failure and load testing, data-quality operations, support as a product,',
    'implementation capacity, revenue operations, key-person resilience, and one',
    'go-live dossier per launch. They are kept under `docs/expansion/` as supplied.',
    'This page holds each thing they ask for to what the tree has, under the rule of',
    '[D-108](DECISION-LOG.md#d-108--the-modernization-blueprint-is-a-crosswalk-onto-the-master-register-not-a-second-register)',
    'and [D-111](DECISION-LOG.md#d-111--five-research-documents-are-held-to-the-tree-as-crosswalks-and-the-pdfs-are-never-their-own-evidence):',
    'a supplied PDF is never its own evidence, every cited file exists, every',
    'standing is held to the kind of file it cites, and every edge case, risk, game',
    'day or maturity control named here exists in the register that owns it.',
    'Standings were read at `origin/main` `ff52ba4` on 28 September 2026. The',
    `company side — entity, insurance, contracts, pricing, go-to-market, the council — is ${ref('docs/SAAS-LAUNCH-KIT.md')}.`,
    '',
    '| Supplied document | What it holds |',
    '| --- | --- |',
    ...SOURCES.map((s) => `| [${s.title}](${link(DOC, s.path)}) | ${cell(s.what)} |`),
    '',
    '## Standings',
    '',
    ...table(['Standing', 'Meaning'], STANDINGS.map((s) => [s, STANDING_MEANING[s]])),
    '',
    `Across the ${ITEMS.length} items with a standing: ${counts(ITEMS)}.`,
    '',
    '## 1. One master operating plan',
    '',
    'A roadmap without named owners, budget, dependencies, evidence and decision',
    'gates is still a strategy document. No register here holds all thirteen fields',
    'on one row; the two nobody holds are a backup owner and a budget.',
    '',
    ...table(['Field', 'Already carried by'], PLAN_FIELDS.map((f) => [f.field, none(f.carriedBy)])),
    '',
    '### The five workstreams, on the seats',
    '',
    ...table(['Workstream', 'Goal', 'Seats', 'Where it lives'], WORKSTREAMS.map((w) => [w.workstream, cell(w.goal), w.seats.map((s) => `\`${s}\``).join(', '), cell(w.note)])),
    '',
    'Every seat is vacant ([`LAUNCH-READINESS-COUNCIL.md`](LAUNCH-READINESS-COUNCIL.md)).',
    '',
    '## 2. The company operating system',
    '',
    `Five areas: ${counts(OPERATING_SYSTEM)}.`,
    '',
    ...itemTable(OPERATING_SYSTEM),
    '',
    '## 3. The organizational model',
    '',
    'Clear ownership before headcount. Eight functions, each with the owner the',
    `document names first and the seat in ${ref('app/src/lib/launchreadiness.ts')} that carries it.`,
    '',
    ...table(['Function', 'Initial owner', 'Non-negotiable', 'Seat', 'Note'], FUNCTIONS.map((f) => [f.fn, cell(f.initialOwner), cell(f.responsibility), f.seat ? `\`${f.seat}\`` : '**none**', cell(f.note)])),
    '',
    DRI_RULE,
    '',
    '## 4. The customer-proof engine',
    '',
    `The pilot-to-platform programme, stage by stage: ${counts(PROOF_ENGINE)}.`,
    '',
    ...itemTable(PROOF_ENGINE),
    '',
    '### The three proofs',
    '',
    ...table(['Proof', 'What it shows', 'The measure that would show it'], PROOFS.map((p) => [p.proof, cell(p.shows), cell(p.measure)])),
    '',
    '## 5. Reliability and service operations',
    '',
    'The product is only as good as it behaves during registration, midterms,',
    `finals, grading, orientation and major incidents. Five tiers: ${counts(SERVICE_TIERS)}.`,
    'No tier word exists on main; `config-tiers.ts` is what a school may configure,',
    'not how a service is run.',
    '',
    ...table(['ID', 'Tier', 'Examples', 'Requirement', 'Standing', 'Evidence', 'Gap'],
      SERVICE_TIERS.map((t) => [t.id, t.tier, cell(t.examples), cell(t.requirement), t.standing, ev(t), cell(t.gap)])),
    '',
    '### What every tier owes',
    '',
    ...table(['Definition', 'The tree, for any tier'], TIER_DEFINITIONS.map((d) => [d.definition, none(d.tree)])),
    '',
    '## 6. The implementation factory',
    '',
    `Seventeen reusable assets: ${counts(FACTORY)}. A full-platform business succeeds only if each new university does not require a custom rebuild.`,
    '',
    ...itemTable(FACTORY),
    '',
    '## 7. Packaging, brand and the readiness test',
    '',
    '### Packages',
    '',
    `Sold as a unified system with modular activation. Each package points at the modules in ${ref('docs/SAAS-LAUNCH-KIT.md')} that carry it.`,
    '',
    ...table(['Package', 'Holds', 'Launch-kit modules'], PACKAGES.map((p) => [p.package, cell(p.holds), p.kitModules.map((m) => `[${m}](SAAS-LAUNCH-KIT.md)`).join(', ')])),
    '',
    'Three commercial rules — do not discount away implementation, security,',
    'migration or support; no unlimited custom scope inside an annual price; no',
    'module promised before it has an owner, a support model, a data model and',
    'tested controls — are the launch kit’s guardrails LK-GUARD-03, LK-GUARD-04 and',
    'LK-GUARD-06.',
    '',
    '### Brand, category and trust assets',
    '',
    ...table(['Asset', 'The document asks', 'The tree'], BRAND.map((b) => [b.asset, cell(b.asks), cell(b.tree)])),
    '',
    ...table(['Public body of work', 'The tree'], PUBLIC_WORKS.map((w) => [w.work, cell(w.tree)])),
    '',
    '### The whole-platform readiness test',
    '',
    'Semester is ready to sell as a full university operating system when every',
    'enabled domain can answer these twelve questions. What answers each today:',
    '',
    ...table(['Question', 'Required answer', 'Answered by'], READINESS_TEST.map((q) => [q.question, cell(q.required), cell(q.answeredBy)])),
    '',
    '### Execution priorities',
    '',
    `${counts(PRIORITIES)}.`,
    '',
    ...itemTable(PRIORITIES),
    '',
    '## 8. A hard launch definition',
    '',
    `The launch readiness review ends in one of three decisions. The code in ${ref('app/src/lib/launchreadiness.ts')} has two.`,
    '',
    ...table(['Decision', 'When', 'The tree'], REVIEW_DECISIONS.map((d) => [`**${d.decision}**`, cell(d.when), cell(d.tree)])),
    '',
    '## 9. Real production verification',
    '',
    VERIFICATION_RULE,
    '',
    `${VERIFICATION.length} checks across seven domains; ${guarded} have a guard, ${VERIFICATION.length - guarded} have none. Every payment check but two is unguarded because no payment exists (D-009).`,
    '',
    ...table(['Domain', 'Check', 'Guard'], VERIFICATION.map((v) => [v.domain, v.check, v.guard ? ref(v.guard) : '**none**'])),
    '',
    '## 10. Stress, failure and recovery testing',
    '',
    RECOVERY_RULE,
    '',
    'Eighteen scenarios, each with the edge cases (`EC-`), risks (`R-`), game days',
    '(`GD-`) and maturity controls that already name it, and the runbook that would',
    'be opened. Every game day is unheld.',
    '',
    ...table(['Scenario', 'Named by', 'Runbook'], FAILURES.map((f) => [f.scenario, f.ids.length ? f.ids.map((i) => `\`${i}\``).join(', ') : '**nothing**', f.runbook ? ref(f.runbook) : '**none**'])),
    '',
    '### What every scenario owes',
    '',
    ...table(['Field', 'Already carried by'], SCENARIO_FIELDS.map((f) => [f.field, none(f.carriedBy)])),
    '',
    '## 11. Capacity, performance and cost proof',
    '',
    CAPACITY_RULE,
    '',
    'The load scenarios to demonstrate before marketing a complete platform, none of which has been run:',
    '',
    ...LOAD_SCENARIOS.map((s) => `- ${s}`),
    '',
    ...table(['Threshold', 'The tree'], THRESHOLDS.map((t) => [t.threshold, none(t.tree)])),
    '',
    '## 12. Data quality and migration readiness',
    '',
    `The integration foundations must be operational requirements, not future ideas: ${counts(DATA_QUALITY)}. Most are tested against mock sources; none has met a live one.`,
    '',
    ...itemTable(DATA_QUALITY),
    '',
    '## 13. Support is a product',
    '',
    `Before live customers, build the support service, not an email address: ${counts(SUPPORT)}.`,
    '',
    ...itemTable(SUPPORT),
    '',
    '### What every ticket type owes',
    '',
    ...table(['Field', 'Already carried by'], TICKET_FIELDS.map((f) => [f.field, none(f.carriedBy)])),
    '',
    '## 14. Implementation and change-management capacity',
    '',
    `Do not sell a whole university operating system without knowing exactly how it gets adopted: ${counts(IMPLEMENTATION)}.`,
    '',
    ...itemTable(IMPLEMENTATION),
    '',
    '### The mutual success plan',
    '',
    `Each customer needs one. No structure exists; the fields \`PilotPlan\` in ${ref('app/src/lib/gtm/pilot.ts')} already carries:`,
    '',
    ...table(['Field', 'Already carried by'], SUCCESS_PLAN.map((f) => [f.field, none(f.carriedBy)])),
    '',
    '## 15. Revenue operations and finance controls',
    '',
    'Order-to-cash discipline. Sales stages and the discount matrix are code; the',
    'financial controls are a page; nothing has been invoiced.',
    '',
    ...table(['Item', 'The tree'], REVOPS.map((r) => [r.item, none(r.tree)])),
    '',
    '## 16. Hiring and key-person resilience',
    '',
    'A platform this broad cannot rely on one person’s memory or availability. It does.',
    '',
    ...table(['Item', 'The tree'], PEOPLE.map((p) => [p.item, none(p.tree)])),
    '',
    '## 17. The go-live dossier',
    '',
    'One dossier for each production launch, pilot, module and high-risk',
    'integration. None exists as a single document; each section, and what already',
    'carries it:',
    '',
    ...table(['Section', 'Holds', 'Already carried by'], DOSSIER.map((d) => [d.section, cell(d.holds), none(d.carriedBy)])),
    '',
    '## 18. The final checklist',
    '',
    'Semester is operational when it can say yes to all twelve. Today:',
    '',
    ...table(['Line', 'Answer', 'Why'], FINAL_CHECKLIST.map((f) => [cell(f.line), `**${f.answer}**`, cell(f.why)])),
    '',
    `${BOTTOM_LINE.join(' · ')}.`,
    '',
  ].join('\n');
}
