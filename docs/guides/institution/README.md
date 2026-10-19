# Guides for institutions

> **Type:** explanation · **Audience:** institution-admins, implementers · **Owner:** `success` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/institution-guides.test.ts`

This is the index to the guides for people who adopt, configure, run and leave Semester on behalf of an institution; stop reading if you are a student or a faculty member looking for help with the app itself.

**Status:** no institution has been activated. These guides describe tooling that is built and tested in this repository: it is `IMPLEMENTED_NOT_RELEASED` as tenant tooling, and the institution gateway runs against a sandbox adapter (`MOCK_DEMO`). Read each page's own Status line before you plan around a capability.

<!-- status: Tenant admin console = IMPLEMENTED_NOT_RELEASED -->
<!-- status: Institution gateway (records/actions/AI) = MOCK_DEMO -->
<!-- verdict: council=NO-GO decision=2026-10-03 -->

## Where the launch decision stands

The Launch Readiness Council page says `Current verdict: NO-GO` ([`LAUNCH-READINESS-COUNCIL.md`](../../LAUNCH-READINESS-COUNCIL.md)). The repository go / no-go recommendation, dated 2026-10-03 ([`GO-NO-GO-DECISION.md`](../../../GO-NO-GO-DECISION.md)), reads:

| Motion | Decision as written |
| --- | --- |
| Design-partner institutional pilot | GO / GREEN for non-activation engagement only: discovery, synthetic demos, evidence exchange, conditional scoping |
| Paid institutional pilot | NO-GO / RED |
| Broad institutional enterprise sale | NO-GO / RED |

That is the verdict as written on those dates, not a forecast. The capability-level view is in [`CAPABILITY-ACTIVATION-REGISTER.md`](../../CAPABILITY-ACTIVATION-REGISTER.md), which says: "No tenant is activated by this register."

## The pages

| Page | Type | Use it to |
| --- | --- | --- |
| [Admin guide](ADMIN-GUIDE.md) | how-to | Find your role, find your tabs on the University screen, and know which of them need a second person |
| [Configuration and approvals](CONFIGURATION-AND-APPROVALS.md) | how-to | Draft, review and publish a configuration or a workflow under the two-person rule |
| [Audit and data requests](AUDIT-AND-DATA-REQUESTS.md) | how-to | Know what is audited, who can read it, and how a rights request is worked |
| [Implementation guide](IMPLEMENTATION-GUIDE.md) | runbook | Run the phases from signed scope to a limited pilot, with who does what and what you can check |
| [Parallel-run evidence](PARALLEL-RUN-EVIDENCE.md) | explanation | Learn what evidence the repository requires before any wording about taking over from an existing system |
| [SSO setup](SSO-SETUP.md) | runbook | See what exists for SAML and OIDC, and the order of activation |
| [SCIM provisioning](SCIM-PROVISIONING.md) | how-to | Point an identity provider at `/scim/v2` |
| [LTI setup](LTI-SETUP.md) | runbook | Register Semester in a learning system |
| [Roster and data loading](ROSTER-AND-DATA-LOADING.md) | explanation | See what loads people and school data today, and what does not exist |
| [Student data map](STUDENT-DATA-MAP.md) | reference | See what Semester holds, for how long and who can read it |
| [Procurement and accessibility artefacts](PROCUREMENT-AND-ACCESSIBILITY-ARTEFACTS.md) | reference | Find the HECVAT, VPAT and trust documents and their stated status |
| [Change management](CHANGE-MANAGEMENT.md) | how-to | Tell staff and students what is changing |
| [Exit plan](EXIT-PLAN.md) | runbook | Leave: offboarding case, student exports, what is not built |

## Who does what, in one rule

Semester operates the database, the gateway and the service-role steps. Your institution owns identity, rosters, policy, communications and the decision to proceed. Where a step needs both, the page names each side. Where the repository records a step that needs a Semester operator, you ask Semester; there is no screen that lets you do it yourself.

## Related, not restated

- Pilot method: [`PILOT-TO-PRODUCTION.md`](../../operating-model/PILOT-TO-PRODUCTION.md) and [`PILOT-IMPLEMENTATION-PLAYBOOK.md`](../../market-readiness/PILOT-IMPLEMENTATION-PLAYBOOK.md)
- What is live: [`FEATURE-TRUTH-TABLE.md`](../../FEATURE-TRUTH-TABLE.md)
- Known limits shown to pilot users: [`KNOWN-LIMITATIONS.md`](../../pilot/KNOWN-LIMITATIONS.md)
