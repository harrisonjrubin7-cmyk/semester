# Semester institutional rollout — verification report

**Verification date:** 2026-09-23  
**Branch:** `codex/institutional-rollout-design`  
**Baseline:** `origin/main` at `a6dfce2`  
**Release state:** locally verified institutional foundation preview; not production-deployed

## Executive verdict

The approved Phase 0 / Phase 1 preview baseline is implemented on an isolated branch and is usable locally. It preserves the production-default experience, adds a flag-gated five-destination institutional information architecture with seven workspaces, provides two synthetic institutions and eight roles per institution, publishes the complete 17-document package plus master PDF to Google Drive, and packages nine ordered Claude Code execution packets.

This evidence does **not** make the entire Phase 1–8 institutional platform production-ready. Production deployment, real SSO and SIS/LMS credentials, executable tenant-isolation database evidence, institutional agreements, procurement approval, and live pilot acceptance remain external release gates. The current public GitHub Pages deployment was inspected separately and has not been changed by this work.

## Evidence boundaries

| State | Verified result |
|---|---|
| Repository | Feature branch is based on current fetched `origin/main`; `origin/main` is an ancestor and no equivalent implementation was found upstream. |
| Local production-default build | Builds successfully without the preview flag. Browser assertion confirms no institutional preview bar or replacement primary navigation and confirms the existing tabs/rail remain. |
| Local flagged preview | Builds and opens with the five primary destinations, seven workspaces, synthetic role switcher, and explicit Sandbox labeling. |
| Browser behavior | Ten flagged route/viewport probes pass. Required screenshots were recaptured after the startup curtain detached. Keyboard focus is visible and 390px body width has no overflow. |
| Google Drive | Seventeen native Google Docs and one PDF exist in the additive `Semester - Institutional Rollout` folder; 18/18 title, parent, MIME, marker, heading/content readbacks passed. |
| Public live site | `https://harrisonjrubin7-cmyk.github.io/semester/#/search` loaded without page errors on 2026-09-23. In a fresh browser it redirected to onboarding. It contains neither the institutional preview bar nor replacement institutional navigation. |
| Production deployment | Not performed and not authorized by the approved design. |

## Automated verification

| Gate | Result | Evidence |
|---|---:|---|
| TypeScript | Pass | Application and university package type checks completed. |
| Lint and structural checks | Pass | Zero errors; 25 pre-existing warnings retained. |
| Default test suite | Pass | 652 files passed, 1 skipped; 12,527 tests passed, 13 skipped. |
| Time-zone suite | Pass | America/Chicago and Pacific/Kiritimati both passed with the same counts. |
| Shuffled suite | Pass | Seed `1790194886304`; same pass/skip counts. |
| Production-default build | Pass | Vite production bundle completed. Standard large-chunk warnings remain. |
| Flagged production build | Pass | Preview chunks emitted and institutional bundle completed. |
| Cold-route production smoke | Pass | Five cold boots opened the named course without route rewriting or page errors. |
| Flag-off browser assertion | Pass | Preview bar absent; institutional primary nav absent; legacy tabs/rail present. |
| Institutional browser smoke | Pass | Ten route/viewport probes. |
| Navigation interaction sweep | Pass | 59/59 destinations and 71 tabs opened; zero page errors; zero button walls; no screen had more than one filled action. |
| Production contrast sample | Pass | 16 passes, 666 elements measured across selected screens, phone/desktop, Ink/Parchment; zero findings. |
| Flagged preview contrast sample | Qualified pass | 332 elements measured with zero contrast findings; the legacy sweep could not certify setup because the preview intentionally replaces `.app-tabs` / `.rail`. |
| Target-size sweep | Known debt | Preview navigation targets meet the 44px design. Existing screen controls produced 3/126 sub-24px targets on phone and 4/176 on desktop at each density. |
| Publication validation | Pass | 17 DOCX files, 59-page master PDF, 18 artifacts, all 60 capability IDs, no blank pages. |
| Publication visual QA | Pass | All 81 DOCX pages and all 59 PDF pages rendered and inspected; no clipping, overlap, missing glyphs, blank pages, or unreadable tables. |
| Drive readback | Pass | 17 native Docs and one PDF; 18/18 semantic readbacks; zero same-title duplicates in the child folder. |

## Browser captures

- `screenshots/home-desktop.png`
- `screenshots/discover-desktop.png`
- `screenshots/ask-semester-desktop.png`
- `screenshots/inbox-mobile.png`
- `screenshots/calendar-mobile.png`
- `screenshots/student-context.png`
- `screenshots/admin-context.png`
- `screenshots/public-live-site-current.png`

The preview captures use synthetic records only. The bottom control identifies the institution, persona and Sandbox state on every flagged screen.

## Acceptance audit — approved specification §§13–18

### §13 Delivery program

- **Phase 0:** complete for the approved baseline. The repository, public site, supplied source text, 60-capability inventory, source index and traceability registry are reconciled to the extent the sources were readable. The shared ChatGPT URL remains indexed but was not programmatically readable.
- **Phase 1:** preview architecture and authorization boundary are designed and demonstrated with synthetic data. Real tenancy, SSO, audit/consent services, retention operations, backup/restore infrastructure and tenant AI enforcement are not deployed.
- **Phases 2–8:** fully specified and decomposed into ordered execution packets; not represented as implemented product functionality.

### §14 Local preview and launch

- Isolated feature branch based on current `origin/main`: pass.
- Existing production and current public deployment preserved: pass.
- Synthetic institutions and role-specific sample data: pass.
- Desktop and mobile inspection: pass.
- Restart and shutdown procedure: pass in `docs/institutional-rollout/local-preview.md`.
- Production deployment kept separate: pass.

### §15 Drive and publication package

- Additive child folder under the existing Semester Drive folder: pass.
- Seventeen named native Google Docs and one master PDF: pass.
- Local PDF and DOCX reopen/render/visual inspection: pass.
- Google document semantic readback after import: pass.
- Post-conversion Google Docs pixel pagination: not verified because the connector returned only a user-scoped export reference; the local rendered files remain the visual source of record.

### §16 Claude Code execution model

- Nine ordered, bounded packets generated: pass.
- Each packet contains objective, requirements, dependencies, repository areas, interfaces/data, security/privacy, accessibility, tests, verification, migration/rollback, completion evidence, upstream inspection and stop conditions: pass.
- Package order and hashes are validated before delivery: pass.

### §17 Program decomposition

- Phase 0 / Phase 1 baseline plan executed: pass.
- Capability registry, traceability registry, tenant-role schema map, isolation test design, local preview, and publication builders exist: pass.
- Later phases remain dependency-ordered and cannot be truthfully collapsed into this baseline: pass.

### §18 Acceptance boundaries

- React, TypeScript and Supabase remain the build target: pass.
- Five primary destinations coexist with seven contextual workspaces in the flagged preview: pass.
- Existing default functionality is preserved with the flag off: pass.
- No production deployment, external institutional communication, purchasing, credential creation or destructive Drive operation was performed: pass.

## Known limitations and external gates

1. The SQL tenant-isolation probe is present but could not execute locally because this host has no PostgreSQL 17 server. It must pass in a disposable database or CI before any tenancy claim advances.
2. Real SSO, LMS, SIS, messaging, productivity-suite and payment integrations require institution-owned credentials and agreements.
3. Production tenant isolation, backups, restore drills, SLO monitoring, security assessment, accessibility conformance testing and procurement approval require representative infrastructure and accountable institutional owners.
4. The existing sub-24px controls identified by the target sweep are accessibility debt and must be remediated before claiming complete WCAG target-size conformance.
5. The shared ChatGPT conversation URL could not be programmatically read in this execution. Its URL and status remain explicit in the source index rather than being silently substituted.
6. The current public site is a separate deployment. This branch has not been merged or released to it.

## Release decision

**Approved for:** local owner review, stakeholder demonstration with synthetic data, document review, and dependency-ordered Claude Code execution.  
**Not approved for:** production institutional rollout or handling real institutional records.

