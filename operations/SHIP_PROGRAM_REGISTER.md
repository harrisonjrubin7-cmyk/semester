# Semester — ship program register

**Standard:** [`SHIP_PROGRAM_RUNBOOK.md`](SHIP_PROGRAM_RUNBOOK.md) · **Baseline:** `origin/main` @ `b711c5c7` · **Recorded:** 2026-10-13
**Rule:** an item is ticked only with a recorded evidence reference. Nothing here approves a launch; `GO-NO-GO-DECISION.md` and `LAUNCH_COMMAND_CENTER.md` remain the authority for motion-level decisions.

## 1. Build evidence (this session)

Run from `app/` unless noted. Results are for the baseline above; they verify the code builds and its own tests pass. They are not operating proof for any workspace.

| Gate | Command | Result |
| --- | --- | --- |
| Install | `npm ci` (repo root) | exit 0; 236 packages (Node 22.22.0 is below the `^22.22.2` engine range; warning only) |
| Types | `npx tsc -b` | exit 0 |
| Gateway types | `npm run check:university` | exit 0 |
| Lint + style/label audits | `npm run lint` | exit 0; warnings only (pre-existing, e.g. `react(purity)` `Date.now` in `MaintenanceRequests.tsx`) |
| Tests | `npm test` | 1535 files passed, 2 skipped; 24,381 tests passed, 81 skipped; exit 0 |
| Production build | `npm run build` | exit 0 |

**Not run this session:** `npm run test:shuffle`, `npm run design-system:check`, `npm run design-system:report`, browser/visual checks, and any route or tenant-isolation verification in a deployed environment.

## 2. Promotion state

Every workspace is **designed** (source §4). None is implemented-and-verified against the operating-proof items, so none moves up. Production states stay locked: at least 10 of 12 items must be evidenced before any production state, and all 12 before active.

## 3. Workspace × operating proof

Legend: ☑ = evidence reference recorded here · ☐ = open · ◐ = claimed by the source, no evidence reference recorded yet.

Items: 1 Route · 2 Guard · 3 Capability registry · 4 API contract · 5 Data model · 6 Audit · 7 Named owner · 8 Runbook · 9 Tests · 10 Release evidence · 11 Monitoring · 12 Operator view

| Workspace | Phase | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | Evidenced | State |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Public web | 3 | ◐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | 0 of 12 recorded | designed |
| Student OS | 3 | ◐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | 0 of 12 recorded | designed |
| Faculty OS | 4 | ◐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | 0 of 12 recorded | designed |
| Advisor OS | 4 | ◐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | 0 of 12 recorded | designed |
| Registrar OS | 4 | ◐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | 0 of 12 recorded | designed |
| Finance OS | 4 | ◐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | 0 of 12 recorded | designed |
| Student Affairs OS | 4 | ◐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | 0 of 12 recorded | designed |
| Institution console | 3 | ◐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | 0 of 12 recorded | designed |
| Community & marketplace | 5 | ◐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | 0 of 12 recorded | designed |
| External portals (family, alumni, employer, board) | 6 | ◐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | 0 of 12 recorded | designed |
| Company OS | 6 | ◐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | 0 of 12 recorded | designed |
| Developer & partner portal | 6 | ◐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | 0 of 12 recorded | designed |
| Operations OS | 2 | ◐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | 0 of 12 recorded | designed |
| Library & design system | 1 | ◐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | 0 of 12 recorded | designed |

**Note on the source's ticks.** The source ticks item 1 for all 14 workspaces. Its own rule says a tick needs a recorded evidence reference, and it names only the platform shell as evidence. Until a per-workspace route reference is written here, item 1 stays ◐. Item 7 (named owner, a person not a team) is open everywhere; the owner matrix in `OWNER-AND-ACCOUNTABILITY-MATRIX.md` is the place to record it.

## 4. Operating proof gaps that block any workspace from moving

These are cross-cutting; they apply to every row.

| Gap | Runbook item | Where it is known | Owner (per existing register) |
| --- | --- | --- | --- |
| Named owner per workspace | 7 | none recorded here | Founder to name people |
| Runbook per workspace with rollback | 8 | this document covers platform rollback only | Engineering + Operations |
| Release evidence (SHA, deploy id, run links) | 10 | §1 above records the baseline SHA only | Release manager |
| Alerts routed and primary/backup on-call | 11 | `LAUNCH_COMMAND_CENTER.md` (staffing: one person) | Operations |
| Restore, rollback and kill-switch drills | §7.4, §7.6 | `LAUNCH_COMMAND_CENTER.md` (restore unmeasured) | Operations |
| AI gateway bypass sites (≈38) | §5 | source §5 | Engineering |
| Read-only holds (`VITE_READ_ONLY`, `SEMESTER_READ_ONLY`) | §7.4 | source §7.4, not drilled in production | Engineering |

## 5. Vanderbilt activation checklist — status

None of these items is complete. Items 1–2 and 4 are outside the repository (insurance, counsel, the founder's sign-off). Items 3, 5, 6 and 7 need an environment and an institution IdP or registrar that this session cannot reach.

| Item | Status | Blocker |
| --- | --- | --- |
| Cyber + E&O insurance bound | open | external (founder) |
| DPA mapped to the actual data flow | open | external (founder + counsel) |
| HECVAT in the required version | open | external (security lead) |
| SAML SSO with the university IdP | open | needs VU IT sandbox credentials |
| OneRoster sandbox read; staging reconciled | open | needs VU sandbox and registrar |
| Accessibility conformance report for pilot journeys | open | needs qualified assessor |
| Tenant-isolation and connected-journey tests on the release | open | needs a release candidate and staging |
| Restore, rollback and kill-switch drills recorded | open | needs staging and named witnesses |
| Named support primary and backup | open | needs people |
| Pilot measures and stop criteria agreed | open | needs VU sponsor |
| VU written approval to activate the named cohort | open | external (VU sponsor) |
| `GO-NO-GO-DECISION.md` updated to the signed pilot | open | depends on the above |

## 6. Deployment status

- **Production:** not deployed by this session. `pages.yml` deploys on every successful `CI` run on `main`, so merging is a production deploy. The runbook requires an authorized target, capabilities off, and approval before production. That approval has not been given, so nothing was merged.
- **Staging:** no authorized staging target was confirmed in this session. `STAGING.md` describes the intended setup; it was not exercised.
- **Release identity (§7.1):** the SHA above is recorded. Build digest, hosting deploy id, schema fingerprint, flag and policy versions, and approvers are not recorded because no release was made.

## 7. Next executable step

1. Name a person for each workspace (item 7). Without this no row can move past designed.
2. Write a route evidence reference per workspace, or leave item 1 as ◐.
3. Decide whether to publish the candidate to a staging target. That is an external-state change and needs the founder's approval.
