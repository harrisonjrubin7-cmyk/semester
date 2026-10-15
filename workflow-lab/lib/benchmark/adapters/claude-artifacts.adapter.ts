import { ManualAdapter } from "./base";
import type { AdapterTask } from "./types";

export class ClaudeArtifactsAdapter extends ManualAdapter {
  readonly platform = "claude-artifacts" as const;
  manualProtocol(task: AdapterTask): string[] {
    return [
      ...this.commonProtocol(task),
      "Let the artifact render. Record whether it rendered without errors and copy any console errors into the console notes.",
      "Copy the artifact's source (HTML / JSX / SVG / Mermaid) and list its files in the source manifest; add the share link as the output URL if one exists.",
      "Exercise the task's acceptance criteria. Reload the artifact: if state resets, record persistence as local-preview and survived-reload = false.",
      "Do not treat in-artifact state as persistence for tasks that require durable records.",
    ];
  }
}
