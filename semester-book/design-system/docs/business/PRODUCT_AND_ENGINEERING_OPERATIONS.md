# Product and engineering operations

_Semester Company OS · 2026-10-05 · Source: uploads/what else on the bussnius and opprations site also.pdf._

> Semester must operate with the same coherence, evidence, reliability and trust it promises to institutions.

| Field | Value |
| --- | --- |
| Mission | Turn evidence into shipped, reliable, accessible product. |
| Owner | Founder → founding engineer |
| Inputs | Customer signals, research, catalog gaps, incidents |
| System of record | GitHub (code, PRs), /ops product operations (backlog, flags, releases) |
| KPIs | Release cadence; Change failure rate; Error budget remaining; Accessibility issues open |
| Reports | Release notes; monthly product review |
| Meeting cadence | Weekly planning; release per engineering playbook |
| Risk controls | CI gates, RLS proof, two-person review for auth/RLS/AI/billing |
| Approval thresholds | No release in pilot launch week, finals or registration opening except S1/S2 fixes |
| Required documents | Engineering playbook, QA test plan, Accessibility test plan, ADR log, PRD template |
| Required integrations | GitHub, Vercel, Supabase (deploy status in /ops) |
| Current status | docs/build/, handoff/execute/, docs/master/ |
| Gaps | PRD template, ADR log, experiment registry |
| Priority | P1 |
| Next action | Run execute stream 00 and approve the design-system baseline |

## Workflows

- Signal → research → problem → opportunity → strategy fit → priority score → PRD → design → threat/privacy/accessibility review → technical design → build → test → controlled release → measure → iterate or retire
