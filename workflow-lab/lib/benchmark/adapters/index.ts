import { ChatGPTCanvasAdapter } from "./chatgpt-canvas.adapter";
import { ClaudeArtifactsAdapter } from "./claude-artifacts.adapter";
import type { BenchmarkAdapter } from "./types";
import { V0Adapter } from "./v0.adapter";
import type { PlatformId } from "@/lib/workflow-router/platforms";

export const ADAPTERS: Record<PlatformId, BenchmarkAdapter> = {
  "claude-artifacts": new ClaudeArtifactsAdapter(),
  "chatgpt-canvas": new ChatGPTCanvasAdapter(),
  v0: new V0Adapter(),
};

export function adapterFor(platform: PlatformId): BenchmarkAdapter {
  return ADAPTERS[platform];
}
