/**
 * Persistence classification and the grading ceiling it imposes.
 *
 * A UI that holds state in memory is not persistent. When a task requires
 * persistence, the best persistence grade a run can earn is capped by what was
 * actually tested: whether the test happened, whether state survived a reload,
 * and how it was stored. The same rule is enforced in the database
 * (private.persistence_ceiling in 002_benchmark_grading.sql); tests keep the
 * two in step.
 */
export const PERSISTENCE_MODES = ["none", "local-preview", "browser-local", "session", "database", "project-backed"] as const;
export type PersistenceMode = (typeof PERSISTENCE_MODES)[number];

export const PERSISTENCE_MODE_HELP: Record<PersistenceMode, string> = {
  none: "No state is kept.",
  "local-preview": "In-memory state inside the platform's preview; lost when the preview reloads.",
  "browser-local": "localStorage / IndexedDB in the viewer's browser; survives reload, not shared or durable.",
  session: "sessionStorage or a session cookie; survives reload, lost when the session ends.",
  database: "Rows in a real database, readable after a fresh session.",
  "project-backed": "Persisted by a deployable project (server, database and migrations) rather than the preview.",
};

const MODE_CAP: Record<PersistenceMode, number> = {
  none: 0,
  "local-preview": 1,
  session: 2,
  "browser-local": 3,
  database: 5,
  "project-backed": 5,
};

export type PersistenceFacts = {
  required: boolean;
  tested: boolean;
  survivedReload: boolean | null | undefined;
  mode: PersistenceMode;
  /** An evidence URL, row identifier, screenshot reference or test log was recorded. */
  hasEvidence: boolean;
};

export type PersistenceCeiling = { ceiling: number; reason: string };

export function persistenceCeiling(f: PersistenceFacts): PersistenceCeiling {
  if (!f.required) return { ceiling: 5, reason: "Persistence is not required for this task." };
  if (!f.tested) return { ceiling: 0, reason: "Persistence is required but no persistence test was recorded." };
  const modeCap = MODE_CAP[f.mode];
  if (f.survivedReload !== true) {
    const cap = Math.min(1, modeCap);
    return {
      ceiling: cap,
      reason:
        f.survivedReload === false
          ? `State did not survive a reload (storage mode: ${f.mode}).`
          : "The reload test is incomplete: survival was not recorded.",
    };
  }
  if ((f.mode === "database" || f.mode === "project-backed") && !f.hasEvidence)
    return { ceiling: 3, reason: "Durable storage was claimed without evidence (URL, row identifier, screenshot or log)." };
  return { ceiling: modeCap, reason: `State survived a reload via ${f.mode}.` };
}

export type PersistenceVerdict = {
  passed: boolean;
  score: number;
  ceiling: number;
  evidence: string[];
};

/** Deterministic probe verdict from recorded facts (the suggested score is the ceiling). */
export function evaluatePersistenceFacts(f: PersistenceFacts, notes?: string | null): PersistenceVerdict {
  const { ceiling, reason } = persistenceCeiling(f);
  const evidence = [reason];
  if (f.required && f.tested && !f.hasEvidence) evidence.push("No evidence artifact was attached.");
  if (notes) evidence.push(notes);
  return { passed: !f.required || ceiling >= 3, score: ceiling, ceiling, evidence };
}

export function clampPersistenceGrade(grade: number, c: PersistenceCeiling): { value: number; clamped: boolean } {
  return grade > c.ceiling ? { value: c.ceiling, clamped: true } : { value: grade, clamped: false };
}
