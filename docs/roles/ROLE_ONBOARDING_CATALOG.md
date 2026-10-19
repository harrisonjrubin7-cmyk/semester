# Role onboarding catalog

**As of** 2026-10-05 · **Part of** [`ROLE_SYSTEM_MASTER_MAP.md`](ROLE_SYSTEM_MASTER_MAP.md) · **Status** audit evidence.

## What exists

- **Student carousel:** `app/src/screens/Onboarding.tsx`, five steps (syllabi, drop one in, term and school, account, way in). Step index `state.onb` is ephemeral; `seenOnboarding` is one boolean in local state. It is forced on any cold boot while unset, except for `#/account`, `#/login`, `#/signin`, `#/signup`.
- **Empty state:** `screens/FirstRun.tsx` ("Nothing here yet… Start with a syllabus"). Not a journey.
- **Student journeys:** six task flows in `lib/journeys.ts` (start semester, plan today, learn and practice, complete assignment, work with people, prepare next).
- **Return destination:** `lib/returnto.ts` stores a hash before an OAuth redirect, single use, 15 minutes, re-parsed through the in-app router so it can only yield `#/<screen>[/<id>]`. No open-redirect path was found.
- **Server:** `public.onboarding_progress(user_id, step_key, completed_at)`, student-owned, readable by an accepted mentor. 0 rows on the live project. Tenant-side equivalents: `implementation_projects`, `implementation_milestones`, `tenant_rollout`, `tenant_rollout_evidence`, `school_config_versions`, `migration_projects`, `roster_import_*`, `beta_*`, `gtm_*`.

## What does not exist

No `onboarding_journeys`, `onboarding_journey_versions`, `onboarding_steps`, `onboarding_step_conditions`, `onboarding_assignments`, `onboarding_step_progress`, `onboarding_events`, `onboarding_checklists`, `onboarding_reminders`, `onboarding_support_handoffs`, `activation_definitions`, `activation_events` or `first_value_events` table (live catalog and migrations). No journey is versioned, assigned by account and role and entitlement, resumable across clients, or able to hand off to support. Activation events are "definitions only; defer collection" in [`SPRINT-1-REGISTRATION-PATH.md`](../SPRINT-1-REGISTRATION-PATH.md). The only activity record is `public.activity`, constrained to three marks (`opened`, `course`, `studied`), which is content-free by construction.

**Reconcile, do not duplicate.** `onboarding_progress` is the canonical seed for step progress; extend it and name new tables to match, with RLS and a check file, instead of creating a parallel set. Operator-side tenant onboarding already has rollout and implementation tables; the journey engine should reference them.

## The twelve journeys

| # | Journey | Entry today | Server pieces that exist | Missing | Class |
| --- | --- | --- | --- | --- | --- |
| 1 | Self-serve student | Carousel | `profiles`, `activity`, `onboarding_progress` | Versioning, resume, first-value event, optional PWA prompt step | Native but incomplete |
| 2 | Institution-linked student | Carousel plus `SchoolClaim` | `claim_school`, `school_membership_requests`, `school_enforcement_readiness`, source labels (`lib/source.ts`) | SSO-first path, official-data source labels step, permitted next action | Native but incomplete |
| 3 | Applicant | `Applying.tsx` | `prospective_student`, `admitted_student` (no capability) | Program action plan, save and return, support handoff | Static prototype only |
| 4 | Faculty | none | `faculty` role, `course:publish`, Course Studio | Invitation or SSO entry, course access, first teaching intent | Not started |
| 5 | TA | none | `teaching_assistant` role | Scoped course relationship, assigned work, first contribution | Not started |
| 6 | Advisor | none | `academic_advisor`, advisor shares | Caseload access, work queue, first check-in | Not started |
| 7 | Registrar / academic operator | none | `registrar`, console `role-grant` with fresh MFA | Elevated identity step, training acknowledgement, scoped first action | Not started |
| 8 | Institution administrator | Console-granted role; University tabs | `tenant_rollout`, Modules, Configuration Studio, SCIM backend | Setup checklist, launch gate view, SSO and SCIM screens | Native but incomplete (backend) |
| 9 | Institutional buyer | Company-site forms | `site_leads`, `gtm_prospects`, `lead-intake`, trust room | `/pilot` page, qualification, workspace, implementation handoff | Native but incomplete |
| 10 | Implementation lead | none | `implementation_projects`, `tenant:implement`, readiness gates in `tenant_rollout` | Workspace, task list, go-live handoff | Not started in the UI |
| 11 | Partner / developer | none | none | Account, terms, sandbox, scoped credentials, certification | Not started |
| 12 | Semester employee | Console-granted | `role_grants`, `console_duty` | Provisioning, required training, access-review cadence | Not started |

## Requirements for the engine (acceptance for `feat/student-onboarding-and-first-value`)

1. Journey and version are rows; a journey is assigned from account, tenant, role, entitlement and entry intent, evaluated on the server.
2. Progress is stored server-side with distinct required, optional, skipped and blocked states, and resumes on a second device.
3. A safe return destination is a screen key, never a URL; the existing `returnto.ts` contract is kept.
4. Every step has an accessible name, keyboard path and narrow-screen layout; tests cover them.
5. Events carry no record content. A test fails if an event payload contains a free-text field.
6. First-value and activation events are definitions in a table, collected only after the privacy test exists.
7. A blocked step offers a human handoff using the existing support ticket path.
8. No journey grants a role. Role grants stay on the single console duty.
