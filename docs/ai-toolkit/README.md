# AI Toolkit — documentation index

The University-Wide AI Toolkit brief asks for a source-grounded, student-controlled
set of workspaces that start from a course, an assignment and a goal — not from a
chat box. This folder documents **what this branch builds, what it deliberately
does not, and what a later reviewed phase has to add**.

Every document separates three things, because the brief's first rule is never to
fabricate and a spec that blurs "built" and "planned" is a fabrication about the
product:

- **Built** — in `app/src/lib/toolkit/` and `app/src/components/toolkit/`, tested.
- **Existing** — a Semester screen that already does the job; the toolkit links to it.
- **Not built** — named, flagged off or labelled "Not built yet" in the UI, with what
  a reviewed phase needs before it can exist.

| Document | Covers |
| --- | --- |
| [AI-TOOLKIT-DASHBOARD.md](AI-TOOLKIT-DASHBOARD.md) | Entry, context selection, recommendations and "Why this workspace?" |
| [CROSS-DEPARTMENT-WORKFLOW-MATRIX.md](CROSS-DEPARTMENT-WORKFLOW-MATRIX.md) | The workflow × discipline matrix, mapped to what exists |
| [SHARED-LEARNING-FOUNDATION.md](SHARED-LEARNING-FOUNDATION.md) | What every department inherits |
| [SOURCE-LOCKER-AND-PROVENANCE.md](SOURCE-LOCKER-AND-PROVENANCE.md) | Source labels, verification, lineage |
| [ASSIGNMENT-WORKSPACE-SPEC.md](ASSIGNMENT-WORKSPACE-SPEC.md) | Templates, stages, submission checklist |
| [ACTIVE-LEARNING-ENGINE.md](ACTIVE-LEARNING-ENGINE.md) | Flashcards, practice, spacing — existing Semester features |
| [RESEARCH-STUDIO.md](RESEARCH-STUDIO.md) | The ten-step research workflow |
| [LITERATURE-SYNTHESIS-AND-CITATION.md](LITERATURE-SYNTHESIS-AND-CITATION.md) | Evidence matrix, claim audit, export |
| [DATA-ANALYSIS-STUDIO.md](DATA-ANALYSIS-STUDIO.md) | Import, dictionary, cleaning log, methods, bounded conclusions |
| [CODE-STUDIO-AND-SANDBOX.md](CODE-STUDIO-AND-SANDBOX.md) | Why code execution is off, and what a sandbox must meet |
| [DOCUMENT-PRESENTATION-MEDIA-STUDIO.md](DOCUMENT-PRESENTATION-MEDIA-STUDIO.md) | Writing, slides and media — existing screens |
| [SUBJECT-WORKBENCH-CATALOG.md](SUBJECT-WORKBENCH-CATALOG.md) | Subjects, prefixes, tool states, entitlement |
| [SCIENCE-AND-DNA-LEARNING-SAFETY.md](SCIENCE-AND-DNA-LEARNING-SAFETY.md) | Science boundary |
| [CLINICAL-LEGAL-FINANCIAL-BOUNDARIES.md](CLINICAL-LEGAL-FINANCIAL-BOUNDARIES.md) | Professional boundaries |
| [ACADEMIC-WORK-PROVENANCE.md](ACADEMIC-WORK-PROVENANCE.md) | Who wrote what |
| [RUBRIC-AND-AI-USE-POLICY.md](RUBRIC-AND-AI-USE-POLICY.md) | Policy precedence, redirects, rubric self-check, declaration |
| [DATA-CLASSIFICATION-AND-TOOL-GOVERNANCE.md](DATA-CLASSIFICATION-AND-TOOL-GOVERNANCE.md) | T0–T6 gate, tool states |
| [UDL-AND-ACCESSIBILITY-IMPLEMENTATION.md](UDL-AND-ACCESSIBILITY-IMPLEMENTATION.md) | UDL and accessibility |
| [DEVICE-TEST-MATRIX.md](DEVICE-TEST-MATRIX.md) | Phone / tablet / desktop |
| [AI-TOOLKIT-THREAT-MODEL.md](AI-TOOLKIT-THREAT-MODEL.md) | Threats and mitigations |
| [AI-TOOLKIT-PERMISSION-MATRIX.md](AI-TOOLKIT-PERMISSION-MATRIX.md) | Who can do what |
| [AI-TOOLKIT-TEST-PLAN.md](AI-TOOLKIT-TEST-PLAN.md) | Tests, revert checks, launch gates |
| [AI-TOOLKIT-FEATURE-FLAGS.md](AI-TOOLKIT-FEATURE-FLAGS.md) | Every flag, its default, the kill switch |

## Phases and branches

Built as a stack of draft pull requests, one per phase of the brief, each based on
the one before:

| Phase | Branch | Adds |
| --- | --- | --- |
| 0 | `feature/ai-toolkit-foundations` | Flags, classification gate, policy precedence, catalog core |
| 1 | `feature/ai-toolkit-dashboard` | Dashboard, recommendations, assignment workspaces, rubric self-check |
| 3 | `feature/research-literature-citation-workflow` | Research Studio |
| 4 | `feature/data-analysis-studio` | Data Studio |
| 6 | `feature/subject-workbenches-stem` | STEM subjects |
| 7 | `feature/subject-workbenches-humanities-business` | Humanities, social science, business, arts |
| 8 | `feature/subject-workbenches-professional-creative` | Health, clinical, field sciences |
| 9 | `feature/academic-integrity-provenance` | AI-use declaration, boundary notices, cross-cutting docs |

Phases 2 (active learning and accessibility), 5 (document, presentation and media)
and 10 (security and accessibility hardening) have no branch: 2 and 5 are served by
existing Semester screens the toolkit links to (see
[ACTIVE-LEARNING-ENGINE.md](ACTIVE-LEARNING-ENGINE.md) and
[DOCUMENT-PRESENTATION-MEDIA-STUDIO.md](DOCUMENT-PRESENTATION-MEDIA-STUDIO.md)), and
10's documents — threat model, test plan, device matrix — land with phase 9. Each
phase's code is new only where a phase needed something that did not exist.

**Where the data lives.** On the student's device, through `useDeviceLibrary`
(`app/src/lib/device-library.ts`) — the same store Career, Athletics and
Registration day use. That is the brief's "private by default" in its strongest
form: there is no server copy to leak, share or train on. It is also a real
limitation — no sync between devices — and the UI does not hide it.

**What is not in this slice** and why:

- *Server tables, RLS and the API surface* (§ Data model, § API requirements). The
  toolkit stores nothing server-side yet, so tables with nothing writing to them
  would be untestable schema. The repository's RLS checks run against Postgres
  (`supabase/*.check.sql`), which this branch could not run. The data model is
  written down in [AI-TOOLKIT-PERMISSION-MATRIX.md](AI-TOOLKIT-PERMISSION-MATRIX.md)
  so the phase that adds sync starts from it.
- *AI generation of any kind.* The toolkit structures, checks and links; it does not
  generate. Generation belongs behind the existing governed gateway
  (`app/server/institution`) with a policy check on the server — a client-side
  keyword list is not a control.
- *Code execution, external connectors.* Flags exist and are hard-wired off. See
  [CODE-STUDIO-AND-SANDBOX.md](CODE-STUDIO-AND-SANDBOX.md).
- *Simulators* (DNA lab, circuits, molecules …). Listed in the catalog as "Not built
  yet" or "Needs review before use".

No deployment, no merge, no high-risk feature enabled.
