# 07 · Production test verification and synthetic monitoring

> Part of the [quality-system pack](README.md). Status: **proposed**.
> Controlling documents: [`MONITORING.md`](../../MONITORING.md),
> [`OBSERVABILITY-PLAN.md`](../engineering-operations/OBSERVABILITY-PLAN.md),
> [`SLO-SLI-DRAFT.md`](../engineering-operations/SLO-SLI-DRAFT.md) and the CTO
> pack's [canary rules](../target-architecture/05-ENVIRONMENTS-AND-ROLLOUT.md).

## 1. What exists, and what it does not prove

`production-smoke.yml` runs **hourly** (`17 * * * *`) and a `record` job writes
each hour's result to the `status-data` branch, which the status pages read for
their 90-day bars. An hour the scheduler skips records nothing and the pages show
"no data yet" rather than "up". That honesty about missing data is the right
design and everything below builds on it.

| Probe | Script | What it proves | What it does **not** prove |
| --- | --- | --- | --- |
| public | `app/scripts/public-production-smoke.mjs` | the deployed Pages bundle is reachable, names its assets, and PostgREST answers | that any person can sign in, save or read anything |
| institutional | `app/scripts/production-smoke.mjs` | frontend `200`, gateway `/health/live` and `/health/ready` say `live` / `ready`, an unauthenticated institutional request is refused `401` | an authenticated request works; tenant isolation holds; data is correct |
| record | `app/scripts/status-record.mjs` | the history file for the status pages | — |

`SLO-SLI-DRAFT.md` says it in one sentence: *"public probe is narrower than
journey outcome."* **Liveness is not a journey.** A fully green hour today is
compatible with nobody being able to sign in. The rest of this page closes that
gap without making the probe an incident.

## 2. Post-deploy verification (gate `production`)

Runs automatically after every production deploy, against the exact deployed
artifact, and must pass within **10 minutes** or the deploy is not "done".
Failure follows the rollback table (CTO 06 §3): capability kill switch first, then
traffic shift, then redeploy of the previous immutable bundle.

| # | Check | Pass condition |
| --- | --- | --- |
| V1 | **Identity of the deploy** | `GET /build.json` (stamped at build: `sha`, `builtAt`, `migrationsHash`, `flagsHash`) equals the artifact the release record names. *A deploy that cannot say what it is cannot be verified.* (new) |
| V2 | Existing liveness and readiness | the two production probes above |
| V3 | **Synthetic journeys** (§3) for every journey marked `synthetic` and gated at or before `production` | all green on the **new** revision |
| V4 | **Isolation canary** (§3, S7) | the canary object is *never* returned to the wrong tenant |
| V5 | Migration reality | applied-migration set equals the artifact's `migrationsHash`; schema fingerprint (`supabase/fingerprint.sql`) equals staging's |
| V6 | Flags and rings | `flagsHash` equals what the release record lists; ring assignment of the synthetic tenant is as declared |
| V7 | **Version skew** | the *previous* web bundle (served from its immutable URL) completes S1–S3 against the new API — the compatibility window is a promise to old clients, so it is tested with one |
| V8 | Alert path alive | the synthetic "deploy marker" event appears on D4; the on-call route receives a *test* page and acknowledges it (monthly, not per deploy) |
| V9 | Security headers and TLS | `_headers` content, TLS validity > 21 days, service worker updates and offers a reload |
| V10 | Release record | exists, links the manifest, lists the rehearsed rollback plan (04 §2 `production`) |

## 3. Synthetic journeys

Each is a catalog journey with `synthetic: true` plus the cheap new ones below.
They run as the **synthetic tenant's** people (§4), never as a customer.

| ID | Probe | Source journey | Frequency | Notes |
| --- | --- | --- | --- | --- |
| S1 | sign in as the synthetic student; **Today renders meaningful content** (a seeded action appears, not just a shell) | `J-ID-01` | 15 min | the SLO says "eligible loads rendering meaningful content" — assert content, not status 200 |
| S2 | create an action; reload in a second session; read it back (**durable**) | `J-PRD-01` | 15 min | the "accepted saves durably retrievable" SLI |
| S3 | edit offline (network cut), reconnect, assert convergence and a visible state | `J-PRD-01` | hourly | the simplest end-to-end sync canary |
| S4 | open the public site and a sourced explore page | `J-ACA-06` | 15 min | exists in spirit as `public-production-smoke` |
| S5 | ask the assistant a canned grounded question | `J-AI-01` | every 6 h | **policy-compliant answer or safe fallback** — either passes; a wrong-tenant retrieval or an ungrounded claim fails. Own budget key |
| S6 | request an export; assert it is accepted and tracked, then fetched | `J-SUP-02` | hourly | "export/delete intake" SLI; **never** requests a deletion of a real person |
| S7 | **isolation canary**: the synthetic *other* tenant's user requests an object whose id is the canary; assert deny. Any success is a **P0 page** | `J-ID-03`, 03 §1 | 5 min | a live control for the claim that matters most |
| S8 | submit a help request to the synthetic queue; assert acknowledged | `J-SUP-01` | hourly | routed to a test sink, not a human |
| S9 | read the synthetic connector's freshness label and age | `J-INT-01` | hourly | asserts the *label*, per the "never show stale as current" rule |
| S10 | send a notification to a test sink; assert delivered within the SLO window | CTO 06 §8 | hourly | no real e-mail, SMS or push |
| S11 | the billing webhook endpoint accepts a *signed test-mode* event and is idempotent on replay | `J-FIN-01` | daily | **no live charge ever**; the account is the payment provider's test mode |
| S12 | the unauthenticated refusal, as today (`/status` → `401`) | `J-OPS-01` | hourly | the "negative twin" that proves the probe can see a refusal |

Each probe records `{probe, journey, region, startedAt, durationMs, result,
revision, correlationId}` to the same `status-data` store the hourly job already
writes, so D4 needs no second pipeline. **A run that produced no result is `no
data`, never `ok`.**

## 4. The synthetic tenant, and the rules that stop a probe becoming an incident

A labelled tenant **inside production** is the only way to exercise
authentication, persistence and authorization on the real stack. It is also real
risk, so it has rules. (Whether it is acceptable under the first customer's
contract is [README Q3](README.md) — counsel's.)

1. **Reserved and visible.** Tenant `zz-test-prod`, ring 0 (internal). People
   have the reserved `.invalid` addresses and names from the fixture catalog. Any
   non-reserved identity found in it is a P1 defect.
2. **Cannot reach any real tenant — and a probe proves it** (S7 every five
   minutes). Isolation is not assumed; it is measured continuously.
3. **Writes confined to rows its own users own**, each marked
   `created_by_probe`. A nightly job deletes them. Audit rows are append-only
   and exempt; they are labelled, so they never count in any customer report.
4. **Excluded from everything a customer or investor could read**: analytics,
   billing, public status *counts of customers*, and customer SLO denominators.
   The probe's own availability is reported as *monitoring*, not as customer
   uptime (`SLO-SLI-DRAFT.md` forbids publishing targets as achieved availability).
5. **Rate- and cost-capped.** A fixed request budget per hour; AI probes use their
   own key and budget (never the students'); a breach pauses the probe and opens a
   ticket, it does not retry harder.
6. **No outbound to real people.** E-mail, SMS and push go to test sinks.
7. **Least privilege, no long-lived password in CI.** The probes obtain
   short-lived sessions for the synthetic users through workload identity (CTO 06
   §5); secrets live in the secret manager with an owner, a rotation interval and
   a revocation step, and appear in `SECRETS.md`.
8. **Never run load, chaos or destructive migration rehearsals in production.**
   Those belong to staging; production chaos is a **game day** against this tenant
   only, scheduled, with on-call present and a stop condition (03 §9).
9. **A kill switch for the probes themselves**, so a probe that misbehaves can be
   silenced in one write without touching the product.

## 5. Alerting on the monitor

CTO 06 §8 states the policy: *page only on symptoms that burn error budget fast
(multi-window, multi-burn-rate); everything else is a ticket*; and the honest
state that today there is **one waking alert, a weekly review and no rota**. The
quality system adds only what makes a probe trustworthy:

| Rule | Why |
| --- | --- |
| **Two consecutive failures, from two places** before paging | one runner in one region is one network; a flap is not an outage. Today every probe runs from a single GitHub-hosted runner, so a second vantage (another region or provider) is **owed** |
| **S7 is the exception**: one failure pages | a possible cross-tenant exposure is P0 and a false alarm is cheap by comparison |
| **No data for 2 hours** raises a "monitor down" ticket | the status pages already show "no data yet"; nothing yet *tells a person* |
| **Every probe has a negative twin** that must fail (S12 refusal; S7 deny) | "a clean reading is a claim about the probe too" |
| **The monitor is itself drilled quarterly**: in staging, break a probe on purpose and measure how long until a named human is told | a monitor that has never alerted is not known to alert |
| **A deploy marker** is written to the same store | correlation: "did it break when we shipped?" is answerable without guessing |
| **Page recipients are a rota with a backup**, or the page says it is a ticket | paging one person 24×7 is a risk, recorded as such |

## 6. Verifying *what we claim* in production

Quality in production is also about statements, not just uptime. Each of these is
a probe or a scheduled check with an owner:

| Claim risk | Check |
| --- | --- |
| a public page says a capability is live that its evidence does not support | a test over the site content against `PUBLIC-CLAIMS-APPROVAL-REGISTER.md` and `CAPABILITY-ACTIVATION-REGISTER.md` (the repository's `salecopy` and `marketreadiness` guards are the start) — a deploy that adds an unapproved claim fails `pull-request` |
| a source is shown without its label or time | S9 and a scan of the rendered synthetic workspace for the five source labels |
| an AI answer ships without disclosure | S5 asserts the disclosure text is present |
| a kill switch exists but does not work | monthly `drill:killswitch` against the synthetic tenant, evidence filed (`docs/evidence/ai/` already holds the first) |

## 7. Acceptance criteria for this page

1. **V1–V10 pass on every production deploy** or the release record says why not.
2. **S1, S2, S4 and S7 run at the stated frequency for 30 consecutive days with
   a recorded result or an explicit `no data`** before the project describes
   production as "monitored" in any external document.
3. **Every probe has a negative twin and a control**; the quarterly monitor drill
   is filed with the measured time to a human.
4. **Zero** non-reserved identities and **zero** customer-visible effects from the
   synthetic tenant (S7 plus a nightly scan).
5. **The probe's cost** (requests, AI spend) is reported on D4 and under its cap.
6. **Prohibited claims stay prohibited:** the probe history is not published as
   uptime, an SLA, capacity or "production resilience" (`SLO-SLI-DRAFT.md`,
   `TEST-COVERAGE-MATRIX.md`).
