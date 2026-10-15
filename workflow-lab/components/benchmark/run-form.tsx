"use client";

import { useActionState, useState } from "react";
import { saveRun } from "@/app/benchmark/actions";
import { ActionMessage, Field, SubmitButton, fieldError, inputClass } from "@/components/ui/form-bits";
import type { ActionState } from "@/lib/actions/types";
import { PERSISTENCE_MODES, PERSISTENCE_MODE_HELP } from "@/lib/benchmark/probes/persistence";
import { RUN_STATUSES, type RunRecord, type TaskRecord } from "@/lib/benchmark/types";
import type { PlatformId } from "@/lib/workflow-router/platforms";

const manifestToText = (m: RunRecord["sourceManifest"]) => m.map((e) => [e.path, e.bytes ?? "", e.language ?? "", e.note ?? ""].join(" | ").replace(/( \| )+$/, "")).join("\n");
const tri = (v: boolean | null | undefined) => (v === true ? "true" : v === false ? "false" : "");

export function RunForm({ suiteId, task, platform, run, nextAttempt }: {
  suiteId: string;
  task: TaskRecord;
  platform: PlatformId;
  /** Existing run being edited, if any. */
  run: RunRecord | null;
  nextAttempt: number;
}) {
  const [state, action] = useActionState<ActionState, FormData>(saveRun, null);
  const [prompt, setPrompt] = useState(run?.executedPrompt ?? task.prompt);
  const [tested, setTested] = useState(run?.persistenceTested ?? false);
  const differs = prompt.trim() !== task.prompt.trim();

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="suiteId" value={suiteId} />
      <input type="hidden" name="taskId" value={task.id} />
      <input type="hidden" name="platform" value={platform} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Attempt" name="attempt" error={fieldError(state, "attempt")} hint={run ? "Editing this attempt." : "Use a new attempt number to record a re-run."}>
          <input id="attempt" name="attempt" type="number" min={1} max={50} defaultValue={run?.attempt ?? nextAttempt} readOnly={Boolean(run)} className={inputClass} />
        </Field>
        <Field label="Run status" name="status" error={fieldError(state, "status")}>
          <select id="status" name="status" defaultValue={run?.status ?? "manual-review-required"} className={inputClass}>
            {RUN_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
      </div>

      <Field label="Exact executed prompt" name="executedPrompt" error={fieldError(state, "executedPrompt")} hint="Paste exactly what you ran. It is stored verbatim and never rewritten.">
        <textarea id="executedPrompt" name="executedPrompt" rows={5} value={prompt} onChange={(e) => setPrompt(e.target.value)} className={`${inputClass} font-mono text-xs`} />
      </Field>
      {differs && (
        <p role="status" className="rounded-md bg-warn-soft px-3 py-2 text-xs text-warn">
          This differs from the canonical prompt. It will be saved as written, but the run is not comparable with runs that used the canonical prompt.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Model name" name="modelName" error={fieldError(state, "modelName")}><input id="modelName" name="modelName" defaultValue={run?.modelName ?? ""} className={inputClass} placeholder="as shown by the product" /></Field>
        <Field label="Model version" name="modelVersion" error={fieldError(state, "modelVersion")}><input id="modelVersion" name="modelVersion" defaultValue={run?.modelVersion ?? ""} className={inputClass} /></Field>
        <Field label="Output URL" name="outputUrl" error={fieldError(state, "outputUrl")}><input id="outputUrl" name="outputUrl" type="url" defaultValue={run?.outputUrl ?? ""} className={inputClass} placeholder="https://…" /></Field>
        <Field label="Execution duration (seconds)" name="durationSeconds" error={fieldError(state, "durationSeconds")}><input id="durationSeconds" name="durationSeconds" type="number" min={0} step="any" defaultValue={run?.durationSeconds ?? ""} className={inputClass} /></Field>
      </div>

      <Field label="Runtime / sandbox notes" name="runtimeNotes" error={fieldError(state, "runtimeNotes")}>
        <textarea id="runtimeNotes" name="runtimeNotes" rows={2} defaultValue={run?.runtimeNotes ?? ""} className={inputClass} />
      </Field>
      <Field label="Console / log notes" name="consoleNotes" error={fieldError(state, "consoleNotes")}>
        <textarea id="consoleNotes" name="consoleNotes" rows={3} defaultValue={run?.consoleNotes ?? ""} className={`${inputClass} font-mono text-xs`} />
      </Field>
      <Field label="Output source / file manifest" name="sourceManifest" error={fieldError(state, "sourceManifest")} hint="One file per line: path | bytes | language | note (all but path optional).">
        <textarea id="sourceManifest" name="sourceManifest" rows={4} defaultValue={manifestToText(run?.sourceManifest ?? [])} className={`${inputClass} font-mono text-xs`} placeholder="app/page.tsx | 2310 | tsx" />
      </Field>
      <details>
        <summary className="cursor-pointer text-sm font-medium">Captured output text (optional)</summary>
        <div className="mt-2">
          <label htmlFor="outputText" className="sr-only">Captured output text</label>
          <textarea id="outputText" name="outputText" rows={6} defaultValue={run?.outputText ?? ""} className={`${inputClass} font-mono text-xs`} />
        </div>
      </details>

      <fieldset className="space-y-3 rounded-lg border border-line p-4">
        <legend className="px-1 text-sm font-semibold">State persistence test</legend>
        {task.requiresPersistence ? (
          <p className="text-xs text-warn">This workflow REQUIRES persistence. The persistence grade is capped by what is recorded here.</p>
        ) : (
          <p className="text-xs text-muted">Persistence is not required for this workflow; record it only if you tested it.</p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Storage mode" name="persistenceMode" error={fieldError(state, "persistenceMode")}>
            <select id="persistenceMode" name="persistenceMode" defaultValue={run?.persistenceMode ?? "none"} className={inputClass} aria-describedby="mode-help">
              {PERSISTENCE_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <div className="space-y-1">
            <span className="block text-sm font-medium">Was persistence tested?</span>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="persistenceTested" value="true" checked={tested} onChange={(e) => setTested(e.target.checked)} />
              Yes, I reloaded / opened a fresh session
            </label>
          </div>
          <Field label="Did state survive the reload?" name="persistenceSurvivedReload" error={fieldError(state, "persistenceSurvivedReload")}>
            <select id="persistenceSurvivedReload" name="persistenceSurvivedReload" defaultValue={tri(run?.persistenceSurvivedReload)} disabled={!tested} className={inputClass}>
              <option value="">Not recorded</option>
              <option value="true">Yes — it survived</option>
              <option value="false">No — it was lost</option>
            </select>
          </Field>
          <Field label="Evidence URL" name="persistenceEvidenceUrl" error={fieldError(state, "persistenceEvidenceUrl")}>
            <input id="persistenceEvidenceUrl" name="persistenceEvidenceUrl" type="url" defaultValue={run?.persistenceEvidenceUrl ?? ""} className={inputClass} placeholder="screenshot, log or row link" />
          </Field>
        </div>
        <Field label="Evidence (row identifier, screenshot reference or test log)" name="persistenceEvidence" error={fieldError(state, "persistenceEvidence")}>
          <textarea id="persistenceEvidence" name="persistenceEvidence" rows={2} defaultValue={run?.persistenceEvidence ?? ""} className={inputClass} />
        </Field>
        <Field label="Failure notes" name="persistenceFailureNotes" error={fieldError(state, "persistenceFailureNotes")}>
          <textarea id="persistenceFailureNotes" name="persistenceFailureNotes" rows={2} defaultValue={run?.persistenceFailureNotes ?? ""} className={inputClass} />
        </Field>
        <p id="mode-help" className="text-xs text-muted">
          {PERSISTENCE_MODES.map((m) => `${m}: ${PERSISTENCE_MODE_HELP[m]}`).join(" ")}
        </p>
      </fieldset>

      <div className="flex items-center gap-3">
        <SubmitButton>{run ? "Update run" : "Record run"}</SubmitButton>
      </div>
      <ActionMessage state={state} />
    </form>
  );
}
