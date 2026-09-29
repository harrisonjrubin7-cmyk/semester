import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEAL_POLICY } from './governance/deal-desk';
import { SALES_STAGES } from './gtm/stages';
import { PILOT_DAYS } from './gtm/pilot';
import { SEATS } from './launchreadiness';
import {
  AGREEMENT_SECTIONS, BANDS, BUYERS, CADENCE, CALCULATOR_INPUTS, CHANNELS, COMMERCIAL_RULES, CORPORATE_FILES, COUNCIL_PRINCIPLES, COUNCIL_PURPOSE,
  COUNCIL_ROLES, COUNCIL_SCOPE, COUNSEL_PROVISIONS, COVERAGES, DECISION_FILES, DECISION_PACKET, DECISION_RIGHTS, ENTITY, FORMATION, GUARDRAILS,
  IDEAL_CUSTOMERS, ITEMS, LAYERS, MARKET_POSITION, MODULES, OUTCOMES, PACKAGE, PIPELINE_METRICS, POSITION, PRINCIPLE, RECORDS, RELEASE_BLOCKS,
  SALES_PROCESS, SEQUENCE, SOURCES, SOW, STANDINGS, STANDING_MEANING, TERM_SHEET, THIRTY_DAYS, UNDERWRITING,
} from './launchkit';
import { cell, controlLine, link, renderedFrom, table } from './ops/render';

/**
 * Holds the SaaS launch kit to the tree: the three supplied documents are
 * where the module says and are never cited as evidence; every item cites
 * files that exist and the kind of file its standing claims; a `held` item
 * cites a decision file; the council roles name real seats; the sales steps
 * name real stages; the SOW fields name real PilotPlan fields; and the bands
 * quote the deal desk's actual minimums. `docs/SAAS-LAUNCH-KIT.md` is rendered
 * from the data; `npm run registers` from app/ rewrites it, and the last test
 * fails while it is stale.
 */

const root = join(import.meta.dirname, '../../..');
const at = (p: string) => join(root, p);
const read = (p: string) => readFileSync(at(p), 'utf8');
const DOC = 'docs/SAAS-LAUNCH-KIT.md';

const isDoc = (p: string) => /\.(md|pdf|json)$/.test(p) && !p.startsWith('.github/');
const isTest = (p: string) => /\.test\.tsx?$/.test(p) || /^supabase\/[^/]+\.check\.sql$/.test(p);
const isCode = (p: string) => !isDoc(p);

describe('the SaaS launch kit crosswalk', () => {
  describe('its shape', () => {
    it('keeps the three supplied documents where it says, and never cites them as evidence', () => {
      expect(SOURCES).toHaveLength(3);
      for (const s of SOURCES) expect(existsSync(at(s.path)), s.path).toBe(true);
      const supplied = new Set(SOURCES.map((s) => s.path));
      for (const i of ITEMS) for (const e of i.evidence) expect(supplied.has(e.path), `${i.id} cites a supplied PDF`).toBe(false);
    });

    it('has the kit’s counts, each id once', () => {
      expect(COMMERCIAL_RULES).toHaveLength(7);
      expect(FORMATION).toHaveLength(20);
      expect(CORPORATE_FILES).toHaveLength(12);
      expect(COVERAGES).toHaveLength(9);
      expect(UNDERWRITING).toHaveLength(9);
      expect(PACKAGE).toHaveLength(7);
      expect(TERM_SHEET).toHaveLength(14);
      expect(AGREEMENT_SECTIONS).toHaveLength(18);
      expect(SOW).toHaveLength(13);
      expect(COUNSEL_PROVISIONS).toHaveLength(12);
      expect(LAYERS).toHaveLength(8);
      expect(MODULES).toHaveLength(12);
      expect(BANDS).toHaveLength(5);
      expect(CALCULATOR_INPUTS).toHaveLength(14);
      expect(GUARDRAILS).toHaveLength(8);
      expect(IDEAL_CUSTOMERS).toHaveLength(8);
      expect(BUYERS).toHaveLength(6);
      expect(SEQUENCE.map((p) => p.items.length)).toEqual([8, 7, 6]);
      expect(CHANNELS).toHaveLength(7);
      expect(SALES_PROCESS).toHaveLength(13);
      expect(PIPELINE_METRICS).toHaveLength(17);
      expect(COUNCIL_SCOPE).toHaveLength(10);
      expect(COUNCIL_PRINCIPLES).toHaveLength(12);
      expect(COUNCIL_ROLES).toHaveLength(12);
      expect(DECISION_RIGHTS).toHaveLength(8);
      expect(DECISION_PACKET).toHaveLength(17);
      expect(CADENCE).toHaveLength(3);
      expect(OUTCOMES).toHaveLength(6);
      expect(RELEASE_BLOCKS).toHaveLength(8);
      expect(RECORDS).toHaveLength(7);
      expect(THIRTY_DAYS).toHaveLength(12);
      expect(PRINCIPLE).toHaveLength(6);
      const ids = ITEMS.map((i) => i.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(id).toMatch(/^LK-[A-Z0-9]+-\d{2}$/);
      expect(POSITION).toMatch(/Foundation/);
      expect(COUNCIL_PURPOSE).toMatch(/evidence-based claims/);
      expect(MARKET_POSITION.tree).toMatch(/No category statement/);
    });
  });

  describe('what a standing may claim', () => {
    it('can tell a missing file from a present one', () => {
      expect(existsSync(at('README.md'))).toBe(true);
      expect(existsSync(at('docs/NO-SUCH-LAUNCH-KIT-EVIDENCE.md'))).toBe(false);
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
        expect(i.gap.trim().length, i.id).toBeGreaterThan(5);
        expect(i.asks.trim().length, i.id).toBeGreaterThan(5);
      }
      for (const p of DECISION_FILES) expect(existsSync(at(p)), p).toBe(true);
      for (const s of STANDINGS) expect(STANDING_MEANING[s]).toMatch(/./);
    });

    it('holds the entity to the owner’s attestation, not to the kit’s recommendation', () => {
      expect(ENTITY.standing).toBe('held');
      expect(ENTITY.evidence.map((e) => e.path)).toContain('docs/market-readiness/HECVAT_DRAFT_RESPONSE.md');
      expect(read('docs/market-readiness/HECVAT_DRAFT_RESPONSE.md')).toMatch(/single-member LLC/);
      expect(FORMATION.find((f) => f.item === 'Structure chosen')?.standing).toBe('held');
    });

    it('holds the pilot term to the code’s 26 weeks, two days past the kit’s 90–180', () => {
      const term = TERM_SHEET.find((t) => t.item === 'Term');
      expect(term?.standing).toBe('held');
      expect(PILOT_DAYS).toBe(182);
      expect(term?.gap).toMatch(/26 weeks/);
      expect(DEAL_POLICY.maxPilotMonths).toBe(6);
    });

    it('quotes the deal desk’s actual minimums in the bands', () => {
      const dollars = (cents: number) => `$${(cents / 100).toLocaleString('en-US')}`;
      expect(BANDS[1].tree).toContain(dollars(DEAL_POLICY.minimumAcvCents.pilot));
      expect(BANDS[1].tree).toContain(dollars(DEAL_POLICY.minimumAcvCents.department));
      expect(BANDS[1].tree).toContain(dollars(DEAL_POLICY.implementationFeeFloorCents));
      expect(BANDS[2].tree).toContain(dollars(DEAL_POLICY.minimumAcvCents.campus));
      expect(BANDS[4].tree).toContain(dollars(DEAL_POLICY.minimumAcvCents.system));
      expect(BANDS[4].tree).toContain(`${Math.round(DEAL_POLICY.multiYearStep * 100)}%`);
      expect(BANDS[4].tree).toContain(`${Math.round(DEAL_POLICY.multiYearCap * 100)}%`);
      for (const b of BANDS) expect(b.tree.trim().length).toBeGreaterThan(5);
    });
  });

  describe('what names what', () => {
    it('names only council seats that exist, and says where none does', () => {
      for (const r of COUNCIL_ROLES) {
        if (r.seat) expect(SEATS, `${r.role} → ${r.seat}`).toContain(r.seat);
        else expect(r.note, r.role).toMatch(/No seat/);
      }
      expect(COUNCIL_ROLES.filter((r) => r.seat === null)).toHaveLength(1);
    });

    it('names only sales stages that exist', () => {
      for (const s of SALES_PROCESS) if (s.stage) expect(SALES_STAGES, `${s.step} → ${s.stage}`).toContain(s.stage);
      expect(SALES_PROCESS.filter((s) => s.stage === null).length).toBe(2);
    });

    it('names only PilotPlan fields for the SOW', () => {
      const plan = read('app/src/lib/gtm/pilot.ts');
      const block = plan.slice(plan.indexOf('export interface PilotPlan'), plan.indexOf('\n}', plan.indexOf('export interface PilotPlan')));
      for (const s of SOW) {
        if (!s.carriedBy) { expect(s.note.trim().length, s.field).toBeGreaterThan(5); continue; }
        for (const f of s.carriedBy.split(',').map((x) => x.trim())) expect(block, `${s.field} → ${f}`).toMatch(new RegExp(`^\\s+${f}\\??:`, 'm'));
      }
    });

    it('maps the eighteen agreement sections onto the outline’s twenty-six', () => {
      const outline = read('docs/trust/PILOT-AGREEMENT-OUTLINE.md');
      expect(outline).toMatch(/^26\. /m);
      expect(outline).not.toMatch(/^27\. /m);
      for (const s of AGREEMENT_SECTIONS) {
        for (const n of s.outline) {
          expect(n, s.section).toBeGreaterThanOrEqual(1);
          expect(n, s.section).toBeLessThanOrEqual(26);
        }
        if (s.outline.length === 0) expect(s.note, s.section).toMatch(/Not in the outline/);
      }
      expect(AGREEMENT_SECTIONS.filter((s) => s.outline.length === 0)).toHaveLength(3);
    });

    it('reads the ideal customers against the GTM playbook', () => {
      const playbook = read('docs/INSTITUTIONAL-GTM-PLAYBOOK.md');
      expect(playbook).toMatch(/transfer/i);
      expect(playbook).not.toMatch(/accessibility-forward/i);
      expect(IDEAL_CUSTOMERS.filter((c) => c.inPlaybook)).toHaveLength(4);
      expect(IDEAL_CUSTOMERS.find((c) => /Accessibility-forward/.test(c.profile))?.inPlaybook).toBe(false);
    });

    it('lists the pipeline metrics nobody can measure yet', () => {
      expect(PIPELINE_METRICS.filter((m) => m.source === null).length).toBe(9);
      expect(DECISION_PACKET.filter((p) => p.askedBy === null).length).toBe(2);
      expect(RECORDS.filter((r) => r.standing === 'missing').length).toBe(2);
      expect(THIRTY_DAYS.filter((t) => t.carriedBy === null).length).toBe(4);
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
  table(['ID', 'Item', 'The kit asks', 'Standing', 'Evidence', 'Gap'], items.map((i) => [i.id, cell(i.item), cell(i.asks), i.standing, ev(i), cell(i.gap)]));

function render(): string {
  return [
    '# SaaS launch kit',
    '',
    renderedFrom('app/src/lib/launchkit.ts', 'launchkit.test.ts'),
    '',
    controlLine(DOC),
    '',
    'Three documents of 28 September 2026 describe the company around the product:',
    'entity and formation, insurance, the pilot agreement package, module-by-module',
    'pricing, the higher-education go-to-market plan, a Product Governance Council',
    'charter and a first-30-day checklist. They are kept under `docs/expansion/` as',
    'supplied. This page holds each thing they ask for to what the tree already has,',
    'under the rule of [D-108](DECISION-LOG.md#d-108--the-modernization-blueprint-is-a-crosswalk-onto-the-master-register-not-a-second-register)',
    'and [D-111](DECISION-LOG.md#d-111--five-research-documents-are-held-to-the-tree-as-crosswalks-and-the-pdfs-are-never-their-own-evidence):',
    'a supplied PDF is never its own evidence, every cited file exists, and every',
    'standing is held to the kind of file it cites. Standings were read at `origin/main`',
    '`ff52ba4` on 28 September 2026.',
    '',
    '**This is a business planning crosswalk, not legal, tax, accounting, insurance or',
    'investment advice.** Nothing here may be signed; counsel, a CPA and a broker',
    'come before any contract, entity change, equity, payment or compliance claim.',
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
    '## 1. The commercial position and its rules',
    '',
    `**${POSITION}**`,
    '',
    ...itemTable(COMMERCIAL_RULES),
    '',
    '## 2. Entity and formation',
    '',
    `${ENTITY.asks} **Held:** ${ENTITY.gap}`,
    '',
    ...table(['Evidence', 'Shows'], ENTITY.evidence.map((e) => [ref(e.path), cell(e.shows)])),
    '',
    `The formation checklist, twenty items: ${counts(FORMATION)}.`,
    '',
    ...itemTable(FORMATION),
    '',
    '### Essential corporate files',
    '',
    'The kit lists twelve. None is in evidence, because `docs/evidence/` does not',
    'exist and corporate records do not belong in a public repository; the gap is a',
    'private store, and an index of it filed here.',
    '',
    ...CORPORATE_FILES.map((f) => `- ${f}`),
    '',
    '## 3. Insurance',
    '',
    `Nine coverages in the kit’s sequence. All nine: ${counts(COVERAGES)}. Only cyber liability is`,
    'named anywhere on main, and the HECVAT draft records that no policy is held.',
    '',
    ...table(['ID', 'Coverage', 'When', 'Purpose', 'Ask the broker', 'Standing', 'Evidence', 'Gap'],
      COVERAGES.map((c) => [c.id, cell(c.item), cell(c.trigger), cell(c.purpose), cell(c.brokerQuestion), c.standing, ev(c), cell(c.gap)])),
    '',
    '### The underwriting packet',
    '',
    `What a broker asks for, and what the tree can hand over today: ${counts(UNDERWRITING)}.`,
    '',
    ...itemTable(UNDERWRITING),
    '',
    '## 4. The pilot agreement',
    '',
    `The recommended package is seven documents: ${counts(PACKAGE)}.`,
    '',
    ...itemTable(PACKAGE),
    '',
    '### The term sheet',
    '',
    `Fourteen positions, each held to where the tree already takes it: ${counts(TERM_SHEET)}.`,
    'The one conflict is the term: the kit says 90–180 days and `gtm/pilot.ts` runs',
    'every pilot for exactly 26 weeks, 182 days, as the owner set it (D-134).',
    '',
    ...itemTable(TERM_SHEET),
    '',
    '### The eighteen agreement sections, on the outline’s twenty-six',
    '',
    'Each section the kit asks for, and the numbered sections of',
    `${ref('docs/trust/PILOT-AGREEMENT-OUTLINE.md')} that carry it.`,
    '',
    ...table(['Section', 'Outline §', 'Note'], AGREEMENT_SECTIONS.map((s) => [cell(s.section), s.outline.length ? s.outline.join(', ') : '**none**', cell(s.note)])),
    '',
    '### The pilot statement of work',
    '',
    'The kit’s SOW template, field by field, and the `PilotPlan` field in',
    `${ref('app/src/lib/gtm/pilot.ts')} that already carries it — the database refuses a pilot without those.`,
    '',
    ...table(['Field', 'Carried by', 'Note'], SOW.map((s) => [s.field, s.carriedBy ? `\`${s.carriedBy}\`` : '**none**', cell(s.note)])),
    '',
    '### Left to counsel',
    '',
    `${COUNSEL_PROVISIONS.join(' · ')}. None of these is attempted in the tree.`,
    '',
    '## 5. Module-by-module pricing',
    '',
    `The commercial layers: ${counts(LAYERS)}.`,
    '',
    ...itemTable(LAYERS),
    '',
    '### The modules',
    '',
    `Twelve modules in the kit’s catalogue. None exists as an entitlement; each is read`,
    `against the features that would be sold under it: ${counts(MODULES)}.`,
    '',
    ...table(['ID', 'Module', 'Buyer', 'Pricing metric', 'Included value', 'Guardrail', 'Standing', 'Evidence', 'Gap'],
      MODULES.map((m) => [m.id, cell(m.item), cell(m.buyer), cell(m.metric), cell(m.included), cell(m.guardrail), m.standing, ev(m), cell(m.gap)])),
    '',
    '### Starting bands',
    '',
    '**Hypotheses to test through discovery, not published prices.** Beside each, what',
    `the tree holds: the deal desk’s proposed minimums in ${ref('app/src/lib/governance/deal-desk.ts')}`,
    `and the planned student plans in ${ref('app/src/lib/plans.ts')}. No institutional price exists.`,
    '',
    ...table(['Scope', 'Annual software', 'One-time implementation', 'Motion', 'The tree'], BANDS.map((b) => [b.scope, b.software, b.implementation, cell(b.motion), cell(b.tree)])),
    '',
    '### Price calculator inputs',
    '',
    'No calculator exists. Each input, and the register that could feed it.',
    '',
    ...table(['Input', 'Source'], CALCULATOR_INPUTS.map((c) => [c.input, cell(c.source)])),
    '',
    '### Pricing guardrails',
    '',
    ...itemTable(GUARDRAILS),
    '',
    '## 6. The higher-education go-to-market plan',
    '',
    `**Market position.** ${MARKET_POSITION.statement} For students: ${MARKET_POSITION.students} For institutions: ${MARKET_POSITION.institutions}`,
    '',
    `*The tree:* ${MARKET_POSITION.tree}`,
    '',
    '### Ideal early customers',
    '',
    `Read against ${ref('docs/INSTITUTIONAL-GTM-PLAYBOOK.md')}.`,
    '',
    ...table(['Profile', 'In the playbook', 'Note'], IDEAL_CUSTOMERS.map((c) => [c.profile, c.inPlaybook ? 'yes' : '**no**', cell(c.note)])),
    '',
    '### The buyer map',
    '',
    'Each offer read against what the tree can show for it, and the buying-committee',
    `role in ${ref('app/src/lib/gtm/pilot.ts')} that names the buyer.`,
    '',
    ...table(['Buyer', 'Pain', 'Message', 'Initial offer', 'Committee role', 'What the tree can show'],
      BUYERS.map((b) => [b.buyer, cell(b.pain), cell(b.message), cell(b.offer), b.committeeRole ? `\`${b.committeeRole}\`` : '**none**', cell(b.offerStanding)])),
    '',
    '### The 180-day sequence',
    '',
    'The tree’s plan is ninety days (`docs/90-DAY-LAUNCH-PROGRAM.md`); the third phase',
    'has nothing to stand on until the first two have run.',
    '',
    ...SEQUENCE.flatMap((p) => [`#### ${p.phase} — ${p.window}`, '', `${counts(p.items)}.`, '', ...itemTable(p.items), '']),
    '### Channels',
    '',
    ...table(['Channel', 'Purpose', 'First action', 'The tree'], CHANNELS.map((c) => [c.channel, cell(c.purpose), cell(c.firstAction), cell(c.tree)])),
    '',
    '### The sales process, on the sixteen stages',
    '',
    `Each of the kit’s thirteen steps, and the stage in ${ref('app/src/lib/gtm/stages.ts')} it enters, or none.`,
    '',
    ...table(['Step', 'Stage'], SALES_PROCESS.map((s) => [s.step, s.stage ? `\`${s.stage}\`` : '**none**'])),
    '',
    '### Pipeline metrics',
    '',
    `Seventeen metrics; ${PIPELINE_METRICS.filter((m) => m.source === null).length} have no source at all.`,
    '',
    ...table(['Metric', 'Where a figure would come from'], PIPELINE_METRICS.map((m) => [m.metric, m.source ? cell(m.source) : '**nowhere**'])),
    '',
    '## 7. The Product Governance Council charter',
    '',
    COUNCIL_PURPOSE,
    '',
    'No council by this name exists. Its accountabilities are already the launch',
    `readiness council’s seats (${ref('docs/LAUNCH-READINESS-COUNCIL.md')}), every one`,
    'vacant; the AI governance board and the portfolio council have charters and no',
    'members. This section holds the charter to those, so that forming one council',
    'means filling seats that already exist rather than drafting a fourth charter.',
    '',
    '### Scope',
    '',
    ...COUNCIL_SCOPE.map((s) => `- ${s}`),
    '',
    '### Principles',
    '',
    ...COUNCIL_PRINCIPLES.map((s) => `- ${s}`),
    '',
    '### Membership, on the seats',
    '',
    ...table(['Role', 'Decides', 'Seat', 'Note'], COUNCIL_ROLES.map((r) => [r.role, cell(r.decides), r.seat ? `\`${r.seat}\`` : '**none**', cell(r.note)])),
    '',
    '### Decision rights',
    '',
    `What must come to the council before release, each held to the gate that already asks: ${counts(DECISION_RIGHTS)}.`,
    '',
    ...itemTable(DECISION_RIGHTS),
    '',
    '### The decision packet',
    '',
    `Each line beside the question or field the tree already asks — ${ref('app/src/lib/governance/charters.ts')},`,
    `the scope questions in ${ref('app/src/lib/ops/operatingsystem.ts')} that the pull-request template carries, and the gates.`,
    '',
    ...table(['Packet line', 'Already asked by'], DECISION_PACKET.map((p) => [p.line, p.askedBy ? cell(p.askedBy) : '**nothing**'])),
    '',
    '### Cadence',
    '',
    ...table(['When', 'The council does', 'The tree'], CADENCE.map((c) => [c.when, cell(c.does), cell(c.tree)])),
    '',
    '### Decision outcomes',
    '',
    ...table(['Outcome', 'The tree’s word for it'], OUTCOMES.map((o) => [o.outcome, cell(o.tree)])),
    '',
    '### Release blocks',
    '',
    `${counts(RELEASE_BLOCKS)}.`,
    '',
    ...itemTable(RELEASE_BLOCKS),
    '',
    '### Records the council keeps',
    '',
    ...table(['Record', 'Where it lives', 'Standing'], RECORDS.map((r) => [r.record, cell(r.tree), r.standing])),
    '',
    '## 8. The first thirty days',
    '',
    `The kit’s checklist, each beside the ninety-day task in ${ref('app/src/lib/launch/ninety-day.ts')}`,
    `or the owner decision in ${ref('docs/LAUNCH-DECISIONS.md')} that carries it.`,
    '',
    ...table(['Item', 'Carried by', 'Where it stands'], THIRTY_DAYS.map((t) => [cell(t.item), t.carriedBy ? cell(t.carriedBy) : '**nothing**', cell(t.note)])),
    '',
    '## 9. The operating principle',
    '',
    ...PRINCIPLE.map((p) => `- ${p}`),
    '',
    'What it takes to make all of this operate — owners, verification, failure',
    'testing, support, implementation capacity, revenue operations and the go-live',
    `dossier — is ${ref('docs/OPERATIONAL-REALITY-REGISTER.md')}.`,
    '',
  ].join('\n');
}
