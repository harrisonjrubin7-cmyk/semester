"use client";

import { useMemo, useState } from "react";

export type SortState = { key: string; dir: "asc" | "desc" };

/** Sort rows by a key; strings compare with locale rules, numbers numerically, null/undefined always last. */
export function useTableSort<T>(rows: T[], read: (row: T, key: string) => string | number | null | undefined, initial: SortState) {
  const [sort, setSort] = useState<SortState>(initial);
  const sorted = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = read(a, sort.key);
      const bv = read(b, sort.key);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" }) * dir;
    });
  }, [rows, sort, read]);
  const toggle = (key: string) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  const ariaSort = (key: string): "ascending" | "descending" | "none" => (sort.key === key ? (sort.dir === "asc" ? "ascending" : "descending") : "none");
  return { sorted, sort, toggle, ariaSort };
}

export function SortHeader({ label, sortKey, ariaSort, onToggle, className = "" }: {
  label: string;
  sortKey: string;
  ariaSort: "ascending" | "descending" | "none";
  onToggle: (key: string) => void;
  className?: string;
}) {
  return (
    <th scope="col" aria-sort={ariaSort} className={`border-b border-line bg-surface-2 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted ${className}`}>
      <button type="button" onClick={() => onToggle(sortKey)} className="inline-flex items-center gap-1 hover:text-ink">
        {label}
        <span aria-hidden="true" className="text-[10px]">{ariaSort === "ascending" ? "▲" : ariaSort === "descending" ? "▼" : "↕"}</span>
      </button>
    </th>
  );
}
