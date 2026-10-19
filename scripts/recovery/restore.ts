// Recovery restore runner (docs/operations/recovery-plan.yaml).
//
// This runner validates the request and refuses unsafe targets. It does not
// restore data itself: no isolated recovery environment is provisioned for this
// repository. Without RECOVERY_TARGET_CONFIGURED=1 it exits non-zero and
// writes a refusal record, so no drill can be recorded as passed by accident.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const REQUIRED_TARGET = "isolated-recovery-environment";
const FIXTURE_PATTERN = /^tenant-synthetic-[a-z0-9-]+$/;

export type RestoreRequest = { fixture: string; target: string };
export type RestoreDecision = { allowed: boolean; reasons: string[] };

// Pure decision: the only function the tests exercise directly.
export function decideRestore(req: RestoreRequest, environmentConfigured: boolean): RestoreDecision {
  const reasons: string[] = [];
  if (!FIXTURE_PATTERN.test(req.fixture)) {
    reasons.push("fixture must be a synthetic tenant (tenant-synthetic-*); production tenants cannot be restored by this runner");
  }
  if (req.target !== REQUIRED_TARGET) {
    reasons.push(`target must be ${REQUIRED_TARGET}; restores never write to live environments first`);
  }
  if (!environmentConfigured) {
    reasons.push("no isolated recovery environment is configured (set RECOVERY_TARGET_CONFIGURED=1 once one exists)");
  }
  return { allowed: reasons.length === 0, reasons };
}

function parseArgs(argv: string[]): RestoreRequest {
  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] ?? "" : "";
  };
  return { fixture: get("--fixture"), target: get("--target") };
}

function main() {
  const req = parseArgs(process.argv.slice(2));
  const configured = process.env.RECOVERY_TARGET_CONFIGURED === "1";
  const decision = decideRestore(req, configured);
  const dir = join("evidence", "recovery");
  mkdirSync(dir, { recursive: true });
  const record = { at: new Date().toISOString(), operation: "restore", request: req, ...decision };
  writeFileSync(join(dir, `restore-${Date.now()}.json`), JSON.stringify(record, null, 2));
  if (!decision.allowed) {
    console.error("restore refused:");
    for (const r of decision.reasons) console.error(`  - ${r}`);
    process.exit(1);
  }
  // Reachable only when an isolated environment is configured. The restore
  // step itself is not implemented in this repository yet; see the PR notes.
  console.error("restore not executed: isolated recovery environment adapter is not implemented in this repository");
  process.exit(2);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
