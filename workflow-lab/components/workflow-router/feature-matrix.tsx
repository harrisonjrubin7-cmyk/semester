"use client";

import { useCallback, useMemo, useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import { SortHeader, useTableSort } from "@/components/ui/use-table-sort";
import { inputClass } from "@/components/ui/form-bits";
import { PlatformBadge } from "@/components/ui/badge";
import { FEATURE_COLUMNS, PLATFORM_LIST, PLATFORMS, type PlatformId, type PlatformProfile as Profile } from "@/lib/workflow-router/platforms";
import { LevelMeter, PlatformProfile } from "./platform-profile";

/** The sixteen-field platform comparison. Rows are platforms; every column sorts. */
export function FeatureMatrix() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<PlatformId | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return PLATFORM_LIST;
    return PLATFORM_LIST.filter((p) => FEATURE_COLUMNS.some((c) => c.read(p).text.toLowerCase().includes(q)));
  }, [query]);

  const read = useCallback((p: Profile, key: string) => FEATURE_COLUMNS.find((c) => c.key === key)?.read(p).sort, []);
  const { sorted, toggle, ariaSort } = useTableSort(rows, read, { key: "platform", dir: "asc" });

  return (
    <section aria-labelledby="fm-title" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="fm-title" className="text-lg font-semibold">Feature matrix</h2>
          <p className="text-sm text-muted">Click a column heading to sort. Capability columns sort by their 0–5 level.</p>
        </div>
        <div className="w-full sm:w-72">
          <label htmlFor="fm-search" className="sr-only">Search the feature matrix</label>
          <input id="fm-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search (e.g. database, PDF, Vercel)" className={inputClass} />
        </div>
      </div>

      <div className="table-wrap rounded-xl border border-line bg-surface">
        <table className="min-w-[110rem] border-collapse text-sm">
          <caption className="sr-only">Claude Artifacts, ChatGPT Canvas and v0 compared across sixteen fields</caption>
          <thead>
            <tr>
              {FEATURE_COLUMNS.map((c) => (
                <SortHeader key={c.key} label={c.label} sortKey={c.key} ariaSort={ariaSort(c.key)} onToggle={toggle} className={c.key === "platform" ? "sticky left-0 z-10" : ""} />
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.id} className="align-top odd:bg-surface even:bg-surface/60">
                {FEATURE_COLUMNS.map((c) => {
                  const v = c.read(p);
                  if (c.key === "platform")
                    return (
                      <th key={c.key} scope="row" className="sticky left-0 z-10 border-b border-line bg-surface px-3 py-3 text-left">
                        <button type="button" onClick={() => setOpen(p.id)} className="text-left font-semibold underline decoration-dotted underline-offset-4 hover:text-accent" aria-label={`Open ${p.name} profile`}>
                          {p.name}
                        </button>
                      </th>
                    );
                  return (
                    <td key={c.key} className="max-w-[18rem] border-b border-line px-3 py-3">
                      {c.kind === "level" && <div className="mb-1"><LevelMeter level={Number(v.sort)} /></div>}
                      <span className={c.kind === "level" ? "text-muted" : ""}>{v.text}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr><td colSpan={FEATURE_COLUMNS.length} className="px-3 py-8 text-center text-muted">No platform matches “{query}”.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Drawer open={open !== null} onClose={() => setOpen(null)} title={open ? PLATFORMS[open].name : ""} subtitle={open ? <PlatformBadge platform={open} label="Platform profile" /> : null}>
        {open && <PlatformProfile id={open} />}
      </Drawer>
    </section>
  );
}
