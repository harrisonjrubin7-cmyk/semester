import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  AI_RELEASE_GATE, LIFECYCLE, NIST_FUNCTIONS, NIST_LABEL, NIST_PRACTICES, PROHIBITED_STARTING_SCOPE, STARTING_USE_CASES,
} from './ai-lifecycle';
import { CHARTERS } from './charters';
import { NEVER, SETTINGS, APPROVAL_FLOW } from './config-tiers';
import { CONTRACTS } from './data-contracts';
import { AUDIENCE_LABEL, AUDIENCES, SECTION_HEADING } from './incident-comms';
import { BAD_WRITE_OUTCOMES, FRONTEND_TARGETS, JOURNEYS, PERMITTED_EXCLUSION, POLICY } from './error-budgets';
import { DIMENSIONS, STAGES, THRESHOLD } from './release-readiness';
import { DEFINITION_OF_DONE, DEFINITION_OF_READY, QUALITY_METRICS, RELEASE_APPROVALS } from './quality-gates';
import {
  CUTOVER_CHECKLIST, DECISION_OPTIONS, KPIS, LTI_SECURITY, MIGRATION_ACCEPTANCE, PHASES, RACI, RISKS, ROLLOUT_STATES, STEERING_AGENDA,
} from './rollout';
import { ROUTE_LABEL } from './scorecard';

/*
 * The operating-model docs are the human copy of these registries. A copy is
 * what drifts, so each doc is held to the list it describes, the way
 * FEATURE-FLAG-REGISTRY.md is held to flags.ts.
 */
const dir = resolve(__dirname, '../../../../docs/operating-model');
const doc = (name: string) => readFileSync(resolve(dir, name), 'utf8');

describe('operating-model docs match the registries', () => {
  it('portfolio: every route and every charter', () => {
    const d = doc('PORTFOLIO-GOVERNANCE.md');
    for (const label of Object.values(ROUTE_LABEL)) expect(d, label).toContain(label);
    for (const c of CHARTERS) expect(d, c.flag).toContain(`\`${c.flag}\``);
  });

  it('configuration: every setting, every never, every approval step', () => {
    const d = doc('CONFIGURATION-TIERS.md');
    for (const s of SETTINGS) expect(d, s.key).toMatch(new RegExp(`\\| \`${s.key.replace('.', '\\.')}\` \\| ${s.tier} \\|`));
    for (const n of NEVER) expect(d, n.key).toContain(`\`${n.key}\``);
    for (const step of APPROVAL_FLOW) expect(d, step).toContain(step);
  });

  it('stewardship: every contract, with its connector, class and SLA', () => {
    const d = doc('DATA-STEWARDSHIP.md');
    for (const c of CONTRACTS) {
      expect(d, c.domain).toContain(`| ${c.domain} | \`${c.connector}\` | ${c.classification} | ${c.freshnessSlaHours} h |`);
    }
  });

  it('incidents: every audience and every section heading', () => {
    const d = doc('INCIDENT-COMMUNICATIONS.md');
    for (const label of Object.values(AUDIENCE_LABEL)) expect(d, label).toContain(`| ${label} |`);
    for (const h of Object.values(SECTION_HEADING)) expect(d, h).toContain(h);
    for (const a of Object.values(AUDIENCES)) for (const r of a.requires) expect(d, r.heading).toContain(r.heading);
  });

  it('pilot to production: every state, gate, milestone, checklist item, risk, RACI row and KPI', () => {
    const d = doc('PILOT-TO-PRODUCTION.md');
    for (const s of ROLLOUT_STATES) {
      const gates = s.exitGates.map((g) => `\`${g}\``).join(', ') || '—';
      expect(d, s.state).toContain(`| ${s.label} | ${s.uiLabel || '—'} | ${s.access} | ${s.authority} | ${s.allowed} | ${gates} |`);
    }
    for (const p of PHASES) {
      expect(d, p.name).toContain(`### Phase ${p.number} — ${p.name}`);
      for (const m of p.milestones) expect(d, m.name).toContain(`| ${m.name} | ${m.owner} | ${m.evidence} | ${m.exit} |`);
    }
    for (const i of [...DECISION_OPTIONS, ...MIGRATION_ACCEPTANCE, ...LTI_SECURITY, ...CUTOVER_CHECKLIST]) expect(d, i).toContain(`- ${i}`);
    for (const r of RISKS) expect(d, r.id).toContain(`| ${r.id} | ${r.risk} | ${r.likelihood} | ${r.impact} |`);
    for (const r of RACI) expect(d, r.workstream).toContain(`| ${r.workstream} | ${r.accountable} | ${r.responsible} |`);
    for (const k of KPIS) expect(d, k.metric).toContain(`| ${k.metric} | ${k.source} | ${k.owner} | ${k.cadence} |`);
    STEERING_AGENDA.forEach((a, i) => expect(d, a).toContain(`${i + 1}. ${a}`));
  });

  it('quality: every gate item and metric', () => {
    const d = doc('QUALITY-MANAGEMENT.md');
    for (const i of [...DEFINITION_OF_READY, ...DEFINITION_OF_DONE, ...RELEASE_APPROVALS]) expect(d, i).toContain(`- ${i}`);
    for (const m of QUALITY_METRICS) expect(d, m.name).toContain(`| ${m.name} |`);
  });

  it('release readiness: every dimension, weight, stage and threshold', () => {
    const d = doc('QUALITY-MANAGEMENT.md');
    for (const x of DIMENSIONS) expect(d, x.key).toContain(`| ${x.label} | ${x.weight}% | ${x.question} |`);
    for (const s of STAGES) {
      const t = THRESHOLD[s.key];
      expect(d, s.key).toContain(`| ${s.label} | ${s.evidence} | ${t.standard} | ${t.highStakes} |`);
    }
  });

  it('SLOs: every journey, bad outcome, budget state and frontend target', () => {
    const d = doc('SLOS-AND-ERROR-BUDGETS.md');
    for (const j of JOURNEYS) expect(d, j.id).toContain(`| ${j.name} | ${j.slo}% | ${j.good} | ${j.why} |`);
    for (const b of BAD_WRITE_OUTCOMES) expect(d, b).toContain(`- ${b}`);
    // A proposed journey is listed apart from the adopted ones, with its own bad events, so it is never read as a commitment.
    const proposed = d.split('## Proposed journeys\n')[1]?.split('\n## ')[0] ?? '';
    for (const j of JOURNEYS) {
      expect(proposed.includes(`| ${j.name} | ${j.slo}% |`), `${j.id}: ${j.proposed ? 'proposed, so under "Proposed journeys"' : 'adopted, so not under "Proposed journeys"'}`).toBe(!!j.proposed);
      if (!j.proposed) continue;
      const section = proposed.split(`### ${j.name}\n`)[1]?.split('\n### ')[0] ?? '';
      for (const b of j.bad ?? []) expect(section, `${j.id}: ${b}`).toContain(`- ${b}`);
    }
    expect(d).toContain(PERMITTED_EXCLUSION);
    for (const p of Object.values(POLICY)) expect(d, p.label).toContain(`| ${p.label} | ${p.remaining} | ${p.release} | ${p.action} |`);
    for (const t of FRONTEND_TARGETS) {
      expect(d, t.metric).toContain(`| ${t.metric} | ${t.target} | ${t.failure} | ${t.guard ? `\`${t.guard}\`` : 'Not measured'} |`);
    }
  });

  it('AI lifecycle: every gate, release-gate item, prohibited scope, starting use case and practice', () => {
    const d = doc('AI-LIFECYCLE-GATES.md');
    for (const g of LIFECYCLE) {
      expect(d, g.id).toContain(`| ${g.id} | ${g.name} | ${NIST_LABEL[g.owner]} | ${g.decision} | ${g.evidence.join(', ')} |`);
    }
    for (const i of [...AI_RELEASE_GATE, ...PROHIBITED_STARTING_SCOPE]) expect(d, i).toContain(`- ${i}`);
    STARTING_USE_CASES.forEach((u, i) => expect(d, u).toContain(`${i + 1}. ${u}`));
    for (const f of NIST_FUNCTIONS) {
      const section = d.split(`### ${NIST_LABEL[f]}\n`)[1]?.split('\n### ')[0] ?? '';
      for (const p of NIST_PRACTICES[f]) expect(section, `${f}: ${p}`).toContain(`- ${p}`);
    }
  });

  it('links only to files that exist', () => {
    for (const name of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
      for (const [, target] of doc(name).matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)) {
        if (/^https?:/.test(target)) continue;
        expect(() => readFileSync(resolve(dir, target)), `${name} → ${target}`).not.toThrow();
      }
    }
  });
});
