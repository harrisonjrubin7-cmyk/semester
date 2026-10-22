# AI Workflow Router & Benchmark Lab (prototype)

Interactive prototype of the app specified in the pasted brief, built from this design system. Router (6 inputs → primary/secondary, confidence, reasons, limits, escalation, handoff, prompts, GitHub plan, Supabase prompt, MD/JSON export), sortable 16-column feature matrix, the 12 canonical workflows, and a benchmark grid with per-run persistence test, 0–5 grading with the persistence ceiling, weighted scores, leaderboard and CSV/Markdown export.

Prototype mode: runs are saved to this browser only (localStorage) and labelled so. The production app — Next.js + Supabase with RLS — is in `handoff/workflow-router-app/`; `lab-engine.js` is a plain-JS port of its `lib/` and must be kept in step.
