# Security control matrix

| Control | Implementation evidence | Verification | Current status | Pilot gate |
| --- | --- | --- | --- | --- |
| identity/session | Supabase auth and account flows | auth tests; target acceptance owed | DESIGN PARTNER | recovery, session, MFA/privileged evidence |
| tenant/resource authorization | school membership, capability checks, RLS migrations | policy and adversarial tests | DESIGN PARTNER | named-tenant independent acceptance |
| least privilege | scoped grants, expiry/revocation, service-role separation | role/grant tests | DESIGN PARTNER | production access review |
| privileged audit | append-only audit/event patterns | DB tests and samples | DESIGN PARTNER | reviewer-signed production export |
| input/file/content safety | validation/sanitization/media safeguards | unit/adversarial suites | DESIGN PARTNER | target-flow abuse test |
| web headers/CSP | CSP and hosting header configuration | header tests/smokes | DESIGN PARTNER | production origin verification |
| secrets/supply chain | secret scan, lockfile, pinned Actions, SBOM | CI and dependency audit | DESIGN PARTNER | blocking high/critical policy + evidence review |
| vulnerability management | disclosure and remediation targets | scan/finding register | INTERNAL | security owner; pen test; close P0/P1 |
| AI security | gateway, scoped tools, no prompt-as-boundary, limits | injection/evaluation drills | DESIGN PARTNER | approved provider/use and target red team |
| monitoring/incident | audit/diagnostic design and runbooks | smoke/tabletop | INTERNAL | staffed alerts and production drill |
| backup/recovery | backup/restore scripts and runbooks | controlled rehearsal | DESIGN PARTNER | timed target-environment restore |
| integration safety | two-phase journal, replay/nonce/signature controls | gateway/LTI tests | DESIGN PARTNER | customer-approved connection acceptance |

### Mandatory adversarial cases

Cross-tenant and cross-resource access; IDOR; stale/revoked/expired roles; replayed/invalid webhooks and LTI assertions; unsafe uploads/HTML/SVG; malformed calendar/roster/content imports; provider outage/timeout; duplicate/uncertain writes; prompt injection/tool escalation; export/delete authorization; support-access overreach.

### Vulnerability release rule

Open P0/P1 findings block launch. Lower findings require owner, compensating control, target date, disclosure where relevant, and expiry. A repository scan is not a penetration test.
