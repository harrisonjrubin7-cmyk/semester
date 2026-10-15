import { ManualAdapter } from "./base";
import type { AdapterTask } from "./types";

export class ChatGPTCanvasAdapter extends ManualAdapter {
  readonly platform = "chatgpt-canvas" as const;
  manualProtocol(task: AdapterTask): string[] {
    return [
      ...this.commonProtocol(task),
      "Confirm Canvas opened for this model; if the product surface has no Canvas, record that and mark the run failed rather than substituting plain chat.",
      "Export the result in its native format (Markdown / DOCX / PDF, or the detected code extension) and list it in the source manifest.",
      "For Python tasks, run the code in the Canvas console and paste the output into the console notes.",
      "Canvas is not a persistence layer: for tasks that require persistence record the mode honestly (usually none or local-preview).",
    ];
  }
}
