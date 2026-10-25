# App portfolio (32 proposed workspaces)

Source: founder-supplied portfolio reports, 23 Oct 2026 (including the per-app "Semester Zite App Portfolio Report" with roles, API domains, tiers, documented 5 Oct 2026 maturity, authority and activation gates — encoded in full in `apps/semester-security-lab/src/lib/portfolio.ts`). These are proposed workspace groupings, not 32 deployed apps. One Zite app may host several workspaces. Documented maturity is historical design evidence, never live status.

## Groups
- **Education (10):** Student; Faculty and Teaching; Advising and Tutoring; Applicant and Admissions; Registrar; Campus Services; Campus Community; Career and Alumni; Employer and Partner; Family and Delegates.
- **Institutional administration (5):** Institution Administration; Institution IT; Institution Trust; Institution Analytics; Student Accounts.
- **Developer ecosystem (2):** Developer Portal; App Review and Marketplace.
- **Company operations (14):** Executive and Strategy; Sales and Revenue Ops; Company Finance; Marketing and Growth; Content and Media; Customer Success; Implementation Delivery; Support Operations; People Operations; Legal and Procurement; Trust and Governance; Engineering and Product; Platform Operations; Board and Investor.
- **Public (1):** Public Site and Trust Center.

## Developer tiers (capability-risk bands, not plans)
T0 read/review · T1 scoped authoring or request initiation · T2 privileged configuration or consequential commands. A tier is the app's highest capability and does not authorize every user.

## Key boundaries
- Institution admin does not grant access to student, financial or accommodation records.
- Company Finance is separate from Student Accounts; company views see student-account data only as aggregates.
- Marketplace approval never implies access to every institution; each institution approves the exact install, version, environment and scopes. Keep publisher verification, version review, install approval, expanded-permission approval and revocation as distinct approvals.
- Institutional activation order: two named admins → sandbox identity → academic calendar → approved SIS mapping → LMS → retention/export → module and AI config → recorded UAT → joint incident contacts. Building a control is not authorization to use it.
- Company chain: opportunity → quote → contract → implementation → invoice → reconciliation → entitlement → customer success → renewal. Connected records, not parallel copies.

## Always unverified until evidence exists
Hosted URL, executed tests, institution authorization, production enablement.

The live mapping to Zite apps is in Security Lab → App portfolio (`apps/semester-security-lab/src/lib/portfolio.ts`).
