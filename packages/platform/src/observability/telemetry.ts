/**
 * Observability standards: what every log line, metric and service must carry
 * so that "which request, whose data, which owner, what is it worth" can be
 * answered at 3 a.m. without reading code.
 *
 * Three rules, each learned from how telemetry leaks:
 *
 * 1. **Logs carry ids, never content.** A log line has a service, a level, a
 *    correlation id and (when there is one) a tenant id and a request id. Its
 *    fields go through `redact` first. A student's essay in a log line is a
 *    student-record disclosure to everyone with log access.
 * 2. **Metrics never carry a tenant or person id as a label.** A label per
 *    tenant is unbounded cardinality (the metrics bill and the dashboard both
 *    fall over) and a label per person is a profile. Per-tenant questions are
 *    answered from logs and traces, where the tenant id belongs; metrics take
 *    a bounded `tier` or `region` instead. `defineMetric` refuses the labels.
 * 3. **A service is not shippable without operational metadata**: an owning
 *    team, a tier, an SLO with a target and window, a runbook that exists,
 *    the data classes it touches and the services it depends on. That is the
 *    "every capability has telemetry, SLOs, runbooks and on-call ownership"
 *    law, as a type a test can check.
 */

import type { Clock } from '../kernel/clock.ts';
import { redact } from './redact.ts';

export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export interface LogRecord {
  at: string;
  level: LogLevel;
  service: string;
  msg: string;
  correlationId: string;
  requestId?: string;
  tenantId?: string;
  fields?: Record<string, unknown>;
}

export interface LogSink {
  write(record: LogRecord): void;
}

export class MemoryLogSink implements LogSink {
  readonly records: LogRecord[] = [];
  write(record: LogRecord): void {
    this.records.push(record);
  }
}

export interface Logger {
  log(level: LogLevel, msg: string, fields?: Record<string, unknown>): void;
}

export function createLogger(
  service: string,
  ctx: { correlationId: string; requestId?: string; tenantId?: string },
  deps: { clock: Clock; sink: LogSink },
): Logger {
  return {
    log(level, msg, fields) {
      deps.sink.write({
        at: deps.clock.now().toISOString(),
        level,
        service,
        msg: msg.slice(0, 500),
        correlationId: ctx.correlationId,
        ...(ctx.requestId ? { requestId: ctx.requestId } : {}),
        ...(ctx.tenantId ? { tenantId: ctx.tenantId } : {}),
        ...(fields ? { fields: redact(fields) as Record<string, unknown> } : {}),
      });
    },
  };
}

/** Labels no metric may carry. */
export const FORBIDDEN_METRIC_LABELS = ['tenant', 'tenant_id', 'tenantid', 'person', 'person_id', 'personid', 'user', 'user_id', 'userid', 'email', 'session', 'session_id', 'correlation_id', 'request_id', 'ip'] as const;

export const METRIC_KINDS = ['counter', 'gauge', 'histogram'] as const;
export type MetricKind = (typeof METRIC_KINDS)[number];

export interface MetricDefinition {
  name: string;
  kind: MetricKind;
  unit: string;
  help: string;
  labels: readonly string[];
}

const METRIC_NAME = /^semester_[a-z][a-z0-9_]*$/;

export function defineMetric(def: MetricDefinition): MetricDefinition {
  if (!METRIC_NAME.test(def.name)) throw new Error(`${def.name}: metric names are semester_snake_case`);
  for (const l of def.labels) {
    if ((FORBIDDEN_METRIC_LABELS as readonly string[]).includes(l.toLowerCase())) {
      throw new Error(`${def.name}: label "${l}" is unbounded or identifying; use a log or trace field instead`);
    }
    if (!/^[a-z][a-z0-9_]*$/.test(l)) throw new Error(`${def.name}: label "${l}" is not snake_case`);
  }
  if (def.labels.length > 6) throw new Error(`${def.name}: more than 6 labels`);
  return def;
}

/** The metrics every command and consumer emits. Domains add their own through `defineMetric`. */
export const PLATFORM_METRICS: readonly MetricDefinition[] = [
  defineMetric({ name: 'semester_command_total', kind: 'counter', unit: '1', help: 'Commands run, by name and result.', labels: ['command', 'result', 'tier'] }),
  defineMetric({ name: 'semester_command_duration_seconds', kind: 'histogram', unit: 's', help: 'Command latency.', labels: ['command', 'tier'] }),
  defineMetric({ name: 'semester_policy_decision_total', kind: 'counter', unit: '1', help: 'Policy decisions, by action and outcome.', labels: ['action', 'outcome', 'reason'] }),
  defineMetric({ name: 'semester_idempotent_replay_total', kind: 'counter', unit: '1', help: 'Commands answered from the idempotency store.', labels: ['command'] }),
  defineMetric({ name: 'semester_outbox_pending', kind: 'gauge', unit: '1', help: 'Outbox rows not yet published.', labels: ['producer'] }),
  defineMetric({ name: 'semester_outbox_dead_lettered_total', kind: 'counter', unit: '1', help: 'Outbox rows parked for an operator.', labels: ['producer'] }),
  defineMetric({ name: 'semester_tenant_isolation_violation_total', kind: 'counter', unit: '1', help: 'Cross-tenant attempts refused by a boundary. Any non-zero value pages.', labels: ['layer'] }),
  defineMetric({ name: 'semester_connector_failures_total', kind: 'counter', unit: '1', help: 'Connector failures, by provider.', labels: ['provider', 'state'] }),
];

/* ── operational metadata ────────────────────────────────────────────── */

export const SERVICE_TIERS = [0, 1, 2, 3] as const;
export type ServiceTier = (typeof SERVICE_TIERS)[number];

export interface Slo {
  name: string;
  /** 0–1, e.g. 0.999. */
  target: number;
  windowDays: number;
  /** What is measured, in words an on-call engineer can check. */
  indicator: string;
}

export interface ServiceDescriptor {
  id: string;
  owner: string;
  /** 0 = records, auth, billing (page immediately) … 3 = internal tooling. */
  tier: ServiceTier;
  description: string;
  slos: readonly Slo[];
  /** Repo path of the runbook. */
  runbook: string;
  dataClasses: readonly string[];
  dependsOn: readonly string[];
  /** Whether the capability still works natively if every external dependency is down. */
  degradesToNative: boolean;
}

/** The minimum SLO target by tier. A tier-0 service cannot declare a 95% target. */
export const MIN_SLO_BY_TIER: Record<ServiceTier, number> = { 0: 0.999, 1: 0.995, 2: 0.99, 3: 0.95 };

export function descriptorProblems(d: ServiceDescriptor): string[] {
  const out: string[] = [];
  if (!/^[a-z][a-z0-9-]*$/.test(d.id)) out.push(`${d.id}: id must be kebab-case`);
  if (!d.owner.trim()) out.push(`${d.id}: no owning team`);
  if (d.slos.length === 0) out.push(`${d.id}: no SLO`);
  for (const s of d.slos) {
    if (!(s.target > 0 && s.target < 1)) out.push(`${d.id}: SLO ${s.name} target must be between 0 and 1`);
    else if (s.target < MIN_SLO_BY_TIER[d.tier]) out.push(`${d.id}: SLO ${s.name} target ${s.target} is below the tier ${d.tier} floor ${MIN_SLO_BY_TIER[d.tier]}`);
    if (!(s.windowDays >= 7 && s.windowDays <= 90)) out.push(`${d.id}: SLO ${s.name} window must be 7–90 days`);
    if (!s.indicator.trim()) out.push(`${d.id}: SLO ${s.name} has no indicator`);
  }
  if (!d.runbook.startsWith('docs/') || !d.runbook.endsWith('.md')) out.push(`${d.id}: runbook must be a docs/*.md path`);
  if (d.dataClasses.length === 0) out.push(`${d.id}: no data classes declared`);
  if (d.dependsOn.includes(d.id)) out.push(`${d.id}: depends on itself`);
  return out;
}

/** The platform's own services. Each domain registers its own in the same shape. */
export const PLATFORM_SERVICES: readonly ServiceDescriptor[] = [
  {
    id: 'gateway', owner: 'platform', tier: 0, description: 'API gateway / BFF: context, versioning, errors, idempotency.',
    slos: [{ name: 'availability', target: 0.999, windowDays: 30, indicator: 'Non-5xx responses / all responses at the edge, excluding 429.' }],
    runbook: 'docs/platform/OPERATIONS.md', dataClasses: ['internal', 'student_private', 'education_record'], dependsOn: ['identity', 'policy'], degradesToNative: true,
  },
  {
    id: 'identity', owner: 'platform', tier: 0, description: 'Sessions, memberships, affiliations, relationships, consent.',
    slos: [{ name: 'availability', target: 0.999, windowDays: 30, indicator: 'Successful session verifications / attempts.' }],
    runbook: 'docs/platform/OPERATIONS.md', dataClasses: ['internal', 'student_private'], dependsOn: [], degradesToNative: true,
  },
  {
    id: 'policy', owner: 'platform', tier: 0, description: 'Policy decision point and capability resolution.',
    slos: [{ name: 'decision-latency', target: 0.999, windowDays: 30, indicator: 'Decisions answered in under 50 ms at the 99th percentile.' }],
    runbook: 'docs/platform/OPERATIONS.md', dataClasses: ['internal'], dependsOn: ['identity'], degradesToNative: true,
  },
  {
    id: 'audit', owner: 'platform', tier: 0, description: 'Append-only hash-chained audit log.',
    slos: [{ name: 'write-durability', target: 0.9999, windowDays: 30, indicator: 'Audit rows committed with their command / commands that required one.' }],
    runbook: 'docs/platform/OPERATIONS.md', dataClasses: ['internal', 'student_private'], dependsOn: [], degradesToNative: true,
  },
  {
    id: 'outbox-publisher', owner: 'platform', tier: 1, description: 'Publishes domain outbox rows; parks failures.',
    slos: [{ name: 'freshness', target: 0.995, windowDays: 30, indicator: 'Rows published within 60 s of commit.' }],
    runbook: 'docs/platform/OPERATIONS.md', dataClasses: ['internal', 'student_private', 'education_record'], dependsOn: ['audit'], degradesToNative: true,
  },
  {
    id: 'notifications', owner: 'platform', tier: 1, description: 'Notification planning and delivery.',
    slos: [{ name: 'timeliness', target: 0.995, windowDays: 30, indicator: 'Non-deferred deliveries handed to a channel within 60 s.' }],
    runbook: 'docs/platform/OPERATIONS.md', dataClasses: ['internal', 'student_private'], dependsOn: ['outbox-publisher'], degradesToNative: true,
  },
  {
    id: 'files', owner: 'platform', tier: 1, description: 'Upload planning, scanning, signed access.',
    slos: [{ name: 'availability', target: 0.995, windowDays: 30, indicator: 'Successful signed-URL issuances / requests that passed policy.' }],
    runbook: 'docs/platform/OPERATIONS.md', dataClasses: ['internal', 'student_private', 'education_record'], dependsOn: ['policy'], degradesToNative: true,
  },
  {
    id: 'search', owner: 'platform', tier: 2, description: 'Tenant-scoped search.',
    slos: [{ name: 'availability', target: 0.99, windowDays: 30, indicator: 'Queries answered without a 5xx.' }],
    runbook: 'docs/platform/OPERATIONS.md', dataClasses: ['internal', 'student_private'], dependsOn: ['policy'], degradesToNative: true,
  },
  {
    id: 'integrations', owner: 'platform', tier: 2, description: 'Connector runtime: inbox, sync, health.',
    slos: [{ name: 'sync-freshness', target: 0.99, windowDays: 30, indicator: 'Healthy connections synced within their interval.' }],
    runbook: 'docs/platform/OPERATIONS.md', dataClasses: ['internal', 'student_private', 'education_record'], dependsOn: ['outbox-publisher'], degradesToNative: true,
  },
];
