# Career portability and lifelong access

Part 10 of the expansion command. Phase 5. Nothing here is built yet; much of
the career hub is.

## What exists on main

- **Career** (`app/src/screens/Career.tsx`, nav id `career`) with
  `app/src/lib/career.ts`: opportunities, experiences, contacts, study abroad.
- Skills graph: `app/src/lib/skills-graph.ts` (`deriveSkillClaims`,
  `explainFit`, `missingSkillPlan`) and `app/src/components/SkillsGraph.tsx`,
  behind the `careerSkillsGraph` flag. That is the course → skill → artifact →
  opportunity graph the command asks for, already.
- Applications: `app/src/lib/apply.ts` (nav id `applying`).
- Database: `skill_records` with a verification workflow (`skill:verify`),
  `skill_claim` and `skill_claim_evidence`, `talent_profiles` (opt-in,
  expiring, employer-visible) with a receipt per view in
  `talent_profile_views`, `opportunities`, `alumni_mentor_offers`.

## In flight

Nothing directly. #788's AI-use declarations become portfolio evidence.

## Entity plan

| Command entity | Decision | Why |
|---|---|---|
| `skills`, `skill_evidence_links` | **Reuse** `skill_records`, `skill_claim`, `skill_claim_evidence` | |
| `experience_records` | **Reuse** `career.ts` experiences | |
| `portfolio_items`, `portfolio_visibility_settings` | **New** `portfolio_items` with a visibility column (`private · link · school · employers`) | |
| `competency_artifacts`, `verification_records` | **Reuse** `skill_records` verification | It already has verified-by and verified-at |
| `career_applications` | **Reuse** `apply.ts` on the device; a table only if the student syncs it | |
| `interview_preparation_records` | **Device-local** | |
| `alumni_transitions`, `lifelong_access_profiles` | **New** `alumni_transitions` | Records what moves to an alumni account and when institutional access ends |
| `employer_project_briefs`, `micro_internships` | **Reuse** `opportunities` with two new kinds | Same publish and moderate workflow |

## Capabilities and flags

- `skill:verify`, `opportunity:publish`, `opportunity:moderate`, `talent:search`
  (all exist).
- Flag `career.portfolio`, `off`.

## Hard boundaries

- The learning record is labelled **"Not an official transcript"** wherever it
  is shown or exported.
- A portfolio item is private until the student changes it, one item at a time.
- After graduation, institution-sourced data (courses, verified skills) is
  exported to the student and then **stops syncing**; the student's own work
  stays theirs, per [`RETENTION.md`](../RETENTION.md).
- Employer briefs and micro-internships appear only where the school approved
  the employer.

## Tests

- A new portfolio item is private; an employer query cannot read it
  (`.check.sql`).
- The exported learning record contains the "not an official transcript" line.
- An alumni transition keeps student-owned rows and ends read access to
  institution rows.
