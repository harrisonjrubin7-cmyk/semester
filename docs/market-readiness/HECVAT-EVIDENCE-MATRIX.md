# HECVAT 4 and TrustEd Apps evidence matrix

HECVAT is used here as a procurement work plan, not a certification. “Defined” means a control/test exists; “produced” requires a dated operating artifact. Customer answers must be reviewed for the contracted architecture and scope.

| Domain | Owner | Source of truth | Test/proof | Current | Remediation / review |
| --- | --- | --- | --- | --- | --- |
| governance/risk | founder + security | operating model, risk register | signed reviews/exceptions | defined | fill security seat; quarterly |
| asset/data inventory | privacy + data | data inventory/lineage, retention | customer data map, table inventory | partial | approve pilot map; on change |
| identity/access | security | roles, capabilities, RLS, SSO plans | cross-tenant/role suite; access review | defined | production review + MFA evidence; quarterly |
| application security | engineering | CI, threat models, secure patterns | CI history, review sample, DAST/pen test | partial | independent test; each release/annual |
| vulnerability management | security | `SECURITY.md`, dependency/secret scans | finding register and SLA evidence | partial | owner and monthly disposition |
| cryptography/secrets | engineering | hosting/provider and secret-store config | configuration export | partial | target-environment confirmation; annual/change |
| logging/monitoring | operations | audit/event architecture | alert test and log review | partial | production alert drill; monthly |
| incident response | security + operations | incident runbooks | tabletop/incident report | defined | production tabletop; semiannual |
| continuity/recovery | operations | backup/restore plans | timed restore and failover evidence | partial | target-production rehearsal; semiannual |
| SDLC/change | engineering | workflows, CODEOWNERS, release gates | PR sample and branch settings | defined | repository-owner evidence; quarterly |
| vendor/subprocessor | privacy | subprocessor/vendor-risk registers | terms/DPA/security review | partial | verify contracts/regions; annual/change |
| privacy/FERPA | privacy | data map, notices, rights/retention | counsel review, rights-request drill | partial | close DPA/notice issues; annual/change |
| accessibility | accessibility | WCAG scorecard/self-assessment | manual AT report/formal ACR | partial | qualified evaluation; each pilot/annual |
| AI practices | product + privacy | model/provider inventory, AI policies | evaluations, terms, kill-switch drill | partial | approve provider and target use; each change |
| secure integrations | data + security | gateway/LTI/interop controls | conformance and target acceptance | partial | approved customer connection required |
| personnel/operations | founder | council/RACI/training plans | signed owners and training records | open | staff/contract owners before launch |
| legal/insurance | founder + counsel | issue lists/contracts | signed paper and certificates | open | counsel/insurance closeout |

## 1EdTech TrustEd Apps targets

- **Data privacy:** minimum necessary, purpose-limited, rights-enabled, retention/contract clarity, no student-data sale.
- **Security practices:** identity/resource/tenant enforcement, secure development, vulnerability response, incident/recovery evidence.
- **Accessibility:** WCAG 2.2 AA target, manual AT validation, barrier response, remediation evidence, honest ACR status.
- **Generative AI:** declared providers/data uses, no-training rule unless expressly approved, oversight, limits, evaluations, audit and opt-out/disablement.

## Evidence record fields

Every produced artifact must include control ID, owner, tenant/environment, scope, collection method, collected/reviewed dates, reviewer, result, exception/remediation, next review, visibility, and integrity hash where appropriate.
