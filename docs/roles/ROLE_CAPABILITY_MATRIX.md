# Role capability matrix

**As of** 2026-10-05 · **Part of** [`ROLE_SYSTEM_MASTER_MAP.md`](ROLE_SYSTEM_MASTER_MAP.md) · **Status** audit evidence.

The full role-by-capability table (185 rows, 96 capabilities, 69 roles) is rendered, and held against the migrations, in [`ROLE-LAUNCH-REGISTER.md`](../ROLE-LAUNCH-REGISTER.md). It is not copied here. [`ROLE-PERMISSION-MATRIX.md`](../ROLE-PERMISSION-MATRIX.md) is stale: it lists 84 capabilities and omits `hold:read`, `hold:place`, `hold:release`, `override:record`, `override:review`, `config:manage`, `config:publish`, `config:view`, `workflow:manage`, `workflow:publish`, `workflow:view` and `guardians:manage`.

## The permission decision, as built versus as required

The brief requires every permission to resolve from twelve inputs. This is what the database evaluates today.

| Input | Evaluated by | Where | Gap |
| --- | --- | --- | --- |
| Active identity and session | Supabase Auth, `auth.uid()` | every policy and definer | |
| Tenant membership | `profiles.school_id` for students; `scope_kind='school'` grants for staff; `institution_membership` for SCIM | `private.school_of()`, `has_capability` | Three sources, not unified (RG-02). Isolation switch `enforce_membership` is off by default (RG-07) |
| Role | `role_grants` → `app_roles` | `private.has_capability` | |
| Capability | `role_capabilities` | `private.has_capability(cap, scope_kind, scope_id)` | 96 defined; 12 absent from the old matrix |
| Organizational scope | `scope_kind` and `scope_id` text; course scope is `school/CODE` | `private.scope_in_tenant` | Organization, course, department and office scopes have no tenant column |
| Relationship to resource | Per-feature tables: `advisor_shares`, `support_access_grant`, `family_grants`, `peer_mentor_assignments`, `trust_room_grants` | feature RPCs | Eight-plus separate stores; no common relationship primitive |
| Consent | `consent_record` and per-feature consent tables | feature RPCs | **Not part of `has_capability`.** Enforced only where a function calls it |
| Data classification | `data_classification` domain T1 to T6; `data_classification_rules` | AI and integration paths | No classification check at the RLS layer |
| Policy | `tenant_feature_policy`, `ai_policy`, `tenant_sso_policy` | `feature_state`, `effective_module_modes` | `tenant_feature_policy` has 0 rows on the live project |
| Entitlement | `supabase/functions/_shared/entitlement.ts` (TypeScript) | Edge only | Not in the database; LTI path runs it in shadow |
| Workflow state | per-domain (registration, gradebook, approvals) | feature RPCs | No shared engine |
| Result: allow / deny / step-up / approval | Allow or deny from `has_capability`. Step-up by `private.assert_fresh_mfa()` in `console_act`, `decide_approval` and support paths only. Approval by `approval_request` for eleven Console duties | | Tenant-admin actions (`approve_offboarding`, `set_member_capabilities`) carry no step-up (RG-10) |

Consequence: `has_capability` answers "does this person hold the capability at this exact scope, live, now", plus open break-glass on a school. Everything else is composed per feature. A new feature that forgets the consent or entitlement call is permitted by the capability alone. A shared decision function returning allow, deny, step-up or approval-required does not exist and is the subject of the `feat/policy-consent-classification-audit-foundation` branch.

## Capability families (counts from the register)

| Family | Capabilities | Held by |
| --- | --- | --- |
| Teaching and grades | `grades:enter`, `grades:moderate`, `grades:release`, `grades:export`, `grades:receive`, `course:publish`, `skill:verify`, `lti:launch` | faculty, TA, student family, registrar (`grades:export`) |
| Records and registration | `record:propose`, `record:approve`, `record:override`, `record:read`, `registration:administer`, `registration_window:publish`, `catalog:sync`, `articulation:*`, `hold:*`, `override:*` | registrar, dean, faculty (`record:propose`) |
| Money | `finance:request`, `finance:read`, `finance:approve`, `finance:approve_high`, `finance:close`, `billing:read`, `billing:operate` | student accounts, financial aid, business admin, billing contact, finance operator |
| Student success and support | `help_request:respond`, `mentee:read`, `tutoring:manage`, `accommodation:verify`, `support:read`, `support:ticket`, `data_request:handle` | advisor, tutor, mentor, disability services, staff, support, data steward |
| Institution control | `tenant:configure`, `tenant:implement`, `ai:configure`, `source:approve`, `audit:read`, `integration:*`, `migration:*`, `config:*`, `workflow:*`, `guardians:manage`, `killswitch:engage` | university_admin, integration_admin, implementation_manager |
| Community and safety | `community:review`, `community:review_senior`, `community:escalation_agreements`, `community:manage`, `moderation:action`, `review:moderate`, `report:read` | moderator, trust and safety, community manager |
| Operations and governance | `console:operate`, `approval:decide`, `breakglass:request`, `platform:configure`, `beta:*`, `incident:communicate`, `governance:decide`, `compliance:manage`, `content:manage`, `trust:publish` | platform_admin, support_agent, incident_responder, portfolio_council, compliance_owner |
| Commercial | `account:manage`, `success:manage`, `campaign:manage`, `campaign:review`, `campaign:report`, `opportunity:publish`, `talent:search`, `demand:read`, `outcomes:read` | account_executive, customer_success, marketing, employer, partners, dean |

Heavily used gates (call sites in migrations): `tenant:configure` 68, `community:review` 32, `audit:read` 31, `integration:view` 23, `account:manage` 22.

## Separation of duties encoded in the database

| Rule | Enforced by | Check |
| --- | --- | --- |
| A requester never approves a Console action; two distinct approvers where `two_person` | `approval_decision` primary key, `decide_approval` | `console-approvals.check.sql` |
| Break-glass at most four hours, review by someone else, new request blocked while review overdue | `break_glass_grant` | `console-approvals.check.sql` |
| A grader cannot moderate their own entry | `gradebook_moderate` | `gradebook.check.sql` |
| A proposer cannot approve a record change | `academic_record_changes` | `academic-record.check.sql` |
| Two other administrators approve a module-mode change | `module_mode_request/approval` | `module_mode.check.sql` |
| A second person publishes a school configuration | `school_config_versions` triggers | `configuration-studio.check.sql` |
| The person who places a legal hold cannot release it | `legal_holds` | `legal-holds.check.sql` |
| Campaign author and reviewer differ | campaign tables | `gtm.check.sql` |

Not enforced in the database (owner decisions pending per [`DECISION-RIGHTS.md`](../DECISION-RIGHTS.md)): policy exception, security exception, data exception, data-subject request, pilot go or no-go.

## Capabilities the brief implies that do not exist

Role grant review, access review, tenant creation, pilot approval, implementation gate approval, release pause, incident declaration, AI model or provider change approval (`ai-provider` is a Console duty with no executor), data export approval, SSO configuration (`tenant_sso_policy` has no capability-gated writer in the UI), SCIM credential issue, app registration, marketplace listing, and any employee-offboarding capability.
