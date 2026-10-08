import type { AdapterTask, CapabilityDecision } from "./types";
import { PLATFORMS, type PlatformId } from "@/lib/workflow-router/platforms";

export function requiresBackend(task: AdapterTask): boolean {
  const c = task.capabilities;
  return Boolean(c.serverCode || c.database || c.auth || c.rls || c.persistentState || c.multiTenant);
}

/**
 * Decide how a task can be executed on a platform.
 *
 * No platform has an approved programmatic integration in this repository, so
 * nothing is ever "supported" for automatic execution. The harness never calls
 * an undocumented endpoint: the answer is always manual-review-required or
 * unsupported, with the reason spelled out.
 */
export function decideCapability(platform: PlatformId, task: AdapterTask): CapabilityDecision {
  const name = PLATFORMS[platform].name;
  if (platform !== "v0" && requiresBackend(task)) {
    return {
      supported: false,
      disposition: "unsupported",
      reason:
        `${name} cannot execute this task as specified: it needs production-style server, database, authentication or persistent-state behavior, ` +
        `and a client-side preview is not equivalent. Automated execution is unsupported.`,
      boundaryNotice:
        "You may still record a MANUAL run to document how the platform handled the prompt. Expect low persistence and sandbox-fit scores, and do not award persistence for in-memory state.",
    };
  }
  return {
    supported: false,
    disposition: "manual-review-required",
    reason: `No approved programmatic integration for ${name} is configured. Run the canonical prompt manually in a fresh session and record the evidence.`,
  };
}
