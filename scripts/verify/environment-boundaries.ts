// Verifies docs/architecture/environments.yaml against the environment-boundary rules
// (local never holds production data; preview requires expiry and no production
// credentials; staging requires production-like RLS).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

export type Violation = { environment: string; reason: string };

const PROHIBITED_LOCAL = ["production_student_records", "production_secrets", "institution_export_files"];
const PREVIEW_REQUIRED = ["per_change_expiry", "no_production_connector_credentials"];
const STAGING_REQUIRED = ["production_like_policy_and_RLS"];
const PRODUCTION_REQUIRED = ["tenant_isolation", "audited_access", "release_gate", "secrets_management", "monitoring", "backup_and_recovery"];

export function verifyEnvironments(doc: { environments?: Record<string, { permitted_data?: string[]; prohibited_data?: string[]; requirements?: string[] }> }): Violation[] {
  const envs = doc.environments ?? {};
  const out: Violation[] = [];
  const need = (name: string, list: string[] | undefined, required: string[]) => {
    for (const r of required) {
      if (!list || !list.includes(r)) out.push({ environment: name, reason: `missing requirement: ${r}` });
    }
  };
  const local = envs.local;
  if (!local) out.push({ environment: "local", reason: "environment missing" });
  else for (const p of PROHIBITED_LOCAL) {
    if (!local.prohibited_data?.includes(p)) out.push({ environment: "local", reason: `must prohibit ${p}` });
    if (local.permitted_data?.includes(p)) out.push({ environment: "local", reason: `permits ${p}` });
  }
  need("preview", envs.preview?.requirements, PREVIEW_REQUIRED);
  need("staging", envs.staging?.requirements, STAGING_REQUIRED);
  need("production", envs.production?.requirements, PRODUCTION_REQUIRED);
  if (envs.production?.permitted_data?.some((d) => d.includes("synthetic"))) {
    out.push({ environment: "production", reason: "production must not permit synthetic-only data as its basis" });
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const doc = parse(readFileSync(join(process.cwd(), "docs/architecture/environments.yaml"), "utf8"));
  const violations = verifyEnvironments(doc);
  console.log(`environment boundary violations: ${violations.length}`);
  for (const v of violations) console.error(`${v.environment}: ${v.reason}`);
  process.exit(violations.length > 0 ? 1 : 0);
}
