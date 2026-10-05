import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { current, draftOf, history, publishBlocker, refusal, workflowsAllowed, type WorkflowVersion } from './api';
import { evaluate, headline, meets, walkthrough, type Facts } from './engine';
import {
  FACTS, FACT_KEYS, FACT_LABEL, LIMITS, OPS, OP_LABEL, OWNERS, OWNER_LABEL, STEP_KINDS, STEP_LABEL, WORKFLOWS, WORKFLOW_LABEL,
  problemText, problems, textOk, type Definition,
} from './spec';
import { TEMPLATES } from './templates';

/**
 * Holds the Workflow Builder's vocabulary and checks to the migration that
 * enforces them — every template, step kind, owner, fact, operator and limit —
 * and its engine to cases worked by hand. The database refuses what this file
 * would refuse; if the two drift, the screen would accept a definition the
 * database then rejects, or worse.
 */

const root = join(import.meta.dirname, '../../../..');
const SQL = readFileSync(join(root, 'supabase/migrations/20260930231000_workflow_builder.sql'), 'utf8');
const DB = JSON.parse(SQL.slice(SQL.indexOf('$j$') + 3, SQL.indexOf('$j$', SQL.indexOf('$j$') + 3))) as {
  workflows: string[]; step_kinds: string[]; owners: string[];
  facts: Record<string, { type: string; min?: number; max?: number }>;
  ops: Record<string, string[]>; limits: Record<string, number>;
};

/** The definition the database check also varies from. */
const VALID: Definition = {
  title: 'Registration clearance',
  steps: [
    { id: 'check', kind: 'rule_check', title: 'Check eligibility', owner: 'system' },
    { id: 'confirm', kind: 'student_confirm', title: 'Confirm the request', owner: 'student', sla_days: 3 },
    { id: 'handoff', kind: 'official_handoff', title: 'Send to the registrar', owner: 'office' },
    { id: 'done', kind: 'complete', title: 'Done', owner: 'system' },
  ],
  requires: [
    { id: 'enrolled', fact: 'program_enrolled', op: 'eq', value: true, explain: 'You need to be enrolled in a program.', next_step: 'Ask the registrar to confirm your enrolment.' },
    { id: 'credits', fact: 'credits_earned', op: 'gte', value: 12, explain: 'This needs 12 credits earned.', next_step: 'See your advisor about your plan.' },
  ],
  handoff: 'Office of the Registrar',
};
const vary = (f: (d: Record<string, unknown>) => void): unknown => {
  const d = JSON.parse(JSON.stringify(VALID)) as Record<string, unknown>;
  f(d);
  return d;
};
const stepsOf = (d: Record<string, unknown>) => d.steps as Record<string, unknown>[];
const reqsOf = (d: Record<string, unknown>) => d.requires as Record<string, unknown>[];

describe('the Workflow Builder, held to its migration', () => {
  it('has the same templates, step kinds and owners, in the same order', () => {
    expect([...WORKFLOWS]).toEqual(DB.workflows);
    expect([...STEP_KINDS]).toEqual(DB.step_kinds);
    expect([...OWNERS]).toEqual(DB.owners);
    const at = SQL.indexOf('workflow       text        not null check (workflow in (');
    const words = [...SQL.slice(at, SQL.indexOf('))', at)).matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    expect(words).toEqual(DB.workflows);
  });

  it('has the same facts, operators and limits, bound for bound', () => {
    expect(JSON.parse(JSON.stringify(FACTS))).toEqual(DB.facts);
    expect(JSON.parse(JSON.stringify(OPS))).toEqual(DB.ops);
    expect(JSON.parse(JSON.stringify(LIMITS))).toEqual(DB.limits);
  });

  it('labels every template, step kind, owner, fact and operator', () => {
    for (const w of WORKFLOWS) expect(WORKFLOW_LABEL[w], w).toBeTruthy();
    for (const s of STEP_KINDS) expect(STEP_LABEL[s], s).toBeTruthy();
    for (const o of OWNERS) expect(OWNER_LABEL[o], o).toBeTruthy();
    for (const f of FACT_KEYS) expect(FACT_LABEL[f], f).toBeTruthy();
    for (const op of ['eq', 'neq', 'gte', 'lte'] as const) expect(OP_LABEL[op]).toBeTruthy();
  });

  it('lets a rule read nothing the data-governance example prohibits', () => {
    // "Fields prohibited: grades, full financial ledger, disability data, health data, disciplinary data, immigration details."
    const banned = /grade|gpa|balance|owed|ledger|finan|aid|disab|accommodat|health|medical|counsel|disciplin|conduct|immigr|visa|citizen/i;
    for (const f of FACT_KEYS) expect(f, `${f} reads something the governance example prohibits`).not.toMatch(banned);
  });

  it('grants the three capabilities to the roles the check walks, and lets the publisher not draft', () => {
    for (const c of ['workflow:manage', 'workflow:publish', 'workflow:view']) expect(SQL).toContain(`'${c}'`);
    expect(SQL).toContain("('registrar',                'workflow:publish')");
    expect(SQL).not.toContain("('registrar',                'workflow:manage')");
  });

  it('records its table in the audit vocabulary', () => {
    expect(SQL).toMatch(/entity_type in \([^)]*'workflow_versions'/s);
    expect(SQL).toContain('create trigger audit_workflow_versions after insert or update or delete');
  });
});

describe('checking a definition', () => {
  // The same cases workflow-builder.check.sql walks against private.workflow_problems.
  it('agrees with the database on the cases it is asked', () => {
    expect(problems(VALID)).toEqual([]);
    expect(problems([1])).toEqual(['not_object']);
    expect(problems(vary((d) => { d.webhook_url = 'x'; }))).toEqual(['unknown_key:webhook_url']);
    expect(problems(vary((d) => { stepsOf(d)[0].student_email = 'a@b.example'; }))).toEqual([`step_unknown_key:${(VALID as { steps: { id: string }[] }).steps[0].id}`]);
    expect(problems(vary((d) => { reqsOf(d)[0].student_email = 'a@b.example'; }))).toEqual([`req_unknown_key:${(VALID as { requires: { id: string }[] }).requires[0].id}`]);
    expect(problems(vary((d) => { d.title = '  '; }))).toEqual(['title']);
    expect(problems(vary((d) => { d.title = 'Pay 4111 1111 1111 1111'; }))).toEqual(['title']);
    expect(problems(vary((d) => { stepsOf(d)[0].kind = 'run_script'; }))).toEqual(['step_kind:check']);
    expect(problems(vary((d) => { stepsOf(d)[0].owner = 'robot'; }))).toEqual(['step_owner:check']);
    expect(problems(vary((d) => { stepsOf(d)[0].id = 'Check It'; }))).toEqual(['step_id:1']);
    expect(problems(vary((d) => { stepsOf(d)[3].id = 'check'; }))).toEqual(['dup_step:check']);
    expect(problems(vary((d) => { stepsOf(d)[1].sla_days = 61; }))).toEqual(['step_sla:confirm']);
    expect(problems(vary((d) => { stepsOf(d)[3].kind = 'notify'; }))).toEqual(['last_step_complete']);
    expect(problems(vary((d) => { stepsOf(d)[1].kind = 'notify'; }))).toEqual(['confirm_before_handoff:handoff']);
    expect(problems(vary((d) => { delete d.handoff; }))).toEqual(['handoff_missing']);
    expect(problems({ title: 'x', steps: [] })).toEqual(['steps_count']);
    expect(problems(vary((d) => { reqsOf(d)[0].fact = 'final_grade'; }))).toEqual(['req_fact:enrolled']);
    expect(problems(vary((d) => { reqsOf(d)[0].fact = 'balance_owed'; }))).toEqual(['req_fact:enrolled']);
    expect(problems(vary((d) => { reqsOf(d)[0].op = 'gte'; }))).toEqual(['req_op:enrolled']);
    expect(problems(vary((d) => { reqsOf(d)[0].value = 1; }))).toEqual(['req_value:enrolled']);
    expect(problems(vary((d) => { reqsOf(d)[1].value = 401; }))).toEqual(['req_value:credits']);
    expect(problems(vary((d) => { reqsOf(d)[1].value = 12.5; }))).toEqual(['req_value:credits']);
    expect(problems(vary((d) => { reqsOf(d)[1].explain = ''; }))).toEqual(['req_explain:credits']);
    expect(problems(vary((d) => { reqsOf(d)[1].next_step = 5; }))).toEqual(['req_next:credits']);
    expect(problems(vary((d) => { reqsOf(d)[1].id = 'enrolled'; }))).toEqual(['dup_req:enrolled']);
  });

  it('accepts a definition with no checks, and one with no handoff when it has no handoff step', () => {
    expect(problems({ title: 'x', steps: [{ id: 'done', kind: 'complete', title: 'Done', owner: 'system' }] })).toEqual([]);
  });

  it('refuses a control character, an over-long text and an over-large definition', () => {
    expect(textOk('a\u0007b', 40)).toBe(false);
    expect(textOk('x'.repeat(LIMITS.explain_max), LIMITS.explain_max)).toBe(true);
    expect(textOk('x'.repeat(LIMITS.explain_max + 1), LIMITS.explain_max)).toBe(false);
    const big = vary((d) => { d.handoff = 'x'; d.requires = Array.from({ length: 11 }, (_, i) => ({ ...reqsOf(d)[0], id: `r${i}` })); });
    expect(problems(big)).toEqual(['requires_count']);
    expect(problems(vary((d) => { d.steps = Array.from({ length: 13 }, (_, i) => ({ id: `s${i}`, kind: 'notify', title: 't', owner: 'system' })); d.handoff = 'x'; })))
      .toContain('steps_count');
  });

  it('turns every code into a sentence, and names the thing it is about', () => {
    expect(problemText('req_fact:enrolled')).toContain('enrolled');
    expect(problemText('confirm_before_handoff:handoff')).toContain('confirms before');
    expect(problemText('unknown_key:webhook_url')).toContain('webhook_url');
    expect(problemText('last_step_complete')).toContain('Complete');
  });
});

describe('the ten templates', () => {
  it('are one for each workflow the brief lists, and each one valid', () => {
    expect(Object.keys(TEMPLATES).sort()).toEqual([...WORKFLOWS].sort());
    for (const w of WORKFLOWS) expect(problems(TEMPLATES[w]), w).toEqual([]);
  });

  it('follow the brief’s sequence: eligibility first, the student’s confirmation before any handoff, completion last', () => {
    for (const w of WORKFLOWS) {
      const kinds = TEMPLATES[w].steps.map((s) => s.kind);
      expect(kinds[0], w).toBe('rule_check');
      expect(kinds.at(-1), w).toBe('complete');
      const h = kinds.indexOf('official_handoff');
      if (h >= 0) expect(kinds.slice(0, h), w).toContain('student_confirm');
    }
  });

  it('never read a fact outside the list, and always explain a check to the student', () => {
    for (const w of WORKFLOWS) for (const r of TEMPLATES[w].requires ?? []) {
      expect(FACT_KEYS, `${w}.${r.id}`).toContain(r.fact);
      expect(r.explain.length).toBeGreaterThan(10);
      expect(r.next_step.length).toBeGreaterThan(10);
    }
  });
});

describe('the policy engine', () => {
  const def = TEMPLATES.registration_clearance;
  const ok: Facts = { program_enrolled: true, term_active: true, hold_present: false };

  it('is eligible only when every check passed', () => {
    const e = evaluate(def, ok);
    expect(e.eligible).toBe(true);
    expect(e.blockers).toEqual([]);
    expect(headline(e)).toContain('You can go on');
  });

  it('explains each blocker in the order written, with the official next step', () => {
    const e = evaluate(def, { program_enrolled: false, term_active: true, hold_present: true });
    expect(e.eligible).toBe(false);
    expect(e.blockers.map((b) => b.id)).toEqual(['enrolled', 'no_hold']);
    expect(e.blockers[0].explain).toContain('enrolled');
    expect(e.blockers[1].next_step).toContain('registrar');
    expect(headline(e)).toBe('2 things stand in the way.');
    expect(headline(evaluate(def, { ...ok, hold_present: true }))).toBe('One thing stands in the way.');
  });

  it('does not treat an unknown fact as a pass or a fail: the third answer is null, and hands over to the office', () => {
    const e = evaluate(def, { program_enrolled: true, hold_present: false });
    expect(e.eligible).toBeNull();
    expect(e.unknown.map((u) => u.id)).toEqual(['term_active']);
    expect(e.checks.find((c) => c.id === 'term_active')?.explain).toContain('could not be checked');
    expect(headline(e)).toContain('Office of the Registrar can check this against the official record');
    // Nothing known at all is not eligible, and not ineligible.
    expect(evaluate(def, {}).eligible).toBeNull();
  });

  it('lets a failure outrank an unknown', () => {
    expect(evaluate(def, { program_enrolled: false }).eligible).toBe(false);
  });

  it('compares numbers the way the operator says, and only numbers to numbers', () => {
    const gte = { id: 'c', fact: 'credits_earned', op: 'gte', value: 30, explain: 'e', next_step: 'n' } as const;
    expect(meets(gte, { credits_earned: 30 })).toBe(true);
    expect(meets(gte, { credits_earned: 29 })).toBe(false);
    expect(meets({ ...gte, op: 'lte' }, { credits_earned: 30 })).toBe(true);
    expect(meets({ ...gte, op: 'lte' }, { credits_earned: 31 })).toBe(false);
    expect(meets({ ...gte, op: 'eq' }, { credits_earned: 30 })).toBe(true);
    expect(meets({ ...gte, op: 'neq' }, { credits_earned: 30 })).toBe(false);
    expect(meets(gte, { credits_earned: true as unknown as number })).toBeNull();
    expect(meets(gte, { credits_earned: Number.NaN })).toBeNull();
    expect(meets({ id: 'b', fact: 'hold_present', op: 'eq', value: false, explain: 'e', next_step: 'n' }, { hold_present: 1 as unknown as boolean })).toBeNull();
  });

  it('gives the same answer for the same definition and facts, every time', () => {
    const facts: Facts = { program_enrolled: true, term_active: false, hold_present: false };
    expect(JSON.stringify(evaluate(def, facts))).toBe(JSON.stringify(evaluate(def, facts)));
  });

  it('names the office at the handoff step and writes nothing to it', () => {
    const w = walkthrough(def);
    expect(w.map((s) => s.step.kind)).toEqual(def.steps.map((s) => s.kind));
    expect(w.find((s) => s.step.kind === 'official_handoff')?.note).toContain('That office keeps the official record');
    expect(w.filter((s) => s.note)).toHaveLength(1);
  });

  it('runs a definition with no checks as eligible', () => {
    expect(evaluate({ title: 'x', steps: [{ id: 'done', kind: 'complete', title: 'Done', owner: 'system' }] }, {}).eligible).toBe(true);
  });
});

describe('versions and who may publish', () => {
  const row = (over: Partial<WorkflowVersion>): WorkflowVersion => ({
    id: 'v', tenant_id: 'u', workflow: 'advisor_approval', state: 'published', version: 1, definition: TEMPLATES.advisor_approval, note: '',
    based_on: null, created_by: 'editor', published_by: 'reg', created_at: 't', updated_at: 't', published_at: 't', ...over,
  });
  const draft = (over: Partial<WorkflowVersion> = {}) => row({ state: 'draft', version: null, published_by: null, published_at: null, ...over });

  it('takes the highest published version as current, never the draft', () => {
    const rows = [row({ id: 'a', version: 1 }), row({ id: 'b', version: 3 }), row({ id: 'c', version: 2 }), draft({ id: 'd' })];
    expect(current(rows, 'advisor_approval')?.id).toBe('b');
    expect(current(rows, 'tutoring_referral')).toBeNull();
    expect(draftOf(rows, 'advisor_approval')?.id).toBe('d');
    expect(history(rows, 'advisor_approval').map((r) => r.version)).toEqual([3, 2, 1]);
  });

  it('refuses the drafter, the account without the role, and a draft the database would refuse', () => {
    const holds = ['workflow:manage', 'workflow:publish', 'workflow:view'];
    expect(publishBlocker(draft({ created_by: 'me' }), [], 'me', holds)).toMatch(/does not publish it/);
    expect(publishBlocker(draft(), [], 'you', holds)).toBeNull();
    expect(publishBlocker(draft(), [], 'you', ['workflow:manage'])).toMatch(/cannot publish/);
    expect(publishBlocker(draft(), ['req_fact:enrolled'], 'you', holds)).toContain('enrolled');
  });

  it('shows the tab only to the three capabilities', () => {
    expect(workflowsAllowed(['workflow:view'])).toBe(true);
    expect(workflowsAllowed(['config:manage'])).toBe(false);
    expect(workflowsAllowed([])).toBe(false);
  });

  it('turns a database refusal into the screen’s words', () => {
    expect(refusal({ message: 'This workflow is not valid: req_fact:enrolled, unknown_key:zzz' }, 'x').message).toContain('enrolled');
    expect(refusal({ code: '23505', message: 'duplicate key value violates unique constraint "workflow_one_draft"' }, 'x').message).toMatch(/already has a draft/);
    expect(refusal({ message: 'new row violates row-level security policy' }, 'x').message).toBe('Your account cannot do that at this school.');
    expect(refusal({ message: 'Whoever drafted a workflow does not publish it.' }, 'x').message).toBe('Whoever drafted a workflow does not publish it.');
  });
});
