# Frontend experience audit

Status: Phase A baseline only  
Date: 2026-10-03  
Repository anchor: remote `main` at `8ccf55afd5dc84a1465acd17e4c200a85db6df22`  
Review checkout: `f80905c8`; its two commits after `main` are documentation-only. During the audit, separate work appeared for a typed capability-exposure resolver and additional architecture documents. The resolver was subsequently committed at `2f4590c9`; the navigation seam added during the implementation continuation was committed at `ef54c20e`. Neither commit is evidence about remote `main`, a deployment, or production activation.

## Executive finding

Semester already contains an unusually broad student product, an institutional gateway, a guarded operations console, a large Supabase control plane, and two public-site implementations. The primary problem is no longer absence of surface area. It is convergence: the route model, design primitives, operational states, public claims, read models, and company operations are not yet one governed system.

The repository supports the statement **“broad native baseline with substantial governance scaffolding.”** It does not yet support **“every capability is live and operational.”** A live claim still requires deployed configuration, current evidence, named operators, approvals, production connectors, UAT, and observed operation.

## Documents read

The review used all three supplied charter PDFs:

1. `audit [https___github.com_harrisonjrubin7-cmyk_sem (1) copy.pdf` — 374 pages; repository/product audit, architecture proposals, privacy and offline designs, and successive execution briefs.
2. `anything else to go over to make it so that everyt.pdf` — 17 pages; eight-part operational test, universal identity/search/notification/support layers, launch gates, commercial model, and honest maturity rules.
3. `anything else to go over further and elabrote on m.pdf` — 15 pages; no-placeholder doctrine, native-first fallback, universal objects/states/lifecycles, operational console, evidence packages, and governance ownership.

The documents were treated as requirements and context. Assertions inside them were rechecked against repository evidence.

## Areas inspected

- `app/src`, including routing, navigation, screens, shared UI, state, accessibility tests, public-site generator, analytics, governance registries, console client, and operational policy.
- `app/server/institution`, `app/api`, `packages/contract`, and `packages/institution`.
- `company-site`, its CSP/hosting configuration, static routes, forms, SEO assets, and screenshots.
- `supabase/migrations`, Edge Functions, policy/check suites, retention, support, integration, commercial, console, and analytics SQL.
- `.github/workflows`, Vercel configuration, environment examples, monitoring/readiness documentation, and test/build scripts.
- Current remote `main`; no deployment, production configuration, external account, or branch/PR state was changed.

## Baseline command results

| Check | Result | Meaning |
|---|---|---|
| Remote revision | PASS | `origin/main` resolves to `8ccf55af…` |
| TypeScript app typecheck | PASS | `tsc -b --noEmit` |
| Institution server typecheck | PASS | `tsc -p tsconfig.university.json` |
| Production app build | PASS with warning | 4,060 modules; several chunks exceed Vite's 500 kB warning |
| Bundle budgets | PASS | First load 436.6 kB/479.0 kB; largest budgeted chunk 435.7 kB/480.0 kB; 93 routes |
| Lint | FAIL | 50 React/compiler warnings exceed the configured maximum of 25; refs during render, synchronous state in effects, render-time `Date`/`Date.now`, and memoization findings dominate |
| Unit/integration tests | FAIL / non-terminating baseline | Timeout failures were observed in `DemandContribution.test.tsx`, `waitingrow.test.tsx`, and `oneday.test.ts`; the suite continued beyond the audit window with jsdom canvas/navigation limitations |
| Capability-exposure implementation | PASS, local branch only | Resolver commit `2f4590c9` plus navigation seam `ef54c20e`; 11 focused resolver tests and 68 navigation/role tests pass, along with typecheck, touched-file lint, and production build |
| Design census | PASS as measurement | 85/99 screens use `Page`/`SettingsPage`; 1,695 raw buttons versus 418 `ActionButton` uses; 40 files use `EmptyState`; 31 use `SourceBadge` |
| Screen audit | PASS as measurement | 96 screens/90 modules; 29 system-ready, 55 targeted migration, 12 redesign-before-features on the automatable half-rubric |
| Browser accessibility smoke | NOT RUN | Configured script requires Playwright, which is absent from the installed checkout |
| Browser performance smoke | NOT RUN | Same missing Playwright dependency; bundle budgets are not runtime Web Vitals evidence |
| Dependency advisory scan | NOT RE-RUN | CI config runs `npm audit`; no package installation or network mutation was performed in Phase A |
| Secret scan | NOT RE-RUN | CI downloads and runs Gitleaks; no local Gitleaks binary was available |
| HawkScan | BLOCKED / NOT VERIFIED | Required HawkScan 6+ CLI, Docker fallback, and `HAWK_API_KEY` are unavailable; no DAST result may be inferred |

### Implementation-continuation evidence

The first milestone now has a bounded local implementation rather than only a recommendation. `2f4590c9` centralizes the seven exposure states and their evidence inputs. `ef54c20e` adds a navigation gate that consumes pre-resolved navigation decisions without reconstructing release, entitlement, cohort, connection, readiness, or kill-switch state in the browser. Missing routes, missing decisions, wrong-surface decisions, and duplicate decisions fail closed. Existing callers remain compatible until an authoritative server response is available.

Focused validation after `ef54c20e`: 11/11 capability-exposure tests passed; 68/68 navigation and role tests passed; TypeScript, zero-warning lint over the three touched files, and the production build passed. The full-suite and global-lint baseline remain red as recorded above. A post-change budget rerun was inconclusive because another concurrent build rewrote the shared chunk graph with hashes that did not match the completed build output; the earlier Phase A measurement remains the last valid budget result. HawkScan was invoked per the security workflow but could not start because neither the required CLI nor Docker is installed and no API key is configured.

## Current frontend architecture

- React 19 and Vite 8 deliver a hash-routed SPA. `lib/route.ts` preserves deep links and retired-route compatibility.
- Navigation and screen inventory are not one authority: the count script reports 63 navigation screens, while the source audit finds 96 screens and the build budget graph records 93 routes.
- State is primarily client-side with native/manual workflows; Supabase and the institution gateway add connected behavior when configured.
- Route-level lazy chunks exist extensively, but the shared entry remains large and Mermaid/PDF/graph tooling creates very large optional chunks.
- Today, Courses, Calendar, Work, Study, Writing, Degree, Campus, Opportunities, Family, Support, Settings, institution workspaces, and an internal console are present.
- The app has strong truth-oriented components (`SourceBadge`, `NotOfficial`, freshness/sync helpers, `OfflineBanner`) but adoption is inconsistent.

## Frontend route and capability map

| Charter area | Current canonical surfaces | Baseline | Connected/official mode | Primary gap |
|---|---|---|---|---|
| Home | `home`, `hub`, `notifs`, `behind` | Present | Mixed | Today is not yet the sole calm hierarchy of Now/Next/Later/At risk/Changed |
| My Journey | `courses`, `work`, `study`, `write`, `sheet`, `deck`, `degree`, `costs`, `career`, `pathway` | Broad | Mixed | Too many peer destinations; cross-module lifecycle is not a single tracked workflow |
| Campus | `university`, `activities`, `maps`, `meals`, `housing`, `athletics`, `community`, `classmates`, `call`, `mail` | Broad | Mostly manual/declared | Source/freshness and institution ownership are inconsistent |
| Opportunities | `opportunities`, `applying`, `career`, `nil`, `volunteers` | Present | Partial | Partner agreement, delivery receipt, retention, and outcome read models are fragmented |
| Support | `support`, `help`, contextual notices | Present | Supabase support path exists behind configuration | Universal support entry and SLA/incident linkage are incomplete |
| Family | `family`, sharing helpers | Present | Policy and projection controls exist in SQL/docs | Complete invite→preview→consent→audit→revoke journey needs production/UAT evidence |
| Settings | account, privacy, data, export, alerts, assistant, courses, look, navigation, workload, grading | Present | Mixed | Devices/sessions, connected-service health, entitlements, and deletion status are not one settings model |
| Institution | `university`, institutional components, server gateway | Broad contracts | No approved live adapter is implied | Onboarding, connector setup, policies, rollout, trust room, and analytics are spread across many screens/components |
| Partner | moderation/listing/opportunity pieces | Partial | Partial | No coherent partner portal with verification, agreement, permitted scope, and retention lifecycle |
| Operations | `console` plus institutional operations studio | Guarded baseline | Supabase-backed where configured | Requested product/company planes and most business modules are not coherent console destinations |

## UX pain-point inventory

| Priority | Finding | Evidence | User consequence |
|---|---|---|---|
| P0 | Remote `main` represents operational status through several independent registries and UI vocabularies | capability, maturity, feature, release, and source registries across `lib/governance`; the local branch now has a resolver and optional navigation seam only | A screen can be “available” by one model and not operational by another until an authoritative response reaches every caller |
| P0 | Public-site implementations diverge | `company-site/` vs `app/src/site/` | Claims, URLs, metadata, and conversion behavior can differ by deployment target |
| P1 | Navigation breadth exceeds the seven-area charter | 96 screens, 63 nav screens, multiple shelves/modes | Users must understand the product map before completing ordinary work |
| P1 | Shared truth-state components are not universal | 31 files use `SourceBadge`; only 3 use `NotOfficial` | Official, derived, manual, stale, and draft states are not consistently legible |
| P1 | Action density is high | 1,695 raw buttons; Career has 33 primaries in the screen audit | Primary next action is diluted and keyboard/focus behavior is harder to standardize |
| P1 | Test/lint baseline is red | command results above | UI refactors cannot be distinguished confidently from existing regressions |
| P2 | Several screens bypass the standard frame | design census and screen audit | Titles, landmarks, widths, help, and state placement vary |
| P2 | Inline layout remains common | screen audit shows >8 inline styles/100 lines on several screens | Responsive fixes and density variants require repeated local edits |
| P2 | Dense workspaces and daily mobile flows share weakly defined density rules | CSS and screen-specific layout | Touch-first actions and desktop administration do not yet express role-specific density systematically |

## Responsive/mobile inventory

| Surface | Evidence | State | Gap |
|---|---|---|---|
| Core student routes | responsive CSS, mobile screenshots, reflow smoke script | Implemented, not reverified here | Browser smoke unavailable; 320 px overflow evidence is stale until rerun |
| App shell | desktop/tabs/modes and responsive navigation | Present | Multiple navigation models increase breakpoint complexity |
| Dense editors | Write/Sheet/Deck/Calendar | Present | Need task-specific mobile contracts; do not force desktop toolbars into small screens |
| Institution/console | panels, tab lists, context bar | Partial | Wide tables/actions need explicit small-screen read-only or drill-in behavior |
| Company site | media rules and mobile screenshots | Present in both site stacks | Must choose one source before responsive fixes are trusted |
| Low bandwidth/offline | service-worker/offline components and manual baselines | Partial | Route-by-route offline capability and queued-action semantics are not centrally exposed |

## Accessibility gap matrix

| Area | Existing evidence | Gap | Priority |
|---|---|---|---|
| Automated semantics | axe tests, label/style scripts, accessibility smoke script | Full browser journey check could not run locally | P1 |
| Keyboard/focus | skip-link tests and dialog patterns | No current manual keyboard evidence for every critical journey | P1 |
| Screen reader | labels and semantic components | No current qualified screen-reader pass/ACR | P1/external |
| Reflow/zoom | script targets 320 px as 400% proxy | No fresh execution because Playwright is absent | P1 |
| Reduced motion | CSS/system support exists | Needs route-level verification | P2 |
| High contrast | token work and contrast workflow | No complete forced-colors/manual evidence | P2 |
| Forms/errors | shared controls and validation exist | Error summary/focus movement is not universal | P1 |
| Charts/tables | console figure metadata and table components | Accessible alternatives and small-cell suppression are not universal | P1 |
| Cognitive load | calm design intent and focus controls | Navigation/action density contradicts the intent on several screens | P1 |

## Design-system duplication matrix

| Concern | Current forms | Consolidation target |
|---|---|---|
| Page frame | `Page`, `SettingsPage`, frameless specialist screens | `PageFrame` with declared density/landmark contract and specialist opt-outs |
| Primary actions | `ActionButton`, `.btn-primary`, `.portal-primary`, raw buttons | One button primitive with intent, size, loading, destructive, icon-only, and permission states |
| Empty/loading/error | `EmptyState`, notices, local paragraphs/spinners | One data-state family driven by a typed operational state |
| Source/status | `SourceBadge`, `NotOfficial`, freshness/sync helpers, ad hoc copy | `ProvenanceLabel` + `OperationalStatePanel` |
| Tabs/segments | shared `TabList` plus local tab implementations | One keyboard-tested tabs API and one segmented-control API |
| Dialog/confirm | shared dialogs plus local confirmations | One focus-managed dialog and `ConfirmDangerousAction` policy wrapper |
| Tables/cards | portal panels, cards, local grids/tables | role-density variants and responsive list fallback |
| Tokens | CSS variables plus 30 TSX color literals and 27 off-scale values | typed semantic tokens with linted escape hatch |

## Backend/read-model gap matrix

| Contract | Present | Gap |
|---|---|---|
| Academic sync contract | `@semester/contract` v1 | Covers nine academic collections, not the universal education/operations graph |
| Institution gateway | shared package, server, Vercel transport, refusal/error handling | Adapter registry is intentionally not proof of a connected institution |
| Capability/entitlement | migrations, capability client, governance registries | No single server-computed exposure/readiness response used by every surface |
| Provenance/freshness | multiple helpers and connector fields | No universal envelope for authoritative/derived/manual + observed/verified timestamps |
| Permission/action safety | RLS, role grants, gateway checks, console gates | UI visibility still depends on multiple client registries; action preview/commit is not universal |
| Support | tickets/access grants and UI | Case, incident, SLA, customer timeline, and root-cause tags are not one read model |
| Operations | console RPC client and migrations | Product and company rollups are incomplete; many figures remain registry/document derived |
| Errors | gateway refusals and local error states | No platform-wide error taxonomy with retryability, preservation, support reference, and correlation ID |
| Events | audit, analytics, institution events, outbox-like patterns | Four event families are not governed by one versioned catalog and privacy policy |

## Analytics/observability gap matrix

| Plane | Current evidence | Gap |
|---|---|---|
| Marketing | attribution fields in company forms; no third-party analytics claim | Requested event taxonomy is not implemented as a governed emitter/read model |
| Product | deliberately minimal daily marks and local usage | No funnel for the requested lifecycle events; consent and purpose rules need design before expansion |
| Operational | audit tables, checks, production smoke, release evidence | No complete APM/RUM/queue/integration telemetry dashboard or verified paging path |
| Business | commercial schemas and readiness registries | No authoritative CRM/finance connections; values must stay manual/unknown |
| Evidence | extensive docs and registers | Evidence freshness exists conceptually but is not a single automatically enforced claim gate |

## Risk register

### P0

1. **False operational completeness:** repository presence can be mistaken for deployment, approved configuration, staffed operation, or observed use.
2. **Public-source divergence:** two public-site architectures can publish different claims and routes.
3. **Red verification baseline:** lint and tests are not green, weakening release evidence.

### P1

1. No single server-owned operational-state/provenance/permission envelope across product, institution, partner, and console UI.
2. Navigation and action density obscure the complete thesis instead of progressively disclosing it.
3. Browser accessibility and runtime performance checks are configured but not reproducible from the installed checkout.
4. Operations console lacks the explicit product/company plane separation and company operating modules.
5. Live institutional, identity-provider, finance, CRM, partner, and notification status remains external evidence, not repository fact.

### P2

1. Incomplete design-token adoption, raw button proliferation, and frameless screens.
2. No unified event schema spanning marketing, product, operations, and audit with enforced data minimization.
3. Dense institution/console views need responsive drill-down contracts.
4. Package contract boundaries are valuable but narrower than the universal object model.

### P3

1. Dark-mode strategy is present in pieces but not declared as a product-wide support contract.
2. Localization/RTL and dyslexia-aware modes are architectural intentions, not verified product-wide capabilities.
3. Documentation volume makes the current operational source of truth hard to identify.

## First 12 PR-sized milestones

1. **Capability-exposure authority:** local implementation exists at `2f4590c9` and `ef54c20e`; next supply the navigation gate from an authoritative server response without manufacturing browser-side evidence.
2. **Verification baseline recovery:** fix lint warnings and the three observed timeout clusters; make the default suite deterministically green.
3. **Operational-state spine:** one typed state/provenance/permission/action envelope, shared UI, and Today migration.
4. **Shell convergence:** move eligible screens to `PageFrame`; define student/mobile and operator/dense variants.
5. **Action primitive consolidation:** replace raw primary actions and unify loading/disabled/permission/destructive behavior.
6. **Today information architecture:** Now/Next/Later/At risk/Changed with progressive disclosure and truthful empty/offline modes.
7. **Cross-module assignment journey:** assignment→task→study→draft→submission receipt→progress using the shared envelope.
8. **Public-site source convergence:** choose one build pipeline, preserve URLs, reconcile metadata/claims, and add deployment parity tests.
9. **Institution onboarding workspace:** tenant setup, identity/connectors, policies, cohorts, evidence, and support in one lifecycle.
10. **Operations two-plane shell:** Product & Platform versus Company & Business, with shared context bar and read-only default.
11. **Operations read models:** server-computed command center, tenant health, integrations, support, release, trust, and evidence APIs.
12. **Privacy-aware event catalog:** versioned marketing/product/operations/audit schemas with forbidden-field tests and initial dashboards.

## Exact first implementation PR

**Title:** `feat(governance): centralize capability exposure and fail closed on incomplete evidence`

**Scope:**

- Complete the existing typed resolver for the seven exposure states: `live`, `connected`, `pilot`, `early_access`, `institution_controlled`, `hidden`, and `retired`.
- Require exact release target, tenant entitlement, cohort authorization, connection health, kill-switch state, native fallback, AI availability, and all eight operational-readiness categories.
- Generate capability and route indexes with owners, source authorities, classifications, evidence references, platforms, expiry policy, support owner, and rollback.
- Fail closed for unknown capability, mismatched target, missing/expired evidence, unauthorized scope, unhealthy required connection, or inactive technical/rollout gate.
- Adopt the resolver in exactly one real surface—navigation—while leaving marketing, AI, and tenant-control callers as explicit follow-ups.
- Preserve current routes through compatibility mapping and add a decision trace suitable for support and audit.

**Acceptance:** focused resolver tests, full typecheck, lint, full unit suite, build, and bundle budget pass; every registered route maps to at least one capability; missing evidence never produces `live` or `connected`; navigation visibility comes from the resolver rather than route presence alone. Locally, focused tests, typecheck, touched-file lint, and build pass. Full lint/tests, a race-free budget rerun, an authoritative server-fed navigation payload, and DAST remain required before this milestone can be called merge-ready.

## Approvals and external evidence required

- **Founder/product:** canonical promises, seven-area navigation, maturity labels, pricing/plan vocabulary, and named owners.
- **Legal/privacy:** public policies/claims, FERPA deployment posture, guardian consent, retention/deletion, marketplace terms, marketing consent, minors, safety, and finance boundaries.
- **Security:** threat model, JIT/break-glass model, connector credential lifecycle, independent testing, vulnerability response, log retention, and production evidence access.
- **Finance/accounting:** pricing authority, refund thresholds, revenue recognition, taxes, cash/burn inputs, vendor spend, and payment-provider activation.
- **Marketing/brand:** canonical public-site source, message hierarchy, conversion taxonomy, analytics consent, approved proof, and publishing workflow.
- **Institution:** SSO/SCIM/SIS/LMS/LTI configuration, data mappings, policies, accessibility/UAT, operational owners, support/escalation, and launch sign-off.
- **Operations/support:** staffed hours, paging destinations, SLAs/SLOs, incident communications, backup/restore evidence, and customer escalation.
