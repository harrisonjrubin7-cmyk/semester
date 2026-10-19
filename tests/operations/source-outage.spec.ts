// Contract tests for source outage and stale-source behaviour. They check the
// required acceptance tests and recovery drills; live outage handling needs a
// running connector and is not verified here.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { decideRebuild } from "../../scripts/recovery/rebuild-projections.ts";

const root = process.cwd();
const load = (p: string) => parse(readFileSync(`${root}/${p}`, "utf8"));

test("stale authoritative source is P0 and blocks the affected path", () => {
  const rel = load("evidence/acceptance/REL-READINESS-001.yaml").release_acceptance;
  const row = rel.matrix.find((r: { test: string }) => r.test === "stale_source_behavior");
  assert.ok(row, "stale_source_behavior row present");
  assert.equal(row.priority, "P0");
  assert.equal(row.outcome, "block_affected_path");
});

test("out-of-order source events are P1 and block connector activation", () => {
  const rel = load("evidence/acceptance/REL-READINESS-001.yaml").release_acceptance;
  const row = rel.matrix.find((r: { test: string }) => r.test === "out_of_order_event");
  assert.equal(row.priority, "P1");
  assert.equal(row.outcome, "block_connector_activation");
});

test("recovery verification sequence includes source-authority reconciliation", () => {
  const rec = load("docs/operations/recovery-plan.yaml").recovery;
  assert.ok(rec.verification_sequence.includes("pnpm test:source-authority"));
  assert.ok(rec.verification_sequence.some((s: string) => s.includes("recovery:reconcile")));
});

test("projection rebuild refuses non-synthetic tenants and missing environments", () => {
  assert.equal(decideRebuild("acme-university", true).allowed, false);
  assert.equal(decideRebuild("tenant-synthetic-a", false).allowed, false);
});
