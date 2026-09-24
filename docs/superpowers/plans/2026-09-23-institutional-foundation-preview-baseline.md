# Semester Institutional Foundation and Preview Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the approved institutional-rollout design into an executable, evidence-backed baseline: one reconciled 60-capability registry, one requirements traceability system, a tenant-and-role map tied to the existing schema, a safely flagged institutional navigation preview with two synthetic campuses and representative roles, a reproducible local launch, and publication builders for the PDF, document, Claude Code, and Google Drive packages.

**Architecture:** Keep the existing React 19, TypeScript, Vite, Supabase, local-first state, and institution-gateway architecture. Add one typed rollout registry as the program source of truth, generate human-readable artifacts from it, expose the approved five-primary/seven-workspace information architecture only behind `VITE_INSTITUTIONAL_PREVIEW`, and seed only synthetic preview data. Existing routes, data, navigation, policies, and production behavior remain the default. The current `schools`, `profiles.school_id`, `role_grants`, `app_roles`, `app_capabilities`, `role_capabilities`, and `private.has_capability` design is mapped and tested before any new migration is proposed.

**Tech Stack:** React 19, TypeScript 7, Vite 8, Vitest 5, Supabase/Postgres RLS, Node.js 22 scripts, HTML/CSS publication source, bundled workspace document/PDF tooling, Google Drive connector.

**Spec:** `docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md`

**Required outputs:** Current-state evidence baseline; reconciled 60-capability matrix; requirements traceability registry; tenant/role schema map and isolation probes; local preview and launch procedure; PDF, editable-document, Google Drive, and Claude Code publication packages.

## Global Constraints

- Preserve all 59 existing registered destinations and all accounted detail/settings routes. The approved 60-capability inventory is a product-capability inventory, not permission to invent a sixtieth route.
- The live production default stays unchanged unless `VITE_INSTITUTIONAL_PREVIEW=true` is present at build time.
- Synthetic preview institutions must be unmistakably fictional and must not contain real student, employee, or institutional credentials.
- A public URL, copied label, or sandbox adapter never counts as a live integration. Use the existing readiness and gateway status vocabulary.
- Client roles control presentation only. Authorization remains in Supabase RLS, server-side identity metadata, and adapter-level object checks.
- Do not edit an already-applied migration. Add a new migration only after the schema map and isolation probes prove that a required invariant is absent.
- Every generated claim must link to a repository file, live-site observation, Drive document ID, shared-chat URL, or supplied-source line range. Unsupported claims are marked `unverified`, never promoted to `complete`.
- The user-facing PDF and documents go to `/Users/harrisonrubin/Documents/Codex/2026-09-23/ana/outputs/semester-institutional-rollout/`; generated repository evidence stays under `docs/institutional-rollout/generated/`.
- Google Drive publication is additive: create `Semester - Institutional Rollout`, preserve existing files, and record imported IDs. Do not delete or replace source documents.
- Follow `CLAUDE.md`: fetch and inspect `origin/main`, search for equivalent work, write a failing test first, prove the test can fail under mutation/revert, run the required gates from `app/`, and visually inspect changed UI.

## Review Focus

- **No route loss:** owned by `app/src/lib/rollout-capabilities.test.ts`, `app/src/lib/nav.registry.test.ts`, and `app/src/lib/institutional-ia.test.ts`.
- **Production-default preservation:** owned by `app/src/lib/institutional-preview.test.ts` and a cold-browser smoke with the flag absent.
- **Tenant and role truth:** owned by `supabase/institutional-foundation.check.sql`, `supabase/grants.check.sql`, and `app/src/lib/institutional-access.test.ts`.
- **No fake integrations or customers:** owned by `app/src/lib/readiness.test.ts`, `app/src/lib/rollout-traceability.test.ts`, and generated-report validation.
- **Synthetic data isolation:** owned by `app/src/data/institutional-preview.test.ts`.
- **Artifact/source consistency:** owned by `app/scripts/rollout-artifacts.test.ts` and `app/scripts/rollout-publication.test.ts`.
- **Accessible responsive preview:** owned by component tests, the existing contrast/target sweeps, and desktop/mobile browser inspection.
- **Drive round-trip integrity:** owned by the publication manifest plus connector read-back evidence recorded in `outputs/semester-institutional-rollout/drive-publication-receipt.md`.

---

## Task 1: Freeze and test the current-state census

**Files:**

- Create: `app/scripts/institutional-census.mjs`
- Create: `app/scripts/institutional-census.test.ts`
- Modify: `app/package.json`
- Create generated output: `docs/institutional-rollout/generated/current-state.json`
- Create generated output: `docs/institutional-rollout/generated/current-state.md`

- [ ] **Step 1: Write the failing census test**

The test must run the script in a temporary output directory and assert exact invariants from the current checkout rather than hard-code a marketing total:

```ts
import { describe, expect, it } from 'vitest';
import { census } from './institutional-census.mjs';

describe('institutional census', () => {
  it('finds every registered destination and every accounted screen', async () => {
    const result = await census(new URL('../src/', import.meta.url));
    expect(result.destinations.count).toBe(59);
    expect(result.screens.unaccounted).toEqual([]);
    expect(result.migrations.duplicateVersions).toEqual([]);
    expect(result.evidence.every((row) => row.path && row.sha256)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test and confirm the missing-module failure**

Run: `cd app && npx vitest run scripts/institutional-census.test.ts`

Expected: FAIL because `institutional-census.mjs` does not exist.

- [ ] **Step 3: Implement the smallest deterministic census**

Export `census(srcUrl)` and `writeCensus(repoRoot, outputDir)`. Inspect:

- the `Screen` union in `app/src/lib/types.ts`;
- `DESTINATIONS` in `app/src/lib/nav.ts`;
- the exclusion sets in `app/src/lib/nav.registry.test.ts`;
- files in `app/server/institution/`;
- numbered files in `supabase/migrations/`;
- root and `docs/` requirement/audit documents;
- Git SHA and UTC generation time.

Hash every cited file with SHA-256. Sort arrays before serialization. Never inspect `.env*`, credentials, `node_modules`, or private runtime data.

- [ ] **Step 4: Add the package command**

```json
"rollout:census": "node scripts/institutional-census.mjs"
```

- [ ] **Step 5: Prove the guard is meaningful**

Temporarily change the expected destination count in the test to `58`, run it, observe FAIL, then restore `59` and observe PASS.

- [ ] **Step 6: Generate and inspect the two census artifacts**

Run: `cd app && npm run rollout:census`

Expected: JSON and Markdown are written under `docs/institutional-rollout/generated/`, both name the same commit, and the Markdown links each evidence path.

- [ ] **Step 7: Commit**

```bash
git add app/scripts/institutional-census.mjs app/scripts/institutional-census.test.ts app/package.json docs/institutional-rollout/generated/current-state.json docs/institutional-rollout/generated/current-state.md
git commit -m "Add reproducible institutional census"
```

## Task 2: Create the authoritative 60-capability registry

**Files:**

- Create: `app/src/lib/rollout-capabilities.ts`
- Create: `app/src/lib/rollout-capabilities.test.ts`
- Modify: `app/src/lib/nav.ts` only if a capability cannot map to an existing destination without changing behavior
- Create generated output: `docs/institutional-rollout/generated/capability-disposition.md`

- [ ] **Step 1: Write the failing registry contract**

```ts
import { describe, expect, it } from 'vitest';
import { CAPABILITIES, capabilityIds, dispositionCounts } from './rollout-capabilities';

describe('rollout capability registry', () => {
  it('contains the approved sixty unique capabilities', () => {
    expect(CAPABILITIES).toHaveLength(60);
    expect(new Set(capabilityIds()).size).toBe(60);
  });

  it('gives every capability evidence, a disposition, an owner, and acceptance tests', () => {
    for (const capability of CAPABILITIES) {
      expect(capability.sources.length).toBeGreaterThan(0);
      expect(capability.acceptance.length).toBeGreaterThan(0);
      expect(capability.owner).not.toBe('');
      expect(['preserve', 'extend', 'build', 'external-gate']).toContain(capability.disposition);
    }
    expect(Object.values(dispositionCounts()).reduce((a, b) => a + b, 0)).toBe(60);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `cd app && npx vitest run src/lib/rollout-capabilities.test.ts`

Expected: FAIL because the registry is absent.

- [ ] **Step 3: Implement the typed registry**

Use this exact public shape:

```ts
export type CapabilityDisposition = 'preserve' | 'extend' | 'build' | 'external-gate';
export type CapabilityState = 'verified' | 'partial' | 'absent' | 'blocked' | 'conflict';
export type RolloutPhase = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type EvidenceRef =
  | `repo:${string}`
  | `drive:${string}`
  | `web:${string}`
  | `attachment:${string}#L${number}-L${number}`;

export interface RolloutCapability {
  id: `CAP-${string}`;
  name: string;
  promise: string;
  destinations: string[];
  phase: RolloutPhase;
  disposition: CapabilityDisposition;
  currentState: CapabilityState;
  owner: string;
  dependencies: string[];
  sources: EvidenceRef[];
  acceptance: string[];
}
```

Transcribe the supplied 60-capability inventory exactly once. Map capabilities to one or more of the existing 59 destinations, detail flows, study modes, guide formats, or institutional gateway areas. A capability that requires credentials or a university agreement gets `external-gate`; it is not omitted.

- [ ] **Step 4: Add drift guards**

Test that every destination named by a capability exists in `DESTINATIONS` or in an explicit typed set of non-destination flows. Test that every `build`/`extend` item has a non-empty dependency list and every `external-gate` item names the external authorization it requires.

- [ ] **Step 5: Generate the human-readable disposition matrix**

Extend `institutional-census.mjs` so `npm run rollout:census` writes `capability-disposition.md` grouped by phase and disposition, with all 60 IDs and source links.

- [ ] **Step 6: Mutation-check and pass**

Delete one registry row, run the focused test, observe the `60` assertion fail, restore it, then run:

`cd app && npx vitest run src/lib/rollout-capabilities.test.ts scripts/institutional-census.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/rollout-capabilities.ts app/src/lib/rollout-capabilities.test.ts app/scripts/institutional-census.mjs docs/institutional-rollout/generated/capability-disposition.md
git commit -m "Reconcile the sixty rollout capabilities"
```

## Task 3: Add requirements and source traceability

**Files:**

- Create: `app/src/lib/rollout-traceability.ts`
- Create: `app/src/lib/rollout-traceability.test.ts`
- Create: `docs/institutional-rollout/source-index.json`
- Create generated output: `docs/institutional-rollout/generated/requirements-traceability.md`

- [ ] **Step 1: Write failing source-integrity tests**

Assert that every capability source resolves to one of the four `EvidenceRef` schemes exported by `rollout-capabilities.ts`:

```ts
import type { EvidenceRef } from './rollout-capabilities';
```

The test must reject bare titles, missing files, fake Drive IDs, line ranges outside the supplied attachment, and `complete` claims whose evidence is not `verified`.

- [ ] **Step 2: Run and confirm failure**

Run: `cd app && npx vitest run src/lib/rollout-traceability.test.ts`

Expected: FAIL because the source index and resolver are absent.

- [ ] **Step 3: Implement source parsing and validation**

Add:

```ts
export type EvidenceStatus = 'verified' | 'unverified' | 'unavailable' | 'superseded';
export interface SourceRecord {
  ref: EvidenceRef;
  title: string;
  status: EvidenceStatus;
  checkedAt: string;
  sha256?: string;
  note: string;
}

export function validateTraceability(
  capabilities: RolloutCapability[],
  sources: SourceRecord[],
): string[];
```

Seed the index with the approved spec, the supplied attachment, the shared-chat URL, the live-site URL, the repository files used by the census, and each Drive document actually read. Mark the shared chat `unverified` if its content still cannot be programmatically read.

- [ ] **Step 4: Generate a bidirectional matrix**

The report must show requirement → capability → phase → files/tests and source → capabilities. It must include an `Unverified and unavailable` section rather than silently dropping weak evidence.

- [ ] **Step 5: Mutation-check and pass**

Give one source `status: 'verified'` with neither a reachable file nor a connector ID; confirm the test fails, restore it, then rerun focused tests.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/rollout-traceability.ts app/src/lib/rollout-traceability.test.ts docs/institutional-rollout/source-index.json docs/institutional-rollout/generated/requirements-traceability.md app/scripts/institutional-census.mjs
git commit -m "Add rollout source traceability"
```

## Task 4: Map tenancy and authorization to the existing schema

**Files:**

- Create: `docs/institutional-rollout/tenant-role-schema-map.md`
- Create: `app/src/lib/institutional-access.ts`
- Create: `app/src/lib/institutional-access.test.ts`
- Create: `supabase/institutional-foundation.check.sql`
- Modify: `supabase/README.md`

- [ ] **Step 1: Write the failing client-model tests**

```ts
import { describe, expect, it } from 'vitest';
import { resolveWorkspaceAccess } from './institutional-access';

describe('institutional access presentation', () => {
  it('never promotes a client-selected role into authorization', () => {
    const access = resolveWorkspaceAccess({ selectedRole: 'university_admin', grants: [] });
    expect(access.authorizedCapabilities).toEqual([]);
    expect(access.presentationRole).toBe('university_admin');
  });
});
```

- [ ] **Step 2: Implement the presentation/auth boundary**

Use distinct types:

```ts
export type InstitutionalScopeKind = 'platform' | 'institution' | 'department' | 'course' | 'organization';
export interface VerifiedGrant {
  role: string;
  scopeKind: InstitutionalScopeKind;
  scopeId: string;
  capabilities: string[];
  expiresAt: string | null;
}
export interface WorkspaceAccess {
  presentationRole: string;
  authorizedCapabilities: string[];
  scopes: Array<{ kind: InstitutionalScopeKind; id: string }>;
}
export interface WorkspaceAccessInput {
  selectedRole: string;
  grants: VerifiedGrant[];
  now?: string;
}
export function resolveWorkspaceAccess(input: WorkspaceAccessInput): WorkspaceAccess;
```

`selectedRole` chooses wording/layout only. Only non-expired server-returned grants populate `authorizedCapabilities`.

- [ ] **Step 3: Write the schema map from current migrations**

Map each approved layer to existing objects:

- institution → `public.schools`;
- user affiliation → `public.profiles.school_id` plus `claim_school()`;
- sub-institution organization → `public.organizations.school_id`;
- scoped grants → `public.role_grants`;
- role vocabulary → `public.app_roles`;
- permission vocabulary → `public.app_capabilities`;
- role-to-permission matrix → `public.role_capabilities`;
- enforcement predicate → `private.has_capability()`;
- external tenant routing → `UniversityIdentity.institutionId` and server adapter registry.

Record real gaps separately: department, course, and program scope identifiers are vocabulary today, not full canonical entities; SSO/SCIM provisioning and consent/retention configuration remain unimplemented.

- [ ] **Step 4: Add read-only SQL isolation probes**

`supabase/institutional-foundation.check.sql` must begin a transaction, create two temporary synthetic auth identities or use local test fixtures, and assert:

- one school cannot read another school's private organization rows;
- direct client update of `profiles.school_id` is denied;
- expired/revoked grants do not satisfy `private.has_capability`;
- a grant in institution A does not authorize scope B;
- a platform capability is not implied by a tenant role;
- the transaction rolls back.

The check must be runnable only against a disposable/local Supabase database. Add that warning and exact command to `supabase/README.md`.

- [ ] **Step 5: Prove the client guard can fail**

Temporarily derive capabilities from `selectedRole`; observe the focused test fail, restore the verified-grant-only implementation, and rerun.

- [ ] **Step 6: Do not add a migration in this task**

If a probe fails because an existing invariant is absent, record a proposed migration name and rollback in the schema map, stop this task, and request design review. Do not quietly widen an applied policy.

- [ ] **Step 7: Commit**

```bash
git add docs/institutional-rollout/tenant-role-schema-map.md app/src/lib/institutional-access.ts app/src/lib/institutional-access.test.ts supabase/institutional-foundation.check.sql supabase/README.md
git commit -m "Map and probe institutional authorization"
```

## Task 5: Implement the flagged five-primary/seven-workspace information architecture

**Files:**

- Create: `app/src/lib/institutional-ia.ts`
- Create: `app/src/lib/institutional-ia.test.ts`
- Create: `app/src/lib/institutional-preview.ts`
- Create: `app/src/lib/institutional-preview.test.ts`
- Create: `app/src/components/nav/InstitutionalPrimaryNav.tsx`
- Create: `app/src/components/nav/InstitutionalWorkspaceNav.tsx`
- Create: `app/src/components/nav/institutional-nav.test.tsx`
- Modify: `app/src/App.tsx`
- Modify: `app/src/styles/app.css`
- Modify: `app/src/styles/industry.css`

- [ ] **Step 1: Write failing IA tests**

Pin the approved model:

```ts
expect(PRIMARY_DESTINATIONS.map((x) => x.id)).toEqual([
  'home', 'calendar', 'discover', 'ask-semester', 'inbox',
]);
expect(WORKSPACES.map((x) => x.id)).toEqual([
  'home', 'courses', 'study', 'create', 'campus', 'career', 'messages',
]);
expect(allMappedDestinationIds()).toEqual(expect.arrayContaining(DESTINATIONS.map((d) => d.screen)));
```

Also assert that the feature flag is false when absent and accepts only the exact string `true`.

- [ ] **Step 2: Implement typed IA mappings without changing routes**

Use virtual navigation IDs that resolve to existing screens:

```ts
export interface InstitutionalNavItem {
  id: string;
  label: string;
  screen: Screen;
  includes: Screen[];
}
```

Resolve Discover to the current search/directory experience, Inbox to current mail/notifications/messages surfaces, and Ask Semester to `ask`. Map every current destination to one workspace. Do not rename the `Screen` union or remove a `DESTINATIONS` row.

- [ ] **Step 3: Implement the exact preview flag**

```ts
export function institutionalPreview(env: Record<string, string | undefined>): boolean {
  return env.VITE_INSTITUTIONAL_PREVIEW === 'true';
}
```

- [ ] **Step 4: Render new navigation only when flagged**

In `App.tsx`, branch at the existing chrome composition boundary. The default path must render the same `ShelfNav`, tab bar, desktop sidebar, and apps panel as before. The preview path renders the new primary nav and contextual workspace nav while routing to the same screens.

- [ ] **Step 5: Add accessibility and responsive behavior**

Use semantic `<nav aria-label="Primary">` and `<nav aria-label="Workspace">`; expose selected state with `aria-current="page"`; maintain 44px targets; collapse workspace navigation to an accessible sheet on phone width; preserve keyboard order and the existing skip link.

- [ ] **Step 6: Prove the default is unchanged**

Render `App` with the variable absent and assert no `Primary` nav exists; render with it set and assert the five labels and seven workspace labels exist. Mutation-check by changing the default to true and confirming the default-preservation test fails.

- [ ] **Step 7: Run focused tests**

Run: `cd app && npx vitest run src/lib/institutional-ia.test.ts src/lib/institutional-preview.test.ts src/components/nav/institutional-nav.test.tsx src/lib/nav.registry.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add app/src/lib/institutional-ia.ts app/src/lib/institutional-ia.test.ts app/src/lib/institutional-preview.ts app/src/lib/institutional-preview.test.ts app/src/components/nav/InstitutionalPrimaryNav.tsx app/src/components/nav/InstitutionalWorkspaceNav.tsx app/src/components/nav/institutional-nav.test.tsx app/src/App.tsx app/src/styles/app.css app/src/styles/industry.css
git commit -m "Add flagged institutional navigation preview"
```

## Task 6: Seed two synthetic institutions and representative roles

**Files:**

- Create: `app/src/data/institutional-preview.ts`
- Create: `app/src/data/institutional-preview.test.ts`
- Create: `app/src/components/InstitutionalPreviewBar.tsx`
- Create: `app/src/components/institutional-preview-bar.test.tsx`
- Modify: `app/src/App.tsx`

- [ ] **Step 1: Write failing fixture tests**

Require exactly two institutions, unique fictional domains under `.example`, no real school names, no real email domains, and representative personas for student, faculty, advisor, campus staff, university admin, moderator, employer, and authorized payer.

- [ ] **Step 2: Implement immutable synthetic fixtures**

Use the names `Northstar University` (`northstar.example`) and `Cedar Coast College` (`cedarcoast.example`). Each fixture carries:

- school capabilities and academic calendar;
- readiness relationship `pilot` at most;
- explicit sandbox connection statuses;
- preview-only people with names such as `Avery Student` and `Morgan Advisor`;
- scoped verified grants matching the existing role vocabulary;
- sample courses, events, messages, holds, bills, housing, career, and support records marked `synthetic`.

- [ ] **Step 3: Add a preview-only switcher**

`InstitutionalPreviewBar` must show `Synthetic preview`, current institution, role, and connection truth. It may switch fixture context in memory only. It must never write `profiles.school_id`, issue `claim_school()`, or persist a role grant.

- [ ] **Step 4: Prevent production inclusion**

Lazy-load the fixtures only inside the preview branch so the production bundle does not eagerly include them. Add a source-level test that the fixture module is imported only from the preview boundary.

- [ ] **Step 5: Mutation-check and pass**

Change one domain to `.edu`, observe the fixture test fail, restore it, then run the two focused test files.

- [ ] **Step 6: Commit**

```bash
git add app/src/data/institutional-preview.ts app/src/data/institutional-preview.test.ts app/src/components/InstitutionalPreviewBar.tsx app/src/components/institutional-preview-bar.test.tsx app/src/App.tsx
git commit -m "Add synthetic institutional preview personas"
```

## Task 7: Make the local preview one command and browser-verifiable

**Files:**

- Create: `app/scripts/institutional-preview.mjs`
- Create: `app/scripts/institutional-preview.test.ts`
- Create: `app/scripts/institutional-preview-smoke.mjs`
- Modify: `app/package.json`
- Create: `docs/institutional-rollout/local-preview.md`

- [ ] **Step 1: Write a failing command-construction test**

Test that the launcher sets `VITE_INSTITUTIONAL_PREVIEW=true`, binds only to `127.0.0.1` by default, accepts a validated numeric port, forwards termination signals, and prints the exact preview URL without printing environment values.

- [ ] **Step 2: Implement the launcher**

Use `node:child_process.spawn` with argument arrays, not shell concatenation. Default to port `4179`. Refuse non-loopback hosts unless the operator explicitly passes `--host` and the documentation states the exposure.

- [ ] **Step 3: Add scripts**

```json
"preview:institutional": "node scripts/institutional-preview.mjs",
"smoke:institutional": "node scripts/institutional-preview-smoke.mjs"
```

- [ ] **Step 4: Implement built-bundle smoke coverage**

The smoke script opens at least:

- `#/search` at 1440×1000;
- `#/calendar` at 390×844;
- `#/ask` at 1440×1000;
- `#/mail` at 390×844;
- one current destination in every workspace.

Assert no uncaught console errors, the five-primary navigation exists, every URL resolves to the expected existing screen, and the `Synthetic preview` disclosure is visible.

- [ ] **Step 5: Document start, restart, and stop**

`local-preview.md` must include:

```bash
cd app
npm ci
npm run preview:institutional
```

State that `Ctrl-C` stops the server, the preview is local only, and production deployment is a separate approval.

- [ ] **Step 6: Run focused tests and smoke**

Run:

```bash
cd app
npx vitest run scripts/institutional-preview.test.ts
VITE_INSTITUTIONAL_PREVIEW=true npm run build
npm run smoke:institutional
```

Expected: all commands PASS.

- [ ] **Step 7: Commit**

```bash
git add app/scripts/institutional-preview.mjs app/scripts/institutional-preview.test.ts app/scripts/institutional-preview-smoke.mjs app/package.json docs/institutional-rollout/local-preview.md
git commit -m "Add one-command institutional preview"
```

## Task 8: Build the 17-document publication source set and Claude Code packets

**Files:**

- Create: `app/scripts/rollout-artifacts.mjs`
- Create: `app/scripts/rollout-artifacts.test.ts`
- Create: `docs/institutional-rollout/publication-manifest.json`
- Create generated directory: `docs/institutional-rollout/generated/publication/`
- Create generated directory: `docs/institutional-rollout/generated/claude-code/`

- [ ] **Step 1: Write a failing manifest test**

Require these exact 17 slugs:

```ts
[
  'master-specification', 'executive-institutional-brief', 'current-product-live-site-audit',
  'capability-disposition-matrix', 'canonical-data-model-permissions',
  'product-systems-user-journeys', 'ai-governance-automation', 'integration-architecture',
  'security-privacy-compliance', 'accessibility-conformance-plan',
  'migration-rollback-disaster-recovery', 'testing-verification-plan',
  'pilot-institutional-rollout-runbook', 'procurement-security-review-package',
  'claude-code-execution-guide', 'requirements-traceability-source-index',
  'decisions-risks-external-blockers',
]
```

Each entry must include title, source sections, output filename, owner, verification date, and generation status.

- [ ] **Step 2: Implement deterministic Markdown generation**

Generate documents from the approved spec, capability registry, traceability index, census, and schema map. Do not copy stale status counts from older audits; cite them as historical snapshots or recalculate them.

- [ ] **Step 3: Generate nine ordered Claude Code packets**

Create `00-baseline-foundation.md` through `08-institutional-rollout.md`. Every packet must include objective, outcomes, requirement IDs, dependencies, exact repository areas, security/privacy/accessibility constraints, tests-first steps, verification commands, migration/rollback requirements, definition of complete, evidence return format, and the stop conditions from §16 of the approved spec.

- [ ] **Step 4: Add no-placeholder validation**

Fail generation if any output contains `TBD`, `TODO`, `TK`, `coming soon`, `implement later`, or an empty source section. The words may appear only in a quoted historical source and must be escaped from the validator with an explicit citation marker.

- [ ] **Step 5: Generate and inspect**

Run: `cd app && node scripts/rollout-artifacts.mjs`

Expected: 17 publication Markdown files and 9 execution packets, all listed in the manifest with SHA-256 hashes.

- [ ] **Step 6: Mutation-check and pass**

Remove one required slug from a temporary manifest fixture and observe the test fail; restore it and rerun.

- [ ] **Step 7: Commit**

```bash
git add app/scripts/rollout-artifacts.mjs app/scripts/rollout-artifacts.test.ts docs/institutional-rollout/publication-manifest.json docs/institutional-rollout/generated/publication docs/institutional-rollout/generated/claude-code
git commit -m "Generate institutional rollout publication sources"
```

## Task 9: Produce and validate the PDF and editable documents

**Files:**

- Create: `app/scripts/rollout-publication.test.ts`
- Create user outputs: `/Users/harrisonrubin/Documents/Codex/2026-09-23/ana/outputs/semester-institutional-rollout/Semester-Institutional-Rollout-Master.pdf`
- Create user outputs: `/Users/harrisonrubin/Documents/Codex/2026-09-23/ana/outputs/semester-institutional-rollout/*.docx`
- Create user output: `/Users/harrisonrubin/Documents/Codex/2026-09-23/ana/outputs/semester-institutional-rollout/publication-validation.json`

- [ ] **Step 1: Load the bundled workspace document dependencies**

Use `mcp__codex_app__load_workspace_dependencies` during execution. Follow the `documents` and `pdf` skills completely. Record the selected runtime and library versions in `publication-validation.json`.

- [ ] **Step 2: Write the failing publication validation test**

The test accepts an artifact directory argument and verifies:

- the master PDF exists and has at least 17 top-level sections;
- all 17 editable documents exist;
- every artifact hash matches the manifest;
- extracted text includes the 60 capability IDs;
- no page is blank;
- headings, links, tables, page numbers, and appendix labels survive conversion.

- [ ] **Step 3: Build the DOCX set**

Convert each generated Markdown source to a styled DOCX with Semester title page, document title, version date, source/evidence footer, accessible heading hierarchy, table headers, alt text for meaningful diagrams, and no decorative image dependence.

- [ ] **Step 4: Build the primary PDF**

Combine the program into one navigable PDF with title page, executive summary, clickable table of contents, the 17 document sections, capability matrix, traceability appendix, verification appendix, decisions/risks/blockers, and page numbers.

- [ ] **Step 5: Reopen and render every PDF page**

Use the PDF skill to reopen the saved file, extract text, render every page to images, and inspect for clipping, missing glyphs, unreadable tables, blank pages, orphan headings, and broken links. Fix and rebuild until all checks pass.

- [ ] **Step 6: Run validation**

Run: `cd app && npx vitest run scripts/rollout-publication.test.ts -- /Users/harrisonrubin/Documents/Codex/2026-09-23/ana/outputs/semester-institutional-rollout`

Expected: PASS and `publication-validation.json` records page count, artifact count, hashes, and visual-inspection result.

- [ ] **Step 7: Commit only source and tests**

Do not commit user-facing binary outputs unless repository policy explicitly requests it.

```bash
git add app/scripts/rollout-publication.test.ts docs/institutional-rollout/publication-manifest.json
git commit -m "Add rollout publication validation"
```

## Task 10: Publish to Google Drive and verify the round trip

**Files:**

- Create user output: `/Users/harrisonrubin/Documents/Codex/2026-09-23/ana/outputs/semester-institutional-rollout/drive-publication-receipt.md`
- Update user output: `/Users/harrisonrubin/Documents/Codex/2026-09-23/ana/outputs/semester-institutional-rollout/publication-validation.json`

- [ ] **Step 1: Resolve the existing Semester folder by ID**

Use the Google Drive skill and connector. Search by folder name, then inspect parent paths and existing contents. If multiple Semester folders remain ambiguous, stop before writing and ask the owner to choose the exact folder.

- [ ] **Step 2: Create one additive child folder**

Create `Semester - Institutional Rollout` inside the resolved Semester folder. Do not delete, overwrite, move, or rename existing documents.

- [ ] **Step 3: Import the editable documents and upload the PDF**

Create/import all 17 documents using the titles from the publication manifest. Upload the primary PDF. Preserve the local filenames in the receipt.

- [ ] **Step 4: Read every Drive document back**

For every imported item, retrieve metadata and a content sample. Verify the title, parent folder ID, expected section headings, and a unique document marker. Record Drive file IDs, URLs, modified times, and local hashes.

- [ ] **Step 5: Check duplicates without deleting them**

List same-title files in the folder. Record duplicates in the receipt with their IDs and dates. Do not remove them.

- [ ] **Step 6: Complete the receipt**

`drive-publication-receipt.md` must state the resolved parent ID, created child ID, all 18 published artifacts, read-back result, duplicates found, and any connector limitations. A failed or unreadable upload remains `failed`; do not describe it as published.

## Task 11: Run the full verification and inspect the preview

**Files:**

- Create: `docs/institutional-rollout/generated/verification-report.md`
- Update: `docs/institutional-rollout/publication-manifest.json`

- [ ] **Step 1: Rebase-aware duplicate audit**

Run:

```bash
git fetch origin main
git log --oneline HEAD..origin/main
git diff --stat HEAD...origin/main
rg -n "institutional preview|rollout-capabilities|Northstar University|Cedar Coast College" app docs supabase
```

If equivalent work landed, reconcile rather than duplicate it.

- [ ] **Step 2: Run the required repository gates from `app/`**

```bash
npx tsc -b --noEmit
npm run check:university
npm run lint
npm test
npm run test:zones
npm run test:shuffle
VITE_INSTITUTIONAL_PREVIEW=true npm run build
npm run smoke:institutional
```

Expected: PASS. Record command, timestamp, duration, and result. Do not replace failures with prose.

- [ ] **Step 3: Run existing UI sweeps**

Run the relevant existing contrast, target, wall, and cold-route checks according to their documented prerequisites. Record any check that cannot run and why.

- [ ] **Step 4: Inspect desktop and mobile in Codex**

Start `npm run preview:institutional`, open the local URL in Codex, and inspect:

- all five primary destinations;
- all seven workspaces;
- both synthetic institutions;
- all eight representative roles;
- keyboard traversal and visible focus;
- narrow-phone overflow;
- wide desktop hierarchy;
- truthful sandbox/disconnected labels;
- direct hash navigation to existing routes.

Capture screenshots for Home, Discover, Ask Semester, Inbox, Calendar, a student context, and an admin context. Save them under the user-facing output directory.

- [ ] **Step 5: Run a production-default comparison**

Build once without `VITE_INSTITUTIONAL_PREVIEW`. Verify the institutional preview bar and new nav are absent and the current route smoke remains green.

- [ ] **Step 6: Write the verification report**

Separate:

- verified locally;
- verified in the built browser bundle;
- verified in Google Drive;
- verified on the public live site;
- not production-deployed;
- external credentials/agreements still required.

- [ ] **Step 7: Commit**

```bash
git add docs/institutional-rollout/generated/verification-report.md docs/institutional-rollout/publication-manifest.json
git commit -m "Record institutional baseline verification"
```

## Task 12: Final plan conformance and handoff

**Files:**

- Modify: `docs/institutional-rollout/generated/verification-report.md`
- Create user output: `/Users/harrisonrubin/Documents/Codex/2026-09-23/ana/outputs/semester-institutional-rollout/claude-code-handoff.zip`

- [ ] **Step 1: Audit this plan against the approved specification**

Check every bullet in spec §§13–18. Record its owning task, artifact, and evidence. Nothing may be marked `complete` merely because it appears in a later phase.

- [ ] **Step 2: Scan outputs for placeholders and false completion language**

Run:

```bash
rg -n "TBD|TODO|TK|coming soon|fully deployed|production ready" docs/institutional-rollout/generated
```

Expected: no unreviewed placeholders and no production claim without production evidence.

- [ ] **Step 3: Package the Claude Code handoff**

Include the approved spec, this plan, all nine execution packets, capability registry export, traceability index, schema map, verification report, and a manifest with SHA-256 hashes. Exclude `.env*`, tokens, local databases, `node_modules`, and user data.

- [ ] **Step 4: Verify the archive**

List and extract the archive into a temporary directory, verify every manifest hash, and confirm the nine packets sort in execution order.

- [ ] **Step 5: Run final status and log checks**

```bash
git status --short
git log --oneline --decorate -15
```

Expected: only intentional ignored/user-output artifacts remain outside Git; every task commit is visible.

- [ ] **Step 6: Present the preview and artifacts without deploying production**

Open the local preview, the master PDF, the Drive folder, and the branch review in Codex. State explicitly that production deployment requires a separate approved release action after later subsystem plans and institutional gates are complete.

---

## Completion Boundary

This plan completes the approved design's first implementation boundary: Phase 0 evidence, the mapped and probed portion of Phase 1, the flagged local preview shell, and reproducible publication/Drive/Claude Code delivery. It does not claim that Phases 2–8 are implemented. Their requirements remain present in the 60-capability registry and ordered execution packets, and each will receive a subsystem implementation plan after this baseline proves the architecture, evidence, preview, and verification machinery on which those builds depend.
