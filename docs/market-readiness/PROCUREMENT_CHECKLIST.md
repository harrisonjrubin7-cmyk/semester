# Procurement Checklist

**Status: `IN_PROGRESS`** — the control-by-control register is `HECVAT_READINESS.md`

What a university procurement and security review asks for, and what we could
hand over today.

| Ask | Have | Note |
| --- | --- | --- |
| Security questionnaire (HECVAT or similar) | **Partial** | `HECVAT_READINESS.md` registers every control with its evidence, test-checked; not yet a completed questionnaire |
| SOC 2 report | **No** | No audit has been performed |
| Penetration test report | **No** | None commissioned |
| VPAT / ACR | **No** | Requires formal evaluation; do not fabricate |
| Data flow diagram | **No** | Constructible from this tree today |
| Subprocessor list | **No** | Constructible: Supabase, GitHub Pages, AI providers |
| Incident response plan | **Partial** | Process defined here; never exercised |
| Business continuity / DR | **No** | No tested restore |
| Privacy policy | **No** | — |
| Terms of service | **No** | — |
| DPA | **No** | — |
| Insurance | **No** | — |
| SSO support | **Partial** | SAML membership binding and SCIM provisioning exist and are policy-tested; no real institution's IdP has completed an exchange (`HECVAT_READINESS.md` IAM-1) |
| Accessibility conformance | **Partial** | Automated critical-journey audits run in CI; formal review and VPAT/ACR remain absent |
| Uptime SLA | **No** | Hourly public synthetic monitoring exists, but no measured availability history, named on-call route or contractual SLO exists |

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
