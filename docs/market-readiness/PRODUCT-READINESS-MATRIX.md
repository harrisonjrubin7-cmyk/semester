# Product-readiness matrix

**Decision rule:** repository implementation may support **YELLOW** use, but no module is **GREEN** for a named institutional pilot until its target-environment owner, UAT, accessibility, security, support, data-rights, monitoring, and rollback evidence is attached.

| Module / outcome | Persona | Category | Sensitivity | A11y / mobile / states | Analytics / tests / support | Pilot / sales status | Required next action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Account and session lifecycle | student | core now | identity | automated coverage; target AT/mobile acceptance open | tests exist; staffed support open | YELLOW / do not sell as GA | run target auth, recovery, revocation, abuse, export and deletion acceptance |
| First-run onboarding | student | core now | profile/context | guided/manual states exist; representative UAT open | activation design exists | YELLOW | prove first-win completion with representative students |
| Today / This Week | student | core now | academic activity | mature states; qualified AT review open | extensive tests; proposed first-win events | YELLOW | run mobile, keyboard, slow-network and recovery UAT |
| Tasks and deadlines | student | core now | academic activity | empty/error/recovery patterns exist | tests exist; outcome baseline absent | YELLOW | validate completion semantics and support burden |
| Courses and schedule setup | student | core now | academic records entered by user | manual/import paths exist | coverage exists; target data map open | YELLOW | freeze manual/read-only pilot path and accept it end to end |
| Calendar import/subscription | student | pilot optional | external calendar data | degraded/read-only designs exist | reconciliation proof absent | YELLOW only after provider approval | approve scopes, consent, reconciliation and disconnect behavior |
| Workload and planning | student/advisor | core now | academic activity | responsive product foundation; manual AT open | tests exist; outcomes absent | YELLOW | define baseline and validate week-one behavior |
| Study and writing tools | student | pilot optional | potentially sensitive content | broad app coverage; scope-specific review open | tests exist; support scope broad | YELLOW only if explicitly included | pick one workflow or disable for first pilot |
| Search and command palette | student | pilot optional | mixed | keyboard patterns exist; target audit open | tests exist | YELLOW | verify result permissions and no dead ends |
| Support discovery | student | core now | support intent | routes and recovery content exist | queue/response evidence absent | RED for supported launch | staff queue, escalation backup, hours and incident communication |
| Notification/reminders | student | pilot optional | preferences/activity | opt controls designed | production delivery/abuse proof absent | YELLOW only after delivery acceptance | test opt-in/out, quiet hours, duplicate prevention and failure recovery |
| Account export/deletion | student/admin | core now | all user data | UI/back-end lifecycle exists | target E2E and backup exceptions open | RED launch gate | perform dated export/delete/retention acceptance |
| Tenant/cohort configuration | admin | core institutional | roster/configuration | admin patterns exist | named operator/UAT absent | YELLOW design partner | create configuration export and approve minimum-necessary roster |
| Roles and capabilities | admin/IT | core institutional | authorization | control system/tests exist | production access review absent | RED launch gate | perform cross-tenant, expiry, revocation and audit acceptance |
| Aggregate pilot reporting | sponsor/operator | core institutional | cohort metrics | privacy thresholds designed | live source and customer approval absent | YELLOW | approve 3–5 measures, thresholds, source, caveats and reviewer |
| Audit visibility | security/admin | core institutional | privileged events | structures/migrations exist | production export/retention proof absent | YELLOW | attach reviewer-signed target audit sample |
| Degraded/read-only/recovery | all | core now | mixed | recovery contracts exist | production rehearsal absent | RED launch gate | run incident, kill-switch, rollback and communication exercise |
| Offboarding | student/admin | core institutional | all pilot data | plans and controls exist | target rehearsal absent | RED launch gate | prove export, access revocation, retention and deletion |
| SSO/SCIM | institution | beta/controlled | identity | architectures and gates exist | no approved live provider | RED | keep disabled until named-provider security/UAT approval |
| SIS/LMS/LTI | institution | beta/controlled | official records | adapters/simulations may exist | no named live acceptance | RED | no write access; separately approve any read-only integration |
| AI learning assistance | student | beta/controlled | prompts/content | disclosures and controls exist | provider/data-use approval and field evaluation open | YELLOW only if specifically approved | approve vendor, purpose, retention, evaluation, human review and kill switch |
| High-impact automated decisions | institution | internal/prohibited | highly sensitive | not an acceptable product state | policy blocks use | RED | remain prohibited |

## First win

Within one session, a student manually adds the minimum academic context and leaves with a coherent, prioritized plan for today and the coming week. Completion requires a visible next action, source/freshness clarity, and a recovery path when inputs are incomplete. It does not require institutional integration or unnecessary profile data.

## Institutional first proof

Within 7–14 days of a permitted design-partner simulation, an authorized operator can review privacy-thresholded activation, first-win completion, planning engagement, support demand, reliability, and qualitative feedback for the defined cohort. The proof is workflow adoption and delivery quality—not causal retention, GPA, or graduation impact.

## Availability language

- **Available now:** repository-implemented functionality demonstrated with synthetic data.
- **Within pilot scope:** only features listed in the signed launch packet after target acceptance.
- **Optional / implementation-dependent:** approved read-only providers and configured modules.
- **Planned / unavailable:** named institutional integrations, high-impact automation, and any capability lacking its release evidence.

See [the deeper product evidence](PRODUCT_READINESS.md) and [pilot readiness matrix](PILOT-READINESS-MATRIX.md).
