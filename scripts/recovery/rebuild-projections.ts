// Read-model rebuild runner (docs/operations/recovery-plan.yaml, drill rebuild_read_model).
// Same contract as restore.ts: validates the tenant, refuses without a configured
// isolated environment, and never reports a rebuild as done unless one ran.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const TENANT_PATTERN = /^tenant-synthetic-[a-z0-9-]+$/;

export function decideRebuild(tenant: string, environmentConfigured: boolean): { allowed: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!TENANT_PATTERN.test(tenant)) {
    reasons.push("tenant must be a synthetic tenant (tenant-synthetic-*) until the isolated environment is verified");
  }
  if (!environmentConfigured) {
    reasons.push("no isolated recovery environment is configured (set RECOVERY_TARGET_CONFIGURED=1 once one exists)");
  }
  return { allowed: reasons.length === 0, reasons };
}

function main() {
  const i = process.argv.indexOf("--tenant");
  const tenant = i >= 0 ? process.argv[i + 1] ?? "" : "";
  const decision = decideRebuild(tenant, process.env.RECOVERY_TARGET_CONFIGURED === "1");
  const dir = join("evidence", "recovery");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, `rebuild-${Date.now()}.json`),
    JSON.stringify({ at: new Date().toISOString(), operation: "rebuild-projections", tenant, ...decision }, null, 2),
  );
  if (!decision.allowed) {
    console.error("rebuild refused:");
    for (const r of decision.reasons) console.error(`  - ${r}`);
    process.exit(1);
  }
  console.error("rebuild not executed: projection rebuild adapter is not implemented in this repository");
  process.exit(2);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
