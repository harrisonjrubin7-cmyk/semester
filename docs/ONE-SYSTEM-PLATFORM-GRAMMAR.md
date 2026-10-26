# One system: the platform grammar

<!-- Rendered from app/src/lib/onesystem.ts by onesystem.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).

What makes Semester feel like one coherent system rather than a bunch of
different screens and tools: one information architecture, one object model,
one design system, one trust pattern, one action model, one notification
centre, one search, one data-agency centre, one operational control plane,
twelve consistency release gates and seven cross-domain relationship rules —
from two documents of 28 September 2026, held to what the tree already has
for each. The [UI constitution](design/SEMESTER-UI-CONSTITUTION.md) is the
design system’s own law; the [do-not-build page](DO-NOT-BUILD.md) holds the
roots.

**Build one platform with many domains, not many products stitched together.** The shared foundations mostly exist as parts. The gap is how they are joined: three navigation models where the documents want one, a trust vocabulary in three components, the pieces of an action model with no single pipeline, notification controls spread across files, and an operations console whose screen unifies seven views while five more stay data or University tabs. So this page is less a list of things to build than a list of things to converge, and each row says which.

| Supplied document | What it holds |
| --- | --- |
| [Canvas vs Blackboard vs Moodle vs D2L Brightspace (… also anything else to make it feel like one system, consistent throughout)](expansion/LMS-Developer-Migration-Guide-and-One-System.pdf) | One information architecture, one object model, one design system, the Source/Scope/Status trust pattern, one action model, one notification centre, one search and command system, one profile and data-agency centre, one operational control plane, the consistency release gates and the eleven foundations. |
| [Sortable LTI 1.3 dashboard (… map out the shared object model schema)](expansion/LMS-Migration-Runbook-Blackboard-Moodle-and-Shared-Object-Model.pdf) | The core hierarchy, the universal metadata envelope, the core entities, the universal trust API shape and the cross-domain relationship rules. |

A status is a claim about the best piece of a row: `tested` cites a test that
runs on every change, `building` code, `designed` a document, `not-started` at
most a document naming the gap. The supplied PDFs are never evidence.

## One information architecture

The documents’ nine top-level areas, each at the app root that carries it. The app has 7 roots; the test holds every name to that list. The one app root the documents have no area for is `courses`.

| Area | App root | Note |
| --- | --- | --- |
| Today | `home` | The Today briefing; Notices sits under it. |
| Learn | `study` | Study, the Studio, revision and practice. |
| Plan | `calendar` | The calendar, the runway and the term. |
| Community | `mine` | Community lives on the Beyond shelf under Mine; it is not a root of its own. |
| Opportunities | `mine` | The same shelf as Community. |
| Support | `support` | A root; the nav entry itself files under Me. |
| Messages | — | No Messages root: Email is a screen under the Courses root and Notices sits under Today. |
| Search | — | A screen and a shortcut (`/`, ⌘K), and a root only in the five-destination journey mode. |
| Me | `me` | The profile and data-agency centre. |

Then the same contextual navigation everywhere: Institution → Term → Course, Community or Service → Object. A student never needs to know which backend system owns an item in order to use it.

| ID | What | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| roots | One stable top-level structure everywhere | tested | `app/src/state/shape.ts`: ROOTS: the seven roots<br>`app/src/donotbuild.test.ts`: the roots match the ones written on the do-not-build page | Three navigation models coexist: the seven roots, the five journey destinations in `lib/tabbar.ts`, and the institutional workspaces in `lib/institutional-ia.ts`. None is the documents’ nine. |
| context | Consistent contextual navigation: institution → term → course → object | building | `app/src/components/unity/ContextBar.tsx`: context → object → source, freshness and save → action, on the hubs and the studio<br>`app/src/components/TermSwitch.tsx`: a term switcher, hidden with one term<br>`app/src/components/CoursePicker.tsx`: a course picker<br>`app/src/components/SchoolPicker.tsx`: a school picker<br>`app/src/lib/parent.ts`: a one-level “up” link, and why there is no breadcrumb trail | The switchers are separate components; there is no one institution → term → course switcher, and no breadcrumb by design. |
| **total** | | not-started 0, designed 0, building 1, tested 1 | | |

## One object model

Every module uses the same shared objects: Person, Institution, Role, Term, Course, Community, Service, Opportunity, Task, Event, Document or source, Plan, Assessment, Submission, Feedback, Grade, Share, Notification, Conversation, Integration, Audit event. Every object carries the same envelope, at what the tree has:

| ID | Field | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| owner | Owner | building | `app/src/lib/integration/lineage.ts`: SourceOwner, per source<br>`docs/FIELD-LINEAGE-AND-SOURCE-FRESHNESS.md`: the lineage model, mostly unbuilt | Per source, not per object. |
| source | Source | tested | `app/src/lib/source.ts`: the five labels the database enforces<br>`app/src/lib/source.test.ts`: held to the check constraint | None. |
| authority | Authority level | building | `app/src/intelligence/contracts.ts`: EvidenceReference.authority on assistant citations<br>`app/src/lib/governance/rollout.ts`: DataAuthority, per tenant | Only on citations and tenants; no object says who decides it. |
| scope | Scope and permissions | building | `app/src/components/unity/Visibility.tsx`: Audience: only me, course, collaborators, portfolio<br>`app/src/lib/unity.ts`: SourceDetail.visibility | A display audience, not a permission model per object. |
| status | Status and freshness | tested | `app/src/lib/source.ts`: freshnessLine<br>`app/src/lib/status.ts`: the status keys<br>`app/src/lib/integration/freshness.ts`: freshness from age<br>`app/src/lib/source.test.ts`: the freshness line | None for what is shown; nothing computes freshness for a course material. |
| version | Version | building | `app/src/lib/docversions.ts`: document versions<br>`app/src/lib/integration/mapping-versions.ts`: mapping versions | Documents and mappings only. |
| retention | Retention class | tested | `packages/institution/src/events.ts`: RETENTION_CLASSES on events<br>`app/src/lib/retention.test.ts`: every table has a retention line<br>`RETENTION.md`: the schedule per table | Per table and per event, not on an object. |
| accessibility | Accessibility metadata | not-started | `docs/ACCESSIBILITY-POLISH-CHECKLIST.md`: the checklist; nothing per object | No object carries alt text, captions or an accessible-equivalent flag. |
| audit | Audit history | tested | `app/src/lib/journal.ts`: the activity journal with provenance on every entry<br>`app/src/lib/journal.test.ts`: well-formed provenance required<br>`app/src/lib/audit-entities.test.ts`: the audited entity types | No unified event schema: four audit tables with their own shapes. |
| undo | Recovery and undo state | tested | `app/src/lib/undo.ts`: one-step undo with field snapshots<br>`app/src/lib/undo.test.ts`: undo and its limits<br>`app/src/screens/Recovery.tsx`: the recovery screen | One step, on the device. |
| **total** | | not-started 1, designed 0, building 4, tested 5 | | |

The documents’ universal metadata envelope, in full: `id`, `tenant_id`, `external_ids[]`, `object_type`, `owner_id`, `created_at`, `updated_at`, `created_by`, `updated_by`, `source_type`, `source_system`, `source_reference`, `source_url`, `source_version`, `source_retrieved_at`, `authority_level`, `visibility_scope`, `access_policy_id`, `retention_class`, `retention_until`, `legal_hold_status`, `status`, `freshness_status`, `effective_at`, `expires_at`, `archived_at`, `version`, `previous_version_id`, `change_reason`, `audit_correlation_id`, `accessibility_metadata`, `language`, `rights_classification`, `data_classification`. No table carries it whole; the fields it names are spread across the source labels, the retention schedule, the events and the audit tables above.

## One trust pattern: Source, Scope, Status

Where did this come from; who can see or act on it; is it official, estimated,
draft, current, pending, stale, restricted, archived, or does it need review.
The status words, held to `lib/provenance.ts`:

| Documents’ word | App word |
| --- | --- |
| official | `Verified` |
| estimated | `Estimated` |
| draft | `Draft` |
| current | `Current` |
| pending | `Pending` |
| stale | `Stale` |
| restricted | `Restricted` |
| archived | `Archived` |
| needs review | — (the label exists in `lib/source.ts` as `needs_review`; the status list has no word for it) |

| ID | What | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| one-component | The same trust component in every product area | building | `app/src/lib/provenance.ts`: Provenance {source, scope, status} and the status words<br>`app/src/components/SourceBadge.tsx`: source and freshness, in twenty-six screens; no scope<br>`app/src/components/SourceBadge.test.tsx`: the badge<br>`app/src/lib/source.ts`: TRUST_KINDS: the five labels plus AI-assisted and external, for display<br>`docs/design/SEMESTER-UI-CONSTITUTION.md`: §5: three trust vocabularies, marked as a fault | Three vocabularies (SourceBadge, NotOfficial, Disclosure), and `provenance.ts` names a component that does not exist. |
| trust-api | One trust payload on every user-facing object: source, authority, scope, status, version | designed | `docs/design/SEMESTER-UI-CONSTITUTION.md`: §7: one trust vocabulary everywhere<br>`app/src/lib/provenance.ts`: the three of the five that exist | No authority or version in the payload; no API returns it. |
| **total** | | not-started 0, designed 1, building 1, tested 0 | | |

The universal trust payload every user-facing object would expose:

```json
{
  "source":    { "type": "institution_verified", "system": "Blackboard Learn", "reference": "course_48933", "last_synced_at": "2026-09-28T14:30:00Z" },
  "authority": { "level": "official_course_record", "decision_owner": "Course Instructor" },
  "scope":     { "visibility": "course_staff_and_student", "sharing": "not_shareable" },
  "status":    { "state": "released", "freshness": "current", "effective_at": "2026-09-28T14:30:00Z" },
  "version":   { "number": 4, "updated_at": "2026-09-28T14:30:00Z" }
}
```

## One action model

Preview → explain the impact → identify the target and the authority →
confirm if consequential → execute → show the completion state → preserve an
audit event → provide undo or recovery if possible → show the support route if
not. Adding a deadline, sharing a portfolio, syncing a grade, joining a club
and sending a referral all make scope, impact and recovery obvious.

| ID | Step | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| preview | Preview, and explain the impact | tested | `app/src/components/ConfirmDialog.tsx`: a preview, then a choice<br>`app/src/lib/actions.test.ts`: the action centre: every action with a why and a source | Per dialog; `lib/explain.ts` explains screens, not actions. |
| authority | Identify the target and the authority | building | `app/src/components/ConfirmDialog.tsx`: the external hand-off tone | No action names who decides it. |
| confirm | Confirm if consequential | tested | `app/src/components/TypeToConfirm.tsx`: type to confirm the irreversible<br>`app/server/institution/gateway.test.ts`: prepare, then commit with confirmed: true and a version re-check | The two-phase pattern is the gateway’s; the app’s dialogs are their own. |
| complete | Show the completion state | building | `app/src/components/Said.tsx`: the live region<br>`app/src/components/unity/States.tsx`: loading, error and success states | The primitives exist; nothing holds an action to announcing its outcome. |
| audit | Preserve an audit event | tested | `app/src/lib/journal.ts`: the journal<br>`app/src/lib/journal.test.ts`: provenance on every entry | The device journal and four server tables; no one schema. |
| undo | Provide undo or recovery if possible | tested | `app/src/lib/undo.test.ts`: one step back<br>`app/src/components/Undone.tsx`: the undo toast | None. |
| escalate | Show the support or escalation route if not | tested | `app/src/lib/help-routes.test.ts`: the routes<br>`supabase/functions/_shared/escalation.ts`: a signed escalation webhook | Not attached to a failed action as a rule. |
| pipeline | Every action follows the same behaviour | designed | `docs/ACTION-EXPLAINABILITY-AND-STUDENT-CONTROL.md`: the model; nothing here is built yet<br>`packages/institution/src/workflow.ts`: five workflow machines for institutional actions | The pieces exist; no single pipeline joins them. |
| **total** | | not-started 0, designed 1, building 2, tested 5 | | |

## One notification centre

| ID | What | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| inbox | Unified inbox and notification centre | building | `app/src/screens/Hub.tsx`: Notices<br>`app/src/lib/comms.ts`: official, course and Semester channels; priority; digest | Notices, Email and reminders are three surfaces. |
| purpose | Notification purpose and source label | building | `app/src/lib/comms.ts`: admit: every message must carry a source label | No test on admit. |
| channels | In-app, email, push and optional SMS | tested | `app/src/lib/notify.ts`: in-app and browser notifications<br>`app/src/lib/push.ts`: web push<br>`app/src/lib/notify.test.ts`: the tiers and caps | No email and no SMS. |
| quiet | Quiet hours and schedule preferences | tested | `app/src/lib/notify.ts`: Quiet and inQuiet<br>`app/src/lib/notify.test.ts`: quiet hours | None. |
| urgency | Urgency levels | building | `app/src/lib/comms.ts`: required, high, normal, low | No test. |
| digest | Digest controls | building | `app/src/lib/comms.ts`: instant, daily, weekly and digestGroups | No test; no send. |
| dedupe | Duplicate suppression | tested | `app/src/lib/notify.ts`: the seen set, last four hundred<br>`app/src/lib/notify.test.ts`: a reminder is not repeated | None. |
| per-course | Per-course, community and service controls | building | `app/src/components/MuteCourses.tsx`: mute a course<br>`app/src/lib/myrules.ts`: the student’s own rules | Courses only. |
| history | Delivery history | not-started | `docs/ETHICAL-ENGAGEMENT-AND-NOTIFICATIONS.md`: the model | Only push stall detection; the screen lists today’s reminders (lib/read/notifications.ts) but keeps no history of past ones. |
| why | Why-am-I-seeing-this explanation | tested | `app/src/lib/notify.ts`: whyFor and shownBody<br>`app/src/lib/notify.test.ts`: the why line | None. |
| **total** | | not-started 1, designed 0, building 5, tested 4 | | |

## One search and command system

The documents’ command palette: Add an action, Find a source, Ask Semester, Start a study session, Prepare advisor agenda, Find support, Join event, Upload work, Review feedback, Manage sharing, Report an issue.

| ID | What | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| one-ranker | Global search over courses, assignments, sources, services, clubs, events, opportunities, messages, support and settings | tested | `app/src/lib/find.ts`: findEverything, one ranker<br>`app/src/lib/find.test.ts`: the ranking<br>`docs/architecture/0006-search-is-one-ranker.md`: why one | Local device data only; messages and services are not indexed. |
| palette | A command palette | tested | `app/src/components/Command.tsx`: the overlay with typeahead<br>`app/src/lib/keys.test.ts`: `/` and ⌘K | Navigation and typeahead; not the eleven commands. |
| boundaries | Results respect tenant, course, role, source, privacy and retention boundaries | building | `app/src/lib/find.ts`: filtered by school capabilities and role<br>`ops/operations-console/README.md`: search: never, for student-private records | No explicit tenant, course-membership or privacy-class filter; the rule is policy. |
| **total** | | not-started 0, designed 0, building 1, tested 2 | | |

## One profile and data-agency centre

A student should not need to hunt through course, community, career and
support modules to understand who has access to their information. Each
item at the `CONTROLS` row in `lib/mecontrols.ts` that carries it:

| Item | Row | Note |
| --- | --- | --- |
| Profile and accessibility preferences | `accessibility` | Text size, spacing, typeface, contrast and motion; the access modes. |
| Notification preferences | `notifications` | Alerts. |
| Connected accounts | `connected` | Calendars and services. |
| Active shares | `sharing` | Who can see what, until when, and how to take it back. |
| Mentorship and community privacy | — | Community identity and aliases exist; no Me row exposes them. |
| AI settings and history | `ai` | Settings; the conversation is kept in the session only. |
| Data export and deletion | `export` | Export, and a deletion row that reaches the delete-account function. |
| Support-access history | `support-access` | Windows, expired and revoked. |
| Security sessions and MFA | `security` | The row exists; the screen offers sign-out only, and no MFA for students. |
| Consent and policy history | — | The FERPA consent model and the agreements screen are staff-facing; no student timeline. |

## One operational control plane

The console may use domain-specific views, but it uses the same identity, permission, audit, case, notification and runbook services; there is no separate admin tool per module. The console exists ([docs/OPERATIONS-CONSOLE-MAP.md](OPERATIONS-CONSOLE-MAP.md), from [ops/operations-console](../ops/operations-console/README.md)); the views it unifies and the ones still outside it, at what the tree has:

| ID | View | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| tenant-config | Tenant configuration | building | `app/src/components/institutional/ControlPlane.tsx`: the control plane tab<br>`app/src/lib/control-plane.ts`: the viewed tenant | A flagged tab of the University screen, not a console. |
| entitlements | Entitlements | tested | `supabase/functions/_shared/entitlement.ts`: the resolver<br>`app/src/lib/entitlement.test.ts`: the order<br>`docs/ENTITLEMENT-RESOLUTION.md`: built; runs in shadow on LTI launches; enforces nothing | Shadow only; no view. |
| flags | Feature flags | tested | `app/src/lib/flags.ts`: the registry<br>`app/src/lib/flags.test.ts`: every flag named<br>`docs/FEATURE-FLAG-REGISTRY.md`: the register | No console view. |
| integration-health | Integration health | tested | `app/src/components/institutional/IntegrationDashboard.tsx`: the staff dashboard<br>`app/src/components/institutional/IntegrationDashboard.test.tsx`: every domain with status and health | School staff, not operations. |
| freshness | Content freshness | building | `app/src/lib/integration/lineage.ts`: breach levels | Integration data only. |
| support | Support cases | building | `app/src/lib/supporttickets.ts`: tickets<br>`app/src/components/HelpInbox.tsx`: the staff help inbox | No case model shared with incidents. |
| incidents | Incidents | tested | `app/src/lib/governance/incident-comms.ts`: communications by audience<br>`app/src/lib/ops/warroom.ts`: the war room<br>`app/src/lib/ops/warroom.test.ts`: the room | Data only; no screen. |
| ai-policy | AI policy | tested | `app/src/lib/governance/ai-lifecycle.ts`: the gates<br>`app/src/lib/aiflags.ts`: the AI flags<br>`app/src/lib/governance/ai-lifecycle.test.ts`: the gates held | Data only; no screen. |
| privacy | Privacy and consent | tested | `app/src/lib/governance/module-privacy.ts`: the model<br>`app/src/lib/governance/module-privacy.test.ts`: held to app_roles | Data only; no screen. |
| a11y-issues | Accessibility issues | designed | `docs/WCAG-UI-AUDIT-SCORECARD.md`: the scorecard | No view and no issue record. |
| commitments | Contracts and customer commitments | tested | `app/src/lib/ops/commitments.ts`: the register<br>`supabase/migrations/20260929110000_console_approvals_and_break_glass.sql`: customer, commitment and contract rows scoped to the tenant<br>`app/src/screens/console.test.tsx`: the Customers view, with classification and access basis on every record | None. |
| billing | Billing | not-started | `docs/DECISION-LOG.md`: D-009: no billing exists | None exists, by decision. |
| evidence | Audit and evidence | tested | `app/src/lib/ops/claims.ts`: the claims register<br>`app/src/lib/ops/proofcalendar.ts`: the proof calendar<br>`app/src/lib/ops/claims.test.ts`: every claim with a register word | Registers, not a view. |
| release-impact | Release impact | tested | `app/src/lib/governance/release-readiness.ts`: the score<br>`app/src/lib/governance/consolechecks.ts`: promises kept, release impact, on-call workload<br>`app/src/lib/governance/consolechecks.test.ts`: the checks | Data only; no screen. |
| **total** | | not-started 1, designed 1, building 3, tested 9 | | |

## Consistency release gates

Before any new feature is released:

| ID | Gate | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| G01 | Uses the shared application shell and context switcher | tested | `app/src/pageframe.test.ts`: every screen renders inside Page, or is on FRAMELESS with a reason | The shell, yes; the context switcher is not one component. |
| G02 | Uses shared design-system components; no one-off controls without approval | tested | `app/scripts/styles.mjs`: the style audit on every lint<br>`app/src/lib/onecontrol.test.ts`: one control pattern<br>`app/src/styles/tokens.test.ts`: the tokens | No shared table or timeline primitive; thirteen raw tables. |
| G03 | Displays Source, Scope and Status where information or authority matters | building | `app/src/components/SourceBadge.tsx`: source and freshness<br>`.github/pull_request_template.md`: asks for SourceBadge where a decision depends on outside data | Source and status; scope is not shown. |
| G04 | Uses standard loading, error, empty, permission, confirmation, recovery and support patterns | tested | `app/src/components/unity/States.tsx`: the states<br>`app/src/components/ui.tsx`: EmptyState<br>`docs/EMPTY-LOADING-ERROR-SUCCESS-STATES.md`: the contract<br>`app/src/pageframe.test.ts`: the frame | Permission-denied and conflict states are per screen. |
| G05 | Appears in global search and the command palette where appropriate | tested | `app/src/lib/nav.test.ts`: every destination in the registry with keywords<br>`app/src/lib/find.test.ts`: found by keyword | None. |
| G06 | Uses the unified notification system | building | `app/src/lib/comms.ts`: admit | Three surfaces, no rule that a module must use one. |
| G07 | Honours shared profile, accessibility, privacy, retention and sharing controls | tested | `app/src/lib/mecontrols.test.ts`: the rows<br>`app/src/lib/retention.test.ts`: every table has a retention line<br>`app/src/lib/sharing.ts`: the shares | None as a gate; nothing checks a new module against them. |
| G08 | Emits standard audit and activity events | building | `app/src/lib/journal.ts`: the journal<br>`docs/architecture/0008-event-envelope-and-outbox.md`: the envelope | No unified event schema. |
| G09 | Passes keyboard, screen-reader, zoom and reflow, mobile and low-bandwidth tests | tested | `app/src/a11y/axe.test.tsx`: axe on every screen<br>`app/src/a11y/dragging.test.ts`: drag alternatives<br>`.github/pull_request_template.md`: keyboard only, 320px and 200% zoom | No low-bandwidth test. |
| G10 | Has one named owner, a source-freshness model, a support runbook and an analytics definition | building | `app/src/lib/governance/charters.ts`: charters with owners<br>`docs/ANALYTICS-EVENTS.md`: the analytics definitions | Charters for portfolios, not per screen. |
| G11 | Can be enabled or disabled by tenant through the same entitlement and feature-flag system | tested | `app/src/lib/flags.test.ts`: every flag<br>`docs/ENTITLEMENT-RESOLUTION.md`: shadow only | Entitlement enforces nothing yet. |
| G12 | Has migration, offboarding and export behaviour defined | tested | `docs/DATA-PORTABILITY-AND-OFFBOARDING.md`: the model<br>`app/src/lib/export.test.ts`: export | Defined for the product, not per module. |
| **total** | | not-started 0, designed 0, building 4, tested 8 | | |

## The eleven foundations

| ID | Foundation | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| identity | One identity | tested | `packages/institution/src/identity.ts`: the claims and their minimization<br>`packages/institution/src/identity.test.ts`: held<br>`docs/INSTITUTIONAL-SSO-ARCHITECTURE.md`: SAML, SCIM and LTI built; OIDC and account linking not | No OIDC; LTI identities link to campus accounts by ticket only. |
| context | One context | building | `app/src/components/unity/ContextBar.tsx`: the context bar | As the navigation row: separate switchers. |
| objects | One object model | building | `app/src/lib/integration/catalog.ts`: thirty-three canonical entities for integration<br>`app/src/components/unity/ObjectCard.tsx`: nine presentation kinds | No single entity type carrying the envelope. |
| design | One design system | tested | `app/src/styles/tokens.css`: the tokens<br>`app/src/lib/look.test.ts`: the palette<br>`docs/design/SEMESTER-UI-CONSTITUTION.md`: the constitution | Tables and timelines have no primitive. |
| trust | One trust pattern | building | `app/src/lib/provenance.ts`: Source, Scope, Status | Three vocabularies. |
| search | One search system | tested | `app/src/lib/find.test.ts`: one ranker | None. |
| notifications | One notification system | building | `app/src/lib/comms.ts`: channels, priority, digest | Three surfaces. |
| me | One data-agency centre | tested | `app/src/lib/mecontrols.test.ts`: the rows | Two of the documents’ ten items have no row. |
| events | One audit and event model | tested | `app/server/institution/gateway.test.ts`: the error envelope and correlation id<br>`docs/architecture/0010-correlation-ids-and-error-envelope.md`: the ADR | Four audit tables; edge functions answer in their own shapes. |
| gateway | One integration gateway | tested | `app/server/institution/gateway.ts`: the gateway<br>`app/server/institution/gateway.test.ts`: prepare, commit, reconcile<br>`docs/LMS-INTEROPERABILITY-MATRIX.md`: the LMS side of it | AGS and the integration tick bypass it. |
| console | One operations console | tested | `app/src/screens/Console.tsx`: the console: context bar, approvals, break-glass, audit, customers, figures, evidence, saved views<br>`app/src/screens/console.test.tsx`: gated by console:operate; every write under the production notice<br>`docs/OPERATIONS-CONSOLE-MAP.md`: the map, rendered from the controls (D-110) | Tenant configuration, flags, incidents, AI policy and privacy are still data or University tabs, not console views. |
| **total** | | not-started 0, designed 0, building 4, tested 7 | | |

## Cross-domain relationship rules

| ID | Rule | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| R1 | A Course can link to Actions, Events, Documents, Assignments, Assessments, Submissions, Feedback, Grades, Communities, Services and Opportunities | building | `app/src/components/CourseHub.tsx`: assignments, study, readings, readiness and the locker on one hub | Communities, services and opportunities do not link to a course. |
| R2 | A Person controls private Plans, Actions, Notes, Preferences and eligible Shares | tested | `app/src/lib/sharing.ts`: the shares<br>`app/src/components/SharingList.test.tsx`: who sees what, until when | None. |
| R3 | A ServiceResource creates a Referral only through consent or a documented institutional basis | tested | `supabase/migrations/20260921002623_referrals.sql`: a referral is the student’s own act<br>`app/src/lib/help-routes.test.ts`: directory-only routes store nothing | None. |
| R4 | A GradeEntry never becomes a career or employer data source by default | tested | `app/src/lib/serviceregister.ts`: EMPLOYER_NEVER: student grades, course performance<br>`app/src/lib/serviceregister.test.ts`: held | None. |
| R5 | Basic-needs browsing never becomes faculty, advisor or club visibility | tested | `app/src/lib/governance/module-privacy.ts`: the basic-needs row: private by default<br>`app/src/lib/governance/module-privacy.test.ts`: held to app_roles<br>`app/src/lib/help-routes.test.ts`: financial aid and accessibility are directory-only | None. |
| R6 | AI conversations never become a shared SourceDocument unless a user deliberately saves and shares an approved artifact | tested | `app/src/lib/chatlog.ts`: the conversation is kept in the session only<br>`app/src/lib/governance/module-privacy.test.ts`: the AI row | None. |
| R7 | IntegrationConnection data always retains source, freshness and external id | tested | `supabase/migrations/20260927170000_integration_control_plane.sql`: source records with provider ids and freshness<br>`app/src/lib/integration/pipeline.test.ts`: the external id and the timestamp on every record | None. |
| **total** | | not-started 0, designed 0, building 1, tested 6 | | |

## Found on the way

Two faults found on 28 September — a trust component `provenance.ts` named that did not exist, and a test `comms.ts` named that did not exist — were fixed the same day, and the test holds them fixed. Nothing is open.
