# Configurability without fragmentation

Semester needs to vary by tenant. Too much configuration, though, turns it into custom software for each university.
The approach here is one shared codebase with tenant configuration and feature flags. Variations go through canonical
extension points, and every mapping is versioned, audited and can be rolled back. Behaviour is configured through
versioned policies, entitlements, mappings and approved extensions. It is never configured through unmanaged forks or
logic written for one customer.

```text
One shared codebase
+ tenant configuration
+ feature flags
+ canonical extension points
+ versioned mappings
+ audit and rollback
= flexibility without fragmentation
```

Source of truth: [`app/src/lib/governance/config-tiers.ts`](../../app/src/lib/governance/config-tiers.ts). A request
for a key it does not register is **not a configuration request**. `classifyRequest` returns `product_request`, and the
request goes to the Portfolio Council ([PORTFOLIO-GOVERNANCE.md](PORTFOLIO-GOVERNANCE.md)).

## Tiers

| Tier | What a tenant can configure | What it cannot change | Reviewers |
| --- | --- | --- | --- |
| 1 — Brand and content | Logo, colors, campus labels, help contacts, public resources, local terminology | Core accessibility tokens, security or consent branding | Customer success, accessibility |
| 2 — Workflow settings | Action templates, deadlines, service routing, notification cadence | Fundamental action and privacy rules | Customer success, product |
| 3 — Policy and governance | AI rules, data classification, visibility, retention, marketplace controls | Legal/contractual floors; may only be **stricter** | Product, privacy, security, accessibility |
| 4 — Integration mappings | SIS/LMS/CRM fields, freshness SLAs, source ownership | Raw secrets, cross-tenant access, audit suppression | Integration owner, data steward, privacy |
| 5 — Extension/custom logic | Approved, reviewed, feature-flagged, versioned, contractually scoped modules | Arbitrary code or bypassing standard controls | Product, engineering, security, privacy, accessibility, legal |

### Registered settings

| Key | Tier |
| --- | --- |
| `brand.logo` | 1 |
| `brand.accent_color` | 1 |
| `brand.campus_labels` | 1 |
| `content.help_contacts` | 1 |
| `content.public_resources` | 1 |
| `workflow.action_templates` | 2 |
| `workflow.deadlines` | 2 |
| `workflow.service_routing` | 2 |
| `workflow.notification_cadence` | 2 |
| `policy.ai_rules` | 3 |
| `policy.data_classification` | 3 |
| `policy.visibility` | 3 |
| `policy.retention` | 3 |
| `policy.marketplace` | 3 |
| `integration.field_mapping` | 4 |
| `integration.freshness_sla` | 4 |
| `integration.source_ownership` | 4 |
| `extension.approved_module` | 5 |

The accent colour is accepted only if it passes the contrast ramp on **every** ground (see `lib/contrast.test.ts` and
the CLAUDE.md note on measuring against the surface that flatters it).

## Never permitted, at any tier

| Key | Why |
| --- | --- |
| `tenant_script` | Arbitrary tenant JavaScript or scripts in the core runtime |
| `direct_sql` | Direct SQL access to Semester production data |
| `unreviewed_webhook` | Unreviewed webhooks carrying student data |
| `custom_css` | Custom CSS can break accessibility tokens and focus |
| `third_party_tracking` | Unapproved third-party tracking |
| `bypass_rls` | Extensions that bypass RLS or policy |
| `weaken_security` | Settings that weaken the security model |
| `weaken_privacy` | Settings that weaken FERPA/privacy controls. A privacy exception is a legal review, not a toggle |
| `disable_audit` | Suppressing or deleting audit records |
| `cross_tenant_access` | Reading another tenant's data |
| `raw_secrets` | Exposing raw credentials to tenant administrators |
| `code_fork` | A tenant fork of the core codebase |

## Approval flow

`nextStep()` returns the first step before launch that is not yet recorded. Each request is a row in
`governance_config_requests`. The database refuses a setting at the wrong tier and any key that isn't registered, so
nothing on the never-permitted list can even be requested. It also refuses to remove a recorded step, to record the
launch step before the reviews, and to mark a request `launched` until every step through launch is recorded. Status
only moves forward (requested → in review → approved → launched → sunset), and `sunset` needs the review step too. A school
makes the request; only its implementation manager (`tenant:implement`) moves it forward.

```text
request
→ classify_tier
→ security_privacy_accessibility_review
→ governance_score
→ approve_configure_flag
→ tenant_sandbox_test
→ uat
→ launch_with_monitoring
→ review_sunset_or_scale
```

## Feature flags

The flag registry already exists: [`docs/FEATURE-FLAG-REGISTRY.md`](../FEATURE-FLAG-REGISTRY.md), backed by
`app/src/lib/flags.ts`. Every flag there already carries the required metadata: key, description, type, owner, scope,
default (always off), created, review, expiry for temporary flags, rollout, success metric, rollback and runbook. The
evaluation order runs from the kill switch, through environment, entitlement, connection, scope, capability, role,
classification and course rule, to user eligibility. It matches the order proposed for this model and is enforced by
`flags.test.ts`.

| Category | Example in the registry | Owner |
| --- | --- | --- |
| Global kill switch | `kill.ai_generation` | Security/operations |
| Module entitlement | `module.integration_dashboard` | Product/customer success |
| Tenant connector | `integration.lms_lti` | Integration owner |
| Provider scope | `scope.sis.enrollment_read` | Data/privacy owner |
| Release | `release.integration_dashboard_v1` | Product/engineering |
| Experiment | `experiment.today_action_ranking_v2` | Product research |
| Safety | `safety.scoped_pseudonymity` | Trust & Safety |
| Write-back | `writeback.lms_grade_passback` | Registrar/IT |

The **flag debt** rule: a flag past its review date is either renewed with a reason, or removed together with its
code in one commit. The quarterly portfolio review walks the list.

## Extension framework

| Type | Example | Data access | Governance |
| --- | --- | --- | --- |
| UI extension | Approved campus-service card | Minimal contextual metadata | Tenant approval, accessibility review |
| Deep link | Library database or appointment system | No data exchange by default | Verified destination, owner, expiry |
| Read-only connector | Career opportunity feed | Approved field mapping | DPA, scopes, sync audit |
| Workflow extension | Tutoring booking handoff | Minimum necessary context | Consent, service owner, audit |
| Tool launch | LTI research simulation | Course/resource context only | LTI validation, policy, source |
| Data export | Approved BI/warehouse report | Aggregated governed data | Role, thresholds, audit |
| Write-back | Calendar save / grade passback | Explicit scoped fields | Double approval, confirmation, audit |

**Certification** for an extension in the directory needs four things. The first is a charter. The second is a
scorecard with no zero and at least 21 points. The third is an accessibility review against the component standard.
The fourth is a data contract for anything that reads, or a write-back flag for anything that writes. Certification
lasts twelve months.
