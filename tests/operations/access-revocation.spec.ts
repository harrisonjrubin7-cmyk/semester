// Contract tests for access revocation and tenant boundaries. The TraceContext
// checks exercise the shared validator; revocation at runtime is not verified here.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { validateTraceContext, toRequestLogFields, type TraceContext } from "../../packages/observability/trace-context.ts";

const root = process.cwd();
const load = (p: string) => parse(readFileSync(`${root}/${p}`, "utf8"));

const base: TraceContext = {
  correlationId: "c-1",
  capabilityId: "student.action-center",
  releaseId: "REL-READINESS-001",
  actorType: "student",
  environment: "staging",
  tenantId: "tenant-synthetic-a",
};

test("access_revocation is a P0 blocker for all activation", () => {
  const rel = load("evidence/acceptance/REL-READINESS-001.yaml").release_acceptance;
  const row = rel.matrix.find((r: { test: string }) => r.test === "access_revocation");
  assert.equal(row.priority, "P0");
  assert.equal(row.outcome, "block_all_activation");
});

test("tenant_isolation is a P0 blocker for all activation", () => {
  const rel = load("evidence/acceptance/REL-READINESS-001.yaml").release_acceptance;
  const row = rel.matrix.find((r: { test: string }) => r.test === "tenant_isolation");
  assert.equal(row.priority, "P0");
  assert.equal(row.outcome, "block_all_activation");
});

test("a valid trace context has no violations", () => {
  assert.deepEqual(validateTraceContext(base), []);
});

test("a production context without a tenant is rejected", () => {
  const violations = validateTraceContext({ ...base, environment: "production", tenantId: undefined });
  assert.ok(violations.some((v) => v.field === "tenantId"));
});

test("unknown actor types and environments are rejected", () => {
  const violations = validateTraceContext({ ...base, actorType: "root", environment: "dev" });
  assert.ok(violations.some((v) => v.field === "actorType"));
  assert.ok(violations.some((v) => v.field === "environment"));
});

test("a trace context without a release id is a violation", () => {
  const { releaseId: _omitted, ...withoutRelease } = base;
  assert.ok(validateTraceContext(withoutRelease).some((v) => v.field === "releaseId"));
});

test("request log fields refuse a raw identifier as actor scope", () => {
  for (const actorScope of ["jane.doe@example.edu", "9f1c2a4e-7b3d-4c1a-9e2f-000000000001"]) {
    assert.throws(() => toRequestLogFields(base, {
      timestamp: "2026-10-15T00:00:00Z", actorScope, routeOrCommand: "GET /x",
      policyDecisionId: "pd-1", resultCode: "allowed", latencyBucket: "<100ms",
    }), /role:qualifier/);
  }
});

test("request log fields carry actor scope, never a raw identity", () => {
  const fields = toRequestLogFields(base, {
    timestamp: "2026-10-15T00:00:00Z",
    actorScope: "student:self",
    routeOrCommand: "GET /action-center",
    policyDecisionId: "pd-1",
    resultCode: "allowed",
    latencyBucket: "<100ms",
  });
  assert.equal(fields.actor_scope_not_raw_sensitive_identity, "student:self");
  assert.equal(fields.correlation_id, "c-1");
  assert.ok(!("email" in fields) && !("userId" in fields));
});
