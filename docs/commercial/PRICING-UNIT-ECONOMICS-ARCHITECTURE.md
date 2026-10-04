# Pricing, packaging, entitlements and unit-economics architecture

| Control | Value |
| --- | --- |
| Status | **PROPOSAL FOR OWNER, FINANCE, TAX AND COUNSEL REVIEW — NOT A PRICE BOOK, NOT A DECISION** |
| Owner | Harrison Rubin — commercial proposal owner; finance, tax, counsel and signing authority review unassigned |
| Evidence date | 2026-10-04 at repository revision `7287ddc` |
| Model | [`unit-economics-model.py`](unit-economics-model.py) — every figure below is printed by it; `--check` asserts the findings this document leans on |
| Builds on | [`PRICING-AND-PACKAGING.md`](PRICING-AND-PACKAGING.md), [`../COMMERCIAL-CORE.md`](../COMMERCIAL-CORE.md), [`../ENTITLEMENT-RESOLUTION.md`](../ENTITLEMENT-RESOLUTION.md), [`../operating-model/COMMERCIAL-GOVERNANCE.md`](../operating-model/COMMERCIAL-GOVERNANCE.md), [`app/src/lib/governance/deal-desk.ts`](../../app/src/lib/governance/deal-desk.ts) |

## 0. What this is, and what it is not

[`PRICING-AND-PACKAGING.md`](PRICING-AND-PACKAGING.md) says there is no approved price book, that prices embedded
in code are not one, and that unknown inputs stay placeholders. This document respects that. It does three things
the repository does not yet have:

1. a **structure** (SKUs, entitlements, meters, controls) that works for any price the owner later approves;
2. **cost-derived floors** — the lowest price at which a stated margin holds under stated cost assumptions —
   instead of invented willingness-to-pay;
3. the **gaps** between what is built and what the thesis needs.

It makes **no decision**. A decision is `docs/decisions/D-<pull request number>.md`
([`../decisions/README.md`](../decisions/README.md)); section 13 lists the ones it asks for. It states **no legal,
tax, accounting or financial-aid conclusion**; section 12 lists the questions for the people who may.

**Claim ceiling (unchanged):** Semester may discuss packaging hypotheses and prepare quotes with explicit
unresolved placeholders for internal review. It may not publish, quote or charge an unapproved number.

### Assumptions, labelled

Provider token prices are first-party list prices from the claude-api reference cached 2026-09-25 (Haiku 4.5
$1/$5, Sonnet 5.5 $2/$10, Opus 5 $5/$25, Opus 5.5 $4/$20, Fable 5.1 $10/$50 per million tokens in/out; cache reads
about 10% of input; batch 50%). **Re-read them from the provider before relying on them.** Card, tax and app-store
rates are public list rates quoted from memory and must be confirmed. Everything about Semester's own delivery
cost (hours, FTE shares, ticket rates) is an **assumption with a lean / base / heavy range**, because the
repository holds no observed cost baseline. The point of the range is that the conclusions below survive it or
say where they do not.

## 1. Findings first

Verified in the code at the revision above; the cost figures are model output under the stated assumptions.

| # | Finding | Evidence | Why it matters |
| --- | --- | --- | --- |
| F1 | **The shared AI key is capped in calls, not dollars.** Any signed-in account may name any of four models, output is clamped at 16,000 tokens, and the cap is 60 calls a month. At the cap on the app's default model (Opus 5) one account costs about **$7.50 a month — roughly Plus's monthly price ($7.99)**; at the worst the clamp allows (Fable 5.1, long output) about **$66 a month**. | `supabase/functions/_shared/clamp.ts` (`ALLOWED_MODELS`, `MAX_OUTPUT_TOKENS`), `functions/claude/index.ts` (`count_call`, `MONTHLY_CALLS`), `lib/assistant.ts` (default `claude-opus-5`) | The clamp's own comment says it: *"The cap counted calls; the bill counts tokens."* Exposure exists wherever `ANTHROPIC_API_KEY` is set. Section 3.4 and 7 fix it. |
| F2 | **Three catalogs disagree.** `plans.ts` lists Pro at $14.99 / $99 "planned"; the database has a `pro` plan row with **no price row and no `plan_entitlements`**; Plus's entitlement rows list four keys while the page promises graduation scenarios and sharing. | `plans.ts`, `20260929070000_commercial_core.sql`, `20260929131000_plus_price.sql` | A price drifting between page, catalog and Stripe is revenue leakage (section 8, L1). One source of truth, generated into the others. |
| F3 | **The entitlement order is built but cannot yet charge, grant or count.** It runs in shadow on LTI launches; personal/sponsored grants and usage counters "still need tables". | `ENTITLEMENT-RESOLUTION.md` → "To wire it" | Section 3 and 7 are those tables. |
| F4 | **The proposed deal-desk minimum contract values are floors on a deal, not prices.** At the assumed active counts they carry the modelled cost only in the lean case; the $200k system minimum cannot cover even lean *variable* cost at 24,000 active students. Price has to scale with active students. | Section 5.3 (`E_budget`) | A per-active component is not optional at campus and system tier. |
| F5 | **Model mix, not caching, is the AI lever.** Routing swings gross margin about 33 points; call volume 12; prompt caching about 2. | Section 5.4 | Build the router and the dollar meter before building cache plumbing. |
| F6 | **The $10k implementation-fee floor is below modelled delivery cost at every tier** (120–1,500 hours at an assumed $110/h). | Section 5.5 | Implementation is a priced product, not a giveaway, or pilots are an explicit investment with a ceiling. |
| F7 | **A free tier at the current cap is not funded by Plus conversion** unless conversion is far above typical consumer rates (a measured hypothesis, not a fact). | Section 5.2 | Budget Free as acquisition cost or fund it through institutions; cap it in dollars. |
| F8 | **App-store commissions cut Plus-yearly margin from 79% to 53–68%** if the native apps sell through in-app purchase. | Section 5.2 | A channel decision for counsel and the app-store terms, before it is a pricing decision. |

## 2. Principles carried from the repository

These are not new; they are what every SKU below must keep true. Each already has a home in code or policy.

1. **A subscription grants entitlements and never authorization** (`COMMERCIAL-CORE.md`). No policy on student data reads a commercial table.
2. **Never paywalled on any plan or in any billing state:** export, deletion, saved plans, safety, accessibility, privacy controls (`ALWAYS_INCLUDED` in `plans.ts`; `ADVERTISING-AND-MONETIZATION-POLICY.md`). These are *floor entitlements*, defined in code, not rows a plan can omit.
3. **Nothing a free student built is taken away if a paid plan lapses** (`plans.test.ts`).
4. **Institution-sponsored use is visually and contractually distinct from consumer use; no advertising in sponsored tenants.** No student or institutional data is sold; no behavioral targeting from education records.
5. **The first step that refuses wins and says so** (`entitlement.ts`); a plan or usage refusal is the only kind the student can fix, so it comes last.
6. **AI overage is written into every order; "free forever" is refused; discounts follow the ladder** (`deal-desk.ts`).
7. **No surprise bill and no surprise lock** in an urgent academic moment (`COMMERCIAL-GOVERNANCE.md`).
8. **Paid individual acquisition stays held** (`INDIVIDUAL_PAID_ACQUISITION_ENABLED = false`) until its market-motion approvals exist. Nothing here lifts that hold.

## 3. SKU, package and entitlement architecture

### 3.1 Nine buyers, one catalog

Buyer and user are different people in this product. The catalog separates **who pays** from **who is entitled**:
a SKU names a payer; entitlements attach to a person (or, for tenant features, a tenant).

| Segment | Payer | Entitled | SKU (existing `commercial_plans` code, or **new**) | Price basis (structure) | Status in repo |
| --- | --- | --- | --- | --- | --- |
| Individual student | Student | Student | `free`, `plus`, `pro` | Subscription, monthly or yearly | Plus priced $7.99 / $59 (D-134) but on hold; Pro unpriced in DB (F2) |
| Family | Guardian (payer) | **The student**; the guardian sees only what the student consents to share | **new** `family_payer` — a *payment relationship*, not an access one: pays a student's Plus or Pro, adds nothing to guardian data access | The student's plan price; no separate guardian price | Not built. Counsel flag (section 12): minors, FERPA, consent |
| Department / program | Dean, department head | Students in a cohort | `department_launch` | Platform fee + sponsored-active band, cohort-limited (`tenant.cohorts`) | Catalog row, quote-priced |
| Institution — pilot | Student success, registrar, CIO | Pilot cohort | `registration_pilot` | Fixed cohort fee + implementation fee, ≤ 6 months | Catalog row; deal-desk pilot rules |
| Institution — campus | CIO, provost | All sponsored students and staff | `semester_access` (connected), `native_lms` (native learning) | Platform fee + sponsored-active band + AI pool + modules | Catalog rows; SSO + extended support entitlements seeded |
| Enterprise / system | System office | Multiple campuses | `university_os` | Platform fee per campus + volume-banded active price + 24×7 support tier | Catalog row; **sell only what the capability register shows as live** (3.5) |
| Partner (integration, channel, implementation) | Partner | n/a | **new** `partner_referral`, `partner_implementation` | Referral share on first-year platform fee; certified-implementer rate card. No margin stacking on student data | Not built; `PARTNER-AND-CHANNEL-STRATEGY.md` |
| Employer | Career services' employer partners | Employer's own listings and candidate pipeline, **opt-in only** | **new** `employer_listing` | Posting/campaign/seat fee; never student-level data without the student's consent | Not built; no sale of data (principle 4) |
| Marketplace provider | Provider | Provider's own listings, orders, entitlements | **new** `marketplace_provider` | Listing fee and/or take rate on GMV; gated (5.6) | Not built; gated by consumer, tax, refund and payout controls |
| Alumni | Institution (sponsored) or alumnus | Alumni | **new** `alumni_network` (sponsored module) and `lifelong` (individual) | Sponsored module per institution; individual continuation of Plus-class features | Not built |
| Services | Institution | n/a | `implementation` | Fixed-scope package + change orders | Catalog row, quote-priced |

**Rules that keep the catalog small:** one price row per (plan, interval, currency, window); a new price is a new
row with the old one retired, never an edit (the D-134 migration is the pattern); every plan lists its
entitlements as rows; a plan with no entitlement rows or no capability backing is **not sellable**.

### 3.2 Packaging ladder for institutions

Mirror the four operating modes in the blueprint, so a package says what the institution gets *and who owns the record*:

| Package | Operating mode | What the institution gets | Included | Priced by |
| --- | --- | --- | --- | --- |
| **Start** (`registration_pilot`, `department_launch`) | Coexistence | Student planning, registration planning, advising and support in one cohort alongside existing systems | SSO optional, one cohort, standard support, pilot reporting | Fixed cohort fee + implementation; converts or ends ≤ 6 months |
| **Operate** (`semester_access`) | Connected | Campus-wide student layer connected to SIS/LMS/IdP with source labels and reconciliation | SSO, SCIM/LTI connectors, extended support, AI pool, reporting | Platform fee + sponsored-active band |
| **Replace** (`native_lms`, `university_os`) | Native / Replacement | Native learning and academic-operations modules, migration, parallel run | 24×7 support option, migration and rollback, governance council | Platform fee per campus + banded active price + modules + implementation |

Replacement is **earned**, per the blueprint: only after parallel run, verification, acceptance and counsel review.
The package is *quoted* before that, but the claims on it are not.

### 3.3 Entitlement model

Four existing layers, kept apart (`COMMERCIAL-CORE.md`): **plan → subscription → entitlement → authorization.**
This design adds a fifth input, **usage**, and the missing source of grants.

```text
kill-switch → environment → tenant-plan → module → sso-policy → lifecycle →
capability → course-scope → course-policy → data-classification →
individual-plan → usage-allowance → allow                (existing order; unchanged)
```

**Where an entitlement comes from (the union the `individual-plan` and `module` steps read):**

| Source | Written by | Lifetime | Stored per student? |
| --- | --- | --- | --- |
| `plan` — personal subscription | Stripe webhook → `subscription_entitlements` | Billing period; removed by dunning, restored on payment | Yes (exists) |
| `contract` — tenant plan | Order form signed → `tenant_plan` + `tenant_feature_policy` | Contract term | No — one row per school |
| `sponsor` — "this school pays for me" | **Derived at resolve time** from membership + tenant plan status + band membership | While the membership is active and the plan is `trial`/`active` | **No** — nothing to drift when a student leaves |
| `grant` — scholarship, support goodwill, referral reward, pilot comp | Service role only, with reason and expiry | Fixed expiry, never open-ended | Yes (**new** `entitlement_grants`) |
| `payer` — a guardian or sponsor pays | Stripe webhook on the payer's subscription, naming the beneficiary | Billing period | Yes, on the beneficiary |
| `floor` — export, deletion, safety, accessibility | **Code**, `ALWAYS_INCLUDED` | Always | Never stored |

**Combination rules** (each exists to close a specific abuse):

- **Features: OR.** Any live source grants it.
- **Limits: the maximum across live sources, never the sum.** Stacking a plan, a grant and a sponsor must not multiply an allowance. Purchasable add-on packs are the one exception and sum under a stated ceiling.
- **Service tiers: the best live tier.**
- **Tenant policy only narrows.** A school can switch a module or AI use off for its students; it cannot widen what a student's own plan buys (the same rule course policy follows).
- **A personal grant never stands in for lifecycle or capability** (existing rule) — it can supply a module and nothing else.
- **Expired is not "never bought."** The verdict names which; the student sees what changed and what fixes it.
- **Fail direction.** If the plan source cannot be read, **paid features degrade to the floor and the floor stays up**; they do not fail closed on a student's own data. A lapsed payment follows the dunning ladder (14-day grace, final notice with the exact date, restrict paid entitlements only).

**Entitlement key catalog** (extends `entitlement_definitions`; `feature` | `limit` | `service_tier`). *Keys marked ◆ exist today.*

| Key | Kind | Free | Plus | Pro | Sponsored | Note |
| --- | --- | --- | --- | --- | --- | --- |
| `plan.multiple` ◆ | feature | 1 saved plan | ✓ | ✓ | per tenant policy | Never removes plans already saved |
| `calendar.sync` ◆ | feature | read-only import | two-way | two-way | per tenant | |
| `export.formats` ◆ | feature | core export always | extra formats | extra formats | per tenant | **Data export itself is a floor entitlement** |
| `reminders.expanded` ◆ | feature | basic | ✓ | ✓ | per tenant | |
| `graduation.scenarios` | feature | — | ✓ | ✓ | per tenant | Promised on the plan page today without a key |
| `whatif.majors` | feature | — | — | ✓ | per tenant | Pro |
| `advisor.share` | feature | — | — | ✓ | ✓ | Sharing is the student's consent act, not a purchase gate on the advisor |
| `career.portfolio` | feature | basic | basic | ✓ | per tenant | |
| `ai.units.monthly` | limit | **A** | **B** | **C** | tenant pool | Dollar-weighted (3.4) |
| `ai.model.class` | limit | light | standard | premium | per `ai_policy` | Caps the model class, replaces free model choice on the shared key |
| `ai.import.monthly` | limit | **protected** (3.4) | ✓ | ✓ | ✓ | Syllabus imports are the activation job |
| `storage.gb` | limit | small | larger | larger | per tenant | Warn before full; never delete (`lib/quota.ts` principle) |
| `tenant.sso` ◆, `tenant.cohorts` ◆ | feature / limit | | | | per contract | |
| `tenant.active.band` | limit | | | | per contract | The contracted band; overage rule in the order |
| `tenant.connectors` | limit | | | | per contract | LTI / SIS / SCIM instances |
| `support.tier` ◆ | service_tier | community | standard | standard | standard / extended / critical_24x7 | |

Allowance values **A, B, C** are starting hypotheses in 3.4, derived from a stated margin rule, to be tuned by measurement.

**Tenant data hook.** The audit blueprint puts entitlements in a `tenants.feature_entitlements jsonb` column. The
repository's own shape — `tenant_plan`, `tenant_feature_policy`, `plan_entitlements` — is better (history, constraints,
service-role-only writes). Keep it; do not add the column.

**Single source of truth (closes F2).** The database catalog is authoritative. `plans.ts` is a *rendering* of it for
offline builds, and a test fails when a price or a promised feature has no catalog row (the pattern
`plans.test.ts` already uses for Plus). A SKU is sellable only if every capability it names has an allowed state in the
capability register (`#1138`, `governance: resolve capability state across routes, entitlements and claims`).

### 3.4 AI as a metered, dollar-weighted allowance

**Unit.** One **AI unit** = 1¢ of *estimated provider cost*, computed from tokens after the call, reserved before it at
the `max_tokens` ceiling, settled after, released on failure — the shape of `private.reserve_ai_budget`, applied to
individuals. The estimate uses a **rate card** table (provider price, model, effective window, who verified it, when),
so a price change is a row, not a deploy.

**Why units, not calls.** Section 5.1 and F1: the same "one call" costs from $0.009 to $1.10 across the models and
profiles the shared key allows.

| Call profile | Model | In / out tokens | List | 50% cached input | Batch |
| --- | --- | --- | --- | --- | --- |
| light (note → cards) | haiku-4.5 | 4,000 / 1,000 | $0.009 | $0.007 | $0.005 |
| standard (tutor answer) | sonnet-5.5 | 10,000 / 2,000 | $0.040 | $0.031 | $0.020 |
| heavy (syllabus import) | sonnet-5.5 | 30,000 / 4,000 | $0.100 | $0.073 | $0.050 |
| premium (long essay feedback) | opus-5.5 | 15,000 / 4,000 | $0.140 | $0.113 | $0.070 |
| app default model | opus-5 | 10,000 / 3,000 | $0.125 | $0.103 | $0.062 |
| worst the clamp allows | fable-5.1 | 30,000 / 16,000 | $1.100 | $0.965 | $0.550 |

Output tokens include thinking. Web search is billed on top and is not modelled (rate unknown — verify).

**Rule that sets the allowance:** *worst-case contribution margin ≥ 40% at the lowest-priced paying interval, after
payment fees and non-AI cost.* Under the model that gives starting hypotheses:

| Plan | AI units per month (hypothesis) | ≈ routed calls | Worst-case AI cost | Margin at the cap |
| --- | --- | --- | --- | --- |
| Free | **75** | ~22 | $0.75 | n/a — acquisition cost (5.2) |
| Plus | **200** | ~60 | $2.00 | 47% (yearly, 60 routed calls) |
| Pro | **400** | ~120 | $4.00 | ≈43% (yearly) |
| Sponsored | pool = `ai_policy.monthly_budget_cents`; default sized per active (5.3) | | | priced into the platform fee |

**Behavior (all required, from `COMMERCIAL-GOVERNANCE.md`):** show remaining units at 50% / 80% / 100% in plain
words; at the cap, fall back (source search, templates, manual path) and offer BYO key (already supported) — **no
silent degrade to a worse model, no surprise charge, no overage bill to a student**; a **deadline grace pool** (one
small top-up per month when an assignment is due within 48 hours, so a cap never lands on the worst moment — a gaming
risk, so it is capped and logged); **syllabus import is protected** — a new student's first imports do not spend the
allowance, because that is the activation job and the first moment of value; heavy tasks that can wait run **batch at
half price**.

**Shared-key model policy.** Free and Plus default to light/standard classes; premium and Opus/Fable-class models are
a Pro or sponsored entitlement. Today's four-model picker on the shared key is the single biggest exposure (F1) and a
two-line change to `ALLOWED_MODELS` per plan, ahead of any of the rest.

## 4. Value-metric analysis

A value metric must **track value delivered, track cost incurred, be countable without surveilling students, and be
predictable for a budget owner.** Scored against the seven candidates:

| Metric | Tracks value | Tracks cost | Privacy-clean to count | Budget-predictable | Gaming risk | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| **Per enrolled student (FTE)** | Weak — pays for non-users | Weak | ✓ SIS count | ✓ | Low | Good *denominator for bands*; poor as the whole price (buyers resist paying for inactive students) |
| **Per active user** | Strong | Strong | ⚠ needs an activity definition and event stream | ✗ varies monthly | Medium — institution throttles rollout to pay less | Use as **banded annual commit with annual true-up**, never monthly metering of students |
| **Platform fee** | Weak | **Strong** — covers fixed tenant cost (security, SSO, support, integrations) | ✓ | ✓ | None | **Required** at every institutional tier; it is where fixed cost is recovered |
| **Implementation** | n/a (one-time) | Strong — labor | ✓ | ✓ fixed scope | Scope creep | Fixed scope + change orders; priced at delivery cost + margin (F6) |
| **AI usage** | Medium | **Strongest** variable cost | ✓ tenant aggregates | Needs a pool + pre-agreed overage | Medium | **Pooled included units + written overage** (deal-desk rule); never per-prompt billing to students |
| **Marketplace take rate** | Strong — paid on completed value | Strong | ✓ | ✗ | Provider fee-avoidance off-platform | Gated (5.6); not before consumer-protection, refund, tax and payout controls exist |
| **Partner (referral / certified implementer)** | Strong | Low | ✓ | ✓ | Channel conflict | Share on first-year *platform fee* only; never on student data |

**Recommendation (hypothesis to test in discovery, not a validated model):** the institutional price is a **hybrid of
five lines**, each recovering the cost it causes:

```text
Annual price = Platform fee (tier)               ← fixed cost to serve
             + Sponsored-active band × band rate  ← variable cost + value, committed annually
             + AI pool above the included units   ← pre-agreed overage, written in the order
             + Modules / connectors               ← scoped, so no hidden obligations
Implementation = fixed-scope package + change orders    (separate one-time line)
```

- **Active** is defined as *a sponsored account with at least one meaningful action in a rolling 90 days*, counted from **tenant-level aggregates** (one row per account per period in `active_subject_period`), never from a per-student behavioral trail. This needs a privacy review before it ships (section 12), consistent with the app's own rule that per-student screen counts never leave the device.
- **Bands, not a meter**, with an annual true-up and no retroactive step-up inside a term — budget owners buy in annual cycles and fear surprise.
- **Floor, not ceiling, comes from cost** (section 5). The ceiling is willingness to pay, which the repository has not measured. Section 10 says how to learn it without surveying students.

## 5. Financial sensitivity

All tables: `python3 docs/commercial/unit-economics-model.py`. **Assumptions, not measurements** (section 0).
Blended "routed" call (55% light, 30% standard, 12% heavy, 3% premium) costs **$0.033** at list, **$0.025** with 50%
of input cached.

### 5.1 AI exposure per account on the shared key

| Scenario (per account) | Per month | Per year |
| --- | --- | --- |
| Median free user: 12 calls, routed mix | $0.40 | $5 |
| Heavy free user: 45 calls, routed mix | $1.49 | $18 |
| At the cap, routed mix (60) | $1.99 | $24 |
| At the cap on the app default model, Opus 5 (60) | **$7.50** | $90 |
| At the cap, worst the clamp allows, Fable 5.1 (60) | **$66.00** | $792 |

Control run (`--check`): the same cap on the cheapest model is more than five times below Plus's monthly price, so
the F1 comparison is not trivially true.

### 5.2 Individual plans

| Plan | AI usage | Revenue/mo | Cost/mo | Contribution/mo | Margin |
| --- | --- | --- | --- | --- | --- |
| Plus monthly | 12 calls routed | $7.99 | $1.39 | $6.60 | 83% |
| Plus monthly | 60 calls routed | $7.99 | $2.98 | $5.01 | 63% |
| Plus monthly | 60 calls Opus 5 | $7.99 | $8.49 | −$0.50 | −6% |
| Plus yearly | 12 calls routed | $4.92 | $1.01 | $3.91 | 79% |
| Plus yearly | 60 calls routed | $4.92 | $2.60 | $2.32 | 47% |
| Plus yearly | 60 calls Opus 5 | $4.92 | $8.11 | −$3.20 | −65% |
| Pro monthly | 12 calls routed | $14.99 | $1.63 | $13.36 | 89% |
| Pro monthly | 60 calls routed | $14.99 | $3.22 | $11.77 | 79% |
| Pro monthly | 60 calls Opus 5 | $14.99 | $8.73 | $6.26 | 42% |
| Pro yearly | 12 calls routed | $8.25 | $1.12 | $7.13 | 86% |
| Pro yearly | 60 calls routed | $8.25 | $2.71 | $5.54 | 67% |
| Pro yearly | 60 calls Opus 5 | $8.25 | $8.23 | $0.02 | 0% |

Cost includes card fee (2.9% + $0.30) and tax-engine fee (0.5%), and assumed base storage, support and infra of
$0.42 a month per payer. **Channel:** Plus yearly with 12 routed calls — web 79%, app store at 15% commission 68%,
at 30% commission 53%.

**Who funds the free tier?** One Plus-yearly payer's contribution ($3.91/month) carries only:

| Free-user AI use | Cost per free active/mo | Free actives one payer funds | Conversion needed to break even |
| --- | --- | --- | --- |
| 20% of cap | $0.82 | 4.8 | ≈ 17% |
| 50% of cap | $1.41 | 2.8 | ≈ 26% |
| 100% of cap | $2.41 | 1.6 | ≈ 38% |

Consumer freemium conversion is commonly reported in the low single digits; **that is a hypothesis to measure, not a
fact here.** If it holds, **the free tier is acquisition cost and must be budgeted as such** (and capped in dollars,
3.4), or funded by institutions. This is the arithmetic behind the Free = 75 units hypothesis.

### 5.3 Institutions: cost to serve and the floor

Fixed cost to serve one campus-tier tenant per year (CSM, baseline support, connector upkeep, security/compliance
allocation, infra baseline): **lean $36,500 · base $73,000 · heavy $139,000**, scaled 0.4× / 0.5× / 1× / 2.5× for
pilot / department / campus / system. Variable cost per **active** student-year: **lean $4.62 · base $10.41 · heavy
$28.13** (of which AI $3.18 / $5.97 / $11.93, at 8 / 15 / 30 calls a month).

**Price floors** (the lowest ACV that holds the target gross margin; *not* a price recommendation):

| Tier | Enrolled | Active | Target GM | Floor, lean | Floor, base | Floor, heavy |
| --- | --- | --- | --- | --- | --- | --- |
| department | 1,500 | 750 (50%) | 60% | $54,292 ($72/active) | $110,763 ($148/active) | $226,501 ($302/active) |
| campus | 10,000 | 4,000 (40%) | 60% | $137,474 ($34/active) | $286,570 ($72/active) | $628,840 ($157/active) |
| campus | 10,000 | 7,000 (70%) | 60% | $172,142 ($25/active) | $364,622 ($52/active) | $839,845 ($120/active) |
| campus | 10,000 | 4,000 (40%) | 75% | $219,958 ($55/active) | $458,512 ($115/active) | $1,006,144 ($252/active) |
| system | 60,000 | 24,000 (40%) | 60% | $505,469 ($21/active) | $1,080,670 ($45/active) | $2,556,790 ($107/active) |

**What each proposed deal-desk minimum can actually carry** (`deal-desk.ts` defaults: pilot $15k, department $25k,
campus $75k, system $200k):

| Tier | Minimum ACV | Gross margin if cost is lean | base | heavy |
| --- | --- | --- | --- | --- |
| pilot | $15,000 | −13% | −129% | −364% |
| department | $25,000 | 13% | −77% | −262% |
| campus | $75,000 | 27% | −53% | −235% |
| system | $200,000 | −1% | −116% | −411% |

A more robust way to read it, because it does not depend on the fixed-cost guess: at a 60% margin target a **$75k
campus** minimum can carry $30,000 of cost; with 4,000 active students at lean variable cost, **$11,510 (≈0.10 FTE)
is left for everything fixed**; at base variable cost, **nothing is**. The $200k system minimum cannot carry lean
variable cost at 24,000 active at all. **Conclusion (F4):** minimums protect against tiny deals only; campus and
system price must include a per-active component, and the floor per active at a 70% margin on variable cost alone is
about **$15 (lean) to $35 (base)** a year before any fixed recovery.

*The fixed-cost assumptions are most likely overstated for a company with founder-led customer success and few
tenants. They are exactly the inputs the owner should replace first with measured hours.* A pilot is correctly an
investment, not a margin product: price it to cover direct variable cost and delivery, and cap the subsidy (deal-desk:
pilot credit ≤ 50% of first-year value, ≤ 6 months).

### 5.4 What moves margin (tornado)

Reference deal: a 4,000-active campus tenant **priced to 60% margin at base cost** — so each row shows how far one
assumption moves a healthy deal, not an invented revenue figure.

| Driver (lean-side / base / heavy-side) | GM lean-side | GM base | GM heavy-side | Swing |
| --- | --- | --- | --- | --- |
| Fixed cost to serve (lean / base / heavy) | 73% | 60% | 37% | 35.8 pts |
| **AI model mix: all-Haiku / routed / all-Opus 5.5** | 66% | 60% | 33% | **32.9 pts** |
| AI calls per active per month (8 / 15 / 30) | 64% | 60% | 52% | 12.2 pts |
| Support tickets per 100 per month (2 / 4 / 8) | 63% | 60% | 55% | 8.0 pts |
| Cost per ticket ($5 / $8 / $15) | 62% | 60% | 55% | 6.7 pts |
| Storage + egress per active/month ($0.02 / 0.05 / 0.15) | 61% | 60% | 58% | 2.2 pts |
| Prompt-cache hit on input (50% vs 0%) | 62% | 60% | 60% | 1.9 pts |

Read-across for the six cost classes the brief names: **AI** (mix, then volume) and **fixed cost to serve**
(integrations + support + compliance) dominate; **support** is third; **storage and caching are rounding errors at
this scale** — do not engineer for them first. **Payment cost** matters to individuals (about 4% of Plus yearly, 7% of Plus monthly, including the tax-engine fee) and to
marketplaces (5.6), not to invoiced institutions.

### 5.5 Implementation

| Tier | Hours (assumed) | Delivery cost @ $110/h | Deal-desk fee floor | Margin at the floor | Fee for a 50% margin |
| --- | --- | --- | --- | --- | --- |
| pilot | 120 | $13,200 | $10,000 | −32% | $26,400 |
| department | 200 | $22,000 | $10,000 | −120% | $44,000 |
| campus | 600 | $66,000 | $10,000 | −560% | $132,000 |
| system | 1,500 | $165,000 | $10,000 | −1,550% | $330,000 |

**Proposal:** replace the single $10k floor with a floor per tier from measured hours, and make **repeatability** the
lever — each productized step (config, SSO, SCIM, LTI, data load, training) that is done without custom work lowers the
hours. Waive only as a capped pilot credit (existing rule).

### 5.6 Marketplace take rate

On a $50 order with the platform bearing card cost, a 0.5% dispute rate, a 4% refund rate (processing fee not
returned), $1.50 support and $0.40 moderation per order, **break-even take rate ≈ 8.1%**.

| Take rate | Gross take | Contribution | Margin on take |
| --- | --- | --- | --- |
| 5% | $2.50 | −$1.54 | −62% |
| 10% | $5.00 | $0.96 | 19% |
| 15% | $7.50 | $3.46 | 46% |
| 20% | $10.00 | $5.96 | 60% |

Below roughly 10% the marketplace loses money on a small order; a **minimum fee per order** (not only a percentage)
is the fix. Connect-style platform fees, payout fees, 1099 handling and who bears chargebacks change this table — a
**payments expert question** (section 12). The marketplace stays **gated** per the blueprint: only once consumer
protection, provider governance, refund, tax and operational capacity exist.

## 6. Discount, trial, freemium, scholarship, sponsorship and contracting rules

The discount ladder, minimums, pilot limits and implementation floor in `deal-desk.ts` are **proposed defaults** and
stay the single place the numbers live. Rules below govern *how they are used*; **no number here is approved.**

### 6.1 Individuals

| Mechanism | Rule |
| --- | --- |
| **Freemium** | Free is real and useful (Today, courses, deadlines, calendar, My Path, registration planning, study tools). It is capped in AI *dollars*, never in safety, export, deletion, accessibility or saved work. Budgeted as acquisition cost (5.2). |
| **Trial** | **No card-required, auto-converting trial.** If a Plus trial is tested, it needs no card and ends by itself; conversion happens only by an explicit action with the recurring price, interval, renewal and cancel route shown (the existing checkout-consent contract, `plus-v2`). Auto-renewal and negative-option law is a counsel question. |
| **Student verification** | Student pricing, if any, is confirmed by school SSO or a verification partner; no document collection Semester does not need. |
| **Referral rewards** | Entitlement `grant` with expiry, per-account cap, no cash value, no stacking (limits take the max, 3.3). |
| **Gift / family payer** | A payer buys the *student's* plan; no payer access to student data follows from payment. |
| **Refunds and credits** | `credits_refunds` ledger; a written policy; refunds that reach Stripe first, then the record (the cancellation pattern, D-132). |
| **Annual vs monthly** | Annual is the default *display*, never pre-selected silently; the saving shown is computed from catalog prices (a test that ties the page to the catalog, as `plans.test.ts` does for Plus). |

### 6.2 Scholarship and access programs

- A **Semester access program** (need-based, via institutions or nonprofit partners) is an **entitlement `grant`**: Plus-class features, fixed 12-month expiry, reason recorded, finance approval, **counted against the discount ladder** (deal-desk rule) and capped as a share of the individual base.
- It is **not financial aid** and must never be described as aid, a scholarship from the institution, or a price reduction that could interact with a student's aid package (section 12). Its eligibility rules are not derived from education records.
- No scholarship recipient sees a different product, a watermark, or an ad.

### 6.3 Institution-sponsored

- The institution pays the platform fee; the student **sees "provided by <school>"** and is never billed. Individuals in a sponsored tenant do not see upsells.
- **When sponsorship ends:** 90-day wind-down to Free with all data intact and exportable; a one-time, plainly worded individual offer; no dark patterns, no countdown pressure, no data hostage. Contracts say so.
- Sponsored seats are **non-transferable**; a seat is a membership, not a license key (see L8).

### 6.4 Enterprise contracting (for counsel to turn into paper)

| Term | Rule |
| --- | --- |
| Price structure | Five-line hybrid (section 4); quote names legal customer, currency, package, cohort/term, services, data/integrations, support, evidence, exclusions, usage/overage, taxes, payment, validity, renewal/cancellation/refund, conversion credit, offboarding (`PRICING-AND-PACKAGING.md`). |
| Discounts | Ladder in `deal-desk.ts`; each needs authority, recorded reason, floor/margin check, expiry and reciprocal value. **Never discount away security, privacy, accessibility, rights, support or clean-exit work.** |
| Multi-year | 3% per year beyond the first, capped at 9%, in exchange for committed bands; prepay discounts are a finance and accounting question. |
| Renewal uplift | A stated cap in the order (value set by finance); no uncapped auto-escalator. |
| AI | Included units per active, pooled; **overage price written in every order**; tenant `ai_policy.monthly_budget_cents` enforces it; alert before overage. |
| Active band | Contracted band, annual true-up, no retroactive step inside a term; defined count method attached. |
| Pilot | ≤ 6 months, convert or end, credit ≤ 50% of first-year value, expiry date stated, exclusions stated. |
| Refused | "Free forever," uncapped usage, unlimited custom work, most-favoured-customer clauses, unbounded SLA credits, public-claims commitments the evidence does not support. |
| Non-standard paper | Legal; changed data flows → security/privacy; custom work → product + scorecard. |
| Public sector | RFP / cooperative-contract vehicles, non-appropriation and indemnity terms, tax exemption certificates — procurement counsel and tax (section 12). |

## 7. Usage-meter schema and invoicing requirements

**Design rules.** Append-only. Idempotent by event id. Reserve → settle → release for anything that spends money
(precedent: `private.reserve_ai_budget`, `count_call`). Service-role writes only; RLS on, no policy for clients.
**No prompt text, document content or free text anywhere in the meter.** Per-student rows are pseudonymous and never
shown to the institution; the institution sees tenant aggregates. Proposed DDL (a sketch for review, not a migration):

```sql
-- What can be measured, and how it is aggregated.
create table public.meter_definitions (
  code        text primary key,                 -- 'ai.units', 'active.subject', 'storage.gb_month', 'connector.sync', 'support.case', 'market.gmv'
  unit        text not null,
  aggregation text not null check (aggregation in ('sum','max','unique_count','last')),
  scope       text not null check (scope in ('account','tenant','provider')),
  billable    boolean not null default false,
  version     integer not null default 1
);

-- Provider/vendor cost per unit at a point in time. A price change is a row, not a deploy.
create table public.rate_card (
  id uuid primary key default gen_random_uuid(),
  meter_code text not null references public.meter_definitions(code),
  dimension  text not null,                     -- model id, storage class, ...
  unit_cost_micros_in  bigint, unit_cost_micros_out bigint,
  effective_from timestamptz not null, effective_to timestamptz,
  source_ref text not null, verified_by text not null, verified_on date not null,
  constraint rate_card_window check (effective_to is null or effective_to > effective_from)
);

-- The ledger. One row per measured event. Never updated except status.
create table public.usage_events (
  event_id        uuid primary key,             -- idempotency key from the emitting service
  meter_code      text not null references public.meter_definitions(code),
  occurred_at     timestamptz not null,
  ingested_at     timestamptz not null default now(),
  tenant_id       text,                         -- null for individual accounts
  billing_account uuid references public.billing_accounts(id),
  subject_ref     bytea,                        -- HMAC(person id, per-tenant key); null for tenant-level meters
  quantity        numeric not null check (quantity >= 0),
  dimensions      jsonb  not null default '{}', -- model, task_class, outcome; NEVER content
  est_cost_micros bigint not null default 0,    -- rate-card snapshot at event time
  rate_card_id    uuid references public.rate_card(id),
  status          text not null default 'provisional' check (status in ('provisional','settled','void')),
  correlation_id  text
);  -- partition by month when volume warrants; keep event_id unique across partitions by deriving it deterministically

-- What an account or tenant may use. Limits combine by max across live sources, never sum.
create table public.meter_allowances (
  scope_kind text not null check (scope_kind in ('account','tenant')),
  scope_id   text not null,
  meter_code text not null references public.meter_definitions(code),
  period     text not null check (period in ('month','year','term')),
  limit_qty  numeric not null,
  soft_at    numeric, hard_at numeric,
  source     text not null check (source in ('plan','contract','grant','sponsor','payer')),
  expires_at timestamptz,
  primary key (scope_kind, scope_id, meter_code, period, source)
);

-- Daily rollup the dashboards and invoices read; rebuilt from usage_events, hash-sealed at period close.
create table public.usage_rollups_daily (
  tenant_id text, billing_account uuid, meter_code text, day date,
  quantity numeric not null, est_cost_micros bigint not null, distinct_subjects integer,
  sealed_hash text
);
create unique index usage_rollups_daily_key on public.usage_rollups_daily
  (coalesce(tenant_id,''), coalesce(billing_account::text,''), meter_code, day);

-- Active-user counting without a behavioral trail: one row per account per period.
create table public.active_subject_period (
  tenant_id text not null, period date not null, subject_ref bytea not null,
  first_qualifying_at timestamptz not null, primary key (tenant_id, period, subject_ref)
);

-- Personal and sponsored grants (the table ENTITLEMENT-RESOLUTION.md says is missing).
create table public.entitlement_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, entitlement_key text not null references public.entitlement_definitions(key),
  value jsonb not null default 'true', source text not null check (source in ('grant','payer')),
  reason text not null check (length(trim(reason)) between 10 and 400),
  granted_by uuid not null, starts_at timestamptz not null default now(),
  expires_at timestamptz not null,              -- never open-ended
  constraint grants_bounded check (expires_at > starts_at and expires_at <= starts_at + interval '13 months')
);
```

**Event contract** (every emitting service): `{ event_id, meter, occurred_at, tenant?, account?, quantity,
dimensions }`, signed service-to-service, `event_id` idempotent, late events accepted for 7 days after period close
into an adjustment line (never a rewrite of a sealed rollup).

**Meters at launch:** `ai.units` (reserve/settle), `active.subject`, `storage.gb_month`, `connector.sync`,
`support.case` (internal cost only), `import.syllabus`; later `market.gmv`, `employer.posting`, `partner.referral`.

### Invoicing requirements

1. **Immutable.** An issued invoice is never edited; correction is a credit memo (`credits_refunds`) and a new line.
2. **Every usage line cites its basis:** meter, period, rollup hash, rate and price version. A customer can reproduce the figure.
3. **Quote → contract → tenant plan → invoice** chain, one billing account, `po_reference`, currency, tax separately (subtotal and tax are already separate columns).
4. **Overage only as written.** A usage line with no matching clause in the signed order is held for review, never sent.
5. **True-up annually**, not monthly; band step-ups are prospective.
6. **Credits** (service credits, pilot credit, goodwill) are explicit lines with a reason, an approver and an expiry.
7. **Idempotent events in, idempotent invoices out** (existing webhook pattern: `apply_payment_event` on `(provider, provider_event_id)`).
8. **Monthly provider reconciliation:** provider invoice versus summed `est_cost_micros`; investigate variance above a threshold set by finance.
9. **Retention:** financial records seven years from the end of the calendar year (D-132); usage events kept only as long as needed to bill and dispute, then rolled up and purged — a retention-schedule and privacy-review item.
10. **Dunning, grace and restrict** follow the existing ladder; restriction removes *paid* entitlements only.
11. **Tax** is computed by a tax engine and verified by the tax advisor; the invoice carries what the engine returned (section 12).
12. **Revenue recognition** is the accountant's: the system must supply the elements (subscription period, implementation delivery, usage, credits, contract dates) — see `REVENUE-RECOGNITION-REVIEW-CHECKLIST.md`.

## 8. Revenue leakage, entitlement abuse and cost-overrun detection

Each detector is a scheduled query over the ledger and catalog with an **owner, a threshold set by finance (starting
values are hypotheses), and a defined action**. A detector that has never fired is not known to work: each ships with a
seeded-failure test (revert the control, watch it go red), per this repository's standard.

| # | Class | Detector | Signal | Starting threshold (hypothesis) | Action |
| --- | --- | --- | --- | --- | --- |
| L1 | Leakage | **Price drift** | Price on page / `plans.ts` / DB catalog / Stripe disagree | Any difference | Block deploy; test fails |
| L2 | Leakage | **Entitled but not paying** | `subscription_entitlements(source='plan')` with no `active`/`grace` subscription | Any | Remove after grace; investigate webhook gap |
| L3 | Leakage | **Paying but not entitled** | Paid invoice, no entitlement | Any | Restore; credit if >24h |
| L4 | Leakage | **Tenant plan vs contract** | `tenant_plan` active after contract end / terminated | Any | Notify CS; downgrade on schedule |
| L5 | Leakage | **Band overage unbilled** | Active students > contracted band for a period | > band | Quote overage per order; flag renewal |
| L6 | Leakage | **Discount outside ladder** | Quote net below list × (1 − approved) or below minimum | Any | Block send; deal desk |
| L7 | Leakage | **Services overrun** | Hours > SOW × 1.1 | 10% | Change order or absorb with approval |
| L8 | Abuse | **Seat sharing / resale** | One account on many devices, impossible travel, or one sponsored seat across many identities | Concurrent sessions > N; same hash cluster | Step-up auth; no automatic ban (accessibility and shared-device reality) |
| L9 | Abuse | **Free-tier farming** | Many new accounts sharing a device or network hash drawing AI units | > N accounts / hash / week | Throttle new-account allowance; require verification |
| L10 | Abuse | **Grant / referral stacking** | Multiple grants raising a limit by sum | Any (limits take max) | Test asserts max-not-sum |
| L11 | Abuse | **Family payer abuse** | One payer, many beneficiaries | > cap | Review |
| L12 | Overrun | **Account AI spend** | Account `est_cost_micros` > p99 or > plan allowance | p99 / allowance | Cap hit → fallback; if beyond cap, kill + alert (a bug) |
| L13 | Overrun | **Tenant AI budget** | `ai_usage_month` ≥ 80% / 100% of `monthly_budget_cents` | 80%, 100% | Alert admin and company; fallback at 100% |
| L14 | Overrun | **Unrated model or tool** | Usage event whose model has no live rate-card row | Any | Block that route (fail closed on *cost*, not on the student's data) |
| L15 | Overrun | **Provider variance** | Provider invoice vs internal estimate | Set by finance | Recalibrate rate card |
| L16 | Overrun | **Gross margin by tenant** | Tenant GM below target two months running | Target − 10 pts | Reprice at renewal or reduce scope |
| L17 | Marketplace | **Refund / dispute spike** | Provider refund or dispute rate over baseline | 2× baseline | Pause provider payouts per terms |
| L18 | Marketplace | **Payout reconciliation** | Σ payouts + fees ≠ GMV received | Any | Hold payouts; finance |
| L19 | Contract | **"Free forever" or uncapped text** | Quote or order text matches refused terms | Any | Block; legal |
| L20 | Collections | **Past due** | Invoice open > terms | Terms | Dunning / account health |

**Anti-abuse never overrides the floor.** No detector may remove export, deletion, accessibility or safety access, or
touch a student's data; actions restrict *paid features or new allowances* only, with notice and an appeal route.

## 9. Packaging narrative and sales enablement

**Positioning** (from the blueprint; claims limited to what the capability register evidences): *Semester is the
student operating layer: one governed place where students plan, learn, create, find campus services, pay and
continue — natively where needed, connected where available, governed everywhere.*

### 9.1 One message per buyer

| Buyer | Their question | Package message | Proof they can ask for |
| --- | --- | --- | --- |
| CIO / IT | Will it add to my pile or reduce it? | Start beside your SIS/LMS with SSO and SCIM; every connector has health, reconciliation and a native fallback | Integration catalog, SSO readiness, security overview |
| Provost / student success | Will students use it? | A cohort pilot with defined acceptance and an adoption dashboard | Pilot scorecard; implementation plan |
| Registrar | Will it be right? | Registration planning with conflict checks; official records stay the source of truth until cutover | Source labels; reconciliation report |
| CFO / procurement | What does it cost and what can go wrong? | A platform fee plus a banded active price, AI overage written, no uncapped terms, a clean exit | Quote template; trust room; exit plan |
| Dean / department | Can I try it without a campus project? | Department Launch: one cohort, fixed fee, standard support | Pilot offer |
| Student | Is it worth paying for? | Free is genuinely useful; Plus is for planning several terms ahead | The plan page |
| Guardian | Can I help without seeing everything? | You can pay; you see only what the student chooses to share | Consent screen |

### 9.2 Price objections (answers stay inside the claim ceiling)

| Objection | Response | Never say |
| --- | --- | --- |
| "Per-student is too expensive for inactive students." | You contract a band of *sponsored active* students with an annual true-up; inactive enrolled students cost you nothing. | "Unlimited use" / "free for everyone" |
| "We already pay for an LMS and a planner." | Start does not replace anything; Operate connects; Replace is earned after parallel run. Show the retired-tools list only when measured. | ROI or savings numbers without a measurement |
| "AI will blow up our bill." | A pooled allowance, an alert at 80%, a written overage price, and a fallback that never locks a student out. | "No limits" |
| "Why an implementation fee?" | It buys repeatable setup, migration verification and a rollback plan; waived only as a capped pilot credit. | "We'll waive it" without approval |
| "Can we get a discount for a multi-year?" | Yes within the ladder: 3% a year to 9%, for a committed band. | A discount not approved |

### 9.3 Enablement kit (artifacts to build, owner CRO unless noted)

Quote template and price-book *structure* (numbers blank until approved); deal-desk one-pager with the ladder and
approvers; discovery guide with the value-metric questions in section 10; TCO/ROI worksheet using the existing ROI
formula with **customer-measured** benefits only; pilot proposal and acceptance scorecard (exist);
objection library above; competitor-neutral "what's included / not included" matrix per package; renewal and expansion
playbook (exists); trust-room index (exists). Every external sentence is checked against the claims register.

## 10. Pricing experiments, with ethical and trust constraints

**Preconditions.** Paid individual acquisition remains on hold until its approvals exist. Monetization changes need a
data/AI/privacy review and user notice **before** activation (`ADVERTISING-AND-MONETIZATION-POLICY.md`).

**Rules.** What is shown is what is charged. No retroactive repricing; price changes apply to the next period with
notice. Assignment by a hash of the account id, pre-registered, with a stated duration. No experiment inside an
institution-sponsored tenant. Participants can see their plan's price at any time. An **ethics checkpoint** (privacy,
counsel, support) before launch and at stop conditions.

**Prohibited:** pricing by inferred income, need, stress, deadline proximity, disability, health, immigration status,
protected class or any education-record signal; fake scarcity or countdowns; pre-checked upsells; hidden fees;
auto-converting trials; making a student's own data a lever; tests on minors.

| # | Experiment | Hypothesis | Primary metric | Guardrails | Stop condition |
| --- | --- | --- | --- | --- | --- |
| E1 | Free AI allowance size (50 / 75 / 125 units) | A smaller allowance does not reduce activation or conversion | Activation; free → paid | Support contacts; refunds; complaints | Activation −X% vs control |
| E2 | Annual vs monthly default *display* | Annual-first lifts revenue per payer without raising refunds | Refund rate at 30 days | Complaints about clarity | Refund rate above control |
| E3 | Semester pass (one term) vs annual | A term-length option converts students who think in semesters | Paid conversion; 12-month retention | Cannibalisation | Revenue per cohort below control |
| E4 | Plus feature fences (which of `graduation.scenarios`, calendar sync, extra exports sit behind Plus) | Value-based fences convert better than volume fences | Conversion; satisfaction | Floor entitlements untouched (checked) | Any floor regression |
| E5 | Family payer bundle | Guardian-paid conversion is meaningful | Guardian-paid share | Consent complaints | Any consent incident |
| E6 | **Institutional metric discovery** (not an A/B) — structured interviews and Van Westendorp / Gabor-Granger with buyers: per-enrolled vs banded-active vs platform fee | Banded-active + platform fee is preferred and budgetable | Preference; stated range | Interviews, not live quotes | n/a |
| E7 | Pilot-to-paid conversion price (credit shape) | A credit toward year-one converts more than a discount | Conversion at pilot end | Margin floor | Margin below floor |

Instrument each with the funnel events in `ANALYTICS-AND-METRICS-DICTIONARY.md`; analytics stay privacy-minimized.

## 11. KPIs and dashboards

`REVENUE-OPERATIONS-DASHBOARD-SPEC.md` rules apply: **no pipeline, bookings, billings, cash, ARR/MRR, recognized
revenue, CAC, LTV, margin, retention, churn, renewal or forecast accuracy is reported as actual until its source, the
finance ledger and the accountant's policy exist.** Until then every tile reads *Not reportable* with its blocker.

| Dashboard | Audience | Tiles (definition → source) |
| --- | --- | --- |
| **1. Executive** | Founder, board | ARR / NRR / gross margin / burn / runway (finance ledger); pipeline and win rate (CRM); activation; renewal risk |
| **2. Individual economics** | Product, finance | Activation = activated ÷ registered; free → paid; plan mix; monthly and annual churn; ARPU; **AI cost per active** and per **successful outcome** (AI units ÷ quality-qualified completions); payment failure and dunning recovery; refund rate; store-channel share |
| **3. Institution** | CS, finance | Contracted vs active students per band; adoption by journey; time to go-live; implementation hours vs SOW and margin; support contacts per 100 active; renewal stage; account health (existing job) |
| **4. AI economics** | CTO, finance | Cost per active, per action, per study asset; model mix; cache hit; % of accounts at 80% / 100% of allowance; tenant budget burn; fallback rate; quality score by task; **gross margin by plan and tenant** (`COMMERCIAL-GOVERNANCE.md`) |
| **5. Leakage and controls** | Finance, RevOps | Detectors L1–L20: open count, age, dollars at risk, last fired |
| **6. Marketplace** (when gated open) | COO, finance | GMV, take, refund and dispute rates, payout reconciliation, provider quality |
| **7. Pricing health** | CRO, finance | Realised discount vs ladder; deals below floor; price drift incidents; quote-to-signature time |

**Definitions to fix before any tile goes live:** *active* (3.3/4), *net revenue retention*, *gross margin* (what is in
cost of revenue — an accounting call), *successful AI outcome*, *churn* (voluntary vs involuntary).

**Targets** are not set here: no observed baseline exists, so a target would be invented. Each KPI gets one after its
first full measured quarter.

## 12. Questions for qualified experts

Nothing here is a conclusion. Each row is a design dependency that someone licensed must answer.

| Area | Question | Design it blocks | Who |
| --- | --- | --- | --- |
| **Accounting** | Revenue recognition for a bundle of platform subscription, implementation, usage and credits; breakage; deferred revenue; capitalized contract costs; capitalized software; whether AI inference is cost of revenue; principal vs agent for marketplace | Invoice line structure; dashboards 1, 2, 6; contract language | CPA / revenue-recognition advisor |
| **Tax** | Sales-tax treatment of SaaS by state and the education exemption; nexus; the correct tax code for the product; international VAT; marketplace-facilitator rules; 1099 duties for provider payouts; tax-exempt certificates | Checkout, invoices, marketplace | Tax advisor |
| **Financial aid** | May aid or bursar-billed charges pay for sponsored fees? Does a scholarship or fee waiver affect cost of attendance or aid packages? Safeguards and consent for aid data; whether any "access program" language is safe | Sponsored billing, access program, finance module | Financial-aid counsel / aid office |
| **Consumer** | Auto-renewal and negative-option rules, trial and refund requirements, price-display and fee-disclosure rules, minors' ability to void contracts, guardian-payer consent | Checkout, trial, family payer, cancellation | Consumer-protection counsel |
| **Marketplace payments** | Money-transmission exposure and which regulated processor model avoids it; KYC/KYB; sanctions; chargeback liability; refunds; payout timing; provider terms; insurance; employer-posting rules; tutoring background checks | Marketplace SKUs, take rate, payouts | Payments counsel + processor |
| **App stores** | Which digital goods must use in-app purchase; commission tier; steering rules | Native-app pricing (F8) | Counsel + store terms |
| **Public procurement** | Cooperative contracts, RFP terms, non-appropriation, indemnity, accessibility attestations | Enterprise paper, pricing vehicle | Procurement counsel |
| **Privacy** | Is the active-user count a new education-record use? DPA terms for usage data; retention of `usage_events`; pseudonymisation adequacy | Meter schema, dashboards 3–4 | DPO / privacy counsel |
| **Contracts** | SLA credits, renewal uplift, price protection, termination for convenience, MFN | Order form | Commercial counsel |

## 13. Sequence, tests and decisions asked

### 13.1 Smallest safe order of work

| Step | Change | Proof (per this repo's standard: revert it and watch it fail) |
| --- | --- | --- |
| P0-a | Restrict shared-key models by plan class; cap `max_tokens` per plan | A test that names a premium model on a Free token and is refused; revert the clamp change, test goes red |
| P0-b | One catalog: a test ties `plans.ts` to the database seed (price, interval, entitlement keys) and fails on Pro today | Fails first on Pro; passes after seeding or removing |
| P0-c | `rate_card` + dollar-weighted reserve/settle for individuals (units), keeping `count_call`'s atomicity | Concurrency test (20 parallel calls = 20 units); cap test; refusal-doesn't-charge test |
| P1-a | `entitlement_grants`, `meter_allowances`; wire `individual-plan` and `usage-allowance` steps; **shadow first** (the LTI pattern) | Max-not-sum test (L10); expired-vs-never-bought test |
| P1-b | `usage_events`, rollups, `active_subject_period`; privacy review gate | Idempotency, late-event, sealed-rollup tests |
| P1-c | Tenant AI pool + alerts at 80% / 100% from the existing `ai_policy` budget | Alert fires at the threshold; overage requires a written clause |
| P2 | Leakage detectors L1–L6, L12–L16, dashboards 2–5 | Seeded-failure test per detector |
| P3 | Marketplace and employer SKUs, gated | Only after section 12 answers |

Not in this change: no migration, no price edit, no `plans.ts` edit (PR 1146 touches the pricing page), no Stripe
change, no switch flipped.

### 13.2 Decisions asked of the owner (each becomes `D-<pull request number>`)

1. Is **Plus $7.99 / $59** and **Pro $14.99 / $99** the price book, or still planning figures? (F2; resolves the conflict `PRICING-AND-PACKAGING.md` names.)
2. Keep the paid-acquisition hold, and on what evidence does it lift?
3. Adopt **dollar-weighted AI units** and the **40% worst-case-margin rule**; approve starting allowances (Free 75 / Plus 200 / Pro 400) or replace them.
4. Replace the $10k implementation floor with a per-tier floor from measured hours; set the real minimum ACVs (`DEAL_POLICY`) once cost is measured.
5. Approve the **active-student definition** pending privacy review.
6. Set the **AI overage** price and the renewal-uplift cap for the standard order.
7. Marketplace: minimum per-order fee and the gate to open.
8. Name the finance, tax and counsel reviewers (unassigned today).

### 13.3 What would change this document

A measured cost baseline (hours, tickets, provider invoices), a first paying customer, buyer discovery on the value
metric, or a provider price change. The script holds the assumptions in one place; edit, re-run, update the tables.
