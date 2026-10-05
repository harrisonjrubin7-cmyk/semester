"use client";

import { useMemo, useState } from "react";
import { DownloadButton } from "@/components/ui/download-button";
import { BENCHMARK_WORKFLOWS } from "@/lib/benchmark/benchmark.config";
import { recommendationToJson } from "@/lib/exports/json";
import { recommendationToMarkdown } from "@/lib/exports/markdown";
import { recommend } from "@/lib/workflow-router/engine";
import { DEFAULT_INPUTS, QUESTIONS, type QuestionKey, type RouterInputs } from "@/lib/workflow-router/inputs";
import { DecisionTree } from "./decision-tree";
import { FeatureMatrix } from "./feature-matrix";
import { PlatformMatrix } from "./platform-matrix";
import { PromptBuilder } from "./prompt-builder";
import { RecommendationPanel } from "./recommendation-panel";
import { SaveRecommendation } from "./save-recommendation";
import { SavedList, type SavedRecommendation } from "./saved-list";

export type SessionMode = { kind: "prototype" } | { kind: "signed-out" } | { kind: "signed-in"; email: string | null };

export function WorkflowRouter({ session, saved, organizations }: {
  session: SessionMode;
  saved: SavedRecommendation[];
  organizations: Array<{ id: string; name: string; role: string }>;
}) {
  const [inputs, setInputs] = useState<RouterInputs>(DEFAULT_INPUTS);
  const [touched, setTouched] = useState<ReadonlySet<QuestionKey>>(new Set());
  const [task, setTask] = useState("");
  const rec = useMemo(() => recommend(inputs), [inputs]);

  const allTouched = new Set<QuestionKey>(QUESTIONS.map((q) => q.key));
  const params = new URLSearchParams({ ...inputs, ...(task.trim() ? { task: task.trim().slice(0, 2000) } : {}) });
  const exportHref = (format: "md" | "json") => `/api/exports/recommendation?${new URLSearchParams({ format, ...Object.fromEntries(params) })}`;

  return (
    <div className="space-y-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Workflow router</h1>
        <p className="text-sm text-muted">Route a workflow to Claude Artifacts, ChatGPT Canvas or v0 — with the reasons, the limits and the prompt.</p>
      </header>

      <section aria-labelledby="presets" className="space-y-2">
        <h2 id="presets" className="text-sm font-semibold">Start from a benchmark workflow</h2>
        <div className="flex flex-wrap gap-1.5">
          {BENCHMARK_WORKFLOWS.map((w) => (
            <button
              key={w.number}
              type="button"
              onClick={() => { setInputs(w.scenario); setTouched(allTouched); setTask(w.prompt); }}
              className="rounded-full border border-line bg-surface px-3 py-1 text-xs hover:bg-surface-2"
              title={w.prompt}
            >
              {w.number}. {w.title}
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="space-y-6">
          <DecisionTree
            inputs={inputs}
            touched={touched}
            onChange={(key, value) => {
              setInputs((p) => ({ ...p, [key]: value }));
              setTouched((t) => new Set(t).add(key));
            }}
            onReset={() => { setInputs(DEFAULT_INPUTS); setTouched(new Set()); setTask(""); }}
          />
        </div>
        <div className="space-y-6">
          <RecommendationPanel rec={rec} />

          <section aria-labelledby="export-title" className="space-y-3 rounded-xl border border-line bg-surface p-5">
            <h2 id="export-title" className="text-lg font-semibold">Export</h2>
            <div className="flex flex-wrap gap-2">
              <a href={exportHref("md")} download className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm font-medium hover:bg-surface-2">Download Markdown</a>
              <a href={exportHref("json")} download className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm font-medium hover:bg-surface-2">Download JSON</a>
              <DownloadButton label="Markdown (offline)" filename="semester-recommendation.md" mime="text/markdown" getText={() => recommendationToMarkdown(rec, task)} />
              <DownloadButton label="JSON (offline)" filename="semester-recommendation.json" mime="application/json" getText={() => recommendationToJson(rec, task)} />
            </div>
          </section>

          <section aria-labelledby="save-title" className="space-y-3 rounded-xl border border-line bg-surface p-5">
            <h2 id="save-title" className="text-lg font-semibold">Save</h2>
            <p className="text-xs text-muted">
              {session.kind === "signed-in" ? `Signed in as ${session.email ?? "your account"}.` : session.kind === "signed-out" ? "Not signed in." : "Prototype mode."}
            </p>
            <SaveRecommendation inputs={inputs} session={session} organizations={organizations} />
          </section>
        </div>
      </div>

      <PromptBuilder rec={rec} task={task} onTaskChange={setTask} />

      {session.kind === "signed-in" && (
        <section aria-labelledby="saved-title" className="space-y-3">
          <h2 id="saved-title" className="text-lg font-semibold">Saved recommendations</h2>
          <SavedList items={saved} onLoad={(i, title) => { setInputs(i); setTouched(allTouched); setTask(title); }} />
        </section>
      )}

      <FeatureMatrix />
      <PlatformMatrix />
    </div>
  );
}
