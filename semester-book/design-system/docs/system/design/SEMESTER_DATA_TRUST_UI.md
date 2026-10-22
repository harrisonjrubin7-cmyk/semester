# Data trust UI

_Semester design, intelligence, workflow and data system · 2026-10-05 · Source: uploads/expand further on brand identy algorthims workflow.pdf, reconciled with this design system (readme.md, tokens/, components/). Where they differ, this design system wins and the difference is listed._

> Semester should make an institutionally complex world feel personally clear.

Every critical screen shows: Source · Updated · Authority · Status · Policy (versioned) · Action. Example: "Source: official institution record · Updated 2 hours ago · Authority: Registrar · Status: current · Policy: registration policy v4.2 · View official details."

Freshness states come from semester-core freshness.ts (live ≤ 5 s, recent ≤ 60 s, delayed, failed, rebuilding); delayed data shows a badge and blocks destructive actions until confirmed at the source.
