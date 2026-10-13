#!/usr/bin/env node
// Validates the registration-readiness pilot artifacts under docs/.
// Run from the repository root: npm run pilot:validate
//
// Documents may not reference a capability, record, route, operation, event,
// audit key, control or file that does not exist, and a release decision may not
// be GO while any evidence item is unverified. Exits 1 with the issues listed.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

export const REQUIRED_ARTIFACTS = [
  'docs/architecture/authority-model.md',
  'docs/architecture/source-freshness-policy.md',
  'docs/architecture/data-classification.md',
  'docs/architecture/ai-boundary.md',
  'docs/contracts/capabilities.yaml',
  'docs/contracts/records.yaml',
  'docs/contracts/routes.yaml',
  'docs/contracts/workflows.yaml',
  'docs/contracts/events.yaml',
  'docs/contracts/audit-events.yaml',
  'docs/contracts/api.openapi.yaml',
  'docs/contracts/asyncapi.yaml',
  'docs/contracts/integration-adapter.yaml',
  'docs/launch/pilot-scope.md',
  'docs/launch/go-no-go.yaml',
  'docs/launch/launch-day-runbook.md',
  'docs/launch/support-handoff.md',
  'docs/launch/incident-runbooks/stale-source.md',
  'docs/launch/incident-runbooks/access-exposure.md',
  'docs/launch/incident-runbooks/staff-misreads-readiness.md',
  'docs/launch/incident-runbooks/dead-letter-and-reconciliation.md',
  'docs/launch/communications/student-announcement.md',
  'docs/launch/communications/staff-onboarding-registrar.md',
  'docs/governance/risk-register.yaml',
  'docs/governance/control-register.yaml',
  'docs/governance/release-evidence.yaml',
  'docs/governance/decision-log.md',
];

const DATA_CLASSES = ['public', 'internal', 'confidential', 'restricted'];
const RECORD_STATUS = ['implemented', 'specified'];
const CONTROL_STATUS = ['specified', 'implemented', 'verified'];
const RELEASE_STATUS = ['proposed', 'specified', 'in_progress', 'blocked', 'implemented', 'verified', 'deployed'];
const GATE_DECISIONS = ['GO', 'NO-GO'];
const DONE_STATUS = ['verified', 'deployed'];

// A reference to a repository file: docs/... ending in a known extension.
const FILE_REF = /docs\/[A-Za-z0-9_./-]+\.(?:md|ya?ml|sql|mjs|ts)\b/g;
const CONTROL_REF = /\bCTL-[A-Z0-9-]+\b/g;

function resolvePointer(doc, pointer) {
  let node = doc;
  for (const raw of pointer.slice(2).split('/')) {
    const key = raw.replaceAll('~1', '/').replaceAll('~0', '~');
    if (node === null || typeof node !== 'object' || !(key in node)) return false;
    node = node[key];
  }
  return true;
}

function forEachRef(node, visit) {
  if (Array.isArray(node)) return node.forEach((item) => forEachRef(item, visit));
  if (node && typeof node === 'object') {
    if (typeof node.$ref === 'string') visit(node.$ref);
    for (const value of Object.values(node)) forEachRef(value, visit);
  }
}

export function validatePilotArtifacts(root) {
  const issues = [];
  const issue = (code, file, message) => issues.push({ code, file, message });
  const exists = (rel) => existsSync(join(root, rel));

  for (const rel of REQUIRED_ARTIFACTS) {
    if (!exists(rel)) issue('artifact.missing', rel, 'Required pilot artifact is missing.');
  }

  const load = (rel) => {
    if (!exists(rel)) return undefined;
    try {
      return parse(readFileSync(join(root, rel), 'utf8'));
    } catch (error) {
      issue('yaml.parse_error', rel, error.message);
      return undefined;
    }
  };

  const capabilities = load('docs/contracts/capabilities.yaml')?.capabilities ?? {};
  const records = load('docs/contracts/records.yaml')?.records ?? {};
  const routesDoc = load('docs/contracts/routes.yaml') ?? {};
  const routes = routesDoc.routes ?? {};
  const uiStates = routesDoc.states ?? [];
  const workflows = load('docs/contracts/workflows.yaml')?.workflows ?? {};
  const events = load('docs/contracts/events.yaml')?.events ?? {};
  const auditKeys = load('docs/contracts/audit-events.yaml')?.audit_keys ?? {};
  const openapi = load('docs/contracts/api.openapi.yaml') ?? {};
  const asyncapi = load('docs/contracts/asyncapi.yaml') ?? {};
  const controls = load('docs/governance/control-register.yaml')?.controls ?? {};
  const risks = load('docs/governance/risk-register.yaml')?.risks ?? [];
  const goNoGo = load('docs/launch/go-no-go.yaml') ?? {};
  const releaseDoc = load('docs/governance/release-evidence.yaml') ?? {};
  const releaseItems = releaseDoc.items ?? {};

  // Capabilities own routes, workflows, events, audit keys and records.
  const CAP = 'docs/contracts/capabilities.yaml';
  for (const [name, cap] of Object.entries(capabilities)) {
    for (const r of cap.records ?? []) {
      if (!records[r]) issue('capability.unknown_record', CAP, `${name} lists record ${r}, which is not in records.yaml.`);
    }
    for (const r of cap.routes ?? []) {
      if (!routes[r]) issue('capability.unknown_route', CAP, `${name} lists route ${r}, which is not in routes.yaml.`);
      else if (routes[r].capability !== name) issue('capability.route_mismatch', CAP, `Route ${r} belongs to ${routes[r].capability}, not ${name}.`);
    }
    for (const w of cap.workflows ?? []) {
      if (!workflows[w]) issue('capability.unknown_workflow', CAP, `${name} lists workflow ${w}, which is not in workflows.yaml.`);
      else if (workflows[w].capability !== name) issue('capability.workflow_mismatch', CAP, `Workflow ${w} belongs to ${workflows[w].capability}, not ${name}.`);
    }
    for (const e of cap.events ?? []) {
      if (!events[e]) issue('capability.unknown_event', CAP, `${name} lists event ${e}, which is not in events.yaml.`);
    }
    for (const a of cap.audit_keys ?? []) {
      if (!auditKeys[a]) issue('capability.unknown_audit_key', CAP, `${name} lists audit key ${a}, which is not in audit-events.yaml.`);
    }
  }

  // Records: an implemented record must point at a migration that defines its table.
  for (const [name, record] of Object.entries(records)) {
    const file = 'docs/contracts/records.yaml';
    if (!RECORD_STATUS.includes(record.status)) issue('record.bad_status', file, `${name} has status ${record.status}.`);
    if (!DATA_CLASSES.includes(record.classification)) issue('record.bad_classification', file, `${name} has classification ${record.classification}.`);
    if (record.status === 'implemented') {
      if (!record.migration || !exists(record.migration)) {
        issue('record.migration_missing', file, `${name} is implemented but its migration ${record.migration} does not exist.`);
        continue;
      }
      const table = String(record.table ?? '').split('.').pop();
      const sql = readFileSync(join(root, record.migration), 'utf8');
      if (!table || !sql.includes(table)) {
        issue('record.table_not_in_migration', file, `${name} names table ${record.table}, which ${record.migration} does not define.`);
      }
    }
  }

  // Routes: API routes match an OpenAPI operation exactly; UI routes render every state.
  const ops = new Map();
  for (const [path, item] of Object.entries(openapi.paths ?? {})) {
    for (const [method, op] of Object.entries(item)) {
      if (op?.operationId) ops.set(op.operationId, { method: method.toUpperCase(), path, op });
    }
  }
  const ROUTES = 'docs/contracts/routes.yaml';
  for (const [id, route] of Object.entries(routes)) {
    if (!capabilities[route.capability]) issue('route.unknown_capability', ROUTES, `${id} belongs to unknown capability ${route.capability}.`);
    if (route.audit && !auditKeys[route.audit]) issue('route.unknown_audit_key', ROUTES, `${id} uses audit key ${route.audit}, which is not defined.`);
    if (route.kind === 'api') {
      const found = ops.get(route.operationId);
      if (!found) {
        issue('route.operation_missing', ROUTES, `${id} names operation ${route.operationId}, which api.openapi.yaml does not define.`);
        continue;
      }
      if (found.method !== route.method || found.path !== route.path) {
        issue('route.operation_mismatch', ROUTES, `${id} is ${route.method} ${route.path}, but ${route.operationId} is ${found.method} ${found.path}.`);
      }
      if (route.idempotency === 'required') {
        const declared = (found.op.parameters ?? []).some((p) => p.name === 'Idempotency-Key' && p.required === true);
        if (!declared) issue('route.idempotency_undeclared', ROUTES, `${id} requires idempotency but ${route.operationId} does not declare a required Idempotency-Key header.`);
      }
    } else if (route.kind === 'ui') {
      for (const state of uiStates) {
        if (!(route.states ?? []).includes(state)) issue('route.state_missing', ROUTES, `${id} does not declare the ${state} state.`);
      }
    } else {
      issue('route.bad_kind', ROUTES, `${id} has kind ${route.kind}.`);
    }
  }
  const routedOps = new Set(Object.values(routes).filter((r) => r.kind === 'api').map((r) => r.operationId));
  for (const opId of ops.keys()) {
    if (!routedOps.has(opId)) issue('operation.unrouted', 'docs/contracts/api.openapi.yaml', `${opId} has no entry in routes.yaml.`);
  }

  // OpenAPI and AsyncAPI: internal references must resolve.
  for (const [rel, doc] of [['docs/contracts/api.openapi.yaml', openapi], ['docs/contracts/asyncapi.yaml', asyncapi]]) {
    forEachRef(doc, (ref) => {
      if (ref.startsWith('#/') && !resolvePointer(doc, ref)) issue('ref.unresolved', rel, `${ref} does not resolve.`);
    });
  }

  // Events, workflows and audit keys.
  const EVENTS = 'docs/contracts/events.yaml';
  for (const [name, event] of Object.entries(events)) {
    if (!auditKeys[event.audit]) issue('event.unknown_audit_key', EVENTS, `${name} uses audit key ${event.audit}, which is not defined.`);
    if (!workflows[event.workflow]) issue('event.unknown_workflow', EVENTS, `${name} names workflow ${event.workflow}, which is not defined.`);
    if (!DATA_CLASSES.includes(event.payload_classification)) issue('event.bad_classification', EVENTS, `${name} has classification ${event.payload_classification}.`);
  }
  for (const [name, audit] of Object.entries(auditKeys)) {
    if (!DATA_CLASSES.includes(audit.subject_class)) issue('audit.bad_classification', 'docs/contracts/audit-events.yaml', `${name} has classification ${audit.subject_class}.`);
  }
  for (const [name, wf] of Object.entries(workflows)) {
    const file = 'docs/contracts/workflows.yaml';
    const states = new Set(wf.states ?? []);
    const terminal = wf.terminal ?? [];
    if (!states.has(wf.initial)) issue('workflow.bad_initial', file, `${name} starts at ${wf.initial}, which is not a state.`);
    for (const s of terminal) if (!states.has(s)) issue('workflow.unknown_terminal', file, `${name} lists terminal state ${s}, which is not a state.`);
    for (const t of wf.transitions ?? []) {
      if (!states.has(t.from) || !states.has(t.to)) issue('workflow.unknown_state', file, `${name} has transition ${t.from} -> ${t.to} with an unknown state.`);
      if (terminal.includes(t.from)) issue('workflow.transition_from_terminal', file, `${name} leaves terminal state ${t.from}.`);
      if (t.event?.includes('.') && !events[t.event]) issue('workflow.unknown_event', file, `${name} transitions on event ${t.event}, which is not in events.yaml.`);
    }
  }

  // AsyncAPI must describe exactly the events in events.yaml.
  const messages = Object.keys(asyncapi.components?.messages ?? {});
  for (const m of messages) if (!events[m]) issue('asyncapi.unknown_event', 'docs/contracts/asyncapi.yaml', `Message ${m} is not in events.yaml.`);
  for (const e of Object.keys(events)) if (!messages.includes(e)) issue('asyncapi.event_missing', 'docs/contracts/asyncapi.yaml', `Event ${e} has no AsyncAPI message.`);

  // Controls: a control is only implemented or verified with evidence on disk.
  const CONTROLS = 'docs/governance/control-register.yaml';
  for (const [id, control] of Object.entries(controls)) {
    if (!CONTROL_STATUS.includes(control.status)) issue('control.bad_status', CONTROLS, `${id} has status ${control.status}.`);
    if (control.status === 'verified' && !control.evidence?.check) issue('control.verified_without_check', CONTROLS, `${id} is verified but names no check command.`);
    if (control.status === 'implemented' || control.status === 'verified') {
      const files = control.evidence?.files ?? [];
      if (files.length === 0) issue('control.implemented_without_files', CONTROLS, `${id} is ${control.status} but lists no files.`);
      for (const f of files) if (!exists(f)) issue('control.file_missing', CONTROLS, `${id} lists ${f}, which does not exist.`);
    }
  }

  // Risks: every prevention control exists, and each risk has an owner and runbook.
  for (const risk of risks) {
    const file = 'docs/governance/risk-register.yaml';
    for (const c of risk.prevention ?? []) if (!controls[c]) issue('risk.unknown_control', file, `${risk.id} cites control ${c}, which is not in control-register.yaml.`);
    if (!risk.owner) issue('risk.no_owner', file, `${risk.id} has no owner.`);
    if (risk.runbook && !exists(risk.runbook)) issue('risk.runbook_missing', file, `${risk.id} points at ${risk.runbook}, which does not exist.`);
  }

  // Go/no-go and release evidence: GO requires every evidence item verified.
  const GATES = 'docs/launch/go-no-go.yaml';
  const seenGates = new Set();
  const gateEvidence = new Set();
  for (const group of Object.values(goNoGo.gates ?? {})) {
    for (const gate of group) {
      if (seenGates.has(gate.id)) issue('gate.duplicate', GATES, `${gate.id} appears more than once.`);
      seenGates.add(gate.id);
      for (const ev of gate.evidence ?? []) {
        gateEvidence.add(ev);
        if (!releaseItems[ev]) issue('gate.unknown_evidence', GATES, `${gate.id} cites ${ev}, which is not in release-evidence.yaml.`);
      }
    }
  }
  for (const [id, item] of Object.entries(releaseItems)) {
    const file = 'docs/governance/release-evidence.yaml';
    if (!RELEASE_STATUS.includes(item.status)) issue('release.bad_status', file, `${id} has status ${item.status}.`);
    if (DONE_STATUS.includes(item.status) && !item.evidence) issue('release.verified_without_evidence', file, `${id} is ${item.status} with no evidence.`);
    if (item.status === 'blocked' && !item.blocker) issue('release.blocked_without_reason', file, `${id} is blocked with no reason.`);
    if (!gateEvidence.has(id)) issue('release.orphan_item', file, `${id} is not cited by any go/no-go gate.`);
  }
  if (!GATE_DECISIONS.includes(goNoGo.decision)) issue('gate.bad_decision', GATES, `Decision ${goNoGo.decision} is not GO or NO-GO.`);
  if (goNoGo.decision !== releaseDoc.release_decision) issue('gate.decision_mismatch', GATES, `go-no-go.yaml says ${goNoGo.decision}; release-evidence.yaml says ${releaseDoc.release_decision}.`);
  if (goNoGo.decision === 'GO') {
    if (!goNoGo.decided_by) issue('gate.go_without_signer', GATES, 'A GO decision names no signer.');
    const unverified = Object.entries(releaseItems).filter(([, item]) => !DONE_STATUS.includes(item.status)).map(([id]) => id);
    if (unverified.length) issue('gate.go_without_evidence', GATES, `GO with unverified evidence: ${unverified.join(', ')}.`);
  }

  // Prose: every control id and every docs/ file a pilot artifact cites must exist.
  for (const rel of REQUIRED_ARTIFACTS) {
    if (!exists(rel) || !/\.(?:md|ya?ml)$/.test(rel)) continue;
    const text = readFileSync(join(root, rel), 'utf8');
    for (const id of new Set(text.match(CONTROL_REF) ?? [])) {
      if (!controls[id]) issue('doc.unknown_control', rel, `Cites control ${id}, which is not in control-register.yaml.`);
    }
    for (const path of new Set(text.match(FILE_REF) ?? [])) {
      if (!exists(path)) issue('doc.missing_path', rel, `Cites ${path}, which does not exist.`);
    }
  }

  return issues;
}

const isMain = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const issues = validatePilotArtifacts(root);
  if (issues.length) {
    console.error(JSON.stringify({ valid: false, issues }, null, 2));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({ valid: true, issues: [] }, null, 2));
  }
}
