# Filed PDFs (6 Oct), each with a .txt extraction

| PDF | What it adds | Where it already lives |
|---|---|---|
| Interactive-ERD-explore-tables | Compliance checker, pgTAP isolation tests, retention safeguard | `../016_*`, `#/trust/monitor` |
| Canvas-AGS-verification-service | Idempotent score-sync worker with retry queues, batch updates and audit logging; walkthroughs of `ags.mjs` and `service.mjs` | `LTI-ADAPTERS.md` (standalone service section) |
| Housing-allocations-DDL | Full housing allocation DDL, isolation assertions, default-deny policy structure | `../semester_campus_portals.sql`, `../014_*`, `../016_structural_tests.sql` |
| Semester-AI-outline | **A third-party app, not Semester.** See below. | — |

## Third-party app with a similar name
"Semester AI – Reader, Tutors" (Bawano Technologies; Google Play `tech.bawano.semester`) is an existing Android app. It offers AI PDF reading and summaries, note scanning, course communities and tutoring.

**This matters for naming.** Get a trademark clearance search and advice from counsel before launch marketing. It's recorded as R-006 in `handoff/assurance/risk-register.csv`.

The product differences are clear and worth stating in positioning:
- **What Semester is:** institution-connected (SIS, LMS, registrar and offices), FERPA-governed, with official records separated from AI suggestions.
- **What the other app is:** a personal study and document app.

| Semester-AI-feature-audit | An audit of the **third-party** Bawano app against NotebookLM and RemNote. The PDF itself warns not to confuse it with your platform. | Competitive context only; see the name-risk note above |
