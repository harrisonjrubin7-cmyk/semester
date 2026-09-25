# Pilot Playbook

**Status: `IN_PROGRESS`** — two entry criteria are implemented and one is
partial; the named people, formal audit and support operating model are not.

## Shape of a first pilot

- **One department, one term.** Not a campus.
- **50–200 students.** Small enough to support by hand, large enough to learn.
- **A named faculty or staff sponsor.** Pilots without one die quietly.
- **No writes to institutional systems of record.** Planning and experience
  only, matching what the adapter registry can honestly support.

## Entry criteria — what must be true before a pilot starts

| Criterion | Current |
| --- | --- |
| Tenant isolation enforced and tested | **Met for the institutional data layer** — cross-tenant policy suites pass; legacy direct tables remain outside this claim |
| Monitoring in place | **Partially met** — public Pages/assets/PostgREST run hourly; private workflow/error signals and named-person delivery remain open |
| Incident process with university contacts | **Not met** |
| Data export and deletion available | **Met** — portable/restorable export, specialized-workspace backup, cloud-account deletion and device erasure are user-facing and tested |
| Accessibility audit of piloted workflows | **Not met** |
| Support access model | **Not met** |

**Two met, one partial and three unmet.** This remains a closed gate: partial
monitoring is not incident ownership, and automated accessibility checks are
not a formal audit.

## Success criteria — decided before, measured after

Agree with the sponsor, in writing, before launch:

- Weekly active share of the cohort
- Task completion for the two or three workflows the pilot is actually about
- Support volume per hundred students
- Accessibility complaints (target zero, measured not assumed)
- Sponsor's own stated criterion, in their words

A pilot without pre-agreed criteria is a pilot that gets judged on vibes.

## Exit

Expand, extend, or stop — stated explicitly, with the measurements attached.
"Stop" must be a real option or the criteria were decoration.
