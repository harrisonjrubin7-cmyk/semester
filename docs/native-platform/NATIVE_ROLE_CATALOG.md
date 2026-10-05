# Native role catalog

**As of** 2026-10-05 · **Live counts** on `lzrqvlugnawcgywkhqlz`

| Object | Count |
| --- | ---: |
| `app_roles` | 69 |
| `app_capabilities` | 96 |
| `role_capabilities` | 185 |
| `role_grants` | 4 |

Four grants are not an institution. Capability checks belong in the database (`private.has_capability` and the SECURITY DEFINER commands), not in React state.

> **Claim ceiling.** A role row is a name in a catalog. It is not a staffed office, a signed seat, or a production permission. Launch-council seats in `app/src/lib/launchreadiness.ts` are unsigned. One person holds or acts in seven of them (`docs/master/SEMESTER_DOMAIN_CATALOG.md`).

## How a PDF workspace maps

| PDF workspace | Expected holder | Capability posture | Class |
| --- | --- | --- | --- |
| Student | Authenticated account, own rows | Own-data RLS plus student RPCs (`my_*`, `registration_enroll` on the student's own request) | Native but incomplete |
| Applicant | No admissions role found as a workspace | Onboarding is an experience, not a role | Not started |
| Faculty / instructor | Gradebook and course-publish RPCs | `gradebook_*`, `publish_course_guidance`, `publish_course_rules`, `publish_study_pack` | Unsafe until isolation and a real roster |
| Teaching assistant | Not found as an endorse or grade path | — | Not started |
| Advisor | Share reader | `share_with_advisor`, `read_advisor_share`, `list_advisor_shares` | Consent grant, not a caseload |
| Student success staff | Help desk | `help_inbox`, `answer_help_request`, office-action drafts | Partial |
| Registrar | Registrar RPCs | `registrar_put_section`, `registrar_put_term`, `registrar_decide`, `registrar_grant_override` | Unsafe to activate |
| Student accounts | Ledger readers | Finance screens | Unsafe to activate |
| Financial aid | None | Directory link | Transitional |
| Housing / dining staff | Dining queue | `dining_order_queue`, `dining_advance_order` | Module-gated |
| Accessibility services | Accommodation share read | `read_shared_accommodation` | No approval role |
| Community moderator | Moderation RPCs | `decide_community_case`, appeals, alias reveal | Unsafe to activate |
| Family / guardian | Grant acceptor | `accept_family_grant`, `read_family_share` | Unsafe to activate |
| Career staff / employer | Sandbox | No employer evidence review | Pilot-only |
| Institution admin | School membership | `request_school_membership`, `set_member_capabilities`, `claim_school` | Unsafe under F-01 |
| IT / security | Console and trust | `console:operate`, break-glass, audit read, trust-room grant | Native but incomplete |
| Operator | Console | Approvals, figures, releases | Native but incomplete |
| Support operator | Tickets | `support:ticket` at platform scope shows the Support tab | Native but incomplete |
| Developer / partner | None | No OAuth client role | Not started |
| Public visitor | Anon key | 32 GraphQL-visible tables; RLS applies; predicates unverified | Requires security review |

## Commands that must stay capability-checked

These are executable by `authenticated` today (advisor WARN, 207 functions). The role catalog's next review is whether the function body refuses a caller who lacks the capability. Samples that move official-shaped data:

| Command | Domain | If the check is missing |
| --- | --- | --- |
| `registration_enroll`, `registration_drop`, `registration_withdraw` | Registration | Enrolment without a window |
| `registrar_decide`, `registrar_grant_override` | Registrar | Policy bypass |
| `gradebook_release`, `gradebook_enter`, `gradebook_moderate` | Grades | Unofficial numbers treated as released |
| `accept_family_grant`, `make_family_share` | Family | Disclosure |
| `dining_place_order` | Campus commerce | Orders without a partner |
| `answer_data_subject_request` | Privacy | A request closed by the wrong person |
| `authorize_school_purge`, `archive_school` | Tenant lifecycle | Destructive |
| `console_act`, `decide_approval`, `close_break_glass` | Operations | Operator action without duty |
| `reveal_alias_identity` | Community | De-anonymisation |

This pass did not open those function bodies. **Class for the set: requires security review before any tenant is switched on.** Do not revoke them as a batch; several are the product.

## Service accounts, SSO, SCIM, sessions

| PDF item | Evidence | Class |
| --- | --- | --- |
| SSO | Documented as IdP integration. Institution IdP stays the identity authority (D26) | Transitional; unsafe |
| SCIM | `scim_credential` and `scim_*` tables. Credential table has RLS and no policy | Schema only; unsafe |
| Access review | Not a console workflow | Not started |
| Service accounts | Not a developer-platform issuer | Not started |
| Session / device | `push_devices`; MFA read in the console | Partial |
| Deprovision | `20260930210000_deprovision_revokes_grants.sql`, `leave_school`, `disable_school_access` | Native but incomplete |

## Two-person and break-glass

Approval request/decision tables and break-glass grant/review/close exist. They are the control. They are not evidence that grade change, purge, or family reveal require two people in every path. **Requires security review** to attach them to the commands in the table above.
