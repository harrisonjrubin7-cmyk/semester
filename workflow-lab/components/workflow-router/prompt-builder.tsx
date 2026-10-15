"use client";

import { useId, useMemo, useState } from "react";
import { CopyButton } from "@/components/ui/copy-button";
import { inputClass } from "@/components/ui/form-bits";
import { needsSupabasePrompt, type Recommendation } from "@/lib/workflow-router/engine";
import { buildPrompt, githubPlan, supabasePrompt } from "@/lib/workflow-router/prompts";

type Tab = "build" | "github" | "supabase";

export function PromptBuilder({ rec, task, onTaskChange }: { rec: Recommendation; task: string; onTaskChange: (v: string) => void }) {
  const [tab, setTab] = useState<Tab>("build");
  const taskId = useId();
  const supa = useMemo(() => supabasePrompt(rec), [rec]);
  const tabs: Array<[Tab, string]> = [["build", "Build prompt"], ["github", "GitHub plan"], ...(needsSupabasePrompt(rec.inputs) ? ([["supabase", "Supabase prompt"]] as Array<[Tab, string]>) : [])];
  const active: Tab = tabs.some(([t]) => t === tab) ? tab : "build";
  const text = active === "build" ? buildPrompt(rec, task) : active === "github" ? githubPlan(rec) : (supa ?? "");

  return (
    <section aria-labelledby="prompt-title" className="space-y-3 rounded-xl border border-line bg-surface p-5">
      <h2 id="prompt-title" className="text-lg font-semibold">Ready-to-copy prompts</h2>
      <div>
        <label htmlFor={taskId} className="block text-sm font-medium">What should it build? <span className="font-normal text-muted">(optional, inserted into the prompt)</span></label>
        <textarea id={taskId} value={task} onChange={(e) => onTaskChange(e.target.value)} rows={2} maxLength={2000} className={`${inputClass} mt-1`} placeholder="e.g. A sortable tracker for every artifact type, with CSV export" />
      </div>

      <div role="tablist" aria-label="Prompt type" className="flex gap-1 border-b border-line">
        {tabs.map(([t, label]) => (
          <button
            key={t}
            role="tab"
            id={`tab-${t}`}
            aria-selected={active === t}
            aria-controls="prompt-panel"
            type="button"
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${active === t ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div id="prompt-panel" role="tabpanel" aria-labelledby={`tab-${active}`} className="space-y-2">
        <div className="flex justify-end">
          <CopyButton text={text} label={active === "build" ? "Copy build prompt" : active === "github" ? "Copy GitHub plan" : "Copy Supabase prompt"} />
        </div>
        <pre tabIndex={0} className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-surface-2 p-3 font-mono text-xs leading-relaxed">{text}</pre>
      </div>
    </section>
  );
}
