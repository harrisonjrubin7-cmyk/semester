# 03 · RAID register

> Part of the [program pack](README.md). Assessed **2026-10-04** against `origin/main`
> at `8e9b746`; rows R02 to R04 and I04, I05 and I08 re-read at `c2e582b` for the
> [second report](STATUS-2026-10-04-2.md). Held by [`program.test.ts`](../../app/src/lib/ops/program.test.ts): ids are
> unique, every id cited anywhere in the pack is defined here, and every launch
> risk below is a real row of the launch risk register.

**Scope rule.** Product and launch risks already have a register,
[`LAUNCH-RISK-REGISTER.md`](../../LAUNCH-RISK-REGISTER.md) (FR-001 to FR-016). This page does
not copy them; the first table says which program node each one blocks, so a
reader can go from a risk to the path it sits on. The rows after it are what that
register does not hold: risks to *delivering* the program, the assumptions its
dates rest on, issues found in the records themselves, and the outside parties
the path depends on.

Every row cites its evidence, and a row without a source is an opinion and is
labelled one. Nothing here closes a risk: a risk closes by the rule at the head
of the launch risk register (current, accepted evidence from the authorized
owner).

## Launch risks by reference

| Risk | Priority | Blocks node(s) | Note |
| --- | --- | --- | --- |
| FR-001 entity, jurisdiction, IP chain, signing authority | P0 | EXT-001, EXT-002, EXT-003 | head of every non-engineering path |
| FR-002 no named sponsor, cohort or contract | P0 | PGM-03, EXT-012 | head of every institutional path |
| FR-003 no current DAST and independent review | P0 | EXT-006, EXT-007 | see RAID-I01 before treating EXT-007 as untouched |
| FR-004 target-tenant isolation unproven | P0 | EXT-013 | needs a customer tenant, so after PGM-03 |
| FR-005 production restore, rollback, rights not exercised | P0 | EXT-011 | needs PGM-02 and EXT-009 first |
| FR-006 backups, rota, live escalation absent | P0 | EXT-009 | gates EXT-003, EXT-010, EXT-011 |
| FR-007 no qualified assistive-technology evaluation | P1 | EXT-008 | on the design-partner critical path |
| FR-008 pricing, payment, tax, insurance unapproved | P1 | EXT-004, EXT-005 | paid motions only |
| FR-009 no frozen candidate with hosted-CI evidence | P1 | PGM-01 | head of every engineering path |
| FR-010 retention, legal hold, rights staffing incomplete | P1 | EXT-011, EXT-017 | |
| FR-011 institutional telemetry and alert delivery unaccepted | P1 | EXT-010 | |
| FR-012 no representative UAT or outcome baseline | P1 | PGM-04, EXT-014, EXT-015 | |
| FR-013 performance budgets and real-device coverage | P2 | — | on no path; scaled acquisition only |
| FR-014 canonical sources and index drift | P2 | — | on no path; this pack follows the pointer rule so it adds no second copy |
| FR-015 vendor contracts and assurance unproven | P2 | EXT-017 | |
| FR-016 no repeatable multi-customer evidence | P3 | PGM-09 | broad enterprise only |

## Risks to delivery

| ID | Risk | Evidence | Blocks | Owner | Next action | Trigger to escalate |
| --- | --- | --- | --- | --- | --- | --- |
| RAID-R01 | Evidence bound to a candidate lapses before the gate chain can finish | The [evidence register](../EVIDENCE-REGISTER.md) dates the dependency audit, secret scan and repository verification at 2026-11-01, the production smoke and assurance run at 2026-11-02, and M1/M2 verification at 2026-10-30. The shortest design-partner chain is 4 weeks after PGM-01, and PGM-01 has no estimate | PGM-07, PGM-08 | Engineering | re-run the set at the freeze, not before; record the SHA in the status report | any record at 7 days to expiry with no freeze date |
| RAID-R02 | `main` moves faster than a candidate can be frozen, so exact-SHA evidence never attaches to one commit | 29 merges to `main` since 2026-10-03 00:00 CT, 101 in the 7 days to 2026-10-04, 129 commits since 3 October (`git log origin/main`); then about 21 pull requests merged in roughly five minutes at 13:51–13:56 UTC, leaving CI queued on at least eight consecutive heads (runs 3966–3976); evidence is "bound to the candidate commit" (evidence register); a main CI run took 18 min 43 s (run 3823) | PGM-01 | Engineering | decide how a candidate is cut (PDR-01) and whether feature merges pause (PDR-07) | a second candidate attempt invalidated by a merge |
| RAID-R03 | Parallel sessions build the same thing and collide | At the first report four open pairs shared files: #1149 and #1156 (modularization; ten files, including `app/src/domains/{calendar,identity,policy}/index.ts`), #1164 and #1173 (CFO model), #1158 and #1163 (growth plan), #1161 and #1170 (supply chain). By `c2e582b`: #1173, #1158 and #1170 are merged and #1163 is not open; **still open**: #1149 with #1156, #1164 against merged #1173 (same finance files), and #1161 against merged #1170 (`SECRETS.md`, `supplychain.ts`, `SUPPLY-CHAIN.md`). `CLAUDE.md` records the same pattern on 15 September | none directly; consumes the one reviewer (RAID-R04) | Founder | close or rebase #1164 and #1161; choose between #1149 and #1156 (PDR-02) | a remaining pair both marked ready |
| RAID-R04 | One reviewer for every change | [`CODEOWNERS`](../../.github/CODEOWNERS): one owner for `*`, and its own header says an author cannot approve their own pull request; 73 pull requests open at the first report and 70 at the second (36 drafts, 34 ready) with six more opened meanwhile; ten created 21–22 September | every merge | Founder | name a second reviewer per path, as CODEOWNERS instructs | backlog older than 14 days |
| RAID-R05 | The critical path runs through one person | [Owner matrix](../../OWNER-AND-ACCOUNTABILITY-MATRIX.md): Harrison Rubin is primary on 15 of 15 company seats, 14 backups `UNASSIGNED` and counsel for the legal seat `UNASSIGNED`; the queue names him owner or coordinator of EXT-006, EXT-007, EXT-009, EXT-010, EXT-011. That assignment "does not assign a backup or establish continuous coverage" | EXT-009, EXT-010, EXT-011, EXT-006 | Founder | EXT-009 first: it gates EXT-003, EXT-010 and EXT-011 | any P0/P1 item with its only owner unavailable |
| RAID-R06 | Plan dates quoted before the path is sized | The nodes at the head of every path (PGM-01, PGM-02, PGM-03, EXT-001) have no estimate in the repository ([02](02-DEPENDENCIES-AND-CRITICAL-PATH.md)) | all motions | TPM | owners estimate PGM-01 and PGM-02 and record the figure in 02; until then no date is stated | a date appears in any deck or reply |
| RAID-R07 | Scope pull from the replacement thesis ahead of the evidence | The prompting audit asks for native, replace-everything positioning from inception; [`GO-NO-GO-DECISION.md`](../../GO-NO-GO-DECISION.md) lists GA, enterprise and system-replacement positioning as explicitly not authorized | every public claim | Founder | keep Track A and Track B apart ([02](02-DEPENDENCIES-AND-CRITICAL-PATH.md#track-b-the-target-architecture-conversion)); every claim through the [claims register](../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md) | a claim ahead of its evidence row |
| RAID-R08 | The conversion track competes for the same operator | The CTO pack's first hires are a hypothesis with no funding or T0 ([08](../target-architecture/08-ORGANIZATION-AND-MILESTONES.md)); until they exist the conversion and the launch path share one person (RAID-R05) | EXT-009 | Founder | do not start conversion milestones before PDR-05 | M0 work opened while EXT-009 is open |
| RAID-R09 | Reviews of the pack itself go stale | About 300 documents already exist ([08 §6](../target-architecture/08-ORGANIZATION-AND-MILESTONES.md)); two were found out of step with their own tables on 2026-10-04 (RAID-I03) | consistency | TPM | this pack points and does not restate; its test fails on a dead id or link | a pack row disagrees with its source |

## Assumptions

| ID | Assumption | Basis | Falsified when |
| --- | --- | --- | --- |
| RAID-A01 | There is no T0: no start date, funding or customer | the CTO pack's header says so; FR-002 | any of the three appears; then 02 gains a calendar |
| RAID-A02 | The repository's week ranges are lower bounds on elapsed time | the checklist says estimates begin only after prerequisites exist | a gate closes faster than its range with its prerequisites unmet |
| RAID-A03 | Harrison Rubin remains sole operator of every company seat until a backup is named | owner matrix | EXT-009 closes |
| RAID-A04 | The 2026-10-03 motion decisions stand until an authorized, dated decision supersedes them | [`GO-NO-GO-DECISION.md`](../../GO-NO-GO-DECISION.md) | a dated decision lands |
| RAID-A05 | Design-partner work stays inside the non-activation boundary | the same decision: synthetic data, no customer claims, no live data | a signed activation record |
| RAID-A06 | No external gate has moved since the 2026-10-03 queue | the queue and evidence directory were last changed 2026-10-03 (`git log`); no later artifact exists under `docs/evidence/` | an artifact is filed or the owner reports one |

## Issues

| ID | Issue | Evidence | Action | Owner |
| --- | --- | --- | --- | --- |
| RAID-I01 | EXT-007 is recorded as blocked, but HawkScan is running on `main` | The queue says "BLOCKED: runtime/key unavailable". The workflow's configuration step exits 1 when the key or application id is missing, and that step passed on `dac31c9` with "Run HawkScan" succeeding (run 37198768645, 2026-10-04), as on `7287ddc` (run 37169105822). `stackhawk.yml` says the scan "does not scan the separate Supabase API" | The owner exports the StackHawk findings for a candidate SHA and decides whether the run counts, then updates the queue. A green workflow is not triaged findings or a clean rescan, so EXT-007 stays open | Founder (EXT-007 owner) |
| RAID-I02 | Three documents disagree on whether counsel is engaged | The [council](../LAUNCH-READINESS-COUNCIL.md) and the [operating system register](../../SEMESTER-OPERATING-SYSTEM.md) list the `privacy` seat as held by "Outside counsel"; the [owner matrix](../../OWNER-AND-ACCOUNTABILITY-MATRIX.md) says "COUNSEL: UNASSIGNED" and the queue shows EXT-001, EXT-002 and EXT-003 OPEN | The founder states in writing whether counsel is engaged, who, and for what scope (PDR-04). Until then the matrix, which is later and more conservative, governs | Founder |
| RAID-I03 | Two pages disagree with their own data | The council page's summary reads "Four seats are held … six are vacant", and its table lists 7 held and 5 vacant; the [proof calendar](../PROOF-CALENDAR.md) says `docs/evidence/` "holds only the AI drills of 29 September", and the directory holds nine entries | Correct the prose where the page is rendered or hand-written; neither count is test-guarded | Founder |
| RAID-I04 | Duplicate open pull requests | RAID-R03; three of four pairs partly resolved by merging (second report, V02) | finish the remaining three (PDR-02) | Founder |
| RAID-I05 | No candidate, and `main` heads are outrunning CI | Finished green: `8e9b746` (run 3888), `dac31c9` (run 3850), `1dda09f` (run 3944). Not finished at 14:05 UTC: at least eight later heads, CI runs 3966–3976 queued, and HawkScan queued on the same heads. A finished green run exists, a candidate does not (PGM-01) | recheck the queued runs; a candidate needs a finished green run on its own SHA | Engineering |
| RAID-I06 | Evidence is expiring | Computed from the evidence register for 2026-10-04: nine records expire within 30 days (regression checklist 2026-10-21, master-register re-read and operating-system review 2026-10-28, M1/M2 2026-10-30, then the five of RAID-R01); the pre-reconciliation advisor reading expired 2026-09-30 | renew with the freeze; the register's own escalation steps apply (30, 7 and 0 days) | Engineering |
| RAID-I07 | Branch protection is defined but recorded as not applied | [`docs/BRANCH-PROTECTION.md`](../BRANCH-PROTECTION.md): "not yet applied", so SEC-003 is open. The live ruleset was not read for this report | read the live ruleset and fill the *Applied* table, or record that it is not applied | Founder |
| RAID-I08 | The Supply chain workflow is red on `main` after two correct changes collided | `attest` in `supply-chain.yml` (added by #1170) failed on `2b97e60` and `c2e582b` with "Some specified paths were not resolved, unable to cache dependencies" ([run 37207335895](https://github.com/harrisonjrubin7-cmyk/semester/actions/runs/37207335895)). It sets `cache-dependency-path: app/package-lock.json`; D-1193 (#1193) moved the lockfile to the repository root and deleted that file, and no other workflow names the old path. Not reproduced | the author of #1170 repoints the path to the root `package-lock.json`; recheck the run | Engineering |

## Dependencies on outside parties

None of these can be supplied by the company. A row is "open" when the source
shows no one engaged.

| ID | Party | Needed for | Lead time (checklist) | State | Source |
| --- | --- | --- | --- | --- | --- |
| RAID-D01 | Qualified corporate, privacy and education counsel | EXT-001, EXT-002, EXT-003, EXT-017 | 2–6 weeks per row | unassigned or unknown (RAID-I02) | owner matrix; queue |
| RAID-D02 | Independent security assessor | EXT-006 | 2–4 weeks | open: assessor, scope and date | queue |
| RAID-D03 | Qualified accessibility evaluator | EXT-008 | 2–6 weeks | open | queue |
| RAID-D04 | CPA or tax adviser | EXT-004 | 2–6 weeks, bundled with insurance | open | queue |
| RAID-D05 | Insurance broker | EXT-005 | in the EXT-004 bundle | open | queue |
| RAID-D06 | The institution, with sponsor, champion, IT, privacy, security, accessibility and procurement approvers | PGM-03, EXT-012 to EXT-015, EXT-018 | customer-dependent | seven seats "NOT IDENTIFIED" | owner matrix |
| RAID-D07 | Production providers (contracts, DPAs, regions) | EXT-017 | no estimate | open | queue |
| RAID-D08 | StackHawk account and a scannable target | EXT-007 | no estimate | partly in place (RAID-I01) | workflow run; queue |
| RAID-D09 | Backup personnel for each seat group | EXT-009 | 1–2 weeks once named | none named | owner matrix |
| RAID-D10 | An authorized target environment | PGM-02 | no estimate | none named | queue preconditions |
| RAID-D11 | Funding and a start date for the conversion hires | the conversion track only | n/a | absent (RAID-A01) | CTO pack |

## Decisions awaiting an owner

The program records a decision request here and in the status report; the
decision itself is a `docs/decisions/D-<pull request number>.md` made by the
owner, never by this pack.

| ID | Decision | Why now | Owner | Recommendation |
| --- | --- | --- | --- | --- |
| PDR-01 | Cut each release candidate as a tag from a green `main` SHA and bind evidence to the tag | RAID-R01, RAID-R02: evidence cannot attach to a moving head | Founder, Engineering | adopt; merges continue on `main` |
| PDR-02 | For each duplicate pair, which pull request proceeds | RAID-R03: both halves cannot merge | Founder | one rule for all four pairs: the ready pull request, or the one that passes CI first; the other rebases onto it or closes |
| PDR-03 | Name an escalation level above the founder for items the founder owns | RAID-R05: 15 company seats and five queue items have no one above the owner to escalate to | Founder | a named adviser or board observer, with a stated response time |
| PDR-04 | State whether counsel is engaged, who, and for what | RAID-I02 | Founder | answer in writing; update the council and register to match |
| PDR-05 | Whether the conversion track starts, and the T0 | RAID-R08, RAID-D11 | Founder | not before EXT-009 closes |
| PDR-06 | The first design-partner profile and cohort | PGM-03 is the head of every institutional path; 90-day task `icp-cohort` | Founder | choose one bounded cohort, as the audit and the checklist both advise |
| PDR-07 | Whether broad feature merges to the current application pause while a candidate is frozen | RAID-R02; the audit recommended freezing feature additions except security and data-protection fixes | Founder | pause for the freeze window only |
