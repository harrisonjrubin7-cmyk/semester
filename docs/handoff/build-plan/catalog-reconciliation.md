# Catalog reconciliation — answers to the inventory questions (from "Semester - expanded platform, workspace, and deliv.pdf")

Computed on 2026-10-14 from `ui_kits/master-catalog/catalog-data.js` and the role kits. These are inventory counts, not proof that anything is implemented.

| Figure | Where it lives | Answer |
|---|---|---|
| **673 catalogued screens** | master catalog, 14 groups (A–N) | **651 unique screen names**. 21 names appear in more than one group (22 extra entries) — e.g. the six Trust pages in both Public site (A) and Trust (M), "Holds" in Student, Registrar and Accounts (B, E, F). These are role variants of one screen, not separate screens. |
| **84 workflow-gap screens** | `addedScreens` | **Already inside the 673** — all 84 are in the catalog. Don't add them on top. |
| **319 steps across 17 workflows** | `workflows` | Confirmed: 17 workflows, 319 steps. 314 steps link to a prototype. |
| **88 systems** | `systems` | Confirmed: 58 product systems + 30 platform control systems. |
| **82 documents** | `docs` | Confirmed. |
| **51-role master catalog** | `roles` | **The catalog has 49 roles, not 51.** The 51 came from the roles PDF; two roles were never added. Reconcile against `ui_kits/roles-access` before quoting 51. |
| **26 user + 21 Semester team roles** | `ui_kits/role-lifecycle` | 47 roles. The 21 team roles are **not** in the 49-role catalog's user list — they're company roles. |
| **20-role atlas** | `ui_kits/atlas` | A presentation subset of the catalog roles. |
| **64 screens × 14 roles** | `ui_kits/role-lens` | A sample matrix, not the full catalog. |
| **64 student destinations** | `ui_kits/semester-app` student nav | Not machine-linked to catalog group B (82 Student OS screens). Treat as a subset until each destination carries its catalog id. |
| **107 screens with a prototype** | `proto` | 107 of 651 unique screens have a bespoke or prototype rendering link in the catalog; every-screen renders all 673 generically. |

## Rules adopted
1. **Count unique screens (651), not catalog entries (673),** in any completion metric; list role variants as views of one screen.
2. **Never add overlapping inventories** (the 84 gap screens, the 64 destinations, the role-lens 64) to the catalog total.
3. **One "forbidden" state name.** Use *Forbidden* everywhere (not "no permission" / "denied") — matches the six-state set: default, loading, empty, error, forbidden, offline.
4. **Status is seven separate dimensions**, mapped to the one maturity scale: Definition and Design → Level 1 · Rendering → Level 1 · Behaviour simulated → Level 1, implemented → Level 3 · Data integration-backed → Level 3 · Authorization tested → Level 4 · Verification accepted → Level 4.
5. **Truncated items stay unresolved.** The PDF's truncated final workspace ("im…") is left as an open catalog entry until its role is named.

## Already built that the PDF asks for
- **Four connected Vanderbilt journeys** — `ui_kits/connected-journeys/` (onboarding gates everything, grade release, hold release, plus the fourth) and the 90-second video.
- **Web-to-app journey** — `ui_kits/journey/`. **Every role, start to finish** — `ui_kits/role-lifecycle/`. **Role pages** — `ui_kits/role-pages/`. **Missing role workspaces** (16) — `ui_kits/role-workspaces/`. **Student lifecycle** — `ui_kits/student-lifecycle/`. **Screen × role** — `ui_kits/role-lens/`. **Platform entry with granted workspaces only** — `ui_kits/platform/`.

## Ids (done 14 Oct)
Stable ids now exist: `handoff/build-plan/catalog/` (673 screen entries → 651 canonical + 22 variants, 49 roles, 17 workflows). Counts above are now id-based. 106 canonical screens have a prototype (107 links; one points at a variant).
