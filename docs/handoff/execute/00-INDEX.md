# Semester — execute everything

> Read `handoff/BUILD.md` first. Run `preflight.sh`, `install.sh`, then these streams; run `verify.sh` after each.

One prompt per stream, run in order. Each stream works on its own branch and ends with a PR and a report. Do not start a stream until the previous one’s exit gates are ticked.

## Master prompt (paste into Claude Code or Codex at the repo root)

```
You are building Semester in harrisonjrubin7-cmyk/semester.
Read handoff/BUILD.md and follow it exactly. Run handoff/preflight.sh and handoff/install.sh. Then run each stream file in order:
handoff/execute/00-setup.md
handoff/execute/01-platform-core.md
handoff/execute/02-identity-sso.md
handoff/execute/03-student-os.md
handoff/execute/04-staff-academic.md
handoff/execute/05-institution-integrations.md
handoff/execute/06-ai-gateway.md
handoff/execute/07-community-career-family.md
handoff/execute/08-ops-command-center.md
handoff/execute/09-trust-security.md
handoff/execute/10-launch.md
handoff/execute/11-company-site-grow.md
handoff/execute/12-one-place.md
handoff/execute/13-platform-maturity.md
handoff/execute/14-native-platform.md
handoff/execute/15-native-finance.md
handoff/execute/16-native-operations.md
handoff/execute/17-web-to-app-journey.md
handoff/execute/18-role-system.md
handoff/execute/19-academic-records.md
handoff/execute/20-social.md
handoff/execute/21-work-studio.md
handoff/execute/22-trust-ferpa-data.md
handoff/execute/23-collab-reliability.md
handoff/execute/24-shell-nav-mobile.md
Then follow handoff/execute/30-phased-build.md for phase order across streams 00–29; it overrides the numeric order above when they differ.
The interactive prototype at design/ui_kits/semester-app/ is the acceptance reference; handoff/prototype/SCREEN-INVENTORY.md lists every screen and its stream.
For each stream: create branch semester/<slug> from origin/main, do the tasks, run every check, write the report to docs/execute/<nn>-<slug>-report.md, open a PR, and STOP for human review before the next stream.
If an input file is missing from the repo, copy it from the Semester design project export under design/.
Never deploy, change secrets, or mark anything complete without evidence.
```

## Streams

| # | Stream | Branch | Depends on |
| --- | --- | --- | --- |
| 00 | Repo audit and design-system sync | semester/setup | — |
| 01 | Database, tenancy, RLS and core logic | semester/platform-core | 00 |
| 02 | Identity, SAML SSO, onboarding | semester/identity-sso | 01 |
| 03 | Student OS | semester/student-os | 01, 02 |
| 04 | Faculty, TA, advisor, registrar, finance, student affairs | semester/staff-academic | 01, 02 |
| 05 | Institution console, integrations, migration | semester/institution-integrations | 01, 02 |
| 06 | Governed AI gateway | semester/ai-gateway | 01, 02 |
| 07 | Community, career, family, developer platform | semester/community-career-family | 01, 02 |
| 08 | Operations command center and site operations | semester/ops-command-center | 01, 02 |
| 09 | Security, privacy, accessibility, compliance | semester/trust-security | 01, 02 |
| 10 | Pilot launch | semester/launch | 01, 02 |
| 11 | Public site, GTM, run and grow | semester/company-site-grow | 01, 02 |
| 12 | One place: nobody leaves Semester | semester/one-place | 00–08 |
| 13 | Platform maturity | semester/platform | 00–10 |
| 14–17 | Native platform, finance, operations, web-to-app journey | see each file | 01, 02 |
| 18 | Role-system reconciliation | semester/role-system | 01 |
| 19 | Gradebook, degree audit, advising, transcripts (32 screens) | semester/academic-records | 01, 02, 04 |
| 20 | Semester Social: feeds, video, threads, profiles, ranking, moderation, analytics (32) | semester/social | 01, 02, 09 |
| 21 | Work Studio and Semester Intelligence (32) | semester/work-studio | 01, 02, 06 |
| 22 | FERPA, data flows, vendor controls, AI governance (12) | semester/trust-ferpa-data | 01, 09 |
| 23 | Collaboration infrastructure, reliability, migrations (3 + Studio infra) | semester/collab-reliability | 21 |
| 24 | Shared shell, role resolver, navigation, notifications, mobile (53) | semester/shell-nav-mobile | 01, 02; finish last |

## Getting the design files into the repo

Download this design project, then copy into the repo under `design/`: `handoff/`, `templates/`, `docs/`, `ui_kits/`, `guidelines/`, `readme.md`, `SKILL.md`. Code files in handoff/ end in .txt; strip the suffix when installing.

## Founder-only steps (no agent can do these)

- Sign the DPA/FERPA addendum; bind cyber and E&O insurance; submit HECVAT Full.
- Attorney review of docs/legal/*.
- Approve the design-system baseline (stream 00) and every PR.
- Name Vanderbilt contacts for IT, registrar and sponsor.
- [18-role-system.md](18-role-system.md) — role-system reconciliation and execution (run handoff/role-reconcile.sh first)
- [../mainframe/START.md](../mainframe/START.md) — mainframe execution: setup, start and continue prompts (supersedes per-stream order for new sessions)

- `25-completion-program.md` — 18 completion packages, independent status stages, screen contract, platform blockers. Run after reconciliation; gates every other stream’s “done”.
- `26-faculty-os-intelligence.md`: Faculty home + Semester Intelligence as executive assistant, research partner and AI TA. After stream 04 teaching gaps close.
- `27-executive-os.md`: Executive decision layer, metric contract, partner scorecard, AI cost model, 35-row cross-domain gap matrix.
- `28-career-interview.md`: Career OS + Interview Studio (prep record, story bank, practice + feedback loop, applications, offers, boundaries).
- **`30-phased-build.md`: START HERE for phased hand-off.** Orders streams 00–29 into Phases 0–5 (audit → foundation → student daily loop → cross-role domains → institutional operation → enable/replace), each with prototype routes, repo targets, exit gate and report contents. Evidence register: `#/os/finish`.
- `29-account-identity-mail.md`: Semester Account, username, Account Center, safe linking, Semester Mail states, deliverability gate, offboarding, Continue with Semester.
