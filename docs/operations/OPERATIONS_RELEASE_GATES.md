# Operations release gates, test plan and SLOs

**As of** 2026-10-05 · **Base** `origin/main` `3bd382d` · **Status** proposal; records no decision. SLO numbers are proposals awaiting the founder (OD-2, which is B-04 in the console backlog).

A console, an `ops_*` RPC, a controlled action or a workflow ships when its **gates** pass. Gates here are *additional* to the repository's standing gates and do not loosen any of them. Existing release gating is in [`docs/RELEASE-GATES.md`](../RELEASE-GATES.md), [`docs/operating-model/`](../operating-model/) (release certification) and the console's release-evidence Command center; this page defines what an *operations* surface adds.

## 1. Standing gates (unchanged; from `CLAUDE.md`, run from `app/`)

```bash
npx tsc -b && npm run lint && npm run check:university && npm test && npm run test:shuffle && npm run build
npm run design-system:check && npm run design-system:report
```

Plus, for database changes, the SQL check suite `supabase/check.sh` (needs Postgres 17), and the definer register and grants allow-list. **A change that touches a migration, a definer function, a grant or a policy is not reported green on the TypeScript gates alone.** `test:shuffle` is weak evidence for timing failures; `src/rootunmount.test.ts` is the guard for mounted-root leaks and applies to every new console component.

## 2. The operations gates

Each gate is a yes/no with a named artefact. A line that cannot be answered `yes` is a blocker for the tier the surface claims.

| Gate | Name | Pass condition | Artefact |
| --- | --- | --- | --- |
| **T** | Tenant isolation | A user with no grant gets `42501`; a holder at school A cannot read school B; a platform holder with only `console:operate` receives no amounts or content; the response has no key from the redaction deny-list | SQL check per RPC (permission matrix §4); T-01 |
| **S** | Security | In-body capability check; `search_path = ''`; registered in `definerregister.ts` and `grants.check.sql`; no anon grant; no new direct client write path; threat model for any new capability; advisor run shows no new ERROR | register diff, advisor output |
| **P** | Privacy | Data classification of every field; content-free audit; consent path for any personal-data movement; retention and hold behaviour stated; no student content to a company role | classification row, `company-roles-student-data.check.sql` exceptions list unchanged |
| **A11y** | Accessibility | Native elements first; visible focus; accessible names (`npm run lint:labels`); label/description/error related (`FieldMessage`); colour never the only signal (`lib/status.ts`); reduced motion via `--motion-*`; keyboard walk of the primary task; at 320 px the primary action works | `src/a11y/` contracts extended, keyboard walk record |
| **AI** | AI governance | Policy row, budget, kill switch, content-free audit, evaluation recorded | `ai_policy` row, eval record |
| **R** | Release and rollback | Behind a flag or a view hidden by capability; a kill-switch or revert path tested; no irreversible step without the 2P+C class | rollback test, T-02 for approvals |
| **I** | Integration | Mapping versioned, freshness shown, `unknown` blocks "live", reconciliation delta reported; observation→authoritative needs a passed dual run | reconciliation report |
| **F** | Financial | Append-only ledger; webhook idempotency; reconciliation; funds-adjacent features have legal and payments review | check, review record |
| **L** | Tenant launch | The tenant launch gate: no open P0 exception, evidence current, owner named, rollback rehearsed, support coverage stated | [`coo/10`](coo/10-tenant-launch-risk-and-readiness.md) checklist |
| **G** | Legal | Counsel reviewed where the surface changes obligations (retention, DSR, contracts, vendor) — counsel not engaged, so this gate **blocks** and says so | counsel record |
| **D** | Load | Registration-day profile met for read paths a registrar uses | [`LOAD-AND-SOAK.md`](../LOAD-AND-SOAK.md) run |
| **E** | Evidence and labelling | Every figure has source, window, authority, freshness, owner, limitation; absent source renders `unknown`; no "live"/"connected" with stale or unknown health | Figures contract test |
| **X** | Experience states | Default, loading, empty, error-with-a-way-back, disabled, success, long content, permission; shared state components | screen test per state |
| **Q** | Equity | Rules that rank or flag people carry an explanation and a review | [`EQUITY-REVIEW.md`](../EQUITY-REVIEW.md) row |
| **W** | Workflow | Every step has capability, timeout, audit event; approval class matches the duty table | workflow version row |

**Applicability.** Every console: T, S, P, A11y, E, X, R. Add AI for AI surfaces; I for integration; F for money; L for tenant-facing activation; G where obligations change; D for registration paths; Q for flagging/ranking; W for workflows.

**Claim gates.** "Cannot bypass approval" needs T-02 green for every duty with a direct write path (red today). "Operated" needs the acceptance in [`OPERATIONS_AUDIT_AND_EVIDENCE.md`](OPERATIONS_AUDIT_AND_EVIDENCE.md#9-acceptance). "Production-ready" is the brief's definition copied unchanged into [`OPERATIONS_CONSOLE_BACKLOG.md`](../ops/OPERATIONS_CONSOLE_BACKLOG.md).

## 3. Per-domain gate map

| Domain | Gates beyond the always-on set | Owner seat |
| --- | --- | --- |
| Tenant hierarchy, identity, roles | L | security |
| Policy/workflow, flags | W, R, Q | product |
| Consent/retention/holds | G | privacy |
| Integration/migration | I, L, D | engineering |
| AI governance | AI, Q | engineering |
| Audit/evidence/risk | E | operations |
| Reliability/incident/rollback | L | operations |
| Portability/offboarding | G | privacy |
| Registrar, academic ops | D, W, Q | product |
| Student success | Q, W | success |
| Student accounts, finance | F, G | finance |
| Community/safety | Q | trust |
| Executive, command center | E | operations |
| Revenue, implementation | L, E | success |
| Legal/vendor, people | G | founder |

## 4. Test plan

**Layers** (all exist as patterns; the new work is the contracts for the new RPCs):

| Layer | Tool | New contract |
| --- | --- | --- |
| SQL checks | `supabase/*.check.sql` via `check.sh` | one file per `ops_*` family: T-01 (forbidden vs empty, cross-tenant, minimisation); watermark lag; rebuild-equals-incremental; atomic write + event; duplicate event, one effect; concurrent claim; bounded retry; dead letter needs replay; receipt idempotency |
| Approval bypass | SQL | T-02: for every duty, a direct write by the actor who may *request* it is refused; red until F-1 closes |
| Break-glass | SQL | T-04: expiry removes access; overdue review surfaced; `my_capabilities()` reflects the grant |
| Definer sweep | `definer-sweep`, `grants`, `rls-coverage`, `definerregister.test.ts` | every new function registered; T-03 no client grant on the 63 no-policy tables, asserted per table |
| Component and screen | Vitest + Testing Library | each state in X; permission notice; `unknown` rendering; green only for empty queue; T-05 browser storage untouched by a console session; T-06 optimistic helper throws for non-allow-listed actions |
| Structural | `rootunmount.test.ts`, `nav.registry.test.ts`, `screen-governance`, style/label audits | every new component with `createRoot` unmounts; every view registered |
| Design contract | `design-system:check` | no raw values; ledgers may shrink, not grow |
| Gateway | `app/server/institution/*.test.ts`, `check:university` | `assertSameTenant`, read-only switch, idempotent commit |
| Load | k6-style harness per [`LOAD-AND-SOAK.md`](../LOAD-AND-SOAK.md) | registrar readiness read at registration-day profile |
| Drills | runbooks | restore, rollback, kill-switch, break-glass, SSO lockout; each recorded as evidence with an expiry |

**Rules from this repository's own history (apply them):**
1. A guard that has never failed is not known to be a guard: revert the fix under each new test and watch it go red, then restore.
2. Include a control in every probe (a case that must be flagged and one that must not).
3. A clean reading is a claim about the probe too: prefer a structural check over a runtime probe where both exist.
4. For anything visual, drive the app with `.claude/skills/run` and look at the screenshot; a dark rectangle is a launch failure.
5. Report only what was run; "not run" is an allowed, required answer.

## 5. Security plan

Threat model each new capability and each new write path before the migration (template: [`SECURITY-THREAT-MODEL.md`](../SECURITY-THREAT-MODEL.md), [`INTEGRATION-THREAT-MODEL.md`](../INTEGRATION-THREAT-MODEL.md)). Priorities in order:

1. **F-1:** close direct operator writes (`feature_kill_switch`, `tenant_feature_policy`, `provider_registry`, integration DML) behind `console_act` executors, then revoke the direct grants. This precedes any "cannot bypass approval" copy.
2. **F-5:** retire `is_app_admin()` from offboarding and `schools_write`.
3. Audit the 18 sensitive definer functions flagged by the Phase 0 pass (each must authorise in-body); decide on GraphQL exposure of 289 tables to `authenticated` (leads, not confirmed vulnerabilities).
4. MFA freshness (15 min) on every privileged write; step-up already built.
5. Service-role keys only in functions; secrets per [`SECRETS.md`](../../SECRETS.md); no operator token in the browser.
6. Dependency and supply-chain: [`SUPPLY-CHAIN.md`](../SUPPLY-CHAIN.md); no new UI dependency.
7. Independent assessment — not done; the most valuable single security artefact, and the one the single-person company cannot produce for itself.

## 6. Accessibility plan

Each console is audited against the existing contracts (`src/a11y/`, `src/styles/{breakpoints,gutter,taps,density,stacking}.test.ts`) and the scorecard in [`WCAG-UI-AUDIT-SCORECARD.md`](../WCAG-UI-AUDIT-SCORECARD.md). Operations-specific risks: dense tables (use real table semantics, sortable headers with state announced, a card layout at ≤ 600 px, never a horizontally-scrolled page); status colour (always word + glyph); toasts for receipts (live regions, persistent in history, not the only record); confirm dialogs for controlled actions (focus trap, escape, named primary action, preview readable by a screen reader); charts per [`DATA-VISUALIZATION-SYSTEM.md`](../DATA-VISUALIZATION-SYSTEM.md) with a table alternative. A conformance report by an external auditor is not done; the Accessibility console shows "unverified" until it is.

## 7. SLOs and observability

**Proposed** objectives (OD-2). Anything below is a target to alert against, not a commitment to a customer; no SLA is offered before the alerting path reaches a person (today no alert reaches anyone — [master map](../master/SEMESTER_COMPANY_OPERATING_SYSTEM.md#where-the-company-actually-stands)).

| SLI | Objective | Source |
| --- | --- | --- |
| Console read (`ops_*`) availability | 99.5 % monthly | RPC success ratio |
| Console read p95 | ≤ 1.5 s for a scoped view | server timing |
| Controlled action: request→receipt (excluding human approval) | p95 ≤ 3 s | `console_act` timing |
| Audit write failure | 0 tolerated: every failure is an incident (the action fails closed) | `console_audit_write` errors |
| Chain verification | succeeds daily; failure pages | scheduled `console_audit_verify` |
| Outbox → projection lag | operational class ≤ 60 s p95; reporting class ≤ 15 min | `projection_watermark` |
| Dead-letter depth | 0 older than 24 h | `dead_lettered_at` |
| Kill switch effect | ≤ 60 s to enforced | rollout test |
| Support first response | by severity per [`coo/04`](coo/04-support-operating-model.md) | `support_tickets` |
| Integration freshness | per-source class; `unknown` after 2× window | `source_freshness_events` |
| Registration-day read freshness (registrar) | ≤ 5 min | feed age |

**Observability.** Four signals exist as patterns: Sentry (errors, traces), Vercel runtime logs, Supabase logs/advisors, the status artefacts in [`docs/sre/`](../sre/README.md) (65-component service catalogue, alert definitions in `docs/sre/generated/`). Required additions: a health endpoint per `ops_*` family reporting projection lag; a structured log field set (`request_id`, `tenant_id` hashed, `capability`, `action`, `outcome`) with **no content**; alert routes to a named human with an acknowledgement requirement; a synthetic check for the console's sign-in → one read → one audited read path. An alert that pages nobody is recorded as "no alerting", not "alerting configured".

## 8. Release process for an operations surface

1. Main-check for the thing itself (`CLAUDE.md`): `git fetch origin main`, grep the defect, not the title.
2. Open the pull request first; write `docs/decisions/D-<pull request number>.md` after (the log is closed at D-160).
3. Branch declares: base SHA, owned files and migrations, overlap check, evidence, rollback, claim and activation impact ([`operational-control-plane.md`](operational-control-plane.md)).
4. Migrations on a dev branch first; production changes need the owner's explicit confirmation per step.
5. Ship dark behind a flag; enable for the founder's tenant, then a design partner under L; never to all tenants at once.
6. Rebase onto `origin/main` before pushing; run the gates; report exactly what ran.
