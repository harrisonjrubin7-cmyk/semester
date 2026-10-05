"use client";

import { useCallback, useMemo, useState } from "react";
import { inputClass } from "@/components/ui/form-bits";
import { SortHeader, useTableSort } from "@/components/ui/use-table-sort";
import { MATRIX_DIMENSIONS, PLATFORM_IDS, PLATFORM_LABELS, type MatrixDimension } from "@/lib/workflow-router/platforms";
import { LevelMeter } from "./platform-profile";

/** Dimension-by-platform comparison: execution limits, React, rendering, state, projects, backend, handoff. */
export function PlatformMatrix() {
  const [query, setQuery] = useState("");
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return MATRIX_DIMENSIONS;
    return MATRIX_DIMENSIONS.filter((d) => `${d.label} ${d.group} ${PLATFORM_IDS.map((p) => d.levels[p].text).join(" ")}`.toLowerCase().includes(q));
  }, [query]);

  const read = useCallback((d: MatrixDimension, key: string) => {
    if (key === "label") return d.label;
    if (key === "group") return d.group;
    return d.levels[key as keyof MatrixDimension["levels"]].level;
  }, []);
  const { sorted, toggle, ariaSort } = useTableSort(rows, read, { key: "group", dir: "asc" });

  return (
    <section aria-labelledby="pm-title" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="pm-title" className="text-lg font-semibold">Capability comparison</h2>
          <p className="text-sm text-muted">Sort by any platform to see where it leads (0 = none, 5 = native).</p>
        </div>
        <div className="w-full sm:w-72">
          <label htmlFor="pm-search" className="sr-only">Search capabilities</label>
          <input id="pm-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search capabilities" className={inputClass} />
        </div>
      </div>
      <div className="table-wrap rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[56rem] border-collapse text-sm">
          <caption className="sr-only">Capability dimensions compared across the three platforms</caption>
          <thead>
            <tr>
              <SortHeader label="Dimension" sortKey="label" ariaSort={ariaSort("label")} onToggle={toggle} />
              <SortHeader label="Group" sortKey="group" ariaSort={ariaSort("group")} onToggle={toggle} />
              {PLATFORM_IDS.map((p) => <SortHeader key={p} label={PLATFORM_LABELS[p]} sortKey={p} ariaSort={ariaSort(p)} onToggle={toggle} />)}
            </tr>
          </thead>
          <tbody>
            {sorted.map((d) => (
              <tr key={d.key} className="align-top">
                <th scope="row" className="border-b border-line px-3 py-3 text-left font-medium">{d.label}</th>
                <td className="border-b border-line px-3 py-3 text-muted">{d.group}</td>
                {PLATFORM_IDS.map((p) => (
                  <td key={p} className="border-b border-line px-3 py-3">
                    <LevelMeter level={d.levels[p].level} />
                    <div className="mt-1 text-xs text-muted">{d.levels[p].text}</div>
                  </td>
                ))}
              </tr>
            ))}
            {sorted.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-muted">Nothing matches “{query}”.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
