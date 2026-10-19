# Identity and Provisioning Readiness

| Control | Value |
| --- | --- |
| Status | **REPOSITORY-TESTED SAML/SCIM CONTROLS — TARGET CONFIGURATION AND ACCEPTANCE ABSENT** |
| Owner | Harrison Rubin — company-side identity owner; customer IdP owner, security approver and backup operator unassigned |
| Evidence date | 2026-10-03 at repository revision `d246a348` |
| Source | [`../INSTITUTIONAL-SSO-ARCHITECTURE.md`](../INSTITUTIONAL-SSO-ARCHITECTURE.md), [`../INSTITUTIONAL-SSO-LAUNCH-READINESS.md`](../INSTITUTIONAL-SSO-LAUNCH-READINESS.md), and [`../SCIM-LIFECYCLE-MANAGEMENT.md`](../SCIM-LIFECYCLE-MANAGEMENT.md) |

## Protocol boundaries

| Concern | Repository state | Authority boundary | Material gap |
| --- | --- | --- | --- |
| SAML 2.0 sign-in | built on Supabase Auth SSO with tenant provider records and first-login membership binding | IdP authenticates; active institutional membership and RLS authorize | no real IdP acceptance; certificate expiry/rotation alerting absent |
| SCIM 2.0 Users/Groups | repository-tested service/gateway; off by default | lifecycle from IdP; only administrator-approved group mappings confer roles | no target credential, provider run, mapping acceptance or operated audit review |
| institutional OIDC | not built | none | implementation and provider validation required |
| tenant discovery | domain hint and institution selector are partial | configured tenant/domain records only | no accepted multi-tenant discovery flow or tenant URL |
| roles/entitlements | membership, capabilities, RLS and policies exist; some LTI entitlement evaluation remains shadow-only | roles come from approved institutional mappings, never email or raw LMS role alone | target role matrix, SoD review and periodic access review absent |
| account linking | LTI ticket linking is partial; automatic email linking refused | explicit ticket plus authenticated session | no personal-to-institutional link/unlink lifecycle or complete audit |
| MFA/session controls | privileged/operator controls exist in the repository | target policy and identity-provider settings remain customer-owned | end-user/target policy validation and operated session evidence absent |

SAML proves who is signing in. SCIM controls institutional membership lifecycle. LTI supplies course context. None is a substitute for the others, and none alone grants broad tenant access.

## Minimum activation sequence

1. Name customer identity, security, application and support owners plus company primary/backups.
2. Approve tenant/domain, provider type, metadata, minimum claim mapping, classification and prohibited claims.
3. Configure the SAML provider in a non-production target and record certificate owner/expiry/rotation procedure.
4. Approve SCIM group-to-role mappings with least privilege and separation of duties; issue an expiring tenant credential through the authorized secret channel.
5. Provision representative synthetic accounts, test mapped/unmapped groups, sign-in binding, role limits, cross-tenant refusal, duplicate/replay behavior and audit records.
6. Deprovision and suspend accounts; confirm access ends while user-created work follows the approved retention/export rule.
7. Exercise provider outage, certificate/credential rotation, disablement, rollback, incident routing and support handoff.
8. Obtain customer identity/security acceptance, then record production change authority and activation as separate decisions.

## Acceptance evidence

The target record must identify environment, provider and configuration version; claims and mappings; credential/certificate custody and expiry; representative roles; every test and result; sanitized audit references; defects/residual risks; rollback result; approvers and timestamps. Production access is not inferred from a passed sandbox run.

## Evidence state

**Repository evidence.** SAML provider/membership binding, tenant-scoped SCIM provisioning, approved group mappings, deprovisioning behavior, audit records and negative tests exist in the checkout. SCIM remains off by default.

**Operational evidence.** No named IdP, issued customer credential, production certificate, accepted mapping, real-provider test, access review, operated rotation or institutional sign-off is evidenced.

**Missing test/proof.** Complete the target activation sequence with two or more representative roles, an unmapped user, another-tenant negative case, suspension/deprovision, certificate and credential rotation, outage/rollback, audit review and customer witness.

## Claim ceiling

Semester may say that repository-tested SAML and SCIM controls exist and are disabled until configured and accepted. OIDC must be described as unavailable for institutional sign-in.

## Prohibited claims

Do not claim SSO/SCIM live, identity-provider certified, zero-touch provisioning, OIDC support, universal directory compatibility, MFA-complete, role mapping approved, access governance operated or institution-ready without the corresponding target and operational evidence.
