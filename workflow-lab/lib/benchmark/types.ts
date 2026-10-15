import type { Criterion, TaskCapabilities, WeightPercents } from "./benchmark.config";
import type { PersistenceMode } from "./probes/persistence";
import type { PlatformId } from "@/lib/workflow-router/platforms";

export const RUN_STATUSES = ["queued", "running", "completed", "manual-review-required", "unsupported", "failed"] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export type SourceManifestEntry = { path: string; bytes?: number; language?: string; note?: string };

export type TaskRecord = {
  id: string;
  suiteId: string;
  number: number;
  slug: string;
  title: string;
  category: string;
  prompt: string;
  requirements: string[];
  capabilities: TaskCapabilities;
  acceptanceCriteria: string[];
  recommendedPlatform: PlatformId;
  weights: WeightPercents;
  requiresPersistence: boolean;
};

export type RunRecord = {
  id: string;
  taskId: string;
  suiteId: string;
  platform: PlatformId;
  attempt: number;
  status: RunStatus;
  executedPrompt: string;
  modelName: string | null;
  modelVersion: string | null;
  runtimeNotes: string | null;
  outputUrl: string | null;
  outputText: string | null;
  sourceManifest: SourceManifestEntry[];
  consoleNotes: string | null;
  durationSeconds: number | null;
  persistenceMode: PersistenceMode;
  persistenceTested: boolean;
  persistenceSurvivedReload: boolean | null;
  persistenceEvidence: string | null;
  persistenceEvidenceUrl: string | null;
  persistenceFailureNotes: string | null;
  recordedBy: string | null;
  createdAt: string;
};

export type GradeRecord = {
  id: string;
  runId: string;
  graderId: string;
  scores: Record<Criterion, number | null>;
  criterionNotes: Partial<Record<Criterion, string>>;
  evidenceUrls: string[];
  evaluatorNotes: string | null;
  createdAt: string;
};

export type SuiteRecord = {
  id: string;
  name: string;
  description: string | null;
  ownerId: string | null;
  organizationId: string | null;
  isTemplate: boolean;
  createdAt: string;
};

export type SuiteBundle = {
  suite: SuiteRecord;
  tasks: TaskRecord[];
  runs: RunRecord[];
  grades: GradeRecord[];
};
