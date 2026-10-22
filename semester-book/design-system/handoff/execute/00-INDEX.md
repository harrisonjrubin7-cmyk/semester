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

## Getting the design files into the repo

Download this design project, then copy into the repo under `design/`: `handoff/`, `templates/`, `docs/`, `ui_kits/`, `guidelines/`, `readme.md`, `SKILL.md`. Code files in handoff/ end in .txt; strip the suffix when installing.

## Founder-only steps (no agent can do these)

- Sign the DPA/FERPA addendum; bind cyber and E&O insurance; submit HECVAT Full.
- Attorney review of docs/legal/*.
- Approve the design-system baseline (stream 00) and every PR.
- Name Vanderbilt contacts for IT, registrar and sponsor.
