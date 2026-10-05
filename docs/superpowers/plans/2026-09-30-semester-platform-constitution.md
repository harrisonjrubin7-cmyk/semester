# Semester Platform Constitution and Activation Control Plane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate Semester's existing constitution, capability, flag, evidence, configuration, and claims machinery into one executable activation control plane that prevents high-risk features from bypassing institution-specific gates.

**Architecture:** Preserve the existing registries and make `rollout-capabilities.ts` the canonical product-capability identity layer. Consolidate the existing twelve architectural primitives into the approved eight, join each of the sixty `CAP-*` product capabilities to an explicit governance policy, evaluate tenant activation through a pure fail-closed policy engine, and require its scoped receipt before `evaluateFlag` can allow a high-risk flag. Generate readiness and claims projections from the same model instead of adding another manually maintained register.

**Tech Stack:** TypeScript 7, Vitest 5, existing React/Supabase application libraries, generated Markdown registers

**Spec:** `docs/superpowers/specs/2026-09-30-semester-platform-constitution-design.md`

## Global Constraints

- Preserve existing `CAP-*`, master-register, claim, evidence, flag, and configuration-version identifiers.
- The approved eight platform primitives replace the existing twelve-primitives vocabulary; learning, planning, support, communication, and similar product concerns remain capability domains rather than parallel platform primitives.
- Product maturity and tenant activation maturity remain distinct.
- No feature flag, entitlement, client assertion, or incomplete approval may activate a high-risk capability.
- The policy engine evaluates and records decisions; it does not execute domain actions.
- Activation receipts gate product exposure and workflow entry; they are not bearer credentials. Every server or database boundary remains authoritative and must independently enforce tenant, actor, purpose, and transaction-specific controls.
- Domain services still recheck transaction-specific authorization, idempotency, and authoritative readback.
- Missing or ambiguous definitions, configurations, evidence, approvals, integration health, or audit availability fail closed.
- Kill switches override every positive activation input.
- Denial output must not expose secrets, private evidence content, security findings, or another tenant's state.
- No production deployment, migration, secret change, external compliance claim, contract, or feature activation is part of this plan.
- Generated documents must be derived from executable registries and held current by tests.

## File Structure

- Modify `app/src/lib/governance/constitution.ts` — canonical eight primitives, twelve operating principles, admission questions, and migration of the existing governance-gap capability map.
- Modify `app/src/lib/governance/constitution.test.ts` — primitive migration, source integrity, and rendered-document checks.
- Modify `docs/PLATFORM-CONSTITUTION.md` — generated output from the constitution registry.
- Create `app/src/lib/governance/capability-governance.ts` — maturity vocabulary, activation classes, governance profiles, sixty explicit `CAP-*` policy bindings, and joined canonical definitions.
- Create `app/src/lib/governance/capability-governance.test.ts` — completeness, identity, evidence, risk, and mapping checks; renderer for the activation register.
- Create `docs/CAPABILITY-ACTIVATION-REGISTER.md` — generated capability/maturity/risk/evidence projection.
- Create `app/src/lib/governance/activation.ts` — pure activation request/context/decision types and fail-closed evaluator.
- Create `app/src/lib/governance/activation.test.ts` — standard, controlled, high-risk, cross-tenant, stale-evidence, kill-switch, replay, and safe-denial tests.
- Modify `app/src/lib/flags.ts` — require a valid scoped activation receipt for every high-risk flag.
- Modify `app/src/lib/flags.test.ts` — prove that tenant policy alone cannot activate high-risk flags and that receipts cannot cross tenant, capability, flag, or time boundaries.
- Create `app/src/lib/governance/projections.ts` — permitted claim statuses and evidence-aware readiness projection.
- Create `app/src/lib/governance/projections.test.ts` — prove that claims cannot exceed capability and tenant maturity.
- Modify `app/src/lib/ops/claims.ts` — add canonical `capabilityIds` bindings to each public claim.
- Modify `app/src/lib/ops/claims.test.ts` — validate claim bindings and apply the control-plane ceiling.
- Modify `app/package.json` — include the new generated-register tests in `npm run registers`.

## Review Focus

- A configuration published for tenant A must never satisfy tenant B; Task 3 adds the cross-tenant configuration test.
- A receipt for one high-risk flag, capability, or operation must not authorize another; Task 4 adds all three mismatch tests.
- An ISO date without a timezone must not change expiry behavior across host timezones; Task 3 evaluates ISO dates at UTC midnight and Task 5 runs the focused suite under Chicago and Kiritimati.
- A capability linked to several claims or master rows must use the most restrictive current result; Task 5 tests mixed maturity and expired evidence.
- Existing active workflows that lose a prerequisite must receive a deny/degraded decision without deleting data or fabricating rollback; Task 3 tests the `continuity` reason and immutable decision output.

---

### Task 1: Consolidate the platform constitution into eight primitives

**Files:**
- Modify: `app/src/lib/governance/constitution.ts`
- Modify: `app/src/lib/governance/constitution.test.ts`
- Modify: `docs/PLATFORM-CONSTITUTION.md`

**Interfaces:**
- Consumes: existing `Capability`, `PRINCIPLES`, `ADMISSION`, and generated-document conventions from `app/src/lib/governance/constitution.ts`.
- Produces: `PrimitiveId`, `PRIMITIVE_IDS`, `PRIMITIVES`, and `PRINCIPLES` as the sole architectural vocabulary imported by Task 2.

- [ ] **Step 1: Replace the primitive expectations with a failing eight-primitives test**

In `app/src/lib/governance/constitution.test.ts`, assert this exact identity order:

```ts
expect(PRIMITIVE_IDS).toEqual([
  'identity-tenancy',
  'permission-consent-authority',
  'data-provenance',
  'policy-rules',
  'action-workflow',
  'integration-gateway',
  'trust-evidence',
  'experience-accessibility',
]);
expect(PRIMITIVES).toHaveLength(8);
expect(PRINCIPLES).toHaveLength(12);
expect(ADMISSION[1]).toMatch(/eight primitives/);
```

Retain the existing assertions that every primitive has an existing `home`, every governance-gap capability names a known primitive, every principle is held by an existing file, and the rendered document equals `docs/PLATFORM-CONSTITUTION.md`.

- [ ] **Step 2: Run the constitution test and confirm the old twelve-primitives model fails**

Run: `cd app && npm test -- src/lib/governance/constitution.test.ts`

Expected: FAIL because `PRIMITIVE_IDS` still contains twelve values and `PRINCIPLES` contains eleven.

- [ ] **Step 3: Implement the eight primitives and twelve approved principles**

In `app/src/lib/governance/constitution.ts`:

- Replace `PrimitiveId` and `PRIMITIVES` with the exact eight identifiers from Step 1.
- Keep each primitive's `home` pointed at an existing implementation boundary.
- Map every existing `J-*`, `I-*`, and `O-*` governance-gap capability to exactly one of the eight primitives. Product-specific learning, planning, support, and communication rows map to `experience-accessibility`, `action-workflow`, or `data-provenance` according to the row's stated job; they do not remain architectural primitives.
- Replace “twelve primitives” wording in `ADMISSION` with “eight primitives”.
- Replace or extend `PRINCIPLES` so it contains the twelve rules in section 4 of the approved spec, each with an existing `heldBy` path. Use `docs/PLATFORM-CONSTITUTION.md` only for the constitution and feature-admission principles that this registry itself holds.
- Update comments and renderer copy so no old twelve-primitives claim remains.

- [ ] **Step 4: Regenerate the platform constitution and run its focused test**

Run: `cd app && REGISTERS=write npm test -- src/lib/governance/constitution.test.ts`

Expected: PASS and `docs/PLATFORM-CONSTITUTION.md` is rewritten with eight primitives and twelve principles.

- [ ] **Step 5: Check that the old primitive vocabulary is absent from the canonical constitution**

Run: `rg -n "twelve primitives|\| (Identity|Knowledge|Authority|Action|Learning|Planning|Support|Communication|Evidence|Integration|Trust|Operations) \|" app/src/lib/governance/constitution.ts docs/PLATFORM-CONSTITUTION.md`

Expected: no stale twelve-primitives sentence or twelve-row primitive table; role and department prose may still use ordinary words such as “support” or “operations”.

- [ ] **Step 6: Commit the constitution migration**

```bash
git add app/src/lib/governance/constitution.ts app/src/lib/governance/constitution.test.ts docs/PLATFORM-CONSTITUTION.md
git commit -m "refactor: consolidate platform constitution primitives"
```

---

### Task 2: Create the canonical capability-governance registry

**Files:**
- Create: `app/src/lib/governance/capability-governance.ts`
- Create: `app/src/lib/governance/capability-governance.test.ts`
- Create: `docs/CAPABILITY-ACTIVATION-REGISTER.md`
- Modify: `app/package.json`

**Interfaces:**
- Consumes: `RolloutCapability` and `CAPABILITIES` from `app/src/lib/rollout-capabilities.ts`; `PrimitiveId` from Task 1; `Domain` and `REGISTER` from `app/src/lib/masterregister.ts`; `Seat` from `app/src/lib/launchreadiness.ts`.
- Produces: `MaturityLevel`, `ActivationClass`, `CapabilityProfile`, `CapabilityPolicy`, `CapabilityDefinition`, `CAPABILITY_PROFILES`, `CAPABILITY_POLICIES`, `CAPABILITY_DEFINITIONS`, `capabilityDefinition(id)`, and `maturityForState(state)`.

- [ ] **Step 1: Write failing vocabulary and completeness tests**

Create `app/src/lib/governance/capability-governance.test.ts` with these core assertions:

```ts
expect(MATURITY_LEVELS).toEqual(['L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9']);
expect(ACTIVATION_CLASSES).toEqual(['standard', 'controlled', 'high-risk']);
expect(CAPABILITY_DEFINITIONS).toHaveLength(60);
expect(new Set(CAPABILITY_DEFINITIONS.map((c) => c.id)).size).toBe(60);
expect(CAPABILITY_DEFINITIONS.map((c) => c.id)).toEqual(CAPABILITIES.map((c) => c.id));
```

For every definition, assert:

- at least one known primitive;
- a known master-register row in `masterRows`;
- a non-empty owner, purpose, accessibility criterion, fallback, support owner, lifecycle condition, and permitted-claim description;
- at least one data rule naming classification, authority, purpose, and retention reference;
- every dependency still resolves as `CAP-*` or starts with `external:`;
- `high-risk` definitions include the full high-risk requirement profile;
- the source `CAP-*` ID is unchanged.

Add explicit risk assertions:

```ts
expect(byId('CAP-041').activationClass).toBe('high-risk'); // family record access
expect(byId('CAP-046').activationClass).toBe('high-risk'); // money
expect(byId('CAP-047').activationClass).toBe('high-risk'); // meal-plan transactions
expect(byId('CAP-048').activationClass).toBe('high-risk'); // housing contracts/workflows
expect(byId('CAP-050').activationClass).toBe('high-risk'); // official registration boundary
expect(byId('CAP-027').activationClass).toBe('controlled'); // source-grounded assistant, no autonomous writes
```

- [ ] **Step 2: Run the new test and verify the module is missing**

Run: `cd app && npm test -- src/lib/governance/capability-governance.test.ts`

Expected: FAIL because `./capability-governance` does not exist.

- [ ] **Step 3: Define the governance types and state-to-maturity mapping**

Create `app/src/lib/governance/capability-governance.ts` with these signatures:

```ts
export type MaturityLevel = `L${0|1|2|3|4|5|6|7|8|9}`;
export type ActivationClass = 'standard' | 'controlled' | 'high-risk';
export type DataAuthority = 'student' | 'semester' | 'institution' | 'external-provider' | 'shared';

export interface DataRule {
  classification: string;
  authority: DataAuthority;
  purpose: string;
  retention: string;
}

export interface CapabilityProfile {
  domain: Domain;
  primitives: readonly PrimitiveId[];
  data: readonly DataRule[];
  accessibility: string;
  fallback: string;
  supportOwner: Seat;
  lifecycle: string;
}

export interface CapabilityPolicy {
  profile: keyof typeof CAPABILITY_PROFILES;
  activationClass: ActivationClass;
  masterRows: readonly string[];
  requiredClaims: string;
  maturity?: MaturityLevel;
}

export interface CapabilityDefinition extends RolloutCapability, CapabilityProfile {
  maturity: MaturityLevel;
  activationClass: ActivationClass;
  masterRows: readonly string[];
  requiredClaims: string;
}

export function maturityForState(state: CapabilityState): MaturityLevel;
export function capabilityDefinition(id: string): CapabilityDefinition | undefined;
```

Use this conservative mapping: `verified → L3`, `partial → L2`, and `absent`, `blocked`, or `conflict → L1`. A `CapabilityPolicy.maturity` override may lower the result but must never raise it above the state-derived value.

- [ ] **Step 4: Define reusable profiles and bind all sixty capabilities explicitly**

Create profiles for the existing product domains rather than duplicating long policy prose sixty times. Each profile supplies complete primitives, data rules, accessibility, fallback, support, and lifecycle values. `CAPABILITY_POLICIES` must contain one explicit key for every `CAP-*` ID and select a profile, activation class, applicable master-register rows, and permitted-claim wording.

Classification rules:

- Local, reversible personal planning/study/creation capabilities are `standard` unless they export broadly or communicate externally.
- Institutional reads, AI assistance, sharing, exports, connected communications, and campus-service workflows are `controlled`.
- Parent/guardian record access, money or transaction ledgers, meal-plan transactions, housing contracts, and official registration are `high-risk`.
- The current course, assignment, and practice capabilities remain standard or controlled student tools; future native-LMS grade or system-of-record writes are separate high-risk flag operations, not silently implied by the existing screen.

The join function must preserve the rollout capability object and add the selected policy/profile fields. It must throw on a missing policy, unknown profile, unknown master row, duplicate source ID, or attempted maturity promotion.

- [ ] **Step 5: Render and verify the activation register**

In `capability-governance.test.ts`, render `docs/CAPABILITY-ACTIVATION-REGISTER.md` using the existing `renderedFrom`, `controlLine`, `table`, and `cell` helpers. Include:

- maturity vocabulary L0–L9;
- activation-class meanings;
- the eight primitives;
- all sixty capabilities with ID, owner, domain, primitives, product maturity, activation class, master rows, fallback, and permitted claim;
- a warning that product maturity does not prove tenant activation.

Write only when `REGISTERS=write`, then assert the checked-in document equals the renderer.

- [ ] **Step 6: Add the renderer to the register script and run it**

Add `src/lib/governance/capability-governance.test.ts` to the existing `registers` script in `app/package.json`.

Run: `cd app && REGISTERS=write npm test -- src/lib/governance/capability-governance.test.ts`

Expected: PASS and `docs/CAPABILITY-ACTIVATION-REGISTER.md` is created.

- [ ] **Step 7: Commit the canonical capability registry**

```bash
git add app/src/lib/governance/capability-governance.ts app/src/lib/governance/capability-governance.test.ts docs/CAPABILITY-ACTIVATION-REGISTER.md app/package.json
git commit -m "feat: add canonical capability governance registry"
```

---

### Task 3: Implement the fail-closed activation policy engine

**Files:**
- Create: `app/src/lib/governance/activation.ts`
- Create: `app/src/lib/governance/activation.test.ts`

**Interfaces:**
- Consumes: `CapabilityDefinition`, `ActivationClass`, and `MaturityLevel` from Task 2; `ConfigVersion` from `app/src/lib/config/studio.ts`; evidence states compatible with `app/src/lib/ops/evidence.ts`.
- Produces: `ActivationRequest`, `ActivationRequirementKey`, `RequirementState`, `ActivationContext`, `ActivationDecision`, `ActivationReceipt`, and `evaluateActivation(request, capability, context)` for Task 4.

- [ ] **Step 1: Write failing standard, controlled, and high-risk decision tests**

Create fixtures for one capability in each activation class and assert:

```ts
expect(evaluateActivation(request, standard, standardReady).outcome).toBe('allow');
expect(evaluateActivation(request, controlled, controlledWithoutEvidence)).toMatchObject({
  outcome: 'unmet_requirements',
  missing: ['current_evidence'],
});
expect(evaluateActivation(request, highRisk, highRiskWithOnlyFeatureEnabled)).toMatchObject({
  outcome: 'unmet_requirements',
});
```

The high-risk fixture must remain denied until all required keys are satisfied:

`tenant_configuration`, `authorization`, `entitlement`, `consent`, `current_evidence`, `accountable_approval`, `integration_health`, `support_ready`, `monitoring_ready`, `rollback_ready`, `parallel_run`, `uat`, `go_live_authorization`, and `audit_available`.

- [ ] **Step 2: Add failing boundary and safety tests**

Cover:

- unknown capability and missing tenant fail closed;
- a `ConfigVersion` from another tenant or in `draft` state is rejected;
- expired, revoked, or failed requirement states are not satisfied;
- a kill switch returns `deny` even when every requirement passes;
- `audit_available` missing denies every controlled or high-risk action that requires an audit;
- two identical requests produce the same `decisionKey` and receipt;
- changing request ID, tenant, capability, operation, configuration version, or policy version changes the key;
- an existing workflow that loses a prerequisite returns `deny` with safe reason `continuity_required`, preserving references and making no mutation;
- reasons expose requirement keys but never evidence bodies, secrets, another tenant ID, or security-finding text;
- UTC ISO-date comparisons behave identically around midnight.

- [ ] **Step 3: Run the test and verify the activation module is missing**

Run: `cd app && npm test -- src/lib/governance/activation.test.ts`

Expected: FAIL because `./activation` does not exist.

- [ ] **Step 4: Define the activation contracts**

Create these exact public shapes in `activation.ts`:

```ts
export type ActivationRequirementKey =
  | 'tenant_configuration' | 'authorization' | 'entitlement' | 'consent'
  | 'current_evidence' | 'accountable_approval' | 'integration_health'
  | 'support_ready' | 'monitoring_ready' | 'rollback_ready'
  | 'parallel_run' | 'uat' | 'go_live_authorization' | 'audit_available';

export type RequirementStatus = 'satisfied' | 'missing' | 'expired' | 'revoked' | 'failed';

export interface RequirementState {
  key: ActivationRequirementKey;
  status: RequirementStatus;
  tenantId: string;
  references: readonly string[];
}

export interface ActivationRequest {
  requestId: string;
  tenantId: string;
  actorId: string;
  purpose: string;
  capabilityId: string;
  operation: string;
}

export interface ActivationContext {
  now: string;
  policyVersion: string;
  configuration: ConfigVersion | null;
  requirements: readonly RequirementState[];
  killSwitchEngaged: boolean;
  existingWorkflow: boolean;
}

export interface ActivationReceipt {
  decisionKey: string;
  requestId: string;
  tenantId: string;
  capabilityId: string;
  operation: string;
  policyVersion: string;
  configurationVersion: number;
  issuedAt: string;
  expiresAt: string;
}

export type ActivationDecision =
  | { outcome: 'allow'; reason: 'all_requirements_satisfied'; receipt: ActivationReceipt; missing: readonly [] }
  | { outcome: 'deny' | 'unmet_requirements'; reason: string; receipt: null; missing: readonly ActivationRequirementKey[] };

export function evaluateActivation(
  request: ActivationRequest,
  capability: CapabilityDefinition | undefined,
  context: ActivationContext,
): ActivationDecision;
```

- [ ] **Step 5: Implement requirement selection and deterministic receipts**

Use ordered requirement sets per activation class. Standard capabilities require tenant configuration only when their profile says so; controlled capabilities require authorization, entitlement, consent as applicable, current evidence, support, monitoring, rollback, and audit; high-risk capabilities require the full list from Step 1.

Rules:

- Only a `published` configuration whose `tenant_id` equals the request tenant and whose numeric `version` is non-null may satisfy `tenant_configuration`.
- Every counted `RequirementState.tenantId` must equal the request tenant.
- Duplicate entries do not widen authority; any non-`satisfied` entry for a required key wins.
- The receipt expires after 15 minutes and binds request, tenant, capability, operation, policy version, and configuration version.
- Build `decisionKey` deterministically from those non-secret fields with a stable, versioned serialization; do not make this pure evaluator asynchronous and do not present the key as a cryptographic signature.
- The evaluator performs no I/O and no mutation.

- [ ] **Step 6: Run the activation tests**

Run: `cd app && npm test -- src/lib/governance/activation.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit the activation engine**

```bash
git add app/src/lib/governance/activation.ts app/src/lib/governance/activation.test.ts
git commit -m "feat: add fail-closed activation policy engine"
```

---

### Task 4: Prevent high-risk feature flags from bypassing activation contracts

**Files:**
- Modify: `app/src/lib/flags.ts`
- Modify: `app/src/lib/flags.test.ts`

**Interfaces:**
- Consumes: `ActivationReceipt` from Task 3 and existing `FlagDefinition`, `FlagContext`, and `evaluateFlag`.
- Produces: `FlagDefinition.capabilityIds`, `FlagContext.activationReceipt`, and the new `FlagStep` value `activation_contract`.

- [ ] **Step 1: Write the failing high-risk bypass test**

Extend the existing “keeps write-back off” test so a tenant policy, healthy connection, approved scopes, capability, permitted role/cohort, classification, course rule, and eligible user still receive:

```ts
expect(evaluateFlag('writeback.registration_submit', ctx)).toMatchObject({
  allowed: false,
  step: 'activation_contract',
});
```

Add a control proving a standard flag with its existing gates still reaches `allowed` without an activation receipt.

- [ ] **Step 2: Add failing receipt-scope tests**

Using a valid receipt fixture, assert denial when any of these differ:

- receipt tenant versus `FlagContext.tenantId`;
- receipt capability versus the flag's declared `capabilityIds`;
- receipt operation versus flag key;
- receipt expiry versus `FlagContext.now`;
- receipt policy/configuration binding missing;
- receipt outcome was not produced by an `allow` decision fixture.

Assert a matching, unexpired receipt allows the high-risk flag only after all existing flag gates pass. Assert a kill switch still wins before the receipt.

- [ ] **Step 3: Run the flag test and verify the bypass remains**

Run: `cd app && npm test -- src/lib/flags.test.ts`

Expected: FAIL because high-risk flags do not yet require receipts.

- [ ] **Step 4: Bind flags to canonical capability IDs**

Add `capabilityIds: readonly string[]` to `FlagDefinition`. Every concrete flag must declare at least one existing `CAP-*` identity. Connector flags created by the map factory receive the matching canonical capability binding in their tuple. Meta flags that govern several product surfaces list every allowed capability rather than using a wildcard.

Minimum bindings include:

- `writeback.registration_submit → CAP-050`;
- `writeback.lms_grade_passback → CAP-020, CAP-021, CAP-030`;
- `module.dining → CAP-047`;
- `integration.degree_audit_read → CAP-044`;
- `integration.erp_bursar_actions → CAP-046`;
- `ops.external_ai_generation → CAP-027`;
- `safety.scoped_pseudonymity` and moderation/escalation flags → the communication/community capabilities they govern.

Extend the registry test to reject missing or unknown capability IDs.

- [ ] **Step 5: Require the scoped receipt after existing gates and before `allowed`**

Add `activationReceipt?: ActivationReceipt | null` to `FlagContext` and `activation_contract` to `FlagStep`. For `def.highRisk`, `evaluateFlag` must deny unless the receipt:

- is unexpired at `ctx.now`;
- names `ctx.tenantId`;
- names one of `def.capabilityIds`;
- names the flag key as its operation;
- carries non-empty policy and configuration versions.

Keep kill switches first. Keep all current environment, entitlement, connection, scope, role, cohort, classification, course, and eligibility checks. The receipt supplements them; it does not replace them.

Document this check as a fail-closed product-exposure gate only. A receipt must never be accepted by a domain API as standalone authorization, and the flag evaluator must not claim to prove server-side authorization.

- [ ] **Step 6: Run flag and activation tests together**

Run: `cd app && npm test -- src/lib/flags.test.ts src/lib/governance/activation.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit high-risk flag enforcement**

```bash
git add app/src/lib/flags.ts app/src/lib/flags.test.ts
git commit -m "feat: require activation receipts for high-risk flags"
```

---

### Task 5: Derive claims and readiness projections from the control plane

**Files:**
- Create: `app/src/lib/governance/projections.ts`
- Create: `app/src/lib/governance/projections.test.ts`
- Modify: `app/src/lib/ops/claims.ts`
- Modify: `app/src/lib/ops/claims.test.ts`
- Modify: `docs/CAPABILITY-ACTIVATION-REGISTER.md`

**Interfaces:**
- Consumes: `CapabilityDefinition`, `MaturityLevel`, and `ActivationClass` from Task 2; `ActivationDecision` from Task 3; `Claim` and `ClaimStatus` from `ops/claims.ts`; `EvidenceRecord` and `evidenceState` from `ops/evidence.ts`.
- Produces: `ProjectionContext`, `permittedClaimStatuses(context)`, `projectClaim(claim, capabilities, contextById)`, and `capabilityReadiness(capability, context)`.

- [ ] **Step 1: Add canonical capability bindings to the claim type and fixtures**

Add `capabilityIds: readonly string[]` to `Claim`. Bind every entry in `CLAIMS` to one or more existing `CAP-*` IDs. A claim about cross-cutting company operations may bind to every directly affected capability, but it may not use an empty list or an invented wildcard.

Update the `sound` fixture in `ops/claims.test.ts` with `capabilityIds: ['CAP-001']` and add a failing assertion for an unknown capability ID.

- [ ] **Step 2: Write failing claim-ceiling and evidence tests**

Create `app/src/lib/governance/projections.test.ts` and assert:

- L0/L1 permits `planned` only;
- L2 permits `planned` and `in-preparation`;
- L3/L4 permits `built-tested`; a standard capability explicitly marked `generallyAvailable` may also permit `available` when current evidence exists and no tenant activation is required;
- controlled and high-risk capabilities at L3/L4 do not permit institution-configured/limited-beta/available without tenant state;
- L5 controlled capability permits `institution-configured`;
- L6/L7 with a named pilot permits `limited-beta`;
- controlled or high-risk capabilities at L8/L9 with `generallyAvailable: true` and current evidence permit `available`;
- expired/revoked evidence removes `available`, `limited-beta`, and `institution-configured` even if maturity is high;
- a high-risk capability never permits `available` below L8;
- a claim linked to multiple capabilities receives the intersection of their permitted statuses;
- the most restrictive capability or expired evidence wins;
- no projection upgrades the claim already stored in `CLAIMS`.

- [ ] **Step 3: Run the new tests and verify projections are missing**

Run: `cd app && npm test -- src/lib/governance/projections.test.ts src/lib/ops/claims.test.ts`

Expected: FAIL because `projections.ts` and `Claim.capabilityIds` do not exist.

- [ ] **Step 4: Implement the projection interfaces**

Create:

```ts
export interface ProjectionContext {
  productMaturity: MaturityLevel;
  tenantMaturity: MaturityLevel | null;
  activationClass: ActivationClass;
  evidence: 'current' | 'expiring' | 'expired' | 'revoked' | 'missing';
  namedPilot: boolean;
  generallyAvailable: boolean;
}

export function permittedClaimStatuses(context: ProjectionContext): ReadonlySet<ClaimStatus>;
export function projectClaim(
  claim: Claim,
  capabilities: readonly CapabilityDefinition[],
  contextById: Readonly<Record<string, ProjectionContext>>,
): { permitted: boolean; allowed: readonly ClaimStatus[]; reason: string };
```

Use a fixed rank only to choose the most restrictive result after the class-specific permitted set is calculated. `available`, `limited-beta`, and `institution-configured` remain distinct operational states, not synonyms.

- [ ] **Step 5: Apply the projection in claims validation**

Extend `Facts` with an optional `claimProjection?: (claim: Claim) => { permitted: boolean; reason: string }`. In `problems`, report a projection error when provided and not permitted. Keep the current master-row, test-evidence, route, wording, and expiry checks unchanged.

In the real `FACTS` fixture in `ops/claims.test.ts`, build projections from `CAPABILITY_DEFINITIONS` and current evidence. The current checked-in claims must pass without being promoted. If a current claim exceeds the canonical projection, lower the claim wording/status or correct its binding; do not raise capability maturity to silence the test.

- [ ] **Step 6: Extend the generated activation register with projections**

Add each capability's currently permitted claim statuses and evidence state to `docs/CAPABILITY-ACTIVATION-REGISTER.md`. Keep the warning that the register is repository evidence, not live tenant activation proof.

Run: `cd app && REGISTERS=write npm test -- src/lib/governance/capability-governance.test.ts src/lib/governance/projections.test.ts src/lib/ops/claims.test.ts`

Expected: PASS and the generated document is current.

- [ ] **Step 7: Run timezone and integration-focused verification**

Run:

```bash
cd app
TZ=America/Chicago npm test -- src/lib/governance/activation.test.ts src/lib/governance/projections.test.ts src/lib/flags.test.ts src/lib/ops/claims.test.ts
TZ=Pacific/Kiritimati npm test -- src/lib/governance/activation.test.ts src/lib/governance/projections.test.ts src/lib/flags.test.ts src/lib/ops/claims.test.ts
```

Expected: both runs PASS with identical decision and expiry assertions.

- [ ] **Step 8: Commit projections and claim bindings**

```bash
git add app/src/lib/governance/projections.ts app/src/lib/governance/projections.test.ts app/src/lib/ops/claims.ts app/src/lib/ops/claims.test.ts docs/CAPABILITY-ACTIVATION-REGISTER.md
git commit -m "feat: derive claims from capability activation state"
```

---

### Task 6: Run repository gates and verify generated-state integrity

**Files:**
- Modify only files required to fix failures caused by Tasks 1–5; do not absorb unrelated pre-existing failures.

**Interfaces:**
- Consumes: all interfaces from Tasks 1–5.
- Produces: a verified branch whose code, tests, and generated registers agree.

- [ ] **Step 1: Regenerate every controlled register**

Run: `cd app && npm run registers`

Expected: PASS; only documents whose executable sources changed are modified.

- [ ] **Step 2: Run the focused control-plane suite**

Run:

```bash
cd app && npm test -- \
  src/lib/governance/constitution.test.ts \
  src/lib/governance/capability-governance.test.ts \
  src/lib/governance/activation.test.ts \
  src/lib/governance/projections.test.ts \
  src/lib/rollout-capabilities.test.ts \
  src/lib/flags.test.ts \
  src/lib/ops/evidence.test.ts \
  src/lib/ops/claims.test.ts \
  src/lib/masterregister.test.ts \
  src/lib/config/studio.test.ts \
  src/lib/contract/tenantcontract.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run type, lint, and build gates**

Run:

```bash
cd app
npm run lint
npm run build
```

Expected: both commands exit 0. Existing lint warning allowance remains unchanged.

- [ ] **Step 4: Run the full application test suite**

Run: `cd app && npm test`

Expected: PASS. If the baseline contains a pre-existing failure, record the exact test and confirm it also fails on `origin/main`; do not weaken or skip it in this branch.

- [ ] **Step 5: Verify no activation or deployment state changed**

Run:

```bash
git diff --name-only origin/main...HEAD
git diff --check origin/main...HEAD
git status --short
```

Expected:

- changes are limited to the constitution, governance engine, flag/claims integration, tests, package register script, approved spec/plan, and generated documents;
- no Supabase migration, production configuration, secret, deployment workflow, or live feature-state file changed;
- `git diff --check` reports no whitespace errors;
- the worktree is clean after the final commit.

- [ ] **Step 6: Commit any generated-document-only finalization**

If Step 1 changed controlled documents after Task 5:

```bash
git add docs/PLATFORM-CONSTITUTION.md docs/CAPABILITY-ACTIVATION-REGISTER.md app/package.json
git commit -m "docs: refresh activation control plane registers"
```

If there is no diff, do not create an empty commit.

- [ ] **Step 7: Request code review**

Use `superpowers:requesting-code-review` against the approved spec and this plan. Critical review issues block branch completion; fix them with the owning task's focused tests before rerunning the final gates.
