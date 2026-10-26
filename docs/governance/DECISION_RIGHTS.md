# Decision rights (ADR program view)

This page assigns who may *accept* each class of ADR. It points at the existing, enforced rules instead of restating them: database two-person rules are in [`docs/DECISION-RIGHTS.md`](../DECISION-RIGHTS.md); seat holders are in [`docs/LAUNCH-READINESS-COUNCIL.md`](../LAUNCH-READINESS-COUNCIL.md) and [`OWNER-AND-ACCOUNTABILITY-MATRIX.md`](../../OWNER-AND-ACCOUNTABILITY-MATRIX.md). Per those documents most seats are held by the founder, several acting, and none has signed — this page does not change that.

| ADR class | Accountable role | Required reviewers | Counsel / external |
| --- | --- | --- | --- |
| Tenancy, identity, authorization (0002, 0003, 0004, 0008, 0020, 0021) | CTO / platform architect | security architect, data architect | — |
| AI policy and risk (0005, 0014) | AI governance lead | security, privacy, product | counsel for external-message and minors questions |
| Data lifecycle, rights, retention (0017, 0019) | Privacy engineer / data architect | CISO, registrar-experience lead | **counsel required** |
| Release, recovery, incident (0012, 0018, 0025) | SRE / incident commander | CTO, support lead | — |
| Accessibility (0013) | Accessibility lead | design-systems lead | external assessor for any public claim |
| Commercial and procurement (0016, 0022, 0024) | CFO / CRO | CEO, security | **counsel required** (contracts, payments, tax, claims) |
| Institutional lifecycle and integrations (0006, 0011, 0015) | COO / integration architect | customer-success, security | counsel for DPA / pilot paper |
| Mobile and offline (0009, 0023) | Mobile architect | security, accessibility | — |
| Governance itself (0001), dual control (0010) | Founder | all | — |

Roles are program roles, not people. Where the repo names no holder the cell stays a role.
