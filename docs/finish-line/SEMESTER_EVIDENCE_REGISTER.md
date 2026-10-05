# Semester evidence register (finish line)

| | |
| --- | --- |
| **Version** | 0.1 |
| **As of** | 2026-10-05, `origin/main` `790ebbf` |
| **Owner** | Harrison Rubin |

## How this differs from `docs/EVIDENCE-REGISTER.md`

`docs/EVIDENCE-REGISTER.md` is rendered from `app/src/lib/ops/evidence.ts` and
tested. It lists the **dated artifacts that exist**, each with a validity and an
expiry. This register lists the **evidence the finish line requires**, which
exists, which is missing and who can produce it. They are not duplicates.
When an artifact here is filed, it joins the rendered register with its own date,
and the row here cites it. Nothing here replaces the rendered register's
expiry logic.

## Evidence categories and state

State: `held` a dated artifact exists · `partial` exists with a stated limit ·
`none` not found · `H` needs a human, vendor or customer.

| ID | Category | Required evidence | State | What exists (path) | Missing |
| --- | --- | --- | --- | --- | --- |
| EV-01 | Security | Independent assessment; DAST run; assurance run | partial `H` | `docs/evidence/security/2026-10-03-founder-assurance-run.md` (self-run), dependency audit and secret scan 2026-10-02 | EXT-006 independent assessment; EXT-007 HawkScan |
| EV-02 | Privacy | Signed DPA; PIA; retention proof | partial `H` | `docs/trust/*`, `lib/governance/pia.ts`, erasure drill 2026-09-30 | DPA signature; counsel review |
| EV-03 | Accessibility | Manual AT pass; qualified ACR | none `H` | `2026-10-04-automated-sweeps.md`, `VPAT-ACR-SELF-ASSESSMENT.md` (self) | EXT-008; recorded human pass |
| EV-04 | AI governance | Model-quality baseline; red team per model | partial | injection red-team 21/21 and kill-switch drill (2026-09-29) | live quality baseline (EV-01 in the AI framework) |
| EV-05 | Availability | Measured uptime against SLO over a window | none | hourly probes; production smoke 2026-10-03 | measured window |
| EV-06 | Backups | Provider backup on; PITR on; owner and date | none `H` | logical rehearsal 2026-09-30 | confirm PITR |
| EV-07 | Disaster recovery | Production restore with recovery point and time | none `H` | `restore-drill.sh` (no result recorded) | the drill |
| EV-08 | Incident response | Target-environment tabletop; alert-to-person demo | partial | founder tabletop 2026-10-03 (documents only) | EXT-010, EXT-011 |
| EV-09 | Data retention | Retention jobs proven live | partial | `retention.test`, sweep suites | cron proof |
| EV-10 | Vendor risk | Provider DPAs; subprocessor review | partial `H` | `docs/SUBPROCESSORS.md` | EXT-017 |
| EV-11 | Access review | Dated review of every console and grant | none | owner attestations | the review |
| EV-12 | SDLC | Branch protection; required checks; review rule | none | `.github/rulesets/main.json` (unapplied) | apply |
| EV-13 | Penetration testing | Report and retest | none `H` | — | EXT-006 |
| EV-14 | Vulnerability management | Findings register with owners and clocks | partial | `docs/security/FINDINGS-REGISTER.md`, `SECURITY.md` | tracked closure |
| EV-15 | Change management | Release record per change | partial | PR history, `CHANGELOG.md` | per-release evidence ([below](#release-evidence-gate)) |
| EV-16 | Logging | Tamper-evident, searchable audit | partial | chains for 3 streams | gateway streams; single search |
| EV-17 | Tenant isolation | Generic cross-tenant sweep, green in CI | none | per-feature suites (111) | TI-01/TI-04 |
| EV-18 | Integration controls | Real-source acceptance for each adapter | none `H` | mocks and contract tests | first adapter |
| EV-19 | Academic integrity | Policy engine, versioned, independent review | partial | `lib/governance/grading-ai.ts`, gradebook second-person moderation | institution sign-off |
| EV-20 | Commercial controls | Executed paper; price book | none `H` | `commercial.check.sql`; live monthly checkout 2026-10-03 | paper; price |
| EV-21 | Customer success | One pilot's weekly and midpoint records | none `H` | blank templates | a pilot |
| EV-22 | Outcome methodology | Baseline, metric definitions, privacy-safe measurement | none | `PRODUCT-ANALYTICS-DATA-ETHICS.md`, `ANALYTICS-EVENTS.md` (definitions only) | events built |
| EV-23 | Public claims | Every available claim rests on an unexpired record | partial | `app/src/lib/ops/claims.test.ts` refuses an expired record under an available claim | claims reportedly 0 of 40 available |
| EV-24 | Gates baseline | Typecheck, lint, tests, build, SQL suites on the candidate commit | partial | this session: tsc 0, lint 0, tests 22,897 passed (`ran`, 2026-10-05) | `check:university`, shuffle, build, SQL suites, hosted CI on the exact commit |

The 18 external-evidence items in `docs/finalization/EXTERNAL-EVIDENCE-QUEUE.md`
(EXT-001 to EXT-018) map onto the `H` rows above. On 2026-10-04 that queue
reported 0 of 18 closed (3 partial, 8 open, 7 blocked).

## Trust maturity path

1. Internal evidence register — **this document and the rendered one.**
2. Public Trust Center — partial.
3. Controlled security document room — partial (`trust_room_*`).
4. HECVAT Lite evidence package — draft.
5. Full HECVAT where requested — not sent.
6. Customer-specific DPA and security review — none.
7. Periodic control review — monthly in the [cadence](SEMESTER_COMPANY_OPERATING_CADENCE.md).
8. External assurance or audit readiness — none.

## Release evidence gate

Every feature or release carries the record below. It is the rule that prevents
a release being marked production-ready without evidence.

| Field | What is recorded |
| --- | --- |
| Requirement | the register row id and the sentence it satisfies |
| Owner | a seat, with backup |
| Design | link |
| Source authority | official, derived, AI-generated, student-owned, external, community |
| Data classification | T0–T3 per the classification matrix |
| Permission model | capability and role |
| Tenant scope | tenant, course, student, public, private |
| Accessibility evidence | automated record plus the AT pass reference |
| Security review | finding ids and result |
| Privacy and retention review | table-classification and retention entries |
| AI policy | route, ceiling, tool matrix entry (if AI) |
| Tests | file paths, and the revert-fails-the-test record |
| Monitoring and SLO | monitor name and objective |
| Support path | runbook and owner |
| Rollback | how, and who |
| Documentation | link |
| Release evidence | dated artifact under `docs/evidence/` |
| Customer-facing claim review | claims-register id and status |
| Review date | when the row is re-read |

### What is enforced today

`app/src/lib/ops/finishline.test.ts` reads
[the readiness register](SEMESTER_RELEASE_READINESS_REGISTER.md) and fails when:

1. any of the 17 finish-line files is missing;
2. a row's Release is `pilot-ready`, `production-ready` or `authoritative` and
   its Evidence cell is empty or `—`;
3. a row's Class or Release is not in the vocabulary.

It does **not** yet enforce the full field list above. That would need the
register to carry each field per row, which is the follow-up in the
[90-day plan](SEMESTER_90_DAY_FINISH_LINE_PLAN.md) (action 8). The guard was
shown to fail against a deliberately promoted row before it was committed; see
the pull request description.

## Filing rules

1. The artifact states its own date, scope and limit in its first lines.
2. Self-run, author-run and independent evidence are labelled as such. Do not
   upgrade the label.
3. A passing run is bound to a commit hash.
4. A drill records date, owner, recovery point and time, and who watched.
5. An expiry is stated. A record without one is not valid for a claim.
6. Filed under `docs/evidence/`, then added to `app/src/lib/ops/evidence.ts` so
   the rendered register and its test pick it up.
