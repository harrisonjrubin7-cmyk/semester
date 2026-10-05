import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { AuthButton } from "@/components/auth/auth-button";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Semester AI Workflow Router & Benchmark Lab", template: "%s" },
  description: "Route a workflow to Claude Artifacts, ChatGPT Canvas or v0, and benchmark all three on 12 canonical workflows.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-fg">
          Skip to content
        </a>
        <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
          <div className="mx-auto flex min-h-14 max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-1.5 sm:px-6">
            <div className="flex items-center gap-3 sm:gap-6">
              <Link href="/" className="text-sm font-semibold tracking-tight">
                Semester<span className="hidden text-muted sm:inline"> Workflow Lab</span>
              </Link>
              <nav aria-label="Primary" className="flex items-center gap-1 text-sm">
                <Link href="/workflow-router" className="rounded-md px-2.5 py-1.5 text-muted hover:bg-surface-2 hover:text-ink">Router</Link>
                <Link href="/benchmark" className="rounded-md px-2.5 py-1.5 text-muted hover:bg-surface-2 hover:text-ink">Benchmark</Link>
              </nav>
            </div>
            <AuthButton />
          </div>
        </header>
        <main id="main" className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
        <footer className="mx-auto max-w-7xl px-4 pb-10 pt-4 text-xs text-muted sm:px-6">
          A sandbox preview proves a concept; a repository, backend, test suite and deployment pipeline prove a product.
        </footer>
      </body>
    </html>
  );
}
