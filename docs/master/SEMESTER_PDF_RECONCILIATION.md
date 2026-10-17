# PDF reconciliation

**As of** 2026-10-05 · **Status** Phase 0.

## Inputs

| PDF | Read | Content |
| --- | --- | --- |
| `…Command_center_screen_Company_operations_command_c.pdf` (24 pp) | all | Design-system catalog (components by group, kits, tokens), the "make the Claude Design system live" master command, QA gates, branch list |
| `…now_provide_prompt_and_comand_to_go_along_with_the.pdf` (21 pp) | all | The ten-phase master execution command and the Phase 0 output format |
| `…expand_and_devlop_how_i_build_these_into_semester.pdf` (14 pp) | all | Design brief text, content/voice rules, screenshots/route-map requests, finalization prompt, traceability-matrix format |
| `list-every-artifact-and-thing-for-claud-to-genrate.pdf` | **not attached** | unreconciled |
| `expand-evan-further-provide-prompt-and-comand-to-e.pdf` | named as reference 1 of the 22-page native Education OS brief; the file itself was not in this checkout | The 22-page brief was read and reconciled in [`docs/native-platform/`](../native-platform/MASTER_CURRENT_STATE.md). That pass does not mark any domain authoritative. |

The task names four PDFs; the three above are the ones supplied. The repo's own record of earlier PDF reconciliation is `docs/PDF-EVIDENCE-GAP-MATRIX.md` (rendered from `app/src/lib/ops/pdfgaps.ts`), which covers a different set of six readiness PDFs.

## PDF claim → repository status

| PDF item | Repository | Class |
| --- | --- | --- |
| Ink `#090A0E`, Parchment `#F4F1EA`/`#FBF9F4` | `styles/app.css:77`; `lib/look.ts` ramps for `ink` and `parchment` | Native and verified (values match) |
| Semester blue `#416180` / `#94BCE3` | present only as the **industry** accent (`styles/industry.css`, `look.ts`); the brief's "Semester indigo" is a separate offered accent per `docs/decisions/D-1293.md` | Native but incomplete; decision D-1293 says offered, not default |
| Radii 3/6/10 | `styles/app.css:119-121` | Native and verified (a second 2/4/7 scale exists in `industry.css`) |
| Motion 130/180/240/280 ms | `styles/tokens.css:172-175`, zeroed under reduced motion | Native and verified |
| `design-tokens/*.ts` (colors, semantic, …) | only `design-tokens/semester.tokens.json`, **generated** | Not started as separate files; CLAUDE.md forbids hand-editing the JSON |
| `theme-light/dark/density/accessibility/motion/components.css` | do not exist; grounds live in `look.ts`, tokens in `tokens.css` | Duplicate-by-design: creating them would split the token authority CLAUDE.md fixes |
| 51 named components | 33 have no export under the requested name; see [role/screen matrix](SEMESTER_ROLE_SCREEN_WORKFLOW_MATRIX.md) §3 | Native but incomplete |
| Seven nav areas, 64 destinations | 7 areas, 63 rows | Native; off by one |
| Operations Command Center, 31 sections | Console has 10 tabs; see matrix §2 | Native but incomplete |
| 17 `ops_*` read contracts | none exist under those names | Not started (equivalents partial) |
| Transactional outbox / receipts | exist | Native but incomplete (no consumer found) |
| Design handoff docs (`CLAUDE_DESIGN_LIVE_INTEGRATION.md`, TOKEN/COMPONENT/SCREEN migration maps, STATE_MATRIX, TRACEABILITY) | none under those names; covered in part by `docs/design/DESIGN_MIGRATION_MATRIX.md`, `COMPONENT_INVENTORY.md`, `RECOVERY-STATE-LIBRARY.md`, `docs/design-system/*` and open draft PR #1304 | Designed/documented only; overlap with #1304 |
| `docs/finish-line/*` (17 files) | all 17 exist | Already landed; not re-created |
| `docs/master/*` (10 named files) | created now by this branch; broader catalogs already existed | This pass |

## Branch-name note

The session was assigned `claude/sharp-pasteur-qrutl6`. The PDFs' branch program (`audit/semester-master-reconciliation`, …) is not followed literally; the sequence is recorded in the [execution roadmap](SEMESTER_EXECUTION_ROADMAP.md).
