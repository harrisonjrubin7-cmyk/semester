import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

/**
 * The shared contract layer for the registration-readiness pilot. Each YAML
 * file under docs/contracts/ names one kind of thing (capability, record,
 * event, audit key, route, command, release decision), and every reference
 * between them must resolve. These checks read the files as written, so a
 * contract cannot drift from the others without the build going red.
 */

const DIR = join(import.meta.dirname, '../../../docs/contracts');
// YAML parses to unknown. The files are repo-owned, and each describe below
// checks the shape it relies on, so the cast is a declaration, not a guess.
const load = <T>(name: string): T => parse(readFileSync(join(DIR, name), 'utf8')) as T;

const ACTORS = ['student', 'advisor', 'registrar', 'institution_admin', 'operations'];
const LEVELS = ['low', 'moderate', 'high'];
const CAPABILITY_STATUS = ['specified', 'in_progress', 'blocked', 'implemented', 'verified', 'deployed'];
const DECISIONS = ['pending', 'approved', 'rejected'];
const SCHEMAS = ['public', 'private'];
const COMMON_AUDIT_FIELDS = ['tenant_id', 'actor_account_id', 'entity_id', 'correlation_id'];
// The envelope the save RPC writes (private.registration_readiness_receipts.event_payload).
const ENVELOPE_FIELDS = ['eventType', 'aggregateId', 'idempotencyKey', 'correlationId', 'payload'];
const KEY = /^[a-z][a-z_]*(\.[a-z_]+)+$/;
const FOREIGN_KEY = /^[a-z_]+ -> ([a-z_]+)\.([a-z_]+)$/;

interface Passport {
  schema: string;
  domain: string;
  owner: string;
  authority: string;
  source_of_truth: string;
  sensitivity: string;
  tenant_scoped: boolean;
  primary_key: string;
  foreign_keys: string[];
  allowed_roles: Record<string, string>;
  retention: { class: string; deletion: string };
  subject?: string;
  immutable?: boolean;
  write_path?: { commands: string[]; requires_audit: boolean; writer?: string };
}

interface Command {
  name: string;
  version: number;
  provisional?: boolean;
  actor_roles: string[];
  input_schema: Record<string, string>;
  state_guard: { creates?: string; allowed_from: string[] };
  writes: string[];
  publishes: string[];
  requires_audit: boolean;
  requires_idempotency: boolean;
  safe_failure: string[];
}

interface EventDef {
  aggregate_type: string;
  producer_commands: string[];
  payload_required: string[];
  payload_status?: string;
}

interface Capability {
  key: string;
  title: string;
  domain: string;
  impact: string;
  sensitivity: string;
  status: string;
  actors: string[];
  routes: string[];
  records: string[];
  permissions: string[];
  commands: string[];
  events: string[];
  audits: string[];
  release_requirements?: string[];
}

interface RouteDef {
  screen: string;
  actors: string[];
  capabilities: string[];
  auth: string;
  status: string;
}

interface AuditDef {
  key: string;
  actor: string;
  entity: string;
  severity: string;
  required_fields: string[];
  status: string;
}

interface Release {
  release_id: string;
  capability_keys: string[];
  decision: string;
  required_evidence: Record<string, string[]>;
  approvers: { role: string; state: string }[];
  rollback: { feature_flag: string };
}

const capabilities = load<{ capabilities: Capability[] }>('capabilities.yaml').capabilities;
const records = load<{ records: Record<string, Passport> }>('records.yaml').records;
const eventFile = load<{
  event_envelope: { required: string[] };
  events: Record<string, EventDef>;
  examples: { event_type: string; envelope: Record<string, unknown> }[];
}>('events.yaml');
const events = eventFile.events;
const audit = load<{ common_required_fields: string[]; audit_events: AuditDef[] }>('audit-events.yaml');
const routes = load<{ routes: Record<string, RouteDef> }>('routes.yaml').routes;
const workflows = load<{
  readiness_states: { canonical: string[]; display: Record<string, string>; transitional: string[] };
  state_edges: [string, string][];
  authorization_chain: string[];
  commands: Command[];
  failure_drills: { drill: string; expected: string }[];
}>('workflows.yaml');
const commands = workflows.commands;
const readinessStates = workflows.readiness_states.canonical;
const release = load<{ release_decision: Release }>('release-evidence.yaml').release_decision;

const commandNames = new Set(commands.map((c) => c.name));
const recordNames = new Set(Object.keys(records));
const eventNames = new Set(Object.keys(events));
const auditKeys = new Set(audit.audit_events.map((a) => a.key));
const routePaths = new Set(Object.keys(routes));
const capabilityKeys = new Set(capabilities.map((c) => c.key));
const duplicates = (values: string[]) => values.filter((v, i) => values.indexOf(v) !== i);

describe('capability registry', () => {
  it('has well-formed, unique keys and a known status and impact vocabulary', () => {
    const keys = capabilities.map((c) => c.key);
    const violations = [
      ...keys.filter((k) => !KEY.test(k)).map((k) => `malformed key ${k}`),
      ...duplicates(keys).map((k) => `duplicate key ${k}`),
      ...capabilities
        .filter((c) => !CAPABILITY_STATUS.includes(c.status))
        .map((c) => `${c.key}: unknown status ${c.status}`),
      ...capabilities.filter((c) => !LEVELS.includes(c.impact)).map((c) => `${c.key}: unknown impact ${c.impact}`),
      ...capabilities
        .filter((c) => !LEVELS.includes(c.sensitivity))
        .map((c) => `${c.key}: unknown sensitivity ${c.sensitivity}`),
    ];
    expect(violations).toEqual([]);
  });

  it('resolves every actor, route, record, command, event and audit key it names', () => {
    const violations = capabilities.flatMap((c) => [
      ...c.actors.filter((a) => !ACTORS.includes(a)).map((a) => `${c.key}: unknown actor ${a}`),
      ...c.routes.filter((r) => !routePaths.has(r)).map((r) => `${c.key}: unknown route ${r}`),
      ...c.records.filter((r) => !recordNames.has(r)).map((r) => `${c.key}: unknown record ${r}`),
      ...c.commands.filter((x) => !commandNames.has(x)).map((x) => `${c.key}: unknown command ${x}`),
      ...c.events.filter((e) => !eventNames.has(e)).map((e) => `${c.key}: unknown event ${e}`),
      ...c.audits.filter((a) => !auditKeys.has(a)).map((a) => `${c.key}: unknown audit ${a}`),
    ]);
    expect(violations).toEqual([]);
  });

  it('gives every capability release requirements', () => {
    expect(capabilities.filter((c) => !c.release_requirements?.length).map((c) => c.key)).toEqual([]);
  });

  it('agrees with the route file in both directions', () => {
    const violations = [
      ...capabilities.flatMap((c) =>
        c.routes
          .filter((r) => !routes[r]?.capabilities.includes(c.key))
          .map((r) => `${c.key} names route ${r}, which does not list it back`),
      ),
      ...Object.entries(routes).flatMap(([path, route]) =>
        route.capabilities
          .filter((k) => !capabilities.find((c) => c.key === k)?.routes.includes(path))
          .map((k) => `${path} lists capability ${k}, which does not list it back`),
      ),
    ];
    expect(violations).toEqual([]);
  });
});

describe('routes', () => {
  it('names only known actors, requires an authenticated session, and states whether it is built', () => {
    const violations = Object.entries(routes).flatMap(([path, r]) => [
      ...r.actors.filter((a) => !ACTORS.includes(a)).map((a) => `${path}: unknown actor ${a}`),
      ...(r.auth === 'required' ? [] : [`${path}: auth must be required, found ${r.auth}`]),
      ...(['not_built', 'proposed', 'built'].includes(r.status) ? [] : [`${path}: unknown status ${r.status}`]),
      ...r.capabilities.filter((k) => !capabilityKeys.has(k)).map((k) => `${path}: unknown capability ${k}`),
    ]);
    expect(violations).toEqual([]);
  });
});

describe('record passports', () => {
  it('is complete for every record', () => {
    const violations = Object.entries(records).flatMap(([name, p]) => {
      const missing = [
        ['schema', p.schema],
        ['domain', p.domain],
        ['owner', p.owner],
        ['authority', p.authority],
        ['source_of_truth', p.source_of_truth],
        ['sensitivity', p.sensitivity],
        ['primary_key', p.primary_key],
        ['foreign_keys', p.foreign_keys],
        ['allowed_roles', p.allowed_roles],
        ['retention.class', p.retention?.class],
        ['retention.deletion', p.retention?.deletion],
      ]
        .filter(([, v]) => v === undefined)
        .map(([f]) => `${name}: missing ${f}`);
      const badSchema = SCHEMAS.includes(p.schema) ? [] : [`${name}: unknown schema ${p.schema}`];
      const badLevel = LEVELS.includes(p.sensitivity) ? [] : [`${name}: unknown sensitivity ${p.sensitivity}`];
      const badTenant = typeof p.tenant_scoped === 'boolean' ? [] : [`${name}: tenant_scoped must be a boolean`];
      return [...missing, ...badSchema, ...badLevel, ...badTenant];
    });
    expect(violations).toEqual([]);
  });

  it('resolves every foreign key to a real table and its id column', () => {
    const violations = Object.entries(records).flatMap(([name, p]) =>
      p.foreign_keys.flatMap((fk) => {
        const match = FOREIGN_KEY.exec(fk);
        if (!match) return [`${name}: malformed foreign key ${fk}`];
        const [, table, column] = match;
        if (!recordNames.has(table)) return [`${name}: foreign key ${fk} targets unknown table ${table}`];
        return column === 'id' ? [] : [`${name}: foreign key ${fk} must target the id column`];
      }),
    );
    expect(violations).toEqual([]);
  });

  it('gives every role a scope, and keeps operations away from student content', () => {
    const violations = Object.entries(records).flatMap(([name, p]) => {
      const roles = Object.keys(p.allowed_roles);
      const unknown = roles.filter((r) => !ACTORS.includes(r)).map((r) => `${name}: unknown role ${r}`);
      const subjectLeak =
        p.subject === 'student' && p.allowed_roles.operations !== 'no_student_content'
          ? [`${name}: student records must give operations no_student_content`]
          : [];
      return [...unknown, ...subjectLeak];
    });
    expect(violations).toEqual([]);
  });

  it('keeps each write path and the command that writes the record in agreement', () => {
    const violations = [
      ...Object.entries(records).flatMap(([name, p]) =>
        (p.write_path?.commands ?? [])
          .filter((c) => !commandNames.has(c))
          .map((c) => `${name}: write path names unknown command ${c}`),
      ),
      ...Object.entries(records).flatMap(([name, p]) =>
        (p.write_path?.commands ?? [])
          .filter((c) => !commands.find((x) => x.name === c)?.writes.includes(name))
          .map((c) => `${name} lists command ${c}, which does not write it`),
      ),
      ...commands.flatMap((c) =>
        c.writes.flatMap((w) => {
          if (!recordNames.has(w)) return [`${c.name} writes unknown record ${w}`];
          const declared = records[w]?.write_path?.commands ?? [];
          return declared.includes(c.name) ? [] : [`${c.name} writes ${w}, which does not list it back`];
        }),
      ),
    ];
    expect(violations).toEqual([]);
  });

  it('names a writer for every record that no command writes', () => {
    const orphans = Object.entries(records)
      .filter(([, p]) => p.write_path && p.write_path.commands.length === 0)
      .filter(([, p]) => !p.write_path?.writer)
      .map(([name]) => `${name}: no command and no named writer`);
    expect(orphans).toEqual([]);
  });
});

describe('readiness states', () => {
  it('uses the eight canonical states the save RPC enforces, once each', () => {
    expect(readinessStates).toHaveLength(8);
    expect(duplicates(readinessStates)).toEqual([]);
  });

  it('maps each confirmed display outcome onto a canonical state, and no other', () => {
    const display = workflows.readiness_states.display;
    expect(Object.keys(display).sort()).toEqual(['blocked', 'needs_review', 'resolved', 'stale', 'unknown']);
    const violations = Object.entries(display)
      .filter(([, canonical]) => !readinessStates.includes(canonical))
      .map(([outcome, canonical]) => `${outcome} maps to unknown state ${canonical}`);
    expect(violations).toEqual([]);
    expect(Object.keys(display)).toHaveLength(5);
  });

  it('uses only canonical states in every edge and guard', () => {
    const edges = workflows.state_edges.flat().filter((s) => !readinessStates.includes(s));
    const guards = commands.flatMap((c) => [
      ...c.state_guard.allowed_from.filter((s) => !readinessStates.includes(s)),
      ...(c.state_guard.creates && !readinessStates.includes(c.state_guard.creates) ? [c.state_guard.creates] : []),
    ]);
    expect([...edges, ...guards]).toEqual([]);
  });
});

describe('commands and workflows', () => {
  it('uses the fourteen-step authorization chain, in order, once each', () => {
    expect(workflows.authorization_chain).toHaveLength(14);
    expect(duplicates(workflows.authorization_chain)).toEqual([]);
    expect(workflows.authorization_chain[0]).toBe('parse_and_validate_input');
    expect(workflows.authorization_chain.at(-1)).toBe('return_receipt_or_safe_error');
  });

  it('gives every command an allowed actor, a safe failure, audit and idempotency', () => {
    const violations = commands.flatMap((c) => [
      ...(c.actor_roles.length === 0 ? [`${c.name}: no actor roles`] : []),
      ...c.actor_roles.filter((a) => !ACTORS.includes(a)).map((a) => `${c.name}: unknown actor ${a}`),
      ...(c.safe_failure.length === 0 ? [`${c.name}: no safe failure`] : []),
      ...(c.requires_audit ? [] : [`${c.name}: sensitive commands must require audit`]),
      ...(c.requires_idempotency ? [] : [`${c.name}: commands must require idempotency`]),
      ...(c.writes.includes('gateway_audit') ? [] : [`${c.name}: writes no gateway_audit`]),
    ]);
    expect(violations).toEqual([]);
  });

  it('writes to the outbox whenever a command publishes an event', () => {
    const violations = commands
      .filter((c) => c.publishes.length > 0 && !c.writes.includes('domain_outbox_events'))
      .map((c) => `${c.name} publishes ${c.publishes.join(', ')} without writing domain_outbox_events`);
    expect(violations).toEqual([]);
  });

  it('publishes only catalogued events and keeps command names unique', () => {
    const violations = [
      ...duplicates(commands.map((c) => c.name)).map((n) => `duplicate command ${n}`),
      ...commands.flatMap((c) => c.publishes.filter((e) => !eventNames.has(e)).map((e) => `${c.name}: unknown event ${e}`)),
    ];
    expect(violations).toEqual([]);
  });

  it('records the ten failure drills the brief requires before a pilot launch', () => {
    expect(workflows.failure_drills).toHaveLength(10);
    expect(workflows.failure_drills.filter((d) => !d.drill || !d.expected)).toEqual([]);
  });
});

describe('domain events', () => {
  it('keeps the envelope the save RPC writes', () => {
    expect(eventFile.event_envelope.required).toEqual(ENVELOPE_FIELDS);
  });

  it('agrees with the commands that publish each event, in both directions', () => {
    const violations = Object.entries(events).flatMap(([name, e]) => {
      const publishers = commands.filter((c) => c.publishes.includes(name)).map((c) => c.name);
      const declared = [...e.producer_commands].sort();
      const actual = [...publishers].sort();
      const producers =
        JSON.stringify(declared) === JSON.stringify(actual) ? [] : [`${name}: producers ${declared} vs publishers ${actual}`];
      const status =
        e.payload_status === 'unverified' || (e.payload_status === 'specified' && e.payload_required.length > 0)
          ? []
          : [`${name}: payload_status ${e.payload_status} needs payload_required or unverified`];
      return [...producers, ...status];
    });
    expect(violations).toEqual([]);
  });

  it('validates each example against the envelope and its catalogue entry', () => {
    const violations = eventFile.examples.flatMap((ex) => {
      const def = events[ex.event_type];
      if (!def) return [`example ${ex.event_type}: not in the catalogue`];
      const missing = ENVELOPE_FIELDS.filter((f) => !(f in ex.envelope)).map((f) => `example missing ${f}`);
      const typeMismatch =
        ex.envelope.eventType === ex.event_type ? [] : [`example envelope type ${String(ex.envelope.eventType)}`];
      const payload = (ex.envelope.payload ?? {}) as Record<string, unknown>;
      const payloadKeys = Object.keys(payload).sort();
      const expectedKeys = [...def.payload_required].sort();
      const payloadMismatch =
        JSON.stringify(payloadKeys) === JSON.stringify(expectedKeys)
          ? []
          : [`example ${ex.event_type} payload ${payloadKeys} vs ${expectedKeys}`];
      return [...missing, ...typeMismatch, ...payloadMismatch];
    });
    expect(violations).toEqual([]);
  });
});

describe('audit vocabulary', () => {
  it('uses the four common fields on every event, with stable well-formed keys', () => {
    expect(audit.common_required_fields).toEqual(COMMON_AUDIT_FIELDS);
    const violations = audit.audit_events.flatMap((a) => [
      ...(KEY.test(a.key) ? [] : [`malformed audit key ${a.key}`]),
      ...(ACTORS.includes(a.actor) ? [] : [`${a.key}: unknown actor ${a.actor}`]),
      ...(LEVELS.includes(a.severity) ? [] : [`${a.key}: unknown severity ${a.severity}`]),
      ...a.required_fields.filter((f) => COMMON_AUDIT_FIELDS.includes(f)).map((f) => `${a.key}: repeats common field ${f}`),
    ]);
    expect(violations).toEqual([]);
    expect(duplicates(audit.audit_events.map((a) => a.key))).toEqual([]);
  });
});

describe('release evidence', () => {
  it('names only registered capabilities and a known decision', () => {
    const violations = [
      ...(DECISIONS.includes(release.decision) ? [] : [`unknown decision ${release.decision}`]),
      ...release.capability_keys.filter((k) => !capabilityKeys.has(k)).map((k) => `unknown capability ${k}`),
      ...duplicates(release.capability_keys).map((k) => `duplicate capability ${k}`),
    ];
    expect(violations).toEqual([]);
  });

  it('lists evidence in every group and gives each approver a known state', () => {
    const violations = [
      ...Object.entries(release.required_evidence)
        .filter(([, items]) => items.length === 0)
        .map(([group]) => `${group}: no evidence listed`),
      ...release.approvers
        .filter((a) => !DECISIONS.includes(a.state))
        .map((a) => `${a.role}: unknown state ${a.state}`),
    ];
    expect(violations).toEqual([]);
  });

  it('is approved only when every approver has approved', () => {
    const unapproved = release.approvers.filter((a) => a.state !== 'approved').map((a) => a.role);
    if (release.decision === 'approved') {
      expect(unapproved).toEqual([]);
    } else {
      expect(release.decision === 'pending' || release.decision === 'rejected').toBe(true);
    }
  });

  it('allows no capability to be deployed without an approved release that covers it', () => {
    const approved = release.decision === 'approved' ? new Set(release.capability_keys) : new Set<string>();
    const violations = capabilities
      .filter((c) => c.status === 'deployed' && !approved.has(c.key))
      .map((c) => `${c.key} is deployed without an approved release`);
    expect(violations).toEqual([]);
  });
});
