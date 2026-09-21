# Procurement Checklist

**Status: `NOT_STARTED`**

What a university procurement and security review asks for, and what we could
hand over today.

| Ask | Have | Note |
| --- | --- | --- |
| Security questionnaire (HECVAT or similar) | **No** | Nothing prepared |
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
| SSO support | **No** | Hard blocker for most institutions |
| Accessibility conformance | **Partial** | Real infrastructure, no journey audit |
| Uptime SLA | **No** | Cannot be offered without monitoring |

## The three that block hardest

1. **SSO.** Many institutions will not proceed past this line.
2. **Security questionnaire.** Cannot be answered honestly today; several
   answers would be "no".
3. **Uptime SLA.** Unofferable without monitoring — you cannot commit to a
   number you cannot measure.

## The rule

Every answer is the true one. A "yes" that unravels in a follow-up call costs
more than the "no, and here is when" it replaced. Several of these are
legitimately "not yet, and here is the plan", and institutions deal with that
answer all the time from early vendors.
