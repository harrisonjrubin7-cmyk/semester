"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Grid2X2, Search, ShieldCheck, X } from "lucide-react";
import { platformDomains } from "@/lib/platform-registry";

const searchableDestinations = [
  { name: "System home", description: "Semester OS overview", href: "/os" },
  ...platformDomains.map((domain) => ({
    name: domain.name,
    description: domain.description,
    href: `/os/${domain.slug}`,
  })),
  {
    name: "Action center",
    description: "Submit and review governed institutional commands",
    href: "/os/workflows/actions",
  },
];

export function SemesterMark() {
  return (
    <span className="semester-mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

export function PlatformShell({ children, current }: { children: React.ReactNode; current?: string }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const matches = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return term
      ? searchableDestinations.filter((item) =>
          `${item.name} ${item.description}`.toLocaleLowerCase().includes(term),
        )
      : searchableDestinations;
  }, [query]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") setSearchOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
    else setQuery("");
  }, [searchOpen]);

  return (
    <div className="os-shell">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <aside className="os-rail" aria-label="Semester OS navigation">
        <Link href="/os" className="os-wordmark" aria-label="Semester OS home">
          <SemesterMark />
          <span><strong>Semester</strong><small>Operating system</small></span>
        </Link>
        <nav className="os-nav">
          <Link href="/os" className={!current ? "active" : ""}>
            <Grid2X2 size={17} aria-hidden="true" />
            System home
          </Link>
          {platformDomains.map((domain) => {
            const Icon = domain.icon;
            return (
              <Link key={domain.slug} href={`/os/${domain.slug}`} className={current === domain.slug ? "active" : ""}>
                <Icon size={17} aria-hidden="true" />
                {domain.name}
              </Link>
            );
          })}
        </nav>
        <div className="os-rail-trust"><ShieldCheck size={16} aria-hidden="true" /><span>Evidence and permissions travel with every action.</span></div>
      </aside>
      <div className="os-stage">
        <header className="os-context-bar">
          <div><span className="status-dot" /> Semester workspace</div>
          <button type="button" aria-label="Search Semester" onClick={() => setSearchOpen(true)}><Search size={16} /> <span>Search</span><kbd>⌘ K</kbd></button>
        </header>
        <main id="main-content" className="os-main">{children}</main>
      </div>
      {searchOpen && (
        <div className="command-backdrop" role="presentation" onMouseDown={() => setSearchOpen(false)}>
          <section className="command-dialog" role="dialog" aria-modal="true" aria-label="Search Semester" onMouseDown={(event) => event.stopPropagation()}>
            <div className="os-search-input">
              <Search size={18} aria-hidden="true" />
              <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the Semester ecosystem" aria-label="Search destinations" />
              <button type="button" onClick={() => setSearchOpen(false)} aria-label="Close search"><X size={18} /></button>
            </div>
            <div className="command-results">
              {matches.map((item) => (
                <Link className="command-result" href={item.href} key={item.href} onClick={() => setSearchOpen(false)}>
                  <div><strong>{item.name}</strong><small>{item.description}</small></div>
                </Link>
              ))}
              {!matches.length && <p className="os-search-empty">No Semester destination matches that search.</p>}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
