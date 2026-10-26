# Commercial governance: pricing, AI economics, ROI and financial controls

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md).

## Pricing governance and the deal desk

Hybrid pricing becomes chaotic without controls. Student plans, institutional licences, implementation, AI capacity
and sponsors all add to that. Source: [`app/src/lib/governance/deal-desk.ts`](../../app/src/lib/governance/deal-desk.ts).
`review(deal)` returns the approvers a deal needs and the terms it refuses.

> **The thresholds in `DEAL_POLICY` are proposed defaults.** No institutional price book exists in this repository.
> Finance sets the real figures in that one object, with its sign-off recorded in the commit.

| Rule | Proposed default |
| --- | --- |
| Minimum annual contract value | Pilot $15k · department $25k · campus $75k · system $200k |
| Discount approval | ≤10% sales lead · ≤20% + finance · ≤30% + CEO · ≤40% + board · above: refused |
| Maximum pilot credit | 50% of first-year value |
| Maximum pilot length | 6 months, then convert or end |
| Implementation fee floor | $10k; it can be waived only as pilot credit, which is capped |
| Multi-year discount | 3% per year beyond the first, capped at 9% |
| AI/compute overage | Must be written into every order |
| Custom work | Needs product approval and a scorecard (see [PORTFOLIO-GOVERNANCE.md](PORTFOLIO-GOVERNANCE.md)) |
| Marketplace revenue share | Set by finance; sponsors never receive student-level data |
| Scholarship / low-income / nonprofit / system pricing | An approved programme, needs finance, and still counts against the discount ladder |
| "Free forever" enterprise commitments | **Refused** |

**Who sits at the deal desk:** sales always; finance above 10% or for any access programme; implementation on every
deal; product when custom work is committed; legal for non-standard paper; security/privacy when the deal changes what
data flows.

**Seats and where else approval is written.** `deal-desk.ts` is the canonical ladder for amounts and discounts. `docs/legal-drafts/CONTRACT-DEVIATION-APPROVAL-MATRIX.md` routes non-standard language, and `docs/market-readiness/LEGAL-AND-COMMERCIAL-READINESS.md` routes novel terms; neither sets an amount. No `sales_lead` seat exists yet, and the finance, CEO and board seats have no named holder. Proposed interim rule, for the owner to confirm: until a seat is filled, a deal that needs it goes to the next approver above it, so today even a discount of up to 10% goes to finance, and nothing is quoted off the ladder. This is a policy proposal, not a delegation of authority.

## AI cost controls

Education pricing can't absorb unconstrained inference, media generation, code execution and data processing. Some of
this already exists:

- **Metered gateway:** see [ADR 0004](../architecture/0004-ai-through-a-metered-gateway.md).
- **Atomic per-tenant monthly budgets:** `private.reserve_ai_budget` in
  `supabase/migrations/20260924163000_intelligence_provider_runtime.sql`.
- **Kill switch:** `kill.ai_generation`.
- **Classification gate:** T3 and above never go to a consumer model.

```text
Request
→ classify complexity and data sensitivity
→ choose allowed provider/model
→ apply tenant/user budget
→ use cache/reuse where safe
→ run source-grounded workflow
→ record cost and outcome
→ fall back gracefully if capacity limit reached
```

| Control | Implementation | Status |
| --- | --- | --- |
| Model routing | Smaller models for classification, extraction and metadata; stronger models only for complex grounded tasks | Partial: `lib/classify.ts` runs a free heuristic before the model |
| Tenant AI budget | Monthly capacity by contract tier | **Built** (`reserve_ai_budget`) |
| User fair-use limits | Transparent allowance; never a surprise hard lock in an urgent academic moment | Designed |
| Course policy gate | AI respects course and assignment permissions | **Built** (toolkit policy precedence) |
| Caching | Non-sensitive reusable outputs, within tenant and source boundaries | Designed |
| Batch processing | Queue PDFs, media and indexing | Designed |
| Compute quotas | Sandbox runtime budgets | Designed, behind `ops.code_sandbox_enabled` |
| Cost observability | Cost per tenant, user, workflow, provider, model and successful task | Partial: usage is recorded per tenant |
| Fallback modes | Source search, templates and manual workflows when capacity runs out | Designed |
| Cost alerts | Admin and company alert before overage | Designed |
| Quality gates | Never substitute a cheaper model that fails grounding, accessibility or safety benchmarks | Process |

**AI unit-economics dashboard (monthly):** AI cost per active student · per completed action · per study asset · per
research project · per code/data execution · breakdown by provider and model · cache hit rate · human escalation rate
· quality score · gross margin by plan and tenant.

## ROI and outcome measurement

Don't promise that Semester "improves retention" without a credible measurement plan. Measure direct, proximal
outcomes first.

| Level | Example | Measurement |
| --- | --- | --- |
| Product behavior | Student completes readiness checklist | Event data |
| Workflow outcome | Student arrives at advising with scenario/questions | Student and advisor confirmation |
| Service outcome | Student successfully books tutoring | Handoff and booking status |
| Institutional operational outcome | Fewer repetitive registration inquiries | Helpdesk category trend |
| Academic/support outcome | More verified research workflow completion | Source/citation audit completion |
| Strategic outcome | Improved persistence/retention | Institution-led analysis, with careful attribution |

```text
ROI = (measured benefit − Semester cost) / Semester cost
```

Measured benefits can include staff time saved, service tickets avoided, faster onboarding, higher action completion,
better appointment preparation, less manual integration and content work, more verified source use, better uptake of
service referrals, and a lower support burden.

**Don't frame dashboards around student "risk."** Measure whether the university made the right support, service or
action easier to reach.

## Financial controls

| Control | Owner | Rule |
| --- | --- | --- |
| Revenue recognition policy | Finance | Written before the first multi-year contract; subscription recognised ratably, implementation on delivery |
| Invoice approval | Finance | Invoices over a threshold need a second approver |
| Refund/credit policy | Finance | Written; credits over a threshold go through the deal desk |
| Expense approval thresholds | Finance + CEO | Tiered by amount |
| Vendor purchase approvals | Finance + security (for data processors) | Every data processor goes on the subprocessor list |
| Marketplace payout reconciliation | Finance | Monthly |
| Sponsor campaign billing reconciliation | Finance | Per campaign |
| Grant restriction tracking | Finance | Restricted funds tracked separately |
| Budget vs actual | Finance | Monthly (see [OPERATING-RHYTHM.md](OPERATING-RHYTHM.md)) |
| Cash forecasting | Finance | 13-week rolling |
| Tax/nexus review | External accountant | Annually, and on entering a new state |
| Fraud controls | Finance | Payee changes verified out-of-band |
| Segregation of duties | Finance | The person who approves a payment doesn't release it |
| External review | External accountant/bookkeeper | Monthly close review |
