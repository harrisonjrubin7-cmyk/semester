# Configuration Studio

The first item of the platform brief of 30 September
([`expansion/Platform-Operating-Model-Configuration-Workflow-Governance-and-Proof.pdf`](expansion/Platform-Operating-Model-Configuration-Workflow-Governance-and-Proof.pdf)):
*"Build a no-code Institution Configuration Studio … one configurable codebase
rather than hundreds of custom deployments."* Decision: [D-1011](DECISION-LOG.md).

## What is built

`school_config_versions` (`supabase/migrations/20260930230000_configuration_studio.sql`),
`lib/config/`, and a **Configuration** tab on University behind
`VITE_CONFIGURATION_STUDIO` (off by default).

| Rule | Where it is held |
|---|---|
| Eleven domains, each a closed list of keys with a type and a range | `private.config_spec()`; `lib/config/studio.ts` `SPEC`; `studio.test.ts` holds them equal |
| A domain has at most one draft; published versions are numbered 1, 2, 3 … and never edited or deleted | unique indexes, the guard trigger, RLS; `configuration-studio.check.sql` |
| Whoever drafted a change does not publish it; editing a draft makes you its drafter | `private.school_config_guard`; checked on an account holding both roles, and on a rewrite of another person's draft |
| A draft saved since it was opened is not published | `publish` filters on the draft's `updated_at`; `api.test.ts` |
| Publishing changes nothing else in the row | the same trigger |
| A rollback is a new draft copied from an old version and published like any other | `based_on`, checked to exist |
| The reporting floor starts at the platform's n = 10 and can only be raised | spec `min: 10`; `studio.test.ts` ties it to `MIN_COHORT` |
| No card number in typed text; no free-form key; 8 KB a version | spec and guard |
| Every draft, save, publish and discard is audited with the actor's grant | `tenant_policy_audit_event` |

Capabilities: `config:manage` (draft), `config:publish` (publish),
`config:view`. `implementation_manager` and `integration_admin` draft;
`registrar` publishes; `university_admin` does both, never on one change.

## What it does not do yet

**Nothing in the app reads these settings.** `effectiveConfig(rows)` returns a
school's published choices over the platform's defaults, and the screen says
on its first line that nothing is applied. Each domain becomes real when the
feature it describes is connected to `effectiveConfig`:

| Domain | The feature that would read it |
|---|---|
| Academic structure | terms, grading, catalog years (`lib/degree.ts`, `lib/terms`) |
| Workflows | registration readiness (`lib/registration.ts`), advisor approval |
| AI | course policy defaults; the kill switch stays authoritative |
| Notifications | the outbox and quiet hours |
| Data | retention sweeps, offboarding export |
| Reporting | `MIN_COHORT` in `lib/institution-ops.ts` (may only rise) |
| Roles, Branding, Content, Features, Accessibility | their screens |

Wiring one domain is its own change with its own test: read
`effectiveConfig`, and prove that a published version changes behaviour and
that the default does not.

## Where the rest of the brief stands

The brief lists about thirty systems. Read against `main` on 30 September:

| Brief item | State |
|---|---|
| Configuration Studio | **This change** (storage, review, versioning, audit) |
| Workflow Builder and policy engine | Not started (no `workflow_*` tables) |
| Data Governance Center | Partly: `governance_*` registries and classification rules exist |
| Migration Studio, parallel run | Built: Migration Center (D-144) |
| Quality System, critical-period releases | Partly: CI gates and drills; change freezes for critical academic dates are defined in the readiness pack and war-room plan, not enforced by a release gate |
| Marketplace / developer ecosystem | Partly: integration catalog and control plane |
| Ask Semester (source-aware search) | Partly: the Ask tab and source-aware answers |
| Procurement Room, Trust Center | Built (Trust Room) |
| Customer Success OS | Partly: GTM pilot and success plans |
| Constitution and councils | Not found: "constitution" on `main` is the student-organization constitution form (`community/constitution.ts`), not a platform constitution; no councils |
| University Digital Twin, Scenario Simulator | Not started |
| Competency and skills OS, CASE registry | Partly: skills graph, credential wallet |
| Continuity Center, Technology Portfolio, Service Design Studio | Not started |
| Academic Operations Center | Not started |
| Outcomes Lab / privacy-preserving research | Partly: aggregate reporting at n ≥ 10 |
