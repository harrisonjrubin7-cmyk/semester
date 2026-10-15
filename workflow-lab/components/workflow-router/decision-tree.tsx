"use client";

import { QUESTIONS, type QuestionKey, type RouterInputs } from "@/lib/workflow-router/inputs";

export function DecisionTree({ inputs, touched, onChange, onReset }: {
  inputs: RouterInputs;
  touched: ReadonlySet<QuestionKey>;
  onChange: <K extends QuestionKey>(key: K, value: RouterInputs[K]) => void;
  onReset: () => void;
}) {
  const answered = touched.size;
  return (
    <section aria-labelledby="tree-title" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="tree-title" className="text-lg font-semibold">Describe the workflow</h2>
          <p className="text-sm text-muted">Every answer is scored; some answers force v0.</p>
        </div>
        <button type="button" onClick={onReset} className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm hover:bg-surface-2">Reset</button>
      </div>

      <div className="space-y-1" aria-live="polite">
        <div className="flex justify-between text-xs text-muted">
          <span>Progress</span>
          <span>{answered} of {QUESTIONS.length} answered</span>
        </div>
        <div role="progressbar" aria-valuemin={0} aria-valuemax={QUESTIONS.length} aria-valuenow={answered} aria-label="Questions answered" className="h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(answered / QUESTIONS.length) * 100}%` }} />
        </div>
      </div>

      {QUESTIONS.map((q, i) => (
        <fieldset key={q.key} className="space-y-2">
          <legend className="mb-1 text-sm font-semibold">
            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent-soft text-xs text-accent">{i + 1}</span>
            {q.title} <span className="font-normal text-muted">— {q.help}</span>
          </legend>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {q.options.map((o) => {
              const selected = inputs[q.key] === o.value;
              const id = `${q.key}-${o.value}`;
              return (
                <label
                  key={o.value}
                  htmlFor={id}
                  className={`flex cursor-pointer flex-col rounded-lg border px-3 py-2 text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
                    selected ? "border-accent bg-accent-soft" : "border-line bg-surface hover:bg-surface-2"
                  }`}
                >
                  <input
                    id={id}
                    type="radio"
                    name={q.key}
                    value={o.value}
                    checked={selected}
                    onChange={() => onChange(q.key, o.value as never)}
                    className="sr-only"
                  />
                  <span className="font-medium">{o.label}</span>
                  <span className="text-xs text-muted">{o.description}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
    </section>
  );
}
