// TraceContext contract from docs/operations/observability.yaml.
// Erasable TypeScript only, so it runs under node --experimental-strip-types.

export type Environment = "local" | "preview" | "staging" | "production";
export type ActorType = "student" | "staff" | "service" | "partner" | "system";

export type TraceContext = {
  correlationId: string;
  causationId?: string;
  tenantId?: string;
  capabilityId: string;
  releaseId?: string;
  actorType: ActorType;
  environment: Environment;
};

const ENVIRONMENTS: readonly string[] = ["local", "preview", "staging", "production"];
const ACTOR_TYPES: readonly string[] = ["student", "staff", "service", "partner", "system"];

export type TraceViolation = { field: string; reason: string };

// Returns every violation rather than the first, so a bad log call reports all of its gaps at once.
export function validateTraceContext(value: unknown): TraceViolation[] {
  const violations: TraceViolation[] = [];
  if (typeof value !== "object" || value === null) {
    return [{ field: "*", reason: "must be an object" }];
  }
  // Safe: the object check above narrows to a non-null object; fields are re-validated individually below.
  const ctx = value as Record<string, unknown>;
  if (typeof ctx.correlationId !== "string" || ctx.correlationId.length === 0) {
    violations.push({ field: "correlationId", reason: "required non-empty string" });
  }
  if (typeof ctx.capabilityId !== "string" || ctx.capabilityId.length === 0) {
    violations.push({ field: "capabilityId", reason: "required non-empty string" });
  }
  if (typeof ctx.environment !== "string" || !ENVIRONMENTS.includes(ctx.environment)) {
    violations.push({ field: "environment", reason: "must be local, preview, staging, or production" });
  }
  if (typeof ctx.actorType !== "string" || !ACTOR_TYPES.includes(ctx.actorType)) {
    violations.push({ field: "actorType", reason: "must be student, staff, service, partner, or system" });
  }
  // Production traffic is always tenant-scoped; a tenantless production context is a boundary failure.
  if (ctx.environment === "production" && (typeof ctx.tenantId !== "string" || ctx.tenantId.length === 0)) {
    violations.push({ field: "tenantId", reason: "required in production" });
  }
  return violations;
}

// Required per-request log fields from observability.yaml every_request.
// Raw identities are never included; actor scope is the only actor detail logged.
export type RequestLogFields = {
  timestamp: string;
  environment: Environment;
  tenant_id_when_present?: string;
  actor_type: ActorType;
  actor_scope_not_raw_sensitive_identity: string;
  capability_id: string;
  route_or_command: string;
  policy_decision_id: string;
  correlation_id: string;
  release_id?: string;
  result_code: string;
  latency_bucket: string;
};

export function toRequestLogFields(
  ctx: TraceContext,
  details: { timestamp: string; actorScope: string; routeOrCommand: string; policyDecisionId: string; resultCode: string; latencyBucket: string },
): RequestLogFields {
  return {
    timestamp: details.timestamp,
    environment: ctx.environment,
    tenant_id_when_present: ctx.tenantId,
    actor_type: ctx.actorType,
    actor_scope_not_raw_sensitive_identity: details.actorScope,
    capability_id: ctx.capabilityId,
    route_or_command: details.routeOrCommand,
    policy_decision_id: details.policyDecisionId,
    correlation_id: ctx.correlationId,
    release_id: ctx.releaseId,
    result_code: details.resultCode,
    latency_bucket: details.latencyBucket,
  };
}
