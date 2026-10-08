# 08 · Staffing, team topology, milestones, architecture review, technical debt

> Part of the [CTO architecture pack](README.md). Status: **proposed**.
> **Assumptions, labelled as such:** the repository records a single human owner
> (`CODEOWNERS`, `OWNER-AND-ACCOUNTABILITY-MATRIX.md`, "backup … unassigned",
> `MONITORING.md` "no rota"). Headcounts and durations below are planning
> *hypotheses* for a funded build, not commitments, and no compensation or
> budget figures are asserted — that is a CEO/CFO input. Dates are relative
> (T0 = the day the first engineer beyond the founder starts) because no funding
> or start date exists in the repository.

## 1. Principles

1. **Fix the bus factor before adding surface area.** One person holding every
   key, every deploy and every pager is the largest operational risk in the
   company; the first two hires exist to retire it.
2. **Vertical slices over layers.** Every milestone ships something a student or
   an institution can use, on the new spine.
3. **Platform team small, domain teams stream-aligned**, with enabling teams for
   security and accessibility so those are never "after".
4. **Do not hire for what a managed service already does well.**

## 2. Team topology (Team Topologies vocabulary)

| Team | Type | Owns | Interacts with |
| --- | --- | --- | --- |
| **Platform & Reliability** | platform | `services/core/src/platform`, `infrastructure/`, CI/CD, observability, rings, DR | everyone (X-as-a-service) |
| **Identity & Trust** | stream-aligned | identity, support-trust, consent, family, audit ledger | Security (collaboration) |
| **Student OS** | stream-aligned | productivity, calendar, assistant UI, Today | Sync, AI, Design |
| **Academic & Learning** | stream-aligned | academic, learning, gradebook, integration of LMS/SIS | Integrations |
| **Campus, Community & Career** | stream-aligned | campus, community, career, marketplace (later) | Trust & Safety |
| **Finance & Commerce** | stream-aligned | finance, billing, marketplace money | Counsel, Platform |
| **Integrations** | complicated-subsystem | integration-hub, connectors, migration tooling | Academic, institutions |
| **Sync & Offline** | complicated-subsystem | `offline-sync`, `sync-gateway`, native storage | Student OS, Mobile |
| **AI Platform** | complicated-subsystem | `ai-gateway`, evals, retrieval, red-team | Security, Counsel |
| **Mobile** | stream-aligned | `apps/mobile`, native plugins | Sync, Design |
| **Design Systems & Accessibility** | enabling | `design-system`, `a11y`, assistive-tech testing | all UI teams |
| **Security & Privacy Engineering** | enabling | threat models, pen test, SDLC evidence, privacy reviews | all |
| **Implementation & Support Engineering** | customer-facing | tenant onboarding, UAT, migration runs, support tooling | Integrations, Customer Success |

Collapsing rule: until there are ≥ 3 engineers per team, teams merge along the
dashed lines — *Platform + Security*, *Student OS + Mobile + Sync*, *Academic +
Integrations*, *Identity + Finance + Trust*.

## 3. Staffing plan (hypothesis; sequence matters more than count)

| Stage | Headcount (eng / total tech) | Hires, in order | What it unlocks |
| --- | --- | --- | --- |
| **S0** now | 1 / 1 | — | current state |
| **S1** T0 – T0+3 mo | 4 / 5 | (1) **Senior platform/SRE engineer** — second operator, on-call pair; (2) **Senior backend engineer (authz/data)** — PDP, RLS, migrations; (3) **Senior full-stack/frontend lead** — decomposition of giant screens, design-system extraction; (4) **security & compliance lead (fractional or full)** — threat models, vendor register, evidence | bus factor 1 → 2; wave C0–C1; ring 0 |
| **S2** + 3–9 mo | 10 / 12 | mobile engineer ×2 (Capacitor/native); sync engineer; integrations engineer ×2 (LTI/SIS/SCIM); AI platform engineer; accessibility engineer; QA/SDET; technical writer / implementation engineer | M2–M4; ring 1; first design partner |
| **S3** + 9–18 mo | 22 / 27 | domain engineers across academic, finance, campus/community, career; second SRE; data engineer; designers ×2; customer-success / implementation architects; support engineers; engineering manager ×2 | rings 2–3; marketplace readiness; multi-institution |
| **S4** + 18–30 mo | 35–45 | per-domain growth; staff/principal engineers; security engineers; data/analytics; regional ops | scale, silo ring, ecosystem |

Non-engineering roles that gate engineering milestones (named because the audit
makes them launch gates, not because this pack decides them): **qualified
external counsel** (contracts, privacy, minors, accessibility claims) before
ring 1; **a support lead** before ring 1; **a finance/revenue-ops owner**
before marketplace; **an institutional implementation lead** before ring 2.

Hiring bar: for platform and security, evidence of operating production
systems with on-call; for domain engineers, ability to read the existing
repository's proof standard (CLAUDE.md) and match it. Contract engineers do
**not** hold production access or approve changes.

## 4. Delivery milestones

Aligned to the audit's program increments 0–6 and to the conversion waves in
[09](09-CONVERSION-PLAN.md). Each milestone has an **exit gate that is a
test, a drill or a signed artifact**, never a status report.

| M | Name | Window (rel.) | Outcome | Exit gate |
| --- | --- | --- | --- | --- |
| **M0** | Foundation | T0 → +10 wk | workspace + boundaries + `FORCE` RLS + tenant-context helper + PDP on 10 priority actions + outbox producing from 3 modules + OTel + IaC for staging + second operator + merge queue | same suite, same counts, green; boundary negative tests red-then-green; RLS/PDP conformance on the 10 actions; **restore drill passed**; threat model v1 for identity, support access, AI |
| **M1** | Student OS on the spine | +10 → +24 wk | productivity, calendar, assistant, notifications running through `core` + `sync-gateway`; `ai-gateway` deployed; web fully on contracts/clients | offline conflict simulator green; AI policy + injection suite gating; axe + manual SR audit on Today/Calendar/Tasks/Notes; support readiness; **ring 0 live** |
| **M2** | Mobile + offline | +18 → +36 wk (overlaps) | Capacitor apps in TestFlight/Play internal; SQLCipher; wipe; push | WebView go/no-go spike passed ([03](03-TECHNOLOGY-DECISIONS.md) P-07); wipe verified; device-posture policy tests; accessibility on device |
| **M3** | Academic core | +30 → +52 wk | catalog, sections, enrollment, degree audit, gradebook, submissions native; LTI/SCIM/SSO real against a design partner | grade-change dual control test; reconciliation report on a real SIS extract; **ring 1 live** with one cohort; pilot migration with parallel run |
| **M4** | Campus, family, community | +44 → +68 wk | directory/dining/housing/events, guardian consent flows, moderation operations | consent/guardian negative tests; moderation SLA drill; content-freshness SLOs |
| **M5** | Commerce & career | +60 → +84 wk | tenant billing, student account views, payment plans, career/portfolio; marketplace in *controlled automation* mode | financial controls review; reconciliation vs processor; PCI scope statement; counsel review of marketplace terms; **ring 2** |
| **M6** | Institutional replacement readiness | +76 → +104 wk | migration center, configuration studio, integration hub GA, reporting | **parallel-run evidence**, institutional sign-off, rollback drill, security/legal review; replacement claim only after human counsel approval |
| **M7** | Scale & ecosystem | +100 wk → | multi-institution ops, silo ring, partner APIs, vertical packages | tenant-isolation audit by third party; capacity at 2×; chaos programme |

Critical path: `M0 → (M1 ∥ M2) → M3 → M5/M6`. The riskiest unknowns are
deliberately early: the WebView gate (M2), the first real SIS/IdP integration
(M3), and the restore drill (M0).

## 5. Architecture review process

- **Who:** an *Architecture Review Group* — CTO (chair), platform lead,
  security lead, one domain lead rotating, one accessibility representative;
  a counsel observer for anything touching privacy, minors, payments or AI
  claims. At S0–S1 this is the founder + the first two hires.
- **What triggers it:** a new module; a new datastore, queue, vendor or
  subprocessor; a change to `kernel`, a policy action, a data classification,
  a public API major; any extraction; anything that changes a no-go condition
  in the audit's launch gates.
- **How:** (1) author opens a PR with a one-page *design note* (problem, options
  with the [03 §1 criteria](03-TECHNOLOGY-DECISIONS.md#1-decision-criteria-weighted-the-same-for-every-proposal),
  recommendation, data classes, threat-model delta, rollback, test plan);
  (2) the PR number becomes the decision id (`docs/decisions/D-<PR>.md`);
  (3) review SLA 3 business days; (4) outcomes: **accept / accept with
  conditions / reject / needs spike**; (5) accepted changes that are
  architectural are promoted to an ADR in `docs/architecture/`.
- **Anti-bureaucracy rules:** reversible, module-internal decisions do **not**
  need review (decided by the module owner, recorded in `MODULE.md`);
  reviewers must state the *failure scenario* they fear; silence after the SLA
  is consent for reversible changes only.
- **Fitness functions** run continuously instead of by meeting: boundary
  checks, complexity budgets, p95 budgets, dependency graph DAG, flag expiry,
  RLS coverage, PDP coverage.
- **Re-open conditions** are written into each ADR (as in `DECISIONS.md`); a
  decision is revisited when its condition fires, not when someone is
  unhappy.

## 6. Technical-debt management

The repository already holds `docs/engineering-operations/TECHNICAL-DEBT-REGISTER.md`.
Keep it; add rules:

1. **Every debt item has** owner, interest (what it costs per month: incidents,
   slowed features, risk), a *payoff trigger*, and an expiry/re-review date.
2. **Budget:** 20 % of each team's capacity is reserved for debt and
   reliability, protected by the error-budget policy (budget burn pauses
   feature work automatically).
3. **Known hot spots (measured):** `Sheet.tsx` 4,749 lines, `lib/sheet.ts`
   3,697, `Calendar.tsx` 3,005, `state/shape.ts` 2,828, `Write.tsx` 2,718,
   `Today.tsx` 2,123, `lib/cloud.ts` 1,950, `state/store.tsx` 1,902,
   `App.tsx` 1,649; 1.1 k+ lib files and 558 components in flat directories;
   two runtimes (Node/Deno) with shared-code constraints; ~25 build-time flags
   duplicating a runtime flag system; empty adapter registries; `contracts/`
   unwired; ~28 flags all denied by design. Each gets a register row and a
   payoff trigger (e.g. *"`Calendar.tsx` is decomposed before its first
   native-mobile release"*).
4. **Ratchets, not rewrites:** complexity budgets only go down; a file over its
   budget cannot grow; new code in a decomposed area lands in the new package.
5. **Debt is paid in slices that ship**; no "refactor sprint" without a user- or
   operator-visible result.
6. **Documentation debt counts:** a doc that disagrees with the code is a
   defect with an owner. About 300 top-level and `docs/` documents already exist; the target is *fewer,
   generated, tested* (`npm run registers`) — consolidation is a tracked item,
   with `SIMPLIFY-AUDIT.md` as the starting inventory.
7. **Quarterly debt review** at the architecture group; two lowest-value items
   are formally *accepted* (and written down) rather than left to rot.
