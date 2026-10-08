import { decideCapability } from "./capability-guard";
import type { AdapterRunResult, AdapterTask, BenchmarkAdapter, CapabilityDecision, EvidenceReport } from "./types";
import { evaluatePersistenceFacts, type PersistenceVerdict } from "../probes/persistence";
import { findSecretLeaks, scoreSourceStructure } from "../probes/source-structure";
import type { RunRecord } from "../types";
import { PLATFORMS, type PlatformId } from "@/lib/workflow-router/platforms";

/**
 * Shared behavior for the three honest adapters. Subclasses only supply the
 * platform id and the manual protocol: there is deliberately no network code.
 */
export abstract class ManualAdapter implements BenchmarkAdapter {
  abstract readonly platform: PlatformId;
  abstract manualProtocol(task: AdapterTask): string[];

  canRun(task: AdapterTask): CapabilityDecision {
    return decideCapability(this.platform, task);
  }

  async run(task: AdapterTask): Promise<AdapterRunResult> {
    const decision = this.canRun(task);
    if (decision.disposition === "unsupported") return this.reportUnsupported(task, decision.reason);
    return {
      platform: this.platform,
      taskId: task.id,
      status: "manual-review-required",
      executedPrompt: task.prompt,
      limitations: [decision.reason],
      manualProtocol: this.manualProtocol(task),
    };
  }

  reportUnsupported(task: AdapterTask, reason: string): AdapterRunResult {
    return {
      platform: this.platform,
      taskId: task.id,
      status: "unsupported",
      executedPrompt: task.prompt,
      limitations: [reason],
      manualProtocol: this.manualProtocol(task),
    };
  }

  collectEvidence(run: RunRecord, task: AdapterTask, files?: Array<{ path: string; content: string }>): EvidenceReport {
    const notes: string[] = [];
    const promptMatches = run.executedPrompt.trim() === task.prompt.trim();
    if (!promptMatches) notes.push("Executed prompt differs from the canonical prompt: the run is not comparable.");
    if (!run.outputUrl) notes.push("No output URL recorded.");
    if (run.sourceManifest.length === 0) notes.push("No source/file manifest recorded.");
    const sourceStructure = files && files.length ? scoreSourceStructure(files) : null;
    if (!sourceStructure) notes.push("No source files supplied: static structure probe skipped.");
    return {
      promptMatchesCanonical: promptMatches,
      hasOutputUrl: Boolean(run.outputUrl),
      hasSourceManifest: run.sourceManifest.length > 0,
      hasConsoleNotes: Boolean(run.consoleNotes?.trim()),
      sourceStructure,
      secretLeaks: files ? findSecretLeaks(files) : [],
      notes,
    };
  }

  evaluatePersistence(run: RunRecord, task: AdapterTask): PersistenceVerdict {
    return evaluatePersistenceFacts(
      {
        required: task.requiresPersistence,
        tested: run.persistenceTested,
        survivedReload: run.persistenceSurvivedReload,
        mode: run.persistenceMode,
        hasEvidence: Boolean(run.persistenceEvidence?.trim() || run.persistenceEvidenceUrl?.trim()),
      },
      run.persistenceFailureNotes,
    );
  }

  protected commonProtocol(task: AdapterTask): string[] {
    return [
      `Open a FRESH session on ${PLATFORMS[this.platform].name} (no prior context).`,
      `Paste the canonical prompt for workflow ${task.number} verbatim; do not edit it. The harness stores the exact text you executed.`,
      "Record the model name and version shown by the product, and note the date.",
    ];
  }
}
