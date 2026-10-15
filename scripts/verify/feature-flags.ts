// Verifies the feature-flag standard and every flag declared under registry/flags/.
// Rules come from registry/flags/feature-flag-standard.yaml.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

export type Violation = { file: string; reason: string };

export function verifyFlag(file: string, flag: Record<string, unknown>, standard: { required: string[]; effects: string[]; environments: string[] }): Violation[] {
  const out: Violation[] = [];
  for (const key of standard.required) {
    if (flag[key] === undefined || flag[key] === null || flag[key] === "") {
      out.push({ file, reason: `missing required metadata: ${key}` });
    }
  }
  if (flag.safe_off_effect !== undefined && !standard.effects.includes(String(flag.safe_off_effect))) {
    out.push({ file, reason: `safe_off_effect not in standard: ${String(flag.safe_off_effect)}` });
  }
  const envs = Array.isArray(flag.environment_scope) ? (flag.environment_scope as unknown[]).map(String) : [];
  for (const e of envs) {
    if (!standard.environments.includes(e)) out.push({ file, reason: `unknown environment_scope: ${e}` });
  }
  if (flag.owner === "" || flag.owner === undefined) out.push({ file, reason: "flag has no owner" });
  return out;
}

function loadStandard(root: string) {
  const doc = parse(readFileSync(join(root, "registry/flags/feature-flag-standard.yaml"), "utf8"));
  const ff = doc.feature_flags;
  return {
    required: ff.required_metadata as string[],
    effects: ff.safe_off_effects as string[],
    environments: ff.environments as string[],
  };
}

function flagFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...flagFiles(p));
    else if (name.endsWith(".yaml") && name !== "feature-flag-standard.yaml") out.push(p);
  }
  return out;
}

export function verifyFeatureFlags(root: string): { checked: number; violations: Violation[] } {
  const standard = loadStandard(root);
  const files = flagFiles(join(root, "registry/flags"));
  const violations: Violation[] = [];
  for (const f of files) {
    const doc = parse(readFileSync(f, "utf8")) ?? {};
    violations.push(...verifyFlag(f, doc.flag ?? doc, standard));
  }
  return { checked: files.length, violations };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = verifyFeatureFlags(process.cwd());
  console.log(`feature flags checked: ${result.checked}; violations: ${result.violations.length}`);
  for (const v of result.violations) console.error(`${v.file}: ${v.reason}`);
  process.exit(result.violations.length > 0 ? 1 : 0);
}
