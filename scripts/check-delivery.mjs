// Checks the delivery-management records under docs/delivery, registry/, and docs/finance.
// Run: node scripts/check-delivery.mjs   (exit 1 when there are errors; warnings do not fail)
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function loadRepo(root = ROOT) {
  const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
  const listJson = (dir) => {
    const abs = join(root, dir);
    if (!existsSync(abs)) return [];
    return readdirSync(abs)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .map((f) => ({ path: `${dir}/${f}`, data: read(`${dir}/${f}`) }));
  };
  return {
    root,
    model: read('docs/delivery/operating-model.json'),
    graph: read('docs/delivery/dependency-graph.json'),
    gates: read('docs/delivery/quality-gates.json'),
    decisions: read('docs/delivery/decision-rights.json'),
    risks: read('docs/delivery/risk-register.json'),
    scorecard: read('docs/delivery/expansion-scorecard.json'),
    finance: read('docs/finance/control-baseline.json'),
    increments: listJson('registry/increments'),
    artifacts: listJson('registry/artifacts'),
  };
}

const isEmpty = (v) =>
  v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0) ||
  (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0);

const LEVELS = ['low', 'medium', 'high', 'critical'];
const EXPECTED_GATES = ['GATE-01', 'GATE-02', 'GATE-03', 'GATE-04', 'GATE-05', 'GATE-06'];
// Fields that name an artifact: a value containing "/" is a file path, anything else is an artifact id.
const REFERENCE_FIELDS = [
  'workflow_definition', 'source_authority_record', 'data_contract', 'access_policy',
  'UI_states', 'operational_runbook', 'release_evidence',
];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
// A string that is a real calendar date, not merely shaped like one (rejects 2026-02-30 and 9999-99-99).
const isCalendarDate = (s) => {
  if (!ISO_DATE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};
// The seven finance controls the delivery specification requires before any finance workflow ships.
const FINANCE_CONTROLS = [
  'finance_component_passport', 'payment_event_contract', 'ledger_schema', 'reconciliation_runbook',
  'refund_approval_policy', 'month_end_close_checklist', 'financial_access_review',
];
const CAPABILITY_DIR = 'packages/platform-control/registry/capabilities';
const FINANCE_STATUSES = ['not_started', 'present'];
// The expansion scorecard's no-override hard stops; deleting one must not pass.
const REQUIRED_HARD_STOPS = [
  'confirmed_unauthorized_access', 'unresolved_critical_accessibility_issue',
  'inability_to_identify_authoritative_source', 'failure_to_safely_disable_capability',
  'missing_institutional_decision_owner',
];

export function check(repo) {
  const errors = [];
  const warnings = [];
  const { model, graph, root } = repo;
  // A repository-relative path resolved to an absolute one inside the repository, or null when it escapes.
  const insideRoot = (rel) => {
    const abs = resolve(root, rel);
    return abs === root || abs.startsWith(root + sep) ? abs : null;
  };
  const today = repo.today ?? new Date().toISOString().slice(0, 10);
  const states = model.delivery_states;
  const rank = (s) => states.indexOf(s);
  const nodes = new Map();
  const trainIds = model.release_trains.map((t) => t.id);
  const capabilityDir = join(root, CAPABILITY_DIR);
  const capabilityKeys = existsSync(capabilityDir)
    ? new Set(readdirSync(capabilityDir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -'.json'.length)))
    : null;
  // Artifact ids must be unique and match their file names, so a reference resolves to exactly one record.
  const artifactById = new Map();
  for (const { path, data } of repo.artifacts) {
    if (artifactById.has(data.id)) errors.push(`${data.id ?? path}: duplicate artifact id`);
    else artifactById.set(data.id, data);
    if (path !== `registry/artifacts/${data.id}.json`) errors.push(`${data.id ?? path}: file name must match id`);
  }
  // Returns why a reference does not resolve, or null when it does. A path that is a registered
  // artifact's location inherits that artifact's state, so a draft runbook cannot pass as approved.
  const referenceProblem = (value) => {
    if (value.includes('/')) {
      const abs = insideRoot(value);
      if (abs === null) return 'is outside the repository';
      if (!existsSync(abs)) return 'does not exist on disk';
      const registered = [...artifactById.values()].find((a) => a.location === value);
      if (registered && registered.state !== 'approved') {
        return `is registered artifact ${registered.id}, currently ${registered.state}, not approved`;
      }
      return null;
    }
    const artifact = artifactById.get(value);
    if (!artifact) return 'is neither a file path nor a registry artifact id';
    return artifact.state === 'approved' ? null : `is registered as ${artifact.state}, not approved`;
  };

  // Dependency graph: unique nodes, known statuses, known edge endpoints, acyclic.
  for (const n of graph.nodes) {
    if (nodes.has(n.id)) errors.push(`dependency-graph: duplicate node ${n.id}`);
    if (!states.includes(n.status)) errors.push(`dependency-graph: node ${n.id} has unknown status ${n.status}`);
    nodes.set(n.id, n);
  }
  const adjacency = new Map([...nodes.keys()].map((id) => [id, []]));
  for (const e of graph.edges) {
    if (!nodes.has(e.from) || !nodes.has(e.to)) {
      errors.push(`dependency-graph: edge ${e.from} -> ${e.to} references an unknown node`);
      continue;
    }
    if (!['hard', 'soft'].includes(e.type)) errors.push(`dependency-graph: edge ${e.from} -> ${e.to} has unknown type ${e.type}`);
    adjacency.get(e.from).push(e.to);
  }
  const color = new Map();
  const visit = (id, path) => {
    if (color.get(id) === 'done') return false;
    if (color.get(id) === 'active') {
      errors.push(`dependency-graph: cycle through ${[...path, id].join(' -> ')}`);
      return true;
    }
    color.set(id, 'active');
    for (const next of adjacency.get(id)) if (visit(next, [...path, id])) return true;
    color.set(id, 'done');
    return false;
  };
  for (const id of nodes.keys()) visit(id, []);

  // Quality gates: exactly GATE-01 to GATE-06, unique ids, each with checks.
  const gateIds = new Set();
  for (const g of repo.gates.gates) {
    if (gateIds.has(g.id)) errors.push(`quality-gates: duplicate ${g.id}`);
    gateIds.add(g.id);
    if (isEmpty(g.checks)) errors.push(`quality-gates: ${g.id} has no checks`);
  }
  const missingGates = EXPECTED_GATES.filter((id) => !gateIds.has(id));
  const unexpectedGates = [...gateIds].filter((id) => !EXPECTED_GATES.includes(id));
  if (missingGates.length || unexpectedGates.length) {
    errors.push(
      `quality-gates: expected GATE-01..GATE-06; missing [${missingGates.join(', ')}]; unexpected [${unexpectedGates.join(', ')}]`,
    );
  }

  // Risks: enumerated levels, mitigations and an owner.
  for (const r of repo.risks.risks) {
    if (!LEVELS.includes(r.likelihood)) errors.push(`risk ${r.id}: unknown likelihood ${r.likelihood}`);
    if (!LEVELS.includes(r.impact)) errors.push(`risk ${r.id}: unknown impact ${r.impact}`);
    if (isEmpty(r.mitigations)) errors.push(`risk ${r.id}: no mitigations`);
    if (isEmpty(r.owner)) errors.push(`risk ${r.id}: no owner`);
  }

  // Decision rights: an unnamed holder is a warning until an institution names one.
  for (const d of repo.decisions.decisions) {
    // Empty, null and the UNASSIGNED sentinel all mean nobody is named; a deleted field must not look reviewed.
    if (!d.approver_holder || d.approver_holder === 'UNASSIGNED') {
      warnings.push(`decision-rights: "${d.decision}" has no named approver`);
    }
  }

  // Increments: required fields once approved, safe-off before enablement, hard dependencies gate progress.
  const ids = new Set();
  const blockedBy = new Map();
  for (const { path, data: inc } of repo.increments) {
    const label = inc.id ?? path;
    if (isEmpty(inc.id)) errors.push(`${path}: missing id`);
    else if (path !== `registry/increments/${inc.id}.json`) errors.push(`${label}: file name must match id`);
    if (ids.has(inc.id)) errors.push(`${label}: duplicate id`);
    ids.add(inc.id);
    if (!states.includes(inc.state)) {
      errors.push(`${label}: unknown state ${inc.state}`);
      continue;
    }
    const r = rank(inc.state);
    const approved = r >= rank('approved_for_build');
    if (approved) {
      const missing = model.every_increment_requires.filter((k) => isEmpty(inc[k]));
      if (missing.length) errors.push(`${label}: ${inc.state} requires ${missing.join(', ')}`);
      // A missing list is not the same as a reviewed "no hard dependencies" decision.
      if (!Array.isArray(inc.hard_dependencies)) {
        errors.push(`${label}: ${inc.state} requires hard_dependencies to be declared as an array`);
      }
    }
    if (approved || inc.release_train !== undefined) {
      if (!trainIds.includes(inc.release_train)) {
        errors.push(`${label}: release_train ${inc.release_train} is not a defined release train (${trainIds.join(', ')})`);
      }
    }
    if (capabilityKeys && (approved || inc.capability_key)) {
      if (!capabilityKeys.has(inc.capability_key)) {
        errors.push(`${label}: capability_key ${inc.capability_key} is not in ${CAPABILITY_DIR}`);
      }
    } else if (!capabilityKeys && approved) {
      warnings.push(`${label}: capability registry ${CAPABILITY_DIR} is absent, so capability_key is unchecked`);
    }
    for (const field of REFERENCE_FIELDS) {
      const value = inc[field];
      if (isEmpty(value)) continue;
      const problem = typeof value === 'string' ? referenceProblem(value) : 'must be a string reference';
      if (!problem) continue;
      // Before approval a broken reference is a gap to close; once approved it is a blocker.
      const message = `${label}: ${field} ${value} ${problem}`;
      if (approved) errors.push(message);
      else warnings.push(message);
    }
    if (r >= rank('enabled') && isEmpty(inc.rollout_and_rollback_plan?.safe_off)) {
      errors.push(`${label}: ${inc.state} without a safe-off behavior`);
    }
    for (const d of inc.hard_dependencies ?? []) {
      if (!nodes.has(d)) errors.push(`${label}: hard dependency ${d} is not in dependency-graph`);
    }
    for (const d of inc.soft_dependencies ?? []) {
      if (!nodes.has(d)) errors.push(`${label}: soft dependency ${d} is not in dependency-graph`);
    }
    const required = model.hard_dependency_minimum_state[inc.state];
    // Before approval, report what still stands between the card and approved_for_build.
    const gate = required ?? 'approved_for_build';
    // A retired component is not ready: it ranks after the delivery states but cannot satisfy a gate.
    const satisfies = (status) => status !== 'retired' && rank(status) >= rank(gate);
    const unmet = (inc.hard_dependencies ?? []).filter((d) => nodes.has(d) && !satisfies(nodes.get(d).status));
    if (required && unmet.length) {
      errors.push(`${label}: ${inc.state} blocked; hard dependencies below ${required}: ${unmet.join(', ')}`);
    }
    if (unmet.length) blockedBy.set(label, unmet);
    if (!isEmpty(inc.gaps)) {
      // Approval means the gaps are closed; an open gap at or after approval is a blocker, before it a warning.
      const message = `${label}: ${inc.gaps.length} open gap(s)`;
      if (approved) errors.push(`${message}; ${inc.state} cannot carry open gaps`);
      else warnings.push(message);
    }
  }

  // Artifacts: a state other than missing needs a location on disk; missing must not exist.
  for (const { path, data: a } of repo.artifacts) {
    const label = a.id ?? path;
    if (!model.artifact_status_rules[a.state]) {
      errors.push(`${label}: unknown artifact state ${a.state}`);
      continue;
    }
    const location = isEmpty(a.location) ? null : insideRoot(a.location);
    const exists = location !== null && existsSync(location);
    if (a.state === 'missing') {
      if (exists) errors.push(`${label}: marked missing but ${a.location} exists`);
      else warnings.push(`${label}: missing (${a.location} not found)`);
    } else if (!exists) {
      errors.push(`${label}: state ${a.state} but ${a.location} does not exist`);
    }
    if (a.release_critical && a.state !== 'approved') warnings.push(`${label}: release-critical and ${a.state}`);
    // An approved artifact whose review date has passed is expired by the operating model's own rule.
    if (a.state === 'approved') {
      if (isEmpty(a.owners?.accountable)) errors.push(`${label}: approved without an accountable owner`);
      for (const dep of a.dependencies ?? []) {
        const d = artifactById.get(dep);
        if (!d || d.state !== 'approved') errors.push(`${label}: approved with unresolved dependency ${dep}`);
      }
    }
    const due = a.review?.next_due;
    if (a.state === 'approved' && isCalendarDate(due ?? '') && due < today) {
      errors.push(`${label}: approved but its review was due ${due}; it cannot support a release`);
    } else if (a.state === 'approved' && !isCalendarDate(due ?? '')) {
      errors.push(`${label}: approved but next_due is not a valid calendar date (${due ?? 'unset'})`);
    }
  }

  // Expansion scorecard: hard stops are defined and the no-override rule is stated.
  if (isEmpty(repo.scorecard.hard_stops)) errors.push('expansion-scorecard: no hard stops');
  const declaredStops = repo.scorecard.hard_stops ?? [];
  const missingStops = REQUIRED_HARD_STOPS.filter((id) => !declaredStops.includes(id));
  if (missingStops.length) errors.push(`expansion-scorecard: missing required hard stops [${missingStops.join(', ')}]`);
  if (!/no score may override/i.test(repo.scorecard.score_policy ?? '')) {
    errors.push('expansion-scorecard: score_policy must state that no score overrides a critical control failure');
  }

  // Finance baseline: principles and minimum artifacts exist; unstarted artifacts are a warning.
  if (isEmpty(repo.finance.principles)) errors.push('finance: no principles');
  const financeIds = repo.finance.minimum_artifacts.map((a) => a.id);
  const missingControls = FINANCE_CONTROLS.filter((id) => !financeIds.includes(id));
  if (missingControls.length) errors.push(`finance: minimum artifacts missing [${missingControls.join(', ')}]`);
  for (const a of repo.finance.minimum_artifacts) {
    if (!FINANCE_STATUSES.includes(a.status)) errors.push(`finance: ${a.id} has unknown status ${a.status}`);
    if (a.status === 'not_started') warnings.push(`finance: ${a.id} not started`);
    // A "present" artifact must point at evidence in the repository, so the baseline cannot claim unbuilt work.
    if (a.status === 'present' && (isEmpty(a.evidence) || insideRoot(a.evidence) === null || !existsSync(insideRoot(a.evidence)))) {
      errors.push(`finance: ${a.id} is marked present but its evidence ${a.evidence ?? '(none)'} does not exist`);
    }
  }

  return { errors, warnings, blockedBy };
}

function main() {
  const repo = loadRepo();
  const { errors, warnings, blockedBy } = check(repo);
  for (const [id, deps] of blockedBy) console.log(`blocked-by ${id}: ${deps.join(', ')}`);
  for (const w of warnings) console.log(`warning: ${w}`);
  for (const e of errors) console.log(`error: ${e}`);
  console.log(`delivery check: ${errors.length} error(s), ${warnings.length} warning(s)`);
  process.exitCode = errors.length ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
