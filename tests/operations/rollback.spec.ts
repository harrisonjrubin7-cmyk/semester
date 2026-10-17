// Contract tests for safe-off and rollback. These verify the released policy
// artifacts and the runners' refusal behaviour. They do not exercise a running
// platform; live rollback proof needs the isolated environment (see PR notes).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { verifyFeatureFlags, verifyFlag } from "../../scripts/verify/feature-flags.ts";
import { verifyEnvironments } from "../../scripts/verify/environment-boundaries.ts";
import { decideRestore } from "../../scripts/recovery/restore.ts";

const root = process.cwd();
const load = (p: string) => parse(readFileSync(`${root}/${p}`, "utf8"));

test("REL-READINESS-001 treats safe_off as a P0 blocker", () => {
  const rel = load("evidence/acceptance/REL-READINESS-001.yaml").release_acceptance;
  const safeOff = rel.matrix.find((r: { test: string }) => r.test === "safe_off");
  assert.ok(safeOff, "safe_off row present");
  assert.equal(safeOff.priority, "P0");
  assert.equal(safeOff.outcome, "block_all_activation");
});

test("feature-flag standard requires a safe-off effect and a retirement lifecycle", () => {
  const std = load("registry/flags/feature-flag-standard.yaml").feature_flags;
  assert.ok(std.required_metadata.includes("safe_off_effect"));
  assert.ok(std.required_metadata.includes("rollback_runbook"));
  assert.ok(std.safe_off_effects.includes("full_capability_safe_off"));
  assert.equal(std.lifecycle.at(-1), "retired");
});

test("a flag without a safe-off effect or owner fails verification", () => {
  const std = load("registry/flags/feature-flag-standard.yaml").feature_flags;
  const standard = { required: std.required_metadata, effects: std.safe_off_effects, environments: std.environments };
  const violations = verifyFlag("bad.yaml", { flag_key: "x", owner: "" }, standard);
  assert.ok(violations.some((v) => v.reason.includes("safe_off_effect")));
  assert.ok(violations.some((v) => v.reason.includes("owner")));
});

test("the repository flag registry passes verification", () => {
  const result = verifyFeatureFlags(root);
  assert.deepEqual(result.violations, []);
});

test("environment boundaries hold for the released environments file", () => {
  assert.deepEqual(verifyEnvironments(load("docs/architecture/environments.yaml")), []);
});

test("restore refuses to run without a configured isolated environment", () => {
  const decision = decideRestore({ fixture: "tenant-synthetic-a", target: "isolated-recovery-environment" }, false);
  assert.equal(decision.allowed, false);
  assert.ok(decision.reasons.some((r) => r.includes("no isolated recovery environment")));
});
