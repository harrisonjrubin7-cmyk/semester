import { ManualAdapter } from "./base";
import type { AdapterTask } from "./types";

export class V0Adapter extends ManualAdapter {
  readonly platform = "v0" as const;
  manualProtocol(task: AdapterTask): string[] {
    return [
      ...this.commonProtocol(task),
      "Wait for the generation to finish; record the preview/chat URL as the output URL.",
      "Export or download the project and record the file manifest (path, size).",
      "Install, typecheck, lint and build the exported project; paste results into the console notes.",
      task.requiresPersistence
        ? "Run the persistence test: create data, hard-reload, open a fresh session, and record where the data lives (row id, screenshot or log). A preview that only holds state in memory is not database persistence."
        : "No persistence test is required for this task; record that it was not required.",
      "v0 output is not production-ready until migrations, RLS, tests and environment variables are verified in your own repository.",
    ];
  }
}
