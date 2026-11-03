// Contract tests for safe-off and rollback. These verify the released policy
// artifacts and the runners' refusal behaviour. They do not exercise a running
// platform; live rollback proof needs the isolated environment (see PR notes).

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

// The committed registry holds only the standard, which discovery excludes, so the
// verifier must reject it rather than pass with zero records checked. Flip this when
// real flag records are added to registry/flags.
test("the committed flag registry is rejected while it holds no records", () => {
  const result = verifyFeatureFlags(root);
  assert.equal(result.checked, 0);
  assert.deepEqual(result.violations.map((v) => v.reason), ["no flag records discovered"]);
});

test("a populated flag registry passes verification", () => {
  const standard = parse(readFileSync(join(root, "registry/flags/feature-flag-standard.yaml"), "utf8")).feature_flags;
  const dir = mkdtempSync(join(tmpdir(), "flags-"));
  mkdirSync(join(dir, "registry/flags"), { recursive: true });
  writeFileSync(join(dir, "registry/flags/feature-flag-standard.yaml"), readFileSync(join(root, "registry/flags/feature-flag-standard.yaml"), "utf8"));
  const record = Object.fromEntries(standard.required_metadata.map((k: string) => [k, `${k}-value`]));
  record.safe_off_effect = standard.safe_off_effects[0];
  record.environment_scope = [standard.environments[0]];
  writeFileSync(join(dir, "registry/flags/example.yaml"), `flag:\n${Object.entries(record).map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`).join("\n")}\n`);
  const result = verifyFeatureFlags(dir);
  rmSync(dir, { recursive: true, force: true });
  assert.equal(result.checked, 1);
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
