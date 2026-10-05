> **DRAFT FOR QUALIFIED LEGAL REVIEW. This document is a business and operational template, not legal advice, not an executed agreement, and not a substitute for review by licensed counsel in the applicable jurisdiction.**

# Semester domain and digital-asset register template — draft

- **Register owner/backup:** `[TBD]`
- **Legal entity/beneficial owner:** `[TBD]`
- **Credential-vault and evidence location:** `[TBD]`
- **Review cadence:** `[TBD]`

## Plain-language summary

This register tracks internet domains, DNS, certificates, hosting accounts, social handles, app-store listings, repositories, package registries, email/service identities and other digital assets. A URL or account appearing in the repository does not prove company ownership, administrative control, renewal, recovery readiness, trademark rights, or authority to transfer it.

## Asset register

| Asset ID | Type/name/URL | Registrar/provider | Registrant/owner | Admin/technical/billing owner + backup | Access/MFA/recovery | Renewal/expiry/payment | DNS/cert/linked services | Transfer/lock/status | Evidence/issues |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `[DA-000]` | `[DOMAIN / DNS / CERTIFICATE / HOSTING / EMAIL / SOCIAL / APP STORE / REPOSITORY / REGISTRY / OTHER]` | `[TBD]` | `[UNVERIFIED]` | `[TBD]` | `[NO SECRETS; VAULT REFERENCE]` | `[TBD]` | `[TBD]` | `[TBD]` | `[TBD]` |

## Control requirements

- Company-controlled account and contact details; no dependency on a departing person's personal email, phone, payment method or device.
- Phishing-resistant MFA where supported, least privilege, two recovery-capable administrators, secure recovery codes and quarterly access review.
- Auto-renewal plus independent expiry monitoring; current payment/contact information; documented grace/redemption windows and escalation.
- DNS change control, registrar lock, DNSSEC/certificate posture where approved, inventory of records/dependencies, rollback and verified ownership before changes.
- Transfer, succession, incident, compromise, impersonation, takedown, archival and closure procedures with immutable decision evidence.
- Brand/trademark, naming, jurisdiction, export/sanctions, app-store, platform and provider-term review where applicable.

Do not place passwords, tokens, private keys, recovery codes, personal data or full payment details in this register. Store only approved vault/evidence references and access classifications.

## Product-behavior and evidence mapping

| Area | Current evidence | Limitation |
| --- | --- | --- |
| domains/URLs used by product and deployments | repository configuration and deployment records | source references do not prove registrant, billing, renewal or recovery control |
| repositories/workflows | Git and CI configuration | access lists, beneficial ownership and provider account recovery require external records |
| brand names/handles | product/site assets | use does not establish clearance or trademark rights |
| product-domain maturity | [`docs/DOMAIN-REPLACEMENT-REGISTER.md`](../DOMAIN-REPLACEMENT-REGISTER.md) | this is an architecture/maturity register, not an internet-domain ownership inventory |

## Operational and publication blockers

Verified owner/entity; complete inventory and dependencies; primary/backup administrators; MFA/recovery; vault references; renewal/payment; registrar/provider contacts; DNS/certificate records; transfer locks; incident and succession drill; third-party/employee/contractor transfers; trademark/naming review; age/geography/jurisdiction; and approved public contact data. No asset may be described as owned, protected, transferable or resilient without current evidence.
