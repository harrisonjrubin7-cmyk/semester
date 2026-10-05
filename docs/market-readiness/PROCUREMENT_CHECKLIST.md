# Procurement Checklist

**Status: `IN_PROGRESS`** — the control-by-control register is `HECVAT_READINESS.md`

What a university procurement and security review asks for, and what we could
hand over today.

| Ask | Have | Note |
| --- | --- | --- |
| Security questionnaire (HECVAT or similar) | **Partial** | `HECVAT_READINESS.md` registers every control with its evidence, test-checked; not yet a completed questionnaire |
| SOC 2 report | **No** | No audit has been performed; the gap assessment is `docs/trust/SOC2-READINESS.md` |
| Penetration test report | **No** | None commissioned |
| VPAT / ACR | **No** | Requires formal evaluation; do not fabricate |
| Data flow diagram | **Partial** | `docs/market-readiness/DATA-FLOW-DIAGRAM.md` and `docs/trust/DATA-FLOW-MAP.md` (`PARTIAL`): logical product flows; not verified against a named tenant or production traffic |
| Subprocessor list | **Partial** | `docs/SUBPROCESSORS.md`: every destination, held by test to the app's content-security policy and its Edge Functions; not yet reviewed by counsel or published |
| Incident response plan | **Partial** | Process defined here; never exercised |
| Business continuity / DR | **No** | No tested restore |
| Privacy policy | **Partial** | Drafts only, not in force and not reviewed by counsel: `docs/legal/PRIVACY-POLICY-DRAFT.md`, `docs/legal-drafts/PRIVACY-NOTICE-DRAFT.md`. The in-app disclosure (`app/src/lib/privacy.ts`) is held to the code by test but is a product disclosure, not a counsel-approved policy |
| Terms of service | **Partial** | Drafts only, not in force and not reviewed by counsel: `docs/legal/TERMS-OF-SERVICE-DRAFT.md`, `docs/legal-drafts/TERMS-OF-SERVICE-DRAFT.md`. Not to be published or used to take payment until counsel approves |
| DPA | **Partial** | A draft addendum (`docs/legal-drafts/DATA-PROCESSING-ADDENDUM-DRAFT.md`) and the requirements and starting language for counsel (`docs/trust/DPA-CHECKLIST.md`). None is approved or signed (HECVAT PRIV-4 `NOT_STARTED`), so none can be offered as Semester's terms |
| Insurance | **No** | — |
| SSO support | **Partial** | SAML membership binding and SCIM provisioning exist and are policy-tested; no real institution's IdP has completed an exchange (`HECVAT_READINESS.md` IAM-1) |
| Accessibility conformance | **Partial** | Automated critical-journey audits run in CI; formal review and VPAT/ACR remain absent |
| Uptime SLA | **No** | Hourly public synthetic monitoring exists, but no measured availability history, named on-call route or contractual SLO exists. The formula, tables and credit schedule are drafted and test-checked in `docs/trust/SLA.md` |

## The three that block hardest

1. **SSO.** Many institutions will not proceed past this line. Built and
   tested; what remains is one live exchange with a real IdP.
2. **Security questionnaire.** Cannot be answered honestly today; several
   answers would be "no".
3. **Uptime SLA.** Still unofferable: an hourly probe begins the measurement,
   but a contractual number needs retained availability history, alert delivery
   to an accountable operator and an agreed SLO/error budget.

## The rule

Every answer is the true one. A "yes" that unravels in a follow-up call costs
more than the "no, and here is when" it replaced. Several of these are
legitimately "not yet, and here is the plan", and institutions deal with that
answer all the time from early vendors.
