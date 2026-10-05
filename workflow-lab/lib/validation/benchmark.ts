import { z } from "zod";
import { CRITERIA } from "@/lib/benchmark/benchmark.config";
import { PERSISTENCE_MODES } from "@/lib/benchmark/probes/persistence";
import { RUN_STATUSES } from "@/lib/benchmark/types";
import { PLATFORM_IDS } from "@/lib/workflow-router/platforms";
import { blankToUndefined, httpUrl, optionalHttpUrl, optionalText, tristate } from "./common";

export const createSuiteSchema = z.object({
  name: z.preprocess(blankToUndefined, z.string().trim().min(1).max(200).optional()),
  organizationId: z.preprocess(blankToUndefined, z.uuid().optional()),
});

export type ManifestEntry = { path: string; bytes?: number; language?: string; note?: string };

/**
 * One file per line: `path` or `path | bytes | language | note`.
 * Returns the entries plus a list of line-level problems.
 */
export function parseManifest(text: string): { entries: ManifestEntry[]; problems: string[] } {
  const entries: ManifestEntry[] = [];
  const problems: string[] = [];
  text.split(/\r?\n/).forEach((raw, idx) => {
    const line = raw.trim();
    if (!line) return;
    const [path, bytes, language, note] = line.split("|").map((p) => p.trim());
    if (!path || path.length > 500) return void problems.push(`Line ${idx + 1}: file path is missing or too long.`);
    const entry: ManifestEntry = { path };
    if (bytes) {
      const n = Number(bytes);
      if (!Number.isFinite(n) || n < 0) return void problems.push(`Line ${idx + 1}: bytes must be a non-negative number.`);
      entry.bytes = n;
    }
    if (language) entry.language = language.slice(0, 40);
    if (note) entry.note = note.slice(0, 300);
    entries.push(entry);
  });
  if (entries.length > 500) problems.push("At most 500 files may be listed.");
  return { entries, problems };
}

const manifestText = z.preprocess(
  (v) => (typeof v === "string" ? v : ""),
  z.string().max(60000).transform((text, ctx) => {
    const { entries, problems } = parseManifest(text);
    for (const p of problems) ctx.addIssue({ code: "custom", message: p });
    return entries;
  }),
);

export const runSchema = z
  .object({
    suiteId: z.uuid(),
    taskId: z.uuid(),
    platform: z.enum(PLATFORM_IDS),
    attempt: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(50).default(1)),
    status: z.enum(RUN_STATUSES),
    executedPrompt: z.string().trim().min(1, "Paste the exact prompt you executed").max(50000),
    modelName: optionalText(200),
    modelVersion: optionalText(200),
    runtimeNotes: optionalText(10000),
    outputUrl: optionalHttpUrl,
    outputText: optionalText(200000),
    sourceManifest: manifestText,
    consoleNotes: optionalText(20000),
    durationSeconds: z.preprocess(blankToUndefined, z.coerce.number().min(0).max(86400 * 7).optional()),
    persistenceMode: z.enum(PERSISTENCE_MODES).default("none"),
    persistenceTested: tristate.transform((v) => v ?? false),
    persistenceSurvivedReload: tristate,
    persistenceEvidence: optionalText(10000),
    persistenceEvidenceUrl: optionalHttpUrl,
    persistenceFailureNotes: optionalText(10000),
  })
  .superRefine((v, ctx) => {
    if (!v.persistenceTested && v.persistenceSurvivedReload !== undefined)
      ctx.addIssue({ code: "custom", path: ["persistenceSurvivedReload"], message: "Survival can only be recorded when persistence was tested." });
    if (!v.persistenceTested && (v.persistenceMode === "database" || v.persistenceMode === "project-backed") && v.status === "completed")
      ctx.addIssue({ code: "custom", path: ["persistenceMode"], message: "A durable storage mode was claimed but persistence was not tested." });
    if (v.persistenceTested && v.persistenceSurvivedReload === false && !v.persistenceFailureNotes && !v.persistenceEvidence)
      ctx.addIssue({ code: "custom", path: ["persistenceFailureNotes"], message: "Describe what failed (or attach evidence) when state did not survive a reload." });
  });
export type RunInput = z.infer<typeof runSchema>;

const score = z.preprocess(blankToUndefined, z.coerce.number().int().min(0, "Scores are 0-5").max(5, "Scores are 0-5").optional());

export function parseUrlLines(text: string): { urls: string[]; problems: string[] } {
  const urls: string[] = [];
  const problems: string[] = [];
  text.split(/\r?\n/).forEach((raw, idx) => {
    const line = raw.trim();
    if (!line) return;
    const r = httpUrl.safeParse(line);
    if (r.success) urls.push(r.data);
    else problems.push(`Evidence line ${idx + 1} is not an http(s) URL.`);
  });
  if (urls.length > 20) problems.push("At most 20 evidence URLs.");
  return { urls, problems };
}

export const gradeSchema = z
  .object({
    runId: z.uuid(),
    correctness: score,
    code_quality: score,
    rendering: score,
    state_management: score,
    maintainability: score,
    handoff: score,
    sandbox_fit: score,
    persistence: score,
    notes_correctness: optionalText(2000),
    notes_code_quality: optionalText(2000),
    notes_rendering: optionalText(2000),
    notes_state_management: optionalText(2000),
    notes_maintainability: optionalText(2000),
    notes_handoff: optionalText(2000),
    notes_sandbox_fit: optionalText(2000),
    notes_persistence: optionalText(2000),
    evidenceUrls: z.preprocess(
      (v) => (typeof v === "string" ? v : ""),
      z.string().max(10000).transform((text, ctx) => {
        const { urls, problems } = parseUrlLines(text);
        for (const p of problems) ctx.addIssue({ code: "custom", message: p });
        return urls;
      }),
    ),
    evaluatorNotes: optionalText(10000),
  })
  .superRefine((v, ctx) => {
    if (!CRITERIA.some((c) => v[c] !== undefined))
      ctx.addIssue({ code: "custom", path: ["correctness"], message: "Enter at least one score." });
  });
export type GradeInput = z.infer<typeof gradeSchema>;
