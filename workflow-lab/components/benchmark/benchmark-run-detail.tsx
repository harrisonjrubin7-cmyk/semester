"use client";

import { Badge, PlatformBadge, StatusBadge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import { ADAPTERS } from "@/lib/benchmark/adapters";
import { CRITERIA, CRITERION_LABELS } from "@/lib/benchmark/benchmark.config";
import { persistenceCeiling } from "@/lib/benchmark/probes/persistence";
import type { TaskSummary } from "@/lib/benchmark/summary";
import type { GradeRecord, RunRecord, TaskRecord } from "@/lib/benchmark/types";
import { gradeSummaryText } from "@/lib/exports/markdown";
import { formatScore100, formatScore5 } from "@/lib/benchmark/scoring";
import { PLATFORMS, type PlatformId } from "@/lib/workflow-router/platforms";
import { GradingForm } from "./grading-form";
import { RunForm } from "./run-form";
import type { Viewer } from "./benchmark-dashboard";

const yn = (v: boolean | null) => (v === null ? "not recorded" : v ? "yes" : "no");

export function BenchmarkRunDetail({ suiteId, summary, platform, grades, viewer }: {
  suiteId: string;
  summary: TaskSummary;
  platform: PlatformId;
  grades: GradeRecord[];
  viewer: Viewer;
}) {
  const task: TaskRecord = summary.task;
  const adapter = ADAPTERS[platform];
  const adapterTask = { id: task.id, number: task.number, title: task.title, prompt: task.prompt, capabilities: task.capabilities, requiresPersistence: task.requiresPersistence };
  const decision = adapter.canRun(adapterTask);
  const runs = summary.runs.filter((r) => r.platform === platform).sort((a, b) => a.attempt - b.attempt);
  const run: RunRecord | null = runs[runs.length - 1] ?? null;
  const board = summary.board.find((b) => b.platform === platform)!;
  const runGrades = run ? grades.filter((g) => g.runId === run.id) : [];
  const mine = viewer.userId ? (runGrades.find((g) => g.graderId === viewer.userId) ?? null) : null;
  const nextAttempt = (runs[runs.length - 1]?.attempt ?? 0) + 1;

  const ceiling = run
    ? persistenceCeiling({
        required: task.requiresPersistence,
        tested: run.persistenceTested,
        survivedReload: run.persistenceSurvivedReload,
        mode: run.persistenceMode,
        hasEvidence: Boolean(run.persistenceEvidence?.trim() || run.persistenceEvidenceUrl?.trim()),
      })
    : { ceiling: 0, reason: "No run recorded." };
  const evidence = run ? adapter.collectEvidence(run, adapterTask) : null;
  const verdict = run ? adapter.evaluatePersistence(run, adapterTask) : null;

  return (
    <div className="space-y-8">
      <section className="space-y-2" aria-labelledby="cap-title">
        <h3 id="cap-title" className="text-sm font-semibold">Execution on {PLATFORMS[platform].name}</h3>
        <div className={`rounded-lg border p-3 text-sm ${decision.disposition === "unsupported" ? "border-bad/40 bg-bad-soft text-bad" : "border-line bg-surface-2"}`}>
          <p><StatusBadge status={decision.disposition} /> <span className="ml-1">{decision.reason}</span></p>
          {decision.boundaryNotice && <p className="mt-2">{decision.boundaryNotice}</p>}
        </div>
        <details>
          <summary className="cursor-pointer text-sm font-medium">Manual execution protocol</summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted">
            {(decision.disposition === "unsupported" ? ["No automated path exists. If you still run the prompt by hand to document the boundary, follow these steps:"] : []).map((s) => <li key={s} className="list-none -ml-5 font-medium text-ink">{s}</li>)}
            {adapter.manualProtocol(adapterTask).map((s) => <li key={s}>{s}</li>)}
          </ol>
        </details>
      </section>

      {run ? (
        <section className="space-y-4" aria-labelledby="run-title">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="run-title" className="text-sm font-semibold">Recorded run — attempt {run.attempt}</h3>
            <div className="flex items-center gap-2">
              <StatusBadge status={run.status} />
              <CopyButton text={gradeSummaryText(summary, platform)} label="Copy grading summary" />
            </div>
          </div>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <Item k="Model" v={[run.modelName, run.modelVersion].filter(Boolean).join(" ") || "—"} />
            <Item k="Duration" v={run.durationSeconds === null ? "—" : `${run.durationSeconds}s`} />
            <Item k="Output URL" v={run.outputUrl ? <a href={run.outputUrl} target="_blank" rel="noopener noreferrer" className="break-all underline">{run.outputUrl}</a> : "—"} />
            <Item k="Recorded" v={new Date(run.createdAt).toLocaleString()} />
          </dl>
          <TextBlock label="Executed prompt" text={run.executedPrompt} copy />
          {run.runtimeNotes && <TextBlock label="Runtime / sandbox notes" text={run.runtimeNotes} />}
          {run.consoleNotes && <TextBlock label="Console / log notes" text={run.consoleNotes} mono />}
          <div>
            <h4 className="text-sm font-semibold">Source / file manifest ({run.sourceManifest.length})</h4>
            {run.sourceManifest.length ? (
              <ul className="mt-1 divide-y divide-line rounded-lg border border-line text-xs">
                {run.sourceManifest.map((f) => <li key={f.path} className="flex justify-between gap-3 px-3 py-1.5"><code className="break-all">{f.path}</code><span className="text-muted">{[f.language, f.bytes !== undefined ? `${f.bytes} B` : null, f.note].filter(Boolean).join(" · ")}</span></li>)}
              </ul>
            ) : <p className="mt-1 text-sm text-muted">No files listed.</p>}
          </div>

          <div className="space-y-2 rounded-lg border border-line p-3">
            <h4 className="text-sm font-semibold">Persistence test</h4>
            <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              <Item k="Required by task" v={task.requiresPersistence ? "yes" : "no"} />
              <Item k="Storage mode" v={<Badge>{run.persistenceMode}</Badge>} />
              <Item k="Tested" v={yn(run.persistenceTested)} />
              <Item k="Survived reload" v={yn(run.persistenceSurvivedReload)} />
              <Item k="Evidence" v={run.persistenceEvidenceUrl ? <a href={run.persistenceEvidenceUrl} target="_blank" rel="noopener noreferrer" className="break-all underline">{run.persistenceEvidenceUrl}</a> : (run.persistenceEvidence || "—")} />
              <Item k="Failure notes" v={run.persistenceFailureNotes || "—"} />
            </dl>
            <p className={`text-xs ${task.requiresPersistence && ceiling.ceiling < 3 ? "text-warn" : "text-muted"}`}>
              Persistence grade ceiling: <strong>{ceiling.ceiling}</strong> — {ceiling.reason}
            </p>
            {verdict && verdict.evidence.length > 1 && <ul className="list-disc pl-5 text-xs text-muted">{verdict.evidence.slice(1).map((e) => <li key={e}>{e}</li>)}</ul>}
          </div>

          {evidence && (
            <div className="rounded-lg border border-line p-3">
              <h4 className="text-sm font-semibold">Evidence check</h4>
              <ul className="mt-1 space-y-1 text-sm">
                <li>{evidence.promptMatchesCanonical ? "✓ Executed prompt matches the canonical prompt" : "⚠ Executed prompt differs from the canonical prompt"}</li>
                <li>{evidence.hasOutputUrl ? "✓ Output URL recorded" : "• No output URL"}</li>
                <li>{evidence.hasSourceManifest ? "✓ Source manifest recorded" : "• No source manifest"}</li>
                <li>{evidence.hasConsoleNotes ? "✓ Console notes recorded" : "• No console notes"}</li>
              </ul>
            </div>
          )}
        </section>
      ) : (
        <p className="rounded-lg border border-dashed border-line p-4 text-sm text-muted">No run has been recorded for this workflow on {PLATFORMS[platform].name} yet.</p>
      )}

      {run && (
        <section aria-labelledby="grades-title" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="grades-title" className="text-sm font-semibold">Grades ({board.score?.graderCount ?? 0} grader{(board.score?.graderCount ?? 0) === 1 ? "" : "s"})</h3>
            <div className="flex items-center gap-2 text-sm">
              <PlatformBadge platform={platform} />
              <span className="font-semibold">{formatScore5(board.score?.score5 ?? null)} / 5</span>
              <span className="text-muted">({formatScore100(board.score?.score100 ?? null)} / 100)</span>
              {board.score && <StatusBadge status={board.score.status} />}
            </div>
          </div>
          {board.score && board.score.missing.length > 0 && (
            <p className="text-xs text-warn">Missing scores for: {board.score.missing.map((m) => CRITERION_LABELS[m]).join(", ")}. This result is not ranked until they are scored.</p>
          )}
          {runGrades.length === 0 ? <p className="text-sm text-muted">Not graded yet.</p> : (
            <div className="table-wrap rounded-lg border border-line">
              <table className="w-full border-collapse text-xs">
                <thead><tr className="text-left uppercase tracking-wide text-muted"><th scope="col" className="border-b border-line bg-surface-2 px-2 py-1.5">Grader</th>{CRITERIA.map((c) => <th key={c} scope="col" className="border-b border-line bg-surface-2 px-2 py-1.5" title={CRITERION_LABELS[c]}>{CRITERION_LABELS[c].split(" ")[0]}</th>)}</tr></thead>
                <tbody>
                  {runGrades.map((g) => (
                    <tr key={g.id} className="align-top">
                      <th scope="row" className="border-b border-line px-2 py-1.5 text-left font-mono">{g.graderId === viewer.userId ? "you" : g.graderId.slice(0, 8)}</th>
                      {CRITERIA.map((c) => <td key={c} className="border-b border-line px-2 py-1.5 tabular-nums">{g.scores[c] ?? "—"}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {runGrades.some((g) => g.evaluatorNotes || g.evidenceUrls.length || Object.keys(g.criterionNotes).length) && (
            <div className="space-y-2">
              {runGrades.map((g) => (g.evaluatorNotes || g.evidenceUrls.length || Object.keys(g.criterionNotes).length) ? (
                <details key={g.id} className="rounded-lg border border-line p-3 text-sm">
                  <summary className="cursor-pointer font-medium">Notes and evidence from {g.graderId === viewer.userId ? "you" : g.graderId.slice(0, 8)}</summary>
                  {g.evaluatorNotes && <p className="mt-2 whitespace-pre-wrap">{g.evaluatorNotes}</p>}
                  {Object.entries(g.criterionNotes).map(([k, v]) => <p key={k} className="mt-1 text-muted"><strong>{CRITERION_LABELS[k as keyof typeof CRITERION_LABELS] ?? k}:</strong> {v}</p>)}
                  {g.evidenceUrls.length > 0 && <ul className="mt-2 list-disc pl-5">{g.evidenceUrls.map((u) => <li key={u}><a href={u} target="_blank" rel="noopener noreferrer" className="break-all underline">{u}</a></li>)}</ul>}
                </details>
              ) : null)}
            </div>
          )}
        </section>
      )}

      {viewer.canWrite ? (
        <>
          {run && (
            <section aria-labelledby="grade-form-title" className="space-y-3">
              <h3 id="grade-form-title" className="text-sm font-semibold">{mine ? "Your grade" : "Grade this run"}</h3>
              <GradingForm run={run} task={task} mine={mine} ceiling={ceiling} />
            </section>
          )}
          <section aria-labelledby="run-form-title" className="space-y-3">
            <h3 id="run-form-title" className="text-sm font-semibold">{run ? `Edit attempt ${run.attempt}` : "Record a run"}</h3>
            <RunForm key={`${run?.id ?? "new"}-${run?.createdAt ?? ""}`} suiteId={suiteId} task={task} platform={platform} run={run} nextAttempt={nextAttempt} />
            {run && (
              <details>
                <summary className="cursor-pointer text-sm font-medium">Record a new attempt (re-run)</summary>
                <div className="mt-3"><RunForm key={`new-${nextAttempt}`} suiteId={suiteId} task={task} platform={platform} run={null} nextAttempt={nextAttempt} /></div>
              </details>
            )}
          </section>
        </>
      ) : (
        <p role="note" className="rounded-lg bg-surface-2 p-3 text-sm text-muted">{viewer.readOnlyReason}</p>
      )}
    </div>
  );
}

function Item({ k, v }: { k: string; v: React.ReactNode }) {
  return <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted">{k}</dt><dd className="mt-0.5">{v}</dd></div>;
}

function TextBlock({ label, text, mono, copy }: { label: string; text: string; mono?: boolean; copy?: boolean }) {
  return (
    <div>
      <div className="flex items-center justify-between"><h4 className="text-sm font-semibold">{label}</h4>{copy && <CopyButton text={text} label="Copy prompt" />}</div>
      <pre tabIndex={0} className={`mt-1 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-surface-2 p-3 text-xs leading-relaxed ${mono ? "font-mono" : ""}`}>{text}</pre>
    </div>
  );
}
