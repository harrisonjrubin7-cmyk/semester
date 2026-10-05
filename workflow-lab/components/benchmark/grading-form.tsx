"use client";

import { useActionState } from "react";
import { submitGrade } from "@/app/benchmark/actions";
import { ActionMessage, Field, SubmitButton, fieldError, inputClass } from "@/components/ui/form-bits";
import type { ActionState } from "@/lib/actions/types";
import { CRITERIA, CRITERION_HELP, CRITERION_LABELS, SCORE_LABELS } from "@/lib/benchmark/benchmark.config";
import type { PersistenceCeiling } from "@/lib/benchmark/probes/persistence";
import type { GradeRecord, RunRecord, TaskRecord } from "@/lib/benchmark/types";

export function GradingForm({ run, task, mine, ceiling }: {
  run: RunRecord;
  task: TaskRecord;
  /** The signed-in user's existing grade for this run, if any. */
  mine: GradeRecord | null;
  ceiling: PersistenceCeiling;
}) {
  const [state, action] = useActionState<ActionState, FormData>(submitGrade, null);

  return (
    <form action={action} className="space-y-4" noValidate key={mine?.id ?? "new"}>
      <input type="hidden" name="runId" value={run.id} />
      <p className="text-sm text-muted">Score 0–5 per criterion. Leave a criterion on “not scored” if you cannot judge it. Only complete results are ranked.</p>

      <div className="space-y-3">
        {CRITERIA.map((c) => {
          const weight = task.weights[c];
          const isPersistence = c === "persistence";
          const err = fieldError(state, c);
          return (
            <div key={c} className={`rounded-lg border border-line p-3 ${weight === 0 ? "opacity-70" : ""}`}>
              <div className="grid gap-3 sm:grid-cols-[1fr_16rem] sm:items-start">
                <div>
                  <label htmlFor={c} className="text-sm font-semibold">{CRITERION_LABELS[c]}</label>
                  <span className="ml-2 text-xs text-muted">{weight === 0 ? "weight 0% (not counted)" : `weight ${weight}%`}</span>
                  <p className="text-xs text-muted">{CRITERION_HELP[c]}</p>
                  {isPersistence && task.requiresPersistence && (
                    <p className="mt-1 text-xs text-warn">Maximum {ceiling.ceiling} — {ceiling.reason}</p>
                  )}
                </div>
                <select id={c} name={c} defaultValue={mine?.scores[c] ?? ""} className={inputClass} aria-describedby={err ? `${c}-error` : undefined}>
                  <option value="">Not scored</option>
                  {SCORE_LABELS.map((label, n) => (
                    <option key={n} value={n} disabled={isPersistence && task.requiresPersistence && n > ceiling.ceiling}>{label}</option>
                  ))}
                </select>
              </div>
              {err && <p id={`${c}-error`} role="alert" className="mt-1 text-xs text-bad">{err}</p>}
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-muted">Evidence note for {CRITERION_LABELS[c].toLowerCase()}</summary>
                <label htmlFor={`notes_${c}`} className="sr-only">Note for {CRITERION_LABELS[c]}</label>
                <textarea id={`notes_${c}`} name={`notes_${c}`} rows={2} defaultValue={mine?.criterionNotes[c] ?? ""} className={`${inputClass} mt-1`} />
              </details>
            </div>
          );
        })}
      </div>

      <Field label="Evidence URLs (one per line)" name="evidenceUrls" error={fieldError(state, "evidenceUrls")} hint="Screenshots, recordings, repositories, test logs.">
        <textarea id="evidenceUrls" name="evidenceUrls" rows={3} defaultValue={(mine?.evidenceUrls ?? []).join("\n")} className={`${inputClass} font-mono text-xs`} />
      </Field>
      <Field label="Evaluator notes" name="evaluatorNotes" error={fieldError(state, "evaluatorNotes")}>
        <textarea id="evaluatorNotes" name="evaluatorNotes" rows={4} defaultValue={mine?.evaluatorNotes ?? ""} className={inputClass} />
      </Field>
      <SubmitButton>{mine ? "Update my grade" : "Save grade"}</SubmitButton>
      <ActionMessage state={state} />
    </form>
  );
}
