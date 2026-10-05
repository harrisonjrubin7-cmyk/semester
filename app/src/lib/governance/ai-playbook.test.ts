import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ACTION_TIERS, ACTION_TIER_ROWS, ASSESSED, CONFIRMATIONS, COST_COMPONENTS, DATA_CLASSES, DEFINITION_OF_DONE, DIMENSIONS, DIMENSION_ROWS,
  FIRST_GOAL, FIRST_WEEK, FLOORS, INPUTS, LAYER, MEMORY_RULES, NEVER_SEND, ONBOARDING, OVERALL_MINIMUM, PROVIDER_REQUIREMENTS, ROADMAP,
  RULES, SOURCES, STARTING_CHOICES, STATUSES, TIERS_WITHOUT_A_CLASS, VENDORS, WEIGHT_SUM, WORKFLOWS,
  CHECKED, EVAL_SET, OFFICIAL_HOSTS, PROVIDER_BASIS, provisional, scoresOf, type Provider,
  scoreVendor, type Scores,
} from './ai-playbook';
import { AI_RELEASE_GATE, PROHIBITED_STARTING_SCOPE } from './ai-lifecycle';
import { TIERS, gate } from '../toolkit/classification';
import { PARTIES } from '../trust/subprocessors';
import { GOALS } from '../goals';

/**
 * Holds the AI integration playbook to the same rule as the AI assurance
 * matrix — every cited file exists, each status cites the kind of file it
 * claims, the supplied PDFs are never evidence — and to the code it
 * crosswalks: a workflow's refusal is an intake refusal that exists, a data
 * class's AI rule is what `classification.gate()` answers for its tiers, a
 * starting choice is a `FirstGoal` goal, a definition-of-done line names an
 * `AI_RELEASE_GATE` item, and the vendor scorecard covers every AI party the
 * subprocessor register names.
 *
 * `docs/operating-model/AI-INTEGRATION-PLAYBOOK.md` is rendered from the data;
 * run `npm run registers` from app/ to rewrite it. The last test fails while stale.
 */

const root = join(import.meta.dirname, '../../../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const DOC = 'docs/operating-model/AI-INTEGRATION-PLAYBOOK.md';

const isDoc = (p: string) => /\.(md|pdf|json)$/.test(p) && !p.startsWith('.github/');
const isTest = (p: string) => /\.test\.tsx?$/.test(p) || /^supabase\/[^/]+\.check\.sql$/.test(p);
const isCode = (p: string) => !isDoc(p);

const all5: Scores = Object.fromEntries(DIMENSIONS.map((d) => [d, 5]));

describe('the AI integration playbook', () => {
  it('keeps the three supplied documents where it says, and never cites them as evidence', () => {
    expect(SOURCES).toHaveLength(3);
    for (const s of SOURCES) expect(existsSync(join(root, s.path)), s.path).toBe(true);
    const supplied = new Set(SOURCES.map((s) => s.path));
    for (const a of ASSESSED) for (const e of a.evidence) expect(supplied.has(e.path), `${a.id} cites a supplied PDF as evidence`).toBe(false);
  });

  it('has what the playbook has, ids once', () => {
    expect(RULES).toHaveLength(10);
    expect(ACTION_TIER_ROWS.map((t) => t.tier)).toEqual([...ACTION_TIERS]);
    expect(WORKFLOWS).toHaveLength(10);
    expect(CONFIRMATIONS).toHaveLength(13);
    expect(NEVER_SEND).toHaveLength(8);
    expect(ONBOARDING).toHaveLength(6);
    expect(INPUTS).toHaveLength(10);
    expect(DEFINITION_OF_DONE).toHaveLength(15);
    expect(PROVIDER_REQUIREMENTS).toHaveLength(12);
    expect(ROADMAP).toHaveLength(4);
    expect(LAYER).toHaveLength(6);
    expect(MEMORY_RULES).toHaveLength(7);
    expect(FIRST_WEEK.map((d) => d.day)).toEqual([0, 1, 2, 3, 5, 7]);
    expect(new Set(ASSESSED.map((a) => a.id)).size).toBe(ASSESSED.length);
  });

  it('builds the five the summary names first, and they are the first five', () => {
    expect(WORKFLOWS.filter((w) => w.first).map((w) => w.id)).toEqual(['WF-01', 'WF-02', 'WF-03', 'WF-04', 'WF-05']);
  });

  it('can tell a missing file from a present one', () => {
    expect(existsSync(join(root, 'README.md'))).toBe(true);
    expect(existsSync(join(root, 'docs/no-such-playbook-evidence.md'))).toBe(false);
  });

  it('cites only files that exist', () => {
    for (const a of ASSESSED) for (const e of a.evidence) expect(existsSync(join(root, e.path)), `${a.id} cites ${e.path}`).toBe(true);
  });

  it('holds each status to the kind of file it claims, and names a gap for every item', () => {
    for (const a of ASSESSED) {
      const paths = a.evidence.map((e) => e.path);
      expect(STATUSES, a.id).toContain(a.status);
      if (a.status === 'designed') expect(paths.some(isDoc), `${a.id} is designed and cites no document`).toBe(true);
      if (a.status === 'building') expect(paths.some(isCode), `${a.id} is building and cites no code`).toBe(true);
      if (a.status === 'tested') expect(paths.some(isTest), `${a.id} is tested and cites no test`).toBe(true);
      if (a.status === 'not-started') expect(paths.every(isDoc), `${a.id} is not started yet cites code`).toBe(true);
      expect(a.gap.trim().length, a.id).toBeGreaterThanOrEqual(5);
    }
  });

  it('names only intake refusals that exist, and the four it added are each carried by the workflow they came from', () => {
    const refusals = new Set<string>(PROHIBITED_STARTING_SCOPE);
    for (const w of WORKFLOWS) for (const r of w.refusedBy) expect(refusals.has(r), `${w.id} → ${r}`).toBe(true);
    const carries = (id: string, r: string) => expect(WORKFLOWS.find((w) => w.id === id)!.refusedBy, `${id} → ${r}`).toContain(r);
    carries('WF-06', 'Ranking students for employers');
    carries('WF-07', 'Auto-publishing institutional policy');
    carries('WF-08', 'Unapproved production changes');
    carries('WF-10', 'Automated hiring decisions');
  });

  it('never lets an automatic action reach past internal state, nor an external one run unconfirmed', () => {
    const rank = (t: string) => ACTION_TIERS.indexOf(t as (typeof ACTION_TIERS)[number]);
    for (const c of CONFIRMATIONS) {
      if (c.automatic) expect(rank(c.tier), `${c.id} is automatic at tier ${c.tier}`).toBeLessThanOrEqual(rank('C'));
      if (rank(c.tier) >= rank('D')) expect(c.automatic, `${c.id} is tier ${c.tier} and automatic`).toBe(false);
    }
    expect(CONFIRMATIONS.filter((c) => !c.automatic)).toHaveLength(8);
  });

  it('says of each data class only what the classification gate does to its tiers', () => {
    const covered = DATA_CLASSES.flatMap((c) => c.tiers);
    expect(new Set(covered).size, 'a tier in two classes').toBe(covered.length);
    expect([...covered, ...TIERS_WITHOUT_A_CLASS].sort()).toEqual(TIERS.map((t) => t.tier).sort());
    for (const c of DATA_CLASSES) {
      if (c.tiers.length === 0) expect(c.reachesAi, `${c.name} has no tier and must fail closed`).toBe(false);
      for (const t of c.tiers) expect(gate(t, 'ai', true).allowed, `${c.name} says ${c.reachesAi} for ${t}`).toBe(c.reachesAi);
    }
    // The control: the gate really does answer differently across the classes.
    expect(gate('T0', 'ai', true).allowed).toBe(true);
    expect(gate('T3', 'ai', true).allowed).toBe(false);
  });

  it('weights sum to 100, and a perfect provider scores 5.0', () => {
    expect(DIMENSION_ROWS.map((d) => d.id)).toEqual([...DIMENSIONS]);
    expect(WEIGHT_SUM).toBe(100);
    expect(DIMENSION_ROWS.find((d) => d.id === 'security')!.weight).toBe(15);
    expect(scoreVendor(all5, { agentic: true })).toEqual({ verdict: 'approve', weighted: 5, reasons: [] });
  });

  it('does not let model quality buy back a floor', () => {
    const r = scoreVendor({ ...all5, 'data-use': 3 }, { agentic: false });
    expect(r.weighted).toBeGreaterThanOrEqual(OVERALL_MINIMUM);
    expect(r.verdict).toBe('refuse');
    expect(r.reasons.join(' ')).toContain('Data-use restrictions 3 is below its floor');
    for (const f of FLOORS) expect(DIMENSIONS).toContain(f.id);
  });

  it('compares the unrounded score with the minimum, and rounds only what it reports', () => {
    const near: Scores = Object.fromEntries(DIMENSIONS.map((d) => [d, 4]));
    near.accessibility = 3.92; // raw 3.996, which rounds to 4.00
    const r = scoreVendor(near, { agentic: false });
    expect(r.verdict).toBe('refuse');
    expect(r.weighted).toBe(4);
    expect(r.reasons.join(' ')).toContain('below 4.0');
  });

  it('holds tool-use safety only for agentic workflows', () => {
    const scores = { ...all5, 'tool-safety': 3 };
    expect(scoreVendor(scores, { agentic: true }).verdict).toBe('refuse');
    expect(scoreVendor(scores, { agentic: false }).verdict).toBe('approve');
  });

  it('refuses below the overall minimum, on a blocker, and will not approve what it has not scored', () => {
    const low: Scores = Object.fromEntries(DIMENSIONS.map((d) => [d, 4]));
    low['model-quality'] = 0;
    const r = scoreVendor(low, { agentic: false });
    expect(r.weighted).toBeLessThan(OVERALL_MINIMUM);
    expect(r.verdict).toBe('refuse');
    expect(scoreVendor(all5, { agentic: false, blocker: 'no incident-notice clause' }).verdict).toBe('refuse');
    expect(scoreVendor({ 'model-quality': 5 }, { agentic: false }).verdict).toBe('unscored');
    expect(() => scoreVendor({ 'data-use': 6 }, { agentic: false })).toThrow();
    expect(() => scoreVendor({ speed: 5 } as Scores, { agentic: false })).toThrow();
  });

  it('puts every AI party the subprocessor register names on the scorecard, scored as its provider', () => {
    const ai = PARTIES.filter((p) => /\bAI\b/.test(p.purpose)).map((p) => p.name);
    expect(ai.length).toBeGreaterThan(0);
    expect(VENDORS.map((v) => v.party).sort()).toEqual([...ai].sort());
    for (const v of VENDORS) {
      expect(v.party.startsWith(v.provider), v.party).toBe(true);
      expect(v.scores).toEqual(scoresOf(v.provider));
    }
  });

  it('rests every score on a page the provider itself publishes, and says why each gap is a gap', () => {
    for (const p of Object.keys(PROVIDER_BASIS) as Provider[]) {
      expect(Object.keys(PROVIDER_BASIS[p]).sort(), p).toEqual([...DIMENSIONS].sort());
      for (const [d, b] of Object.entries(PROVIDER_BASIS[p])) {
        if ('unscored' in b) { expect(b.unscored.trim().length, `${p} ${d}`).toBeGreaterThan(10); continue; }
        const host = new URL(b.url).hostname;
        expect(b.url.startsWith('https://'), `${p} ${d}`).toBe(true);
        expect(OFFICIAL_HOSTS[p].some((h) => host === h || host.endsWith(`.${h}`)), `${p} ${d} cites ${host}`).toBe(true);
        expect(Number.isInteger(b.score) && b.score >= 0 && b.score <= 5, `${p} ${d}`).toBe(true);
        expect(b.says.trim().length, `${p} ${d}`).toBeGreaterThan(20);
      }
    }
    expect(CHECKED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('leaves model quality unscored until a run of the set is filed, and names the set', () => {
    expect(existsSync(join(root, EVAL_SET)), EVAL_SET).toBe(true);
    for (const p of Object.keys(PROVIDER_BASIS) as Provider[]) {
      const b = PROVIDER_BASIS[p]['model-quality'];
      expect('unscored' in b && b.unscored.includes(EVAL_SET), p).toBe(true);
    }
  });

  it('approves no provider while model quality is unscored, and says what the scored part reads', () => {
    for (const v of VENDORS) {
      const r = scoreVendor(v.scores, { agentic: v.agentic });
      expect(r.verdict, v.party).toBe('unscored');
      expect(r.reasons.join(' ')).toContain('Model quality');
    }
    expect(provisional(scoresOf('Anthropic'), false)).toEqual({ weighted: 4.02, scoredWeight: 92, floorsMissed: [] });
    expect(provisional(scoresOf('OpenAI'), true)).toEqual({ weighted: 4.08, scoredWeight: 87, floorsMissed: [] });
    // The control: a missed floor is reported, and one that binds only agentic workflows is not reported for others.
    expect(provisional({ 'tool-safety': 3 }, true).floorsMissed).toEqual(['tool-safety']);
    expect(provisional({ 'tool-safety': 3 }, false).floorsMissed).toEqual([]);
    expect(provisional({}, false).weighted).toBeNull();
  });

  it('holds each starting choice to the FirstGoal goal that carries it', () => {
    const ids = new Set(GOALS.map((g) => g.id));
    expect(STARTING_CHOICES).toHaveLength(6);
    for (const c of STARTING_CHOICES) if (c.goal) expect(ids.has(c.goal), `${c.choice} → ${c.goal}`).toBe(true);
    expect(new Set(STARTING_CHOICES.map((c) => c.goal).filter(Boolean)).size).toBe(STARTING_CHOICES.filter((c) => c.goal).length);
    expect(STARTING_CHOICES.filter((c) => !c.goal).map((c) => c.choice)).toEqual(['Organize this week']);
    expect(FIRST_GOAL).toBe('I now know what I need to do next.');
  });

  it('names only release-gate items that exist, and says why a line has none', () => {
    const gateItems = new Set<string>(AI_RELEASE_GATE);
    for (const d of DEFINITION_OF_DONE) {
      if (d.carriedBy) expect(gateItems.has(d.carriedBy), `${d.ask} → ${d.carriedBy}`).toBe(true);
      else expect(d.note, d.ask).toBeTruthy();
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
const ev = (e: readonly { path: string; shows: string }[]) => (e.length ? e.map((x) => `\`${x.path}\` — ${cell(x.shows)}`).join('<br>') : '—');
const count = (rows: readonly { status: string }[], s: string) => rows.filter((r) => r.status === s).length;

function render(): string {
  const goalLabel = (id: string | null) => (id ? `\`${id}\` — ${GOALS.find((g) => g.id === id)!.label}` : '**none**');
  const extraGoals = GOALS.filter((g) => !STARTING_CHOICES.some((c) => c.goal === g.id));
  const out: string[] = [
    '# The 2026 AI integration playbook, held to the tree',
    '',
    '<!-- Rendered from app/src/lib/governance/ai-playbook.ts by ai-playbook.test.ts. Edit the data, then run `npm run registers` from app/. -->',
    '',
    '> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md).',
    '',
    'Three documents arrived on 29 September 2026 and are kept under `docs/expansion/`',
    'as supplied. They overlap heavily with what is already in code, and replace',
    'none of it: [`AI-LIFECYCLE-GATES.md`](AI-LIFECYCLE-GATES.md) owns the gates, the',
    'release gate and the intake refusals; [`AI-ASSURANCE.md`](AI-ASSURANCE.md) owns',
    'the NIST matrix and the evaluation tiers; `toolkit/classification.ts` owns the',
    'data tiers. So every workflow’s prohibited decision names the intake refusal',
    'that already refuses it, every data class is checked against what the',
    'classification gate actually does, every definition-of-done line names the',
    '`AI_RELEASE_GATE` item that carries it, and the vendor scorecard is code.',
    '',
    '| Supplied document | What it holds |',
    '| --- | --- |',
    ...SOURCES.map((s) => `| [${cell(s.title)}](../${s.path.replace(/^docs\//, '')}) | ${cell(s.what)} |`),
    '',
    '## Where it stands',
    '',
    'Statuses were read at `origin/main` `beaa839` on 29 September 2026. A test holds',
    'every cited file to existing and each status to the kind of file it cites:',
    '`designed` a document, `building` code, `tested` a test that runs on every',
    'change. The supplied PDFs are never cited as evidence.',
    '',
    `| | ${STATUSES.join(' | ')} | Total |`,
    `| --- | ${STATUSES.map(() => '---:').join(' | ')} | ---: |`,
    ...([['Workflows', WORKFLOWS], ['Confirmation matrix', CONFIRMATIONS], ['Never sent casually', NEVER_SEND], ['Onboarding steps', ONBOARDING], ['Multimodal inputs', INPUTS]] as const).map(
      ([name, rows]) => `| ${name} | ${STATUSES.map((s) => count(rows, s)).join(' | ')} | ${rows.length} |`,
    ),
    '',
    'Read the workflow statuses carefully. Most of the ten are `tested` because the',
    '*non-AI workflow* and its boundary exist and are held — registration that',
    'registers nobody, advisor shares that expire, skills the student confirms.',
    'In almost every case the gap is the agent itself: nothing drafts, explains or',
    'routes with a model yet. That is the order the playbook asks for (“the non-AI',
    'workflow is usable” is on its definition of done), not a shortfall to hide.',
    '',
    '## The ten rules',
    '',
    ...RULES.map((r, i) => `${i + 1}. ${r}`),
    '',
    '## Action-risk tiers',
    '',
    '| Tier | Description | Example | Required control |',
    '| --- | --- | --- | --- |',
    ...ACTION_TIER_ROWS.map((t) => `| ${t.tier} | ${cell(t.name)} | ${cell(t.example)} | ${cell(t.control)} |`),
    '',
    '## The ten workflows',
    '',
    'The five the summary says to build first are marked ★. *Reaches* is the',
    'highest action tier the workflow may reach, and only through that tier’s',
    'control. *Refused at intake* names the `PROHIBITED_STARTING_SCOPE` entry that',
    'already refuses part of what the workflow must never do.',
    '',
    '| ID | Workflow | For | Job | Reaches | Must never | Refused at intake | Status | Evidence | Gap |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...WORKFLOWS.map((w) => `| ${w.id} | ${w.first ? '★ ' : ''}${cell(w.name)} | ${w.audience} | ${cell(w.job)} | ${w.reaches} | ${cell(w.prohibited)} | ${w.refusedBy.length ? w.refusedBy.map((r) => `*${r}*`).join(', ') : '—'} | ${w.status} | ${ev(w.evidence)} | ${cell(w.gap)} |`),
    '',
    'Four of these refusals were added to `PROHIBITED_STARTING_SCOPE` for this playbook (D-131): automated hiring decisions, ranking students for employers, auto-publishing institutional policy, and unapproved production changes. A use case that touches any of them is refused at intake, whatever evidence it brings.',
    '',
    '### ROI scorecards',
    '',
    'Count completed, useful, safe outcomes — never raw usage.',
    '',
    '| ID | Workflow | Leading | Outcome | Guardrail |',
    '| --- | --- | --- | --- | --- |',
    ...WORKFLOWS.map((w) => `| ${w.id} | ${cell(w.name)} | ${cell(w.roi.leading)} | ${cell(w.roi.outcome)} | ${cell(w.roi.guardrail)} |`),
    '',
    `Cost counts ${COST_COMPONENTS.map((c) => c.toLowerCase()).join(', ')}. None of these metrics is collected today; the tenant usage tables (\`private.ai_usage_month\`) count tokens, which is cost, not value.`,
    '',
    '## The human-confirmation matrix',
    '',
    'A test holds the matrix to its own tiers: nothing automatic reaches past',
    'internal state (tier C), and nothing at tier D or E runs without',
    'confirmation.',
    '',
    '| ID | AI action | Automatic? | Required control | Tier | Status | Evidence | Gap |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...CONFIRMATIONS.map((c) => `| ${c.id} | ${cell(c.action)} | ${c.automatic ? 'Yes' : 'No'} | ${cell(c.control)} | ${c.tier} | ${c.status} | ${ev(c.evidence)} | ${cell(c.gap)} |`),
    '',
    '## Data classes, against the classification gate',
    '',
    'Each playbook class names the `classification.ts` tiers it covers, and the',
    'test asks `gate(tier, "ai", courseAllowsAi = true)` for every one: a class',
    'whose rule says “exclude” is only true if the gate refuses it. A class with',
    'no tier must fail closed.',
    '',
    '| Class | Examples | AI handling rule | Tiers | Reaches AI? | Note |',
    '| --- | --- | --- | --- | --- | --- |',
    ...DATA_CLASSES.map((c) => `| ${c.name} | ${cell(c.examples)} | ${cell(c.rule)} | ${c.tiers.length ? c.tiers.join(', ') : '—'} | ${c.reachesAi ? 'Yes, for the student’s own purpose' : 'No'} | ${cell(c.note)} |`),
    '',
    `No class covers ${TIERS_WITHOUT_A_CLASS.map((t) => `${t} (${TIERS.find((x) => x.tier === t)!.name.toLowerCase()})`).join(', ')}: the playbook has no class for material an instructor provided for a use, and the gate already decides it by the course policy.`,
    '',
    '### What must never be sent casually to AI',
    '',
    '| ID | Item | Status | Evidence | Gap |',
    '| --- | --- | --- | --- | --- |',
    ...NEVER_SEND.map((n) => `| ${n.id} | ${cell(n.item)} | ${n.status} | ${ev(n.evidence)} | ${cell(n.gap)} |`),
    '',
    '## The AI vendor scorecard',
    '',
    'Score each provider 0–5 on every dimension. Do not approve on model quality',
    'alone. `scoreVendor()` in `ai-playbook.ts` is the scorecard; the test holds',
    'its rules.',
    '',
    '| Dimension | Weight | What 5 means | Floor |',
    '| --- | ---: | --- | --- |',
    ...DIMENSION_ROWS.map((d) => {
      const f = FLOORS.find((x) => x.id === d.id);
      return `| ${d.name} | ${d.weight}% | ${cell(d.five)} | ${f ? `${f.min.toFixed(1)}${f.agenticOnly ? ', agentic workflows only' : ''}` : '—'} |`;
    }),
    '',
    `**Approval:** every dimension scored, a weighted score of at least ${OVERALL_MINIMUM.toFixed(1)}, every floor met, and no critical legal, security or privacy blocker — which no model quality can offset.`,
    '',
    `**The weights sum to ${WEIGHT_SUM}%.** As supplied they summed to 95%; the missing five points went to security posture (10% → 15%), one of the three floors no weighted total can offset.`,
    '',
    '### The providers Semester can call',
    '',
    `Every AI party in \`trust/subprocessors.ts\`, held there by the test, scored from the provider’s own public documentation read on ${CHECKED}. Each score cites the page it rests on, and the test refuses a citation to any other host. These are desk scores, not contract review: no DPA is signed (see [\`DPA-CHECKLIST.md\`](../trust/DPA-CHECKLIST.md)).`,
    '',
    `**No provider is approvable yet.** Model quality is performance on Semester’s own evaluation set, \`${EVAL_SET}\`: fifteen synthetic cases through the prompts Semester sends, graded by fixed checks. It has not been run against either provider, so every verdict is *unscored*. The provisional reading is the weighted score over the dimensions that are scored, and any floor already missed.`,
    '',
    '| Provider | Agentic? | Verdict | Provisional | Scored weight | Floors missed | Note |',
    '| --- | --- | --- | ---: | ---: | --- | --- |',
    ...VENDORS.map((v) => {
      const p = provisional(v.scores, v.agentic);
      return `| ${v.party} | ${v.agentic ? 'Yes' : 'No'} | ${scoreVendor(v.scores, { agentic: v.agentic }).verdict} | ${p.weighted?.toFixed(2) ?? '—'} | ${p.scoredWeight}% | ${p.floorsMissed.length ? p.floorsMissed.join(', ') : 'none'} | ${cell(v.note)} |`;
    }),
    '',
    ...(Object.keys(PROVIDER_BASIS) as Provider[]).flatMap((p) => [
      `#### ${p}`,
      '',
      '| Dimension | Weight | Score | What the provider’s own page says |',
      '| --- | ---: | ---: | --- |',
      ...DIMENSION_ROWS.map((d) => {
        const b = PROVIDER_BASIS[p][d.id];
        return 'score' in b ? `| ${d.name} | ${d.weight}% | ${b.score} | ${cell(b.says)} [source](${b.url}) |` : `| ${d.name} | ${d.weight}% | — | Unscored: ${cell(b.unscored)} |`;
      }),
      '',
    ]),
    'What would change a score: a signed DPA with a FERPA school-official clause (education fit, both providers); written confirmation that OpenAI’s certifications cover the API (security, OpenAI); an uptime SLA (reliability, both); a filed run of the model-quality set (model quality, both).',
    '',
    '### What a provider must show before approval',
    '',
    '| Requirement | Verification |',
    '| --- | --- |',
    ...PROVIDER_REQUIREMENTS.map((r) => `| ${cell(r.requirement)} | ${cell(r.verification)} |`),
    '',
    '## Student onboarding',
    '',
    `First-session goal: “${FIRST_GOAL}” Deliver a useful result in minutes before asking the student to configure anything.`,
    '',
    '| ID | Step | Asks | Status | Evidence | Gap |',
    '| --- | --- | --- | --- | --- | --- |',
    ...ONBOARDING.map((o) => `| ${o.id} | ${cell(o.step)} | ${cell(o.asks)} | ${o.status} | ${ev(o.evidence)} | ${cell(o.gap)} |`),
    '',
    '### Starting choices, against FirstGoal',
    '',
    '| Choice | First outcome | FirstGoal goal |',
    '| --- | --- | --- |',
    ...STARTING_CHOICES.map((c) => `| ${cell(c.choice)} | ${cell(c.outcome)} | ${goalLabel(c.goal)} |`),
    '',
    `FirstGoal also offers ${extraGoals.map((g) => `\`${g.id}\` — ${g.label}`).join(', ')}, which the playbook does not list.`,
    '',
    '### The first week',
    '',
    '| Day | Semester moment |',
    '| ---: | --- |',
    ...FIRST_WEEK.map((d) => `| ${d.day} | ${cell(d.moment)} |`),
    '',
    'Do not flood new users with notifications: the goal is confidence and practical progress, not engagement for its own sake.',
    '',
    '## Semester Intelligence: one layer',
    '',
    '| Verb | Does |',
    '| --- | --- |',
    ...LAYER.map((l) => `| ${l.verb} | ${cell(l.does)} |`),
    '',
    '### Memory the student controls',
    '',
    'The nearest thing in the tree is *About me* (`lib/aboutme.ts`): lines the',
    'student types, nothing inferred, each editable and deletable. Every memory',
    'must be:',
    '',
    ...MEMORY_RULES.map((m) => `- ${m}`),
    '',
    '### Multimodal inputs',
    '',
    '| ID | Input | Capability | Status | Evidence | Gap |',
    '| --- | --- | --- | --- | --- | --- |',
    ...INPUTS.map((c) => `| ${c.id} | ${cell(c.input)} | ${cell(c.capability)} | ${c.status} | ${ev(c.evidence)} | ${cell(c.gap)} |`),
    '',
    '## The definition of done, against the release gate in code',
    '',
    '| Ask | Carried by | Note |',
    '| --- | --- | --- |',
    ...DEFINITION_OF_DONE.map((d) => `| ${cell(d.ask)} | ${d.carriedBy ? `\`${d.carriedBy}\`` : '**none**'} | ${d.note ? cell(d.note) : '—'} |`),
    '',
    '## The roadmap',
    '',
  ];
  for (const p of ROADMAP) out.push(`**${p.phase}.** ${p.items.join('; ')}.`, '');
  out.push(
    'Semester Intelligence should turn a confusing university signal into a sourced, explainable, student-controlled next step — while people, institutions, policies and safety boundaries stay in control.',
    '',
  );
  return out.join('\n');
}
