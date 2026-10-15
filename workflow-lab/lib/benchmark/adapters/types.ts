import type { TaskCapabilities } from "../benchmark.config";
import type { PersistenceVerdict } from "../probes/persistence";
import type { StaticProbeResult } from "../probes/source-structure";
import type { RunRecord, RunStatus, SourceManifestEntry } from "../types";
import type { PlatformId } from "@/lib/workflow-router/platforms";

/** What an adapter needs to know about a task. */
export type AdapterTask = {
  id: string;
  number: number;
  title: string;
  prompt: string;
  capabilities: TaskCapabilities;
  requiresPersistence: boolean;
};

export type CapabilityDecision = {
  /** true: an approved integration could run it. No integration is wired, so this is always false today. */
  supported: boolean;
  /** What the harness must do instead. */
  disposition: "manual-review-required" | "unsupported";
  reason: string;
  /** Boundary note for the grader, e.g. why persistence will score low on this platform. */
  boundaryNotice?: string;
};

export type AdapterRunResult = {
  platform: PlatformId;
  taskId: string;
  status: Extract<RunStatus, "manual-review-required" | "unsupported" | "completed" | "failed">;
  executedPrompt: string;
  outputUrl?: string;
  outputText?: string;
  sourceFiles?: SourceManifestEntry[];
  consoleOutput?: string;
  executionSeconds?: number;
  limitations: string[];
  /** Ordered steps a human follows to produce the run record. */
  manualProtocol?: string[];
  error?: string;
};

export type EvidenceReport = {
  promptMatchesCanonical: boolean;
  hasOutputUrl: boolean;
  hasSourceManifest: boolean;
  hasConsoleNotes: boolean;
  sourceStructure: StaticProbeResult | null;
  secretLeaks: string[];
  notes: string[];
};

export interface BenchmarkAdapter {
  readonly platform: PlatformId;
  canRun(task: AdapterTask): CapabilityDecision;
  run(task: AdapterTask): Promise<AdapterRunResult>;
  /** Inspect a recorded run (and optionally captured source) and return evidence for the grader. */
  collectEvidence(run: RunRecord, task: AdapterTask, files?: Array<{ path: string; content: string }>): EvidenceReport;
  evaluatePersistence(run: RunRecord, task: AdapterTask): PersistenceVerdict;
  reportUnsupported(task: AdapterTask, reason: string): AdapterRunResult;
  /** The ordered manual steps for producing a comparable run record. */
  manualProtocol(task: AdapterTask): string[];
}
