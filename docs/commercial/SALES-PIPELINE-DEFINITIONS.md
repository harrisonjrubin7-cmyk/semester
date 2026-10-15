# Sales Pipeline Definitions

| Control | Value |
| --- | --- |
| Status | **CONTROLLED DEFINITIONS — NO CURRENT PIPELINE VALUE OR FORECAST ASSERTED** |
| Owner | Harrison Rubin — company-side pipeline owner; backup seller, finance reviewer and deal desk unassigned |
| Evidence date | 2026-10-03 at repository revision `a86b3376` |

## Stage model

One opportunity represents one legal customer, bounded problem/cohort/workflow and potential commercial decision. A contact, form submission, meeting, demo, security questionnaire, proposal or verbal interest is not automatically an opportunity or customer.

This document uses the exact controlled vocabulary in `app/src/lib/gtm/stages.ts`; the code maps every stage to the coarser account statuses `target`, `engaged`, `pilot`, `customer`, `paused` and `closed_lost`.

| Implemented stage | Required evidence before advancing |
| --- | --- |
| `target_account` | organization/use case fits the controlled ICP hypothesis; source and owner recorded |
| `discovery` | authorized stakeholder agrees to a discovery conversation |
| `qualified` | named champion, stated problem, budget cycle and decision process recorded |
| `multi_stakeholder_demo` | appropriate stakeholders and a synthetic/non-activation demonstration scope are agreed |
| `outcome_workshop` | buying committee is mapped, including IT, privacy, accessibility and academic sponsor |
| `technical_review` | requested architecture/integration evidence, questions, owners and dates are logged |
| `security_privacy_accessibility_review` | requested controls, exceptions, owners and acceptable prerequisites are documented |
| `proposal` | dated conditional proposal with approved or explicit placeholder terms is authorized for delivery |
| `pilot_or_implementation_SOW` | customer-specific scope, measures/guardrails, responsibilities, support and offboarding pass pilot readiness |
| `procurement_legal` | proposal is accepted into formal review; redlines, approvals and dependencies are tracked |
| `contracted` | procurement and legal have signed and deal-desk review has no refusals; this is the successful commercial decision, not activation or recognized revenue |
| `implementation` | signed scope and accepted handoff enter the controlled pilot/delivery lifecycle |
| `live` | launch council returns GO for the named first cohort; this does not imply broad or enterprise launch |
| `renewal` | pilot has a signed final verdict with approved outcomes measured |
| `expansion` | separately authorized scope and evidence support an expansion decision |
| `closed_lost` | rejection, disqualifier, withdrawal or expiry is recorded with reason, learning and future-contact rule |

There is no separate `closed_won` or `implementation_pending` value in the implemented model. `contracted` is the successful commercial decision; `implementation` begins delivery after an accepted handoff. The later `live`, `renewal` and `expansion` states preserve one governed GTM lifecycle. None by itself proves activation, delivery acceptance, billing, cash collection, recognized revenue or enterprise readiness.

Movement requires the exit evidence; never advance to improve a forecast. The implemented transition helper does not permit backward moves. When required evidence later fails, pause the account, record the correction and block forward movement; close the opportunity when the decision is no longer valid, and create a fresh `target_account` only if a later authorized motion begins. Record stage-entered time, next action/date, owner, amount/currency/status, probability source, scope, risk, decision date and evidence links. Any amount, probability or close date without authority is labeled **assumption** and excluded from actual revenue/customer claims.

## Vocabulary crosswalk

`stages.ts` is the only stage vocabulary a pipeline record may use. Other documents describe the same journey in other words; they are views of it, never second stage lists.

| Other vocabulary | Where | Reads as |
| --- | --- | --- |
| seven gated stages | `INSTITUTIONAL-GTM-PLAYBOOK.md` | the seven stages that carry an exit gate in `SALES_EXIT`: `qualified`, `outcome_workshop`, `proposal`, `pilot_or_implementation_SOW`, `contracted`, `live`, `renewal`. The other nine are gated by [`ACCOUNT-SCORING-AND-FORECAST.md`](ACCOUNT-SCORING-AND-FORECAST.md) |
| pilot lifecycle `discovery → configure → train → launch → hypercare → learn → decide` | `PAID-PILOT-FRAMEWORK.md` | delivery of one pilot: `configure` and `train` happen in `implementation`, `launch` is the launch-council GO that enters `live`, `hypercare` and `learn` run in `live`, and `decide` ends in a signed verdict that opens `renewal` |
| fourteen tenant rollout states | `operating-model/PILOT-TO-PRODUCTION.md` | the database-enforced state of a customer tenant, which tracks delivery after `contracted`; it is not a sales stage |
| funnel steps | `GROWTH-FUNNEL-SPEC.md` | a reporting view: `technical_review` and `security_privacy_accessibility_review` may be reported as one step, and launch, activation and outcome review are measures, not stages |
| the five-option conversion list | `operating-model/PILOT-TO-PRODUCTION.md` | the four final verdicts of `pilotVerdict` (convert, expand, pause, stop) plus an extension, which is not a verdict; see `PILOT-TO-ANNUAL-CONVERSION.md` |

**`renewal` has two meanings today, kept apart.** The stage `renewal` is entered by a signed final pilot verdict. The renewal of an annual contract is its own renewal opportunity, created by the commercial trigger 120 days before the term ends (`docs/COMMERCIAL-CORE.md`), and is reported as a renewal motion, not as a second move of the pilot opportunity.

**"Agreed price" is private.** `annualPriceAgreed` in `pilotReadiness` means the quote or order for that account states a price both sides accepted. It does not make a price public, and CLM-015 stays prohibited until the claims owner approves exact wording.

## Forecast and hygiene

Pipeline amount uses the approved quoted scope, never an invented price. Weighted pipeline is amount × explicitly approved probability and remains a planning estimate—not booked, billed, collected or recognized revenue. Separate new, renewal, expansion and services motions; do not double-count a pilot and its hypothetical annual conversion. Review stale next actions, duplicate accounts, expired proposals, missing authority, unsupported close dates and consent/suppression weekly.

## Evidence state

**Repository evidence.** Qualification, discovery, proposal, trust, implementation and commercial-control artifacts define the required stage evidence.

**Operational evidence.** No approved current pipeline, stage history, forecast calibration, deal desk, contracted institutional customer or revenue record is evidenced.

**Missing test/proof.** Configure the controlled stages/required fields; deduplicate/import only authorized records; assign reviewers; run hygiene/forecast reviews; reconcile signed orders to finance and implementation; validate stage definitions against real outcomes.

## Claim ceiling

Semester may use these definitions to manage prospective work and report counts explicitly labeled by evidence state.

## Prohibited claims

Do not describe targets, leads, verbal interest, proposals, weighted pipeline, signed-but-unaccepted scope, invoices or cash as customers, bookings, ARR/MRR or recognized revenue without the corresponding authorized definition and record.
