"use client";

import Link from "next/link";
import { Search, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { mobileNavigation, navigation } from "./navigation";
import { OfflineStrip } from "./workspace-states";

function RailLink({ courseId, mode, item }: { courseId: string; mode: string; item: (typeof navigation)[number] }) {
  const Icon = item.icon;
  const active = mode === item.id;
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={`flex min-h-11 items-center gap-3 rounded px-3 py-2 text-sm no-underline transition-colors ${active ? "bg-white/10 text-white" : "hover:bg-white/5 hover:text-white"}`}
      href={`/courses/${courseId}/${item.id}`}
    >
      <Icon aria-hidden="true" size={17} />
      <span className="min-w-0 flex-1"><span className="block font-medium">{item.label}</span><span className="block truncate text-[11px] opacity-70">{item.detail}</span></span>
    </Link>
  );
}

function CommandPalette({ courseId, open, close }: { courseId: string; open: boolean; close: () => void }) {
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const results = useMemo(() => navigation.filter((item) => `${item.label} ${item.detail}`.toLowerCase().includes(query.toLowerCase())), [query]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setQuery("");
    const frame = requestAnimationFrame(() => input.current?.focus());
    return () => { cancelAnimationFrame(frame); previous?.focus(); };
  }, [open]);

  function trapFocus(event: React.KeyboardEvent) {
    if (event.key !== "Tab") return;
    const focusable = Array.from(dialog.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? []);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  if (!open) return null;
  return (
    <div className="command-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section aria-label="Navigate Semester" aria-modal="true" className="command-dialog" onKeyDown={trapFocus} ref={dialog} role="dialog">
        <label className="sr-only" htmlFor="command-search">Search destinations</label>
        <input id="command-search" ref={input} className="command-input" onChange={(event) => setQuery(event.target.value)} placeholder="Search course destinations…" value={query} />
        <nav aria-label="Search results" className="command-results">
          {results.map((item) => {
            const Icon = item.icon;
            return <Link className="command-result" href={`/courses/${courseId}/${item.id}`} key={item.id} onClick={close}><Icon aria-hidden="true" size={17} /><span><strong className="block text-sm">{item.label}</strong><span className="muted text-xs">{item.detail}</span></span></Link>;
          })}
          {!results.length ? <p className="muted p-5 text-sm" role="status">No matching destination.</p> : null}
        </nav>
        <p className="muted border-t border-[color:var(--border-default)] px-6 py-3 text-xs">Press Escape to close.</p>
      </section>
    </div>
  );
}

export function AppShell({ courseId, courseTitle, term, mode, offline, children }: { courseId: string; courseTitle: string; term?: string; mode: string; offline: boolean; children: React.ReactNode }) {
  const [palette, setPalette] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setPalette(true); }
      if (event.key === "Escape") setPalette(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const primary = navigation.filter((item) => item.group === "primary");
  const study = navigation.filter((item) => item.group === "study");
  const secondary = navigation.filter((item) => item.group === "secondary");

  return (
    <>
      <a className="skip-link" href="#workspace-content">Skip to course content</a>
      <div className="workspace-shell">
        <aside aria-label="Semester course rail" className="desktop-rail">
          <div className="mb-7 flex items-start justify-between gap-3">
            <div><p className="font-[family-name:var(--font-editorial)] text-lg tracking-[0.08em] text-white">SEMESTER</p><p className="mt-1 text-xs">Source-aware study</p></div>
          </div>
          <button className="mb-6 flex min-h-11 items-center justify-between rounded border border-white/15 px-3 text-sm text-white hover:bg-white/5" onClick={() => setPalette(true)} type="button"><span className="flex items-center gap-2"><Search aria-hidden="true" size={16} /> Search</span><kbd className="text-xs opacity-60">⌘K</kbd></button>
          <nav aria-label="Course navigation" className="space-y-1">{primary.map((item) => <RailLink courseId={courseId} item={item} key={item.id} mode={mode} />)}</nav>
          <p className="mb-2 mt-6 px-3 text-[11px] font-semibold uppercase tracking-[0.14em]">Study studio</p>
          <nav aria-label="Study modes" className="space-y-1">{study.map((item) => <RailLink courseId={courseId} item={item} key={item.id} mode={mode} />)}</nav>
          <div className="mt-auto pt-6"><nav aria-label="Course tools" className="space-y-1">{secondary.map((item) => <RailLink courseId={courseId} item={item} key={item.id} mode={mode} />)}</nav></div>
        </aside>
        <div className="workspace-main">
          {offline ? <OfflineStrip /> : null}
          <div className="context-bar" aria-label="System context">
            <div className="flex items-center gap-2 whitespace-nowrap"><strong>{term || "Term not set"}</strong><span aria-hidden="true">/</span><span>{courseTitle}</span></div>
            <div className="flex items-center gap-2 whitespace-nowrap"><ShieldCheck aria-hidden="true" size={15} /><span>{offline ? "Changes pending" : "Source records available"}</span></div>
          </div>
          <main className="workspace-content" id="workspace-content" tabIndex={-1}>{children}</main>
        </div>
      </div>
      <nav aria-label="Mobile navigation" className="mobile-tabs">
        {mobileNavigation.map((item) => {
          const Icon = item.icon;
          if (item.id === "search") return <button aria-label="Search Semester" className="mobile-tab" key={item.id} onClick={() => setPalette(true)} type="button"><Icon aria-hidden="true" size={19} /><span>{item.label}</span></button>;
          const active = mode === item.id;
          return <Link aria-current={active ? "page" : undefined} className="mobile-tab" href={`/courses/${courseId}/${item.id}`} key={item.id}><Icon aria-hidden="true" size={19} /><span>{item.label}</span></Link>;
        })}
      </nav>
      <CommandPalette close={() => setPalette(false)} courseId={courseId} open={palette} />
    </>
  );
}
