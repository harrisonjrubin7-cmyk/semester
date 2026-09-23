# Semester Intelligence Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing Semester application with provider-neutral intelligence, journey navigation, adaptive learning, a career and skills graph, policy-controlled multimodal capture, and a university control plane without replacing any current route or capability.

**Architecture:** Add one shared set of evidence, context, policy, feature-state and proposed-action contracts, then attach each new capability to the current screen and registry that already owns the workflow. All new experiences are tenant-aware, feature-gated and truthful when an external provider is unavailable; the default build and existing stored navigation continue to work unchanged.

**Tech Stack:** React 19, TypeScript 7, Vitest, Vite, Supabase Postgres 17/RLS/Edge Functions, the existing institution gateway, local device persistence and Playwright-compatible browser smoke scripts.

**Spec:** `docs/superpowers/specs/2026-09-23-semester-intelligence-expansion-design.md`

## Global Constraints

- Keep the current `App` root, shell, route identifiers, destination registry, tokens, tabs, bookmarks, search and app directory.
- Preserve the existing `#/ask` deep link and every current `Screen` union member.
- No new runtime dependency unless the repository already contains no equivalent and the owner approves it.
- Essential planning, study, career and governance inspection must work without AI.
- A client feature flag controls discovery only; server and database authorization remain authoritative.
- Missing provider credentials render **Awaiting institution authorization**, never simulated success.
- Course, career, capture and control-plane records include tenant and person scope wherever they persist.
- Model-generated citation text is not trusted; citations render from application-owned evidence records.
- Consequential actions always require explicit confirmation and authoritative readback.
- Reuse the current visual language; do not introduce a dashboard theme or second token system.
- Tests are written and observed failing before production code for every task.
- Use `apply_patch` for source edits and commit each completed task independently.

## Review Focus

- A user switches from Northstar to Cedar Coast while an Intelligence panel is open: old context, citations, actions and drafts must disappear before the new tenant can ask or act. Covered in Tasks 3 and 12.
- A course or tenant forbids Draft mode after a conversation began: the next request must use the newly effective mode and explain the restriction. Covered in Tasks 1 and 3.
- A recording permission changes or consent is withdrawn during processing: processing stops, derived outputs remain unavailable and the original follows the applicable retention rule. Covered in Tasks 8 and 10.
- An opportunity or course source becomes stale or is removed: fit, readiness and recommendations must disclose missing evidence instead of retaining a confident result. Covered in Tasks 6 and 7.
- A production feature flag is enabled in the client while server authorization is absent: the UI may be discoverable but every protected read and mutation must remain denied. Covered in Tasks 2, 9 and 10.

---

### Task 1: Shared feature, evidence, context and policy contracts

**Files:**
- Create: `app/src/lib/experience-flags.ts`
- Create: `app/src/lib/experience-flags.test.ts`
- Create: `app/src/intelligence/contracts.ts`
- Create: `app/src/intelligence/contracts.test.ts`
- Modify: `app/src/lib/institutional-preview.ts`

**Interfaces:**
- Consumes: `institutionalPreview(env: Record<string, string | undefined>): boolean`.
- Produces: `experienceFlags(env): ExperienceFlags`, `effectiveIntegrityMode(requested, policy): IntegrityDecision`, `scopeKey(scope): string`, and the shared `EvidenceReference`, `ContextEnvelope`, `ProposedAction`, `IntelligenceResponse`, `FeatureState` and `IntegrityMode` types.

- [ ] **Step 1: Write the failing contract tests**

```ts
import { describe, expect, it } from 'vitest';
import { experienceFlags } from './experience-flags';
import { effectiveIntegrityMode, scopeKey } from '../intelligence/contracts';

describe('experience feature states', () => {
  it('keeps every addition off unless the institutional preview or an exact feature value enables it', () => {
    expect(experienceFlags({}).journeyNavigation).toBe('off');
    expect(experienceFlags({ VITE_INSTITUTIONAL_PREVIEW: 'true' }).journeyNavigation).toBe('preview');
    expect(experienceFlags({ VITE_SEMESTER_INTELLIGENCE: 'sandbox' }).semesterIntelligence).toBe('sandbox');
    expect(experienceFlags({ VITE_SEMESTER_INTELLIGENCE: 'TRUE' }).semesterIntelligence).toBe('off');
  });
});

describe('intelligence policy contracts', () => {
  it('falls back from a forbidden Draft to the first permitted learning mode and says why', () => {
    expect(effectiveIntegrityMode('draft', { allowed: ['hint', 'review'], reason: 'Course policy' })).toEqual({
      requested: 'draft', effective: 'hint', restricted: true, reason: 'Course policy',
    });
  });

  it('keys context by tenant, role, person and resource', () => {
    expect(scopeKey({ tenantId: 'northstar', role: 'student', personId: 'nora', resourceId: 'econ' }))
      .toBe('northstar:student:nora:econ');
  });
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `cd app && pnpm exec vitest run src/lib/experience-flags.test.ts src/intelligence/contracts.test.ts`

Expected: FAIL because the two modules do not exist.

- [ ] **Step 3: Add the exact shared types and pure rules**

```ts
export type FeatureState = 'off' | 'preview' | 'sandbox' | 'production';
export type IntegrityMode = 'explain' | 'hint' | 'practice' | 'review' | 'draft';
export type SourceOrigin = 'course' | 'institution' | 'student' | 'web' | 'inference';

export interface Scope {
  tenantId: string;
  role: string;
  personId: string;
  resourceId?: string;
}

export interface EvidenceReference {
  id: string;
  sourceId: string;
  origin: SourceOrigin;
  title: string;
  locator: string;
  excerpt: string;
  verifiedAt: string;
  authority: 'authoritative' | 'confirmed' | 'unverified' | 'inferred';
  scope: Scope;
  confidence?: number;
}

export interface ContextEnvelope {
  scope: Scope;
  screen: string;
  courseId?: string;
  assignmentId?: string;
  deadlineId?: string;
  sourceIds: string[];
  evidenceIds: string[];
  policyId: string;
  consentIds: string[];
  integrityMode: IntegrityMode;
  timezone: string;
  assembledAt: string;
}

export interface ProposedAction {
  id: string;
  label: string;
  effect: string;
  target: string;
  before: unknown;
  after: unknown;
  evidenceIds: string[];
  class: 'prepare' | 'internal-write' | 'consequential';
  reversible: boolean;
  status: 'proposed' | 'confirmed' | 'applied' | 'failed' | 'dismissed';
  receipt?: string;
}

export interface IntelligenceResponse {
  text: string;
  evidence: EvidenceReference[];
  informationUsed: string[];
  origins: SourceOrigin[];
  mode: IntegrityMode;
  policyReason?: string;
  uncertainty?: string;
  actions: ProposedAction[];
}
```

Implement `experienceFlags` with exact-string parsing and make `INSTITUTIONAL_PREVIEW` feed preview defaults without changing its existing export.

- [ ] **Step 4: Run focused and adjacent tests**

Run: `cd app && pnpm exec vitest run src/lib/experience-flags.test.ts src/intelligence/contracts.test.ts src/lib/institutional-preview.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/experience-flags.ts app/src/lib/experience-flags.test.ts app/src/intelligence/contracts.ts app/src/intelligence/contracts.test.ts app/src/lib/institutional-preview.ts
git commit -m "Add shared Semester experience contracts"
```

### Task 2: Tenant policy persistence and database enforcement

**Files:**
- Create: `supabase/migrations/20260923210000_intelligence_policy.sql`
- Create: `supabase/intelligence-policy.check.sql`
- Modify: `supabase/institutional-foundation.check.sql`
- Modify: `MIGRATION-HISTORY.md`

**Interfaces:**
- Consumes: existing university, organization, role-grant, capability and audit-event tables.
- Produces: `public.tenant_feature_policy`, `public.ai_policy`, `public.approved_source`, `public.consent_record`, and the security-definer-free read functions `feature_state(text, text)` and `effective_ai_policy(text, uuid)`.

- [ ] **Step 1: Write the failing SQL policy suite**

Define the same `pg_temp.become`, `pg_temp.counted` and `pg_temp.refused` helpers used by `supabase/institutional-foundation.check.sql`, add fixtures for two schools and assert:

```sql
perform pg_temp.become(northstar_admin);
insert into public.tenant_feature_policy
  (tenant_id, capability, state, permitted_roles, updated_by)
values
  ('northstar-check', 'semester_intelligence', 'sandbox', array['student'], northstar_admin);
reset role;

perform pg_temp.become(cedar_user);
select count(*) into n
  from public.tenant_feature_policy
 where tenant_id = 'northstar-check';
reset role;
perform pg_temp.counted('another tenant cannot read policy', n, 0);

if not pg_temp.refused(
  northstar_student,
  format(
    'insert into public.approved_source '
    '(tenant_id, course_id, title, origin, authority, created_by) '
    'values (%L, %L, %L, %L, %L, %L)',
    'northstar-check', 'econ', 'Counterfeit syllabus',
    'course', 'authoritative', northstar_student
  )
) then
  raise exception 'FAILED: a student made a source authoritative';
end if;
```

Also assert that a client-provided production flag grants no row access without a verified role grant.

- [ ] **Step 2: Run the targeted database check and verify RED**

Run: `./supabase/check.sh intelligence-policy`

Expected: FAIL because the migration and policy tables do not exist. If PostgreSQL 17 is unavailable, install or select the repository-required Postgres 17 server before continuing; do not substitute another major.

- [ ] **Step 3: Implement schema, constraints and RLS**

Use constrained states:

```sql
do $$ begin
  create type public.feature_state as enum ('off', 'preview', 'sandbox', 'production');
exception when duplicate_object then null;
end $$;

alter table public.role_grants
  drop constraint if exists role_grants_scope_kind_check;
alter table public.role_grants
  add constraint role_grants_scope_kind_check check (scope_kind in (
    'platform', 'school', 'organization', 'course', 'department',
    'office', 'residence', 'business', 'employer'
  ));

insert into public.app_capabilities (capability, about) values
  ('tenant:configure', 'Change one university tenant configuration.'),
  ('ai:configure', 'Change one university tenant AI policy and budget.'),
  ('source:approve', 'Approve course sources for one university tenant.'),
  ('audit:read', 'Read configuration and access audit events for one university tenant.'),
  ('support:read', 'Inspect explainable support signals for one university tenant.')
on conflict (capability) do nothing;

insert into public.role_capabilities (role, capability) values
  ('university_admin', 'tenant:configure'),
  ('university_admin', 'ai:configure'),
  ('university_admin', 'source:approve'),
  ('university_admin', 'audit:read'),
  ('university_staff', 'support:read')
on conflict (role, capability) do nothing;

create table if not exists public.tenant_feature_policy (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.schools(id) on delete cascade,
  capability text not null,
  state public.feature_state not null default 'off',
  permitted_roles text[] not null default '{}',
  reason text not null default '',
  effective_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  unique (tenant_id, capability)
);
```

Create equivalent tenant-scoped policies for AI policy, approved sources and consent records. Authorize changes with `private.has_capability(..., 'school', tenant_id)` and verified `role_grants`; do not authorize from email domain, request body or client flag. Audit inserts and updates with old/new JSON and actor grant.

- [ ] **Step 4: Run database suites**

Run: `./supabase/check.sh intelligence-policy`

Expected: PASS with cross-tenant read/write refusal and same-tenant authorized administration.

Run: `./supabase/check.sh institutional-foundation`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260923210000_intelligence_policy.sql supabase/intelligence-policy.check.sql supabase/institutional-foundation.check.sql MIGRATION-HISTORY.md
git commit -m "Enforce tenant intelligence policy"
```

### Task 3: Provider-neutral Semester Intelligence request assembly

**Files:**
- Create: `app/src/intelligence/assemble.ts`
- Create: `app/src/intelligence/assemble.test.ts`
- Create: `app/src/intelligence/session.ts`
- Create: `app/src/intelligence/session.test.ts`
- Modify: `app/src/ai/assemble.ts`
- Modify: `app/src/ai/converse.ts`
- Modify: `app/src/ai/store.tsx`

**Interfaces:**
- Consumes: Task 1 contracts, existing `providerFor(screen)` output, current store context and existing provider adapters.
- Produces: `assembleIntelligenceRequest(input): IntelligenceRequest`, `IntelligenceSessionScope`, and `sameSessionScope(a, b): boolean`.

- [ ] **Step 1: Write failing tests for minimal disclosure and context invalidation**

```ts
it('sends only evidence selected by the active screen provider', () => {
  const request = assembleIntelligenceRequest(fixture({ visibleSourceIds: ['syllabus-1'] }));
  expect(request.context.sourceIds).toEqual(['syllabus-1']);
  expect(JSON.stringify(request)).not.toContain('private-family-note');
});

it('invalidates a conversation context when tenant or person changes', () => {
  expect(sameSessionScope(
    { tenantId: 'northstar', role: 'student', personId: 'nora' },
    { tenantId: 'cedar', role: 'student', personId: 'nora' },
  )).toBe(false);
});

it('re-evaluates integrity policy for every request', () => {
  const request = assembleIntelligenceRequest(fixture({ requestedMode: 'draft', allowedModes: ['hint'] }));
  expect(request.context.integrityMode).toBe('hint');
  expect(request.policyDecision.restricted).toBe(true);
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `cd app && pnpm exec vitest run src/intelligence/assemble.test.ts src/intelligence/session.test.ts`

Expected: FAIL because the request assembler does not exist.

- [ ] **Step 3: Implement the adapter boundary**

Define:

```ts
export interface IntelligenceRequest {
  question: string;
  context: ContextEnvelope;
  evidence: EvidenceReference[];
  policyDecision: IntegrityDecision;
  providerRoute: 'managed' | 'anthropic' | 'openai' | 'local' | 'unavailable';
}
```

Make existing `ai/assemble.ts` provide screen-visible data to this boundary. Keep `lib/claude.ts` and `lib/openai.ts` as provider adapters; do not rename internal files merely for branding. Clear transient read context, citations and pending actions when `sameSessionScope` becomes false.

- [ ] **Step 4: Run focused and existing assistant tests**

Run: `cd app && pnpm exec vitest run src/intelligence src/ai/providers src/ai/prompt.test.ts src/ai/split.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/intelligence app/src/ai/assemble.ts app/src/ai/converse.ts app/src/ai/store.tsx
git commit -m "Route assistant context through Semester Intelligence"
```

### Task 4: Semester Intelligence identity, modes and response disclosure

**Files:**
- Create: `app/src/intelligence/Disclosure.tsx`
- Create: `app/src/intelligence/Disclosure.test.tsx`
- Create: `app/src/intelligence/ModePicker.tsx`
- Create: `app/src/intelligence/ModePicker.test.tsx`
- Create: `app/src/intelligence/branding.test.ts`
- Modify: `app/src/ai/Turns.tsx`
- Modify: `app/src/ai/Chat.tsx`
- Modify: `app/src/ai/Panel.tsx`
- Modify: `app/src/lib/nav.ts`
- Modify: `app/src/lib/softtop.ts`
- Modify: `app/src/components/Command.tsx`
- Modify: `app/src/screens/Connect.tsx`
- Modify: `app/src/screens/settings/Assistant.tsx`
- Modify: `app/src/components/mail/Compose.tsx`

**Interfaces:**
- Consumes: `IntelligenceResponse`, `IntegrityMode`, and `effectiveIntegrityMode` from Tasks 1 and 3.
- Produces: `<IntelligenceDisclosure response />` and `<IntegrityModePicker requested policy onChange />`.

- [ ] **Step 1: Write failing disclosure and branding tests**

```tsx
it('shows exact source locators, information used, origin and mode', () => {
  render(<IntelligenceDisclosure response={responseFixture()} />);
  expect(screen.getByText('Syllabus · p. 4')).toBeVisible();
  expect(screen.getByText('Course material')).toBeVisible();
  expect(screen.getByText('Information Semester used')).toBeVisible();
  expect(screen.getByText('Hint mode')).toBeVisible();
});

it('does not allow a restricted mode to remain effective', async () => {
  render(<IntegrityModePicker requested="draft" policy={{ allowed: ['hint'], reason: 'Course policy' }} onChange={change} />);
  expect(screen.getByRole('button', { name: 'Draft' })).toHaveAttribute('aria-disabled', 'true');
  expect(screen.getByText('Course policy')).toBeVisible();
});
```

The branding test reads user-facing source files and permits “Claude” only in provider selection, billing/help text and provider-specific diagnostics. It requires navigation, commands and conversation headings to say `Ask Semester` or `Semester Intelligence`.

- [ ] **Step 2: Run tests and verify RED**

Run: `cd app && pnpm exec vitest run src/intelligence/Disclosure.test.tsx src/intelligence/ModePicker.test.tsx src/intelligence/branding.test.ts`

Expected: FAIL because the components do not exist and current navigation says Ask Claude.

- [ ] **Step 3: Implement disclosure and mode controls**

Render citations as application-owned links/buttons keyed by `EvidenceReference.id`. Render information-used disclosure collapsed by default but keyboard reachable. Put mode selection beside the composer in both full-screen Chat and the global Panel. Show proposed actions only through the current confirmation components; do not add a direct execution path.

Change user-facing naming while keeping `screen: 'ask'`, `#/ask`, existing history and provider configuration.

- [ ] **Step 4: Run assistant, navigation and accessibility tests**

Run: `cd app && pnpm exec vitest run src/intelligence src/ai src/lib/nav.test.ts src/lib/tabbar.test.ts src/a11y`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/intelligence app/src/ai/Turns.tsx app/src/ai/Chat.tsx app/src/ai/Panel.tsx app/src/lib/nav.ts app/src/lib/softtop.ts app/src/components/Command.tsx app/src/screens/Connect.tsx app/src/screens/settings/Assistant.tsx app/src/components/mail/Compose.tsx
git commit -m "Present governed Semester Intelligence"
```

### Task 5: Journey registry and journey-first discovery

**Files:**
- Create: `app/src/lib/journeys.ts`
- Create: `app/src/lib/journeys.test.ts`
- Create: `app/src/components/JourneyCards.tsx`
- Create: `app/src/components/JourneyCards.test.tsx`
- Modify: `app/src/screens/Directory.tsx`
- Modify: `app/src/screens/Today.tsx`
- Modify: `app/src/lib/desk.ts`
- Modify: `app/src/components/Command.tsx`
- Modify: `app/src/styles/app.css`

**Interfaces:**
- Consumes: existing `Destination`, `Screen`, `allApps`, search scoring, current deadlines and study evidence.
- Produces: `JOURNEYS`, `journeysFor(destinations)`, `recommendJourney(input)`, `searchJourneys(query)`, and `<JourneyCards>`.

- [ ] **Step 1: Write failing registry and rendering tests**

```ts
it('maps every journey only to registered screens and preserves all offered destinations', () => {
  const beforeJourneyCount = allApps(caps, 'student').length;
  const result = journeysFor(DESTINATIONS);
  expect(result.map((j) => j.id)).toEqual([
    'start-semester', 'plan-today', 'learn-practice', 'complete-assignment', 'work-with-people', 'prepare-next',
  ]);
  expect(new Set(result.flatMap((j) => j.screens)).size).toBeGreaterThan(0);
  expect(allApps(caps, 'student')).toHaveLength(beforeJourneyCount);
});

it('ranks plan today from a confirmed deadline without hiding the other journeys', () => {
  const ranked = recommendJourney({ confirmedDueSoon: 2, setupIncomplete: false, reviewDue: 0, collaborationDue: 0, careerDue: 0 });
  expect(ranked[0].id).toBe('plan-today');
  expect(ranked).toHaveLength(6);
});
```

Render tests assert a visible **All tools** control, unchanged app count, keyboard-operable cards and no duplicate `<main>` or page heading.

- [ ] **Step 2: Run tests and verify RED**

Run: `cd app && pnpm exec vitest run src/lib/journeys.test.ts src/components/JourneyCards.test.tsx`

Expected: FAIL because the registry and component do not exist.

- [ ] **Step 3: Implement journeys as references to existing screens**

Define the exact ids and labels from the spec. Each journey contains ordered `Screen[]`, a short outcome sentence and search aliases. Directory defaults to journey cards plus existing favorites/recent sections; **All tools** reveals the unchanged catalog. A query searches journeys and apps together. Today shows one recommendation and its deterministic reason.

- [ ] **Step 4: Run directory, search, navigation and structural tests**

Run: `cd app && pnpm exec vitest run src/lib/journeys.test.ts src/components/JourneyCards.test.tsx src/lib/desk.test.ts src/screens/directory.test.tsx src/a11y/landmarks.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/journeys.ts app/src/lib/journeys.test.ts app/src/components/JourneyCards.tsx app/src/components/JourneyCards.test.tsx app/src/screens/Directory.tsx app/src/screens/Today.tsx app/src/lib/desk.ts app/src/components/Command.tsx app/src/styles/app.css
git commit -m "Organize Semester around student journeys"
```

### Task 6: Adaptive course learning loop

**Files:**
- Create: `app/src/lib/learning-loop.ts`
- Create: `app/src/lib/learning-loop.test.ts`
- Create: `app/src/components/MasteryGraph.tsx`
- Create: `app/src/components/MasteryGraph.test.tsx`
- Modify: `app/src/lib/nextstep.ts`
- Modify: `app/src/components/StudyStudio.tsx`
- Modify: `app/src/screens/Study.tsx`
- Modify: `app/src/components/StudyJournal.tsx`

**Interfaces:**
- Consumes: existing guide units, card history, `Knowing`, due-card calculations, tests, teach-back and mistake-journal records.
- Produces: `initialDiagnostic(concepts, answers): DiagnosticResult`, `learningState(input): ConceptState[]`, `classifyMistake(input): MistakeSuggestion`, `readinessForecast(input): ReadinessForecast`, and `recommendLearningActivity(input): LearningRecommendation`.

- [ ] **Step 1: Write failing learning-loop tests**

```ts
it('keeps unobserved concepts unmeasured rather than inheriting an authored percentage', () => {
  const [concept] = learningState(fixture({ attempts: [] }));
  expect(concept.state).toBe('unseen');
  expect(concept.confidence).toBeNull();
  expect(concept.evidence).toEqual([]);
});

it('uses an initial diagnostic as evidence without turning it into a grade', () => {
  const result = initialDiagnostic(conceptsFixture(), diagnosticAnswersFixture());
  expect(result.concepts[0].state).toBe('introduced');
  expect(result.concepts[0].evidence[0].kind).toBe('diagnostic');
  expect(result).not.toHaveProperty('grade');
});

it('explains a recommendation from due retrieval and a recurring procedure error', () => {
  const next = recommendLearningActivity(fixture({ due: 4, recurringMistake: 'procedure-error' }));
  expect(next.activity).toBe('cards');
  expect(next.evidence.map((e) => e.kind)).toEqual(expect.arrayContaining(['due-retrieval', 'mistake']));
});

it('widens readiness when a source is stale or evidence coverage is sparse', () => {
  expect(readinessForecast(fixture({ stale: true, coverage: 0.2 })).range).toEqual([20, 55]);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `cd app && pnpm exec vitest run src/lib/learning-loop.test.ts src/components/MasteryGraph.test.tsx`

Expected: FAIL because the learning loop does not exist.

- [ ] **Step 3: Implement pure evidence calculations and accessible graph**

Use the five states from the spec. The first course visit may offer a short source-linked diagnostic; skipping it leaves concepts Unseen. Return `confidence: null` when evidence is insufficient. The graph renders state, evidence count and next review as text as well as visuals. Integrate the recommendation above Study's existing eleven formats; keep every format under the existing All ways control. Add mistake suggestions to the journal as confirmable classifications.

- [ ] **Step 4: Run study and evidence suites**

Run: `cd app && pnpm exec vitest run src/lib/learning-loop.test.ts src/components/MasteryGraph.test.tsx src/lib/nextstep.test.ts src/components/StudyStudio.test.tsx src/screens/studyhierarchy.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/learning-loop.ts app/src/lib/learning-loop.test.ts app/src/components/MasteryGraph.tsx app/src/components/MasteryGraph.test.tsx app/src/lib/nextstep.ts app/src/components/StudyStudio.tsx app/src/screens/Study.tsx app/src/components/StudyJournal.tsx
git commit -m "Connect study tools into an adaptive loop"
```

### Task 7: Career skills graph and explainable opportunity fit

**Files:**
- Create: `app/src/lib/skills-graph.ts`
- Create: `app/src/lib/skills-graph.test.ts`
- Create: `app/src/components/SkillsGraph.tsx`
- Create: `app/src/components/SkillsGraph.test.tsx`
- Modify: `app/src/lib/career.ts`
- Modify: `app/src/lib/apply.ts`
- Modify: `app/src/lib/apply.test.ts`
- Modify: `app/src/screens/Career.tsx`

**Interfaces:**
- Consumes: current career experiences, opportunities, courses, projects, organizations and application records.
- Produces: `deriveSkillClaims(input)`, `explainFit(opportunity, claims)`, `searchOpportunities(query, opportunities)`, `missingSkillPlan(fit)`, and `<SkillsGraph>`.

- [ ] **Step 1: Write failing provenance and fit tests**

```ts
it('never calls a derived skill verified', () => {
  const [claim] = deriveSkillClaims({ courses: [courseFixture()], projects: [], work: [], organizations: [] });
  expect(claim.verification).toBe('suggested');
  expect(claim.evidence[0].sourceId).toBe(courseFixture().id);
});

it('explains matches, gaps and stale evidence without a black-box percentage', () => {
  const fit = explainFit(opportunityFixture(), claimsFixture({ stale: ['sql'] }));
  expect(fit.matched).toContainEqual(expect.objectContaining({ skill: 'Research' }));
  expect(fit.missing).toContain('SQL');
  expect(fit.uncertainties.join(' ')).toContain('stale');
  expect(fit).not.toHaveProperty('score');
});

it('adds a tracked opportunity deadline through the existing application calendar path', () => {
  const application = opportunityApplication(opportunityFixture());
  const [item] = asItems([application], new Date(2026, 8, 23));
  expect(item.source).toBe('applications');
  expect(application.stage).toBe('Interested');
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `cd app && pnpm exec vitest run src/lib/skills-graph.test.ts src/components/SkillsGraph.test.tsx`

Expected: FAIL because the graph does not exist.

- [ ] **Step 3: Implement the graph and Career integration**

Add stable claim ids, verification states and evidence links. Add natural-language token matching over authorized local/sandbox opportunities. Career gains Skills, Fit, Plan, Portfolio and Practice sections inside its existing screen; it continues to use the existing Applications destination rather than embedding another tracker. Mentor, alumni and career-center introductions produce requests or drafts, not connection success.

- [ ] **Step 4: Run career, calendar and route-home tests**

Run: `cd app && pnpm exec vitest run src/lib/skills-graph.test.ts src/components/SkillsGraph.test.tsx src/lib/career.test.ts src/lib/apply.test.ts src/lib/onehome.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/skills-graph.ts app/src/lib/skills-graph.test.ts app/src/components/SkillsGraph.tsx app/src/components/SkillsGraph.test.tsx app/src/lib/career.ts app/src/lib/apply.ts app/src/lib/apply.test.ts app/src/screens/Career.tsx
git commit -m "Add an evidence-backed career skills graph"
```

### Task 8: Consent-controlled multimodal course capture

**Files:**
- Create: `app/src/lib/capture-policy.ts`
- Create: `app/src/lib/capture-policy.test.ts`
- Create: `app/src/lib/course-capture.ts`
- Create: `app/src/lib/course-capture.test.ts`
- Create: `app/src/components/CourseCapture.tsx`
- Create: `app/src/components/CourseCapture.test.tsx`
- Modify: `app/src/components/Capture.tsx`
- Modify: `app/src/screens/Update.tsx`
- Modify: `app/src/lib/transcribe.ts`

**Interfaces:**
- Consumes: approved-source, consent and AI policy from Tasks 1–2; existing image capture and transcription utilities.
- Produces: `effectiveCapturePolicy(input)`, `beginCapture(policy, consent)`, `deriveCaptureArtifacts(input)`, `answerFromCapture(question, capture)`, and `<CourseCapture>`.

- [ ] **Step 1: Write failing policy and provenance tests**

```ts
it('does not initialize recording when policy prohibits it', () => {
  expect(() => beginCapture({ recording: 'prohibited', modelProcessing: false }, consentFixture()))
    .toThrow('Recording is not permitted by this course or institution.');
});

it('stops processing after consent withdrawal and exposes no derived artifacts', () => {
  const result = deriveCaptureArtifacts(captureFixture({ consent: 'withdrawn' }));
  expect(result.status).toBe('blocked');
  expect(result.artifacts).toEqual([]);
});

it('links every extracted deadline to a transcript moment and leaves it unconfirmed', () => {
  const result = deriveCaptureArtifacts(captureFixture());
  expect(result.proposals[0]).toMatchObject({ locator: '00:14:22', confirmed: false });
});

it('answers about a video or diagram only from linked moments or regions', () => {
  const result = answerFromCapture('Why did the curve move?', captureFixture());
  expect(result.evidence).toEqual([
    expect.objectContaining({ sourceId: 'lecture-1', locator: '00:22:08' }),
    expect.objectContaining({ sourceId: 'diagram-1', locator: 'region:x120-y80-w340-h210' }),
  ]);
});
```

Component tests cover keyboard file selection, explicit consent, audio/video/image acceptance, denied states, progress announcements and removal of local originals.

- [ ] **Step 2: Run tests and verify RED**

Run: `cd app && pnpm exec vitest run src/lib/capture-policy.test.ts src/lib/course-capture.test.ts src/components/CourseCapture.test.tsx`

Expected: FAIL because policy and course capture modules do not exist.

- [ ] **Step 3: Implement upload-first capture and policy gates**

Support `audio/*`, `video/*`, `image/*` and permitted documents through the existing `FilePick` primitive. Preserve original metadata and content hash. Produce timestamp/region-backed proposals, notes, cards, quizzes and audio-review inputs. Ground video and diagram questions only in indexed transcript moments or image regions and return those locators through `EvidenceReference`. A photographed problem opens the existing guided Work/Study behavior with the effective integrity mode, never an unrestricted answer shortcut. Integrate the workspace into Add a reading (`Update`) so capture extends the existing course-material flow rather than adding a duplicate global route. Keep live microphone recording behind an explicit policy state and browser capability check.

- [ ] **Step 4: Run capture, import and accessibility tests**

Run: `cd app && pnpm exec vitest run src/lib/capture-policy.test.ts src/lib/course-capture.test.ts src/components/CourseCapture.test.tsx src/lib/transcribe.test.ts src/a11y`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/capture-policy.ts app/src/lib/capture-policy.test.ts app/src/lib/course-capture.ts app/src/lib/course-capture.test.ts app/src/components/CourseCapture.tsx app/src/components/CourseCapture.test.tsx app/src/components/Capture.tsx app/src/screens/Update.tsx app/src/lib/transcribe.ts
git commit -m "Add policy-controlled multimodal course capture"
```

### Task 9: University control plane inside the existing University route

**Files:**
- Create: `app/src/lib/control-plane.ts`
- Create: `app/src/lib/control-plane.test.ts`
- Create: `app/src/components/institutional/ControlPlane.tsx`
- Create: `app/src/components/institutional/ControlPlane.test.tsx`
- Modify: `app/src/screens/University.tsx`
- Modify: `app/src/components/institutional/RoleWorkspace.tsx`
- Modify: `app/src/styles/app.css`

**Interfaces:**
- Consumes: tenant feature policy, AI policy, consent, approved sources, gateway status, verified grants, audit events and existing readiness data.
- Produces: `controlPlaneView(input): ControlPlaneView`, `supportSignals(input): SupportSignal[]`, and `<ControlPlane>`.

- [ ] **Step 1: Write failing authorization and transparency tests**

```ts
it('lets a verified tenant administrator edit only their tenant policy', () => {
  expect(controlPlaneView(fixture({ capability: 'tenant_admin', tenantId: 'northstar' })).canEdit).toBe(true);
  expect(controlPlaneView(fixture({ capability: 'tenant_admin', tenantId: 'cedar', viewedTenantId: 'northstar' })).canEdit).toBe(false);
});

it('treats a selected preview persona as demonstration, not authorization', () => {
  expect(controlPlaneView(fixture({ previewRole: 'admin', verifiedCapabilities: [] })).canEdit).toBe(false);
});

it('explains support signals and excludes protected-trait and emotion inputs', () => {
  const signals = supportSignals(signalFixture());
  expect(signals[0].reasons.length).toBeGreaterThan(0);
  expect(JSON.stringify(signals)).not.toMatch(/race|gender|emotion|sentiment/i);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `cd app && pnpm exec vitest run src/lib/control-plane.test.ts src/components/institutional/ControlPlane.test.tsx`

Expected: FAIL because the control-plane modules do not exist.

- [ ] **Step 3: Implement role-gated modules**

Add a Control tab to the existing University screen only when the feature state is not off. Render Identity, Roles, Integrations, Intelligence, Sources, Data governance, Audit, Accessibility, Outcomes and Support as sections using current `SectionLabel`, `Notice`, `Segmented`, row and card primitives. Status vocabulary is exactly `contract only`, `sandbox tested`, `awaiting authorization`, `connected but degraded`, or `production verified`. Preview administrators may inspect and stage local changes but cannot produce a production receipt.

- [ ] **Step 4: Run University, role and structural tests**

Run: `cd app && pnpm exec vitest run src/lib/control-plane.test.ts src/components/institutional/ControlPlane.test.tsx src/screens/university.test.tsx src/lib/role.test.ts src/lib/rolespec.test.ts src/a11y/landmarks.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/control-plane.ts app/src/lib/control-plane.test.ts app/src/components/institutional/ControlPlane.tsx app/src/components/institutional/ControlPlane.test.tsx app/src/screens/University.tsx app/src/components/institutional/RoleWorkspace.tsx app/src/styles/app.css
git commit -m "Add the University control plane"
```

### Task 10: Persist learning, skills and capture evidence with tenant isolation

**Files:**
- Create: `supabase/migrations/20260923211000_evidence_graphs.sql`
- Create: `supabase/evidence-graphs.check.sql`
- Modify: `supabase/deletion.check.sql`
- Modify: `supabase/records.check.sql`
- Modify: `MIGRATION-HISTORY.md`

**Interfaces:**
- Consumes: Task 2 tenant policies and the repository's account, course, record and deletion foundations.
- Produces: tenant-scoped `evidence_reference`, `concept_evidence`, `mistake_evidence`, `skill_claim`, `skill_claim_evidence`, `capture_asset`, `capture_segment`, and `capture_artifact` records.

- [ ] **Step 1: Write failing RLS, deletion and withdrawal tests**

The SQL suite proves:

```sql
perform pg_temp.become(northstar_user);
select count(*) into n
  from public.evidence_reference
 where id = northstar_source and title = 'ECON syllabus';
reset role;
perform pg_temp.counted('owner can read Northstar evidence', n, 1);

perform pg_temp.become(cedar_user);
select count(*) into n
  from public.evidence_reference
 where id = northstar_source;
reset role;
perform pg_temp.counted('another tenant cannot read Northstar evidence', n, 0);

if not pg_temp.refused(
  northstar_user,
  format(
    'insert into public.capture_artifact (capture_id, kind, body, created_by) '
    'values (%L, %L, %L, %L)',
    withdrawn_capture, 'summary', '{}', northstar_user
  )
) then
  raise exception 'FAILED: withdrawn consent allowed a derived artifact';
end if;
```

Extend deletion checks to prove assets, segments, derived artifacts, personal learning evidence and unshared skill claims are removed or tombstoned according to the existing account-deletion contract.

- [ ] **Step 2: Run and verify RED**

Run: `./supabase/check.sh evidence-graphs`

Expected: FAIL because the evidence graph tables do not exist.

- [ ] **Step 3: Implement normalized schema, indexes and RLS**

Every table includes or joins unambiguously to `tenant_id` and `person_id`; every foreign key receives a covering non-partial index. Use checks for valid evidence authority, verification and artifact states. Prevent direct client promotion from suggested to institution-verified. Prevent derived capture inserts when effective consent is withdrawn or expired.

- [ ] **Step 4: Run graph, deletion, record and index suites**

Run: `./supabase/check.sh evidence-graphs`

Expected: PASS.

Run: `./supabase/check.sh deletion && ./supabase/check.sh records && ./supabase/check.sh indexes`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260923211000_evidence_graphs.sql supabase/evidence-graphs.check.sql supabase/deletion.check.sql supabase/records.check.sql MIGRATION-HISTORY.md
git commit -m "Persist isolated learning and skills evidence"
```

### Task 11: Institution gateway policy, model routing and authoritative receipts

**Files:**
- Create: `app/server/institution/intelligence.ts`
- Create: `app/server/institution/intelligence.test.ts`
- Create: `packages/institution/src/intelligence.ts`
- Create: `packages/institution/src/intelligence.test.ts`
- Modify: `packages/institution/src/index.ts`
- Modify: `app/server/institution/gateway.ts`
- Modify: `app/server/institution/journal.ts`
- Modify: `app/server/institution/.env.example`

**Interfaces:**
- Consumes: `IntelligenceRequest`, tenant AI policy, approved sources, verified gateway roles and existing gateway response/receipt patterns.
- Produces: versioned `POST /v1/intelligence/respond`, `POST /v1/intelligence/actions/:id/confirm`, `IntelligenceGatewayRequest`, `IntelligenceGatewayResponse` and authoritative `ActionReceipt`.

- [ ] **Step 1: Write failing contract and gateway tests**

```ts
it('refuses a client production flag when the verified tenant policy is off', async () => {
  const response = await respond(requestFixture({ clientState: 'production', tenantPolicy: 'off' }));
  expect(response.status).toBe(403);
  expect(response.body.code).toBe('policy-disabled');
});

it('routes only to an allowed model under the tenant cost ceiling', async () => {
  const route = chooseModel(policyFixture({ allowedModels: ['openai:gpt-5-mini'], maxCents: 2 }), taskFixture());
  expect(route.model).toBe('openai:gpt-5-mini');
  expect(route.estimatedCents).toBeLessThanOrEqual(2);
});

it('cannot apply a consequential action without a fresh explicit confirmation', async () => {
  const response = await confirmAction(actionFixture({ class: 'consequential', confirmation: null }));
  expect(response.status).toBe(409);
  expect(response.body.code).toBe('confirmation-required');
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `cd app && pnpm exec vitest run server/institution/intelligence.test.ts ../packages/institution/src/intelligence.test.ts`

Expected: FAIL because the contract and handlers do not exist.

- [ ] **Step 3: Implement versioned gateway endpoints**

Validate request scope against authenticated gateway roles, load policy server-side, intersect source permissions, choose an allowed route and return structured evidence ids separately from model prose. Record request category, provider/model, token/cost totals, policy decision and action confirmation in the audit journal without logging protected source bodies. Produce receipts only after external or internal authoritative readback.

Add optional environment names to `.env.example` without values: `SEMESTER_AI_PROVIDERS`, `SEMESTER_AI_MONTHLY_CENTS`, and `SEMESTER_AI_RETENTION_DAYS`.

- [ ] **Step 4: Run gateway and package verification**

Run: `cd app && pnpm exec vitest run server/institution ../packages/institution/src && pnpm run check:university && pnpm run smoke:gateway`

Expected: PASS; smoke output reports policy-disabled or configured sandbox truthfully, never a fabricated model response.

- [ ] **Step 5: Commit**

```bash
git add app/server/institution/intelligence.ts app/server/institution/intelligence.test.ts packages/institution/src/intelligence.ts packages/institution/src/intelligence.test.ts packages/institution/src/index.ts app/server/institution/gateway.ts app/server/institution/journal.ts app/server/institution/.env.example
git commit -m "Add governed intelligence gateway contracts"
```

### Task 12: Cross-feature isolation, accessibility and browser acceptance

**Files:**
- Create: `app/src/lib/experience-preservation.test.ts`
- Create: `app/scripts/intelligence-expansion-smoke.mjs`
- Modify: `app/src/a11y/landmarks.test.ts`
- Modify: `app/scripts/institutional-preview-smoke.mjs`
- Modify: `app/src/styles/app.css`
- Create: `docs/institutional-rollout/intelligence-expansion-evidence.md`
- Modify: `docs/IMPLEMENTATION_STATUS.md`
- Modify: `docs/market-readiness/PRODUCT_READINESS.md`

**Interfaces:**
- Consumes: all previous tasks.
- Produces: one preservation suite, one browser acceptance script and a truthful evidence record separating local, sandbox and externally gated behavior.

- [ ] **Step 1: Write failing preservation and browser assertions**

The preservation test records the pre-expansion destination ids and asserts:

```ts
it('keeps every pre-expansion route and one application root', () => {
  expect(DESTINATIONS.map((d) => d.screen)).toEqual(expect.arrayContaining(PRE_EXPANSION_SCREENS));
  expect(new Set(DESTINATIONS.map((d) => d.screen)).size).toBe(DESTINATIONS.length);
});
```

The browser script must assert on desktop `1440x1000` and phone `390x844`:

- one `[data-semester-root]`, one `<main>`, one page heading and one primary navigation;
- six journey cards plus a working All tools catalog;
- `#/ask` says Ask Semester and exposes all five modes;
- a response fixture shows citations, information used and source origin;
- Study shows one next activity, its evidence and all existing study formats;
- Career explains matched and missing skills without a black-box score;
- capture refuses prohibited recording and keeps extracted facts unconfirmed;
- preview admin inspection does not grant production authorization;
- switching Northstar to Cedar Coast removes the prior context, pending action, learning evidence, skill claim and capture draft;
- default build exposes no preview tenants, role switcher or control-plane sample data.

- [ ] **Step 2: Run focused acceptance and verify RED**

Run: `cd app && pnpm exec vitest run src/lib/experience-preservation.test.ts src/a11y/landmarks.test.ts`

Expected: FAIL until every preservation assertion and style correction is present.

- [ ] **Step 3: Correct accessibility and responsive defects exposed by acceptance**

Use existing tokens to raise low-contrast secondary text, replace essential condensed uppercase labels with readable sentence case, maintain 44px touch targets, add textual chart summaries and ensure loading skeletons carry a visible/announced loading label rather than resembling empty content. Do not globally change the current visual identity.

- [ ] **Step 4: Run complete verification**

Run: `cd app && pnpm test`

Expected: all test files pass except repository-declared skips.

Run: `cd app && pnpm run test:zones`

Expected: identical pass counts in `America/Chicago` and `Pacific/Kiritimati`.

Run: `cd app && pnpm run test:shuffle`

Expected: identical pass counts in shuffled order.

Run: `cd app && pnpm run lint && pnpm run build`

Expected: lint, structural audits, TypeScript and default production build pass.

Run: `cd app && VITE_INSTITUTIONAL_PREVIEW=true VITE_SEMESTER_INTELLIGENCE=sandbox VITE_JOURNEY_NAVIGATION=preview VITE_ADAPTIVE_LEARNING=preview VITE_CAREER_SKILLS_GRAPH=preview VITE_MULTIMODAL_CAPTURE=preview VITE_UNIVERSITY_CONTROL_PLANE=preview pnpm run build`

Expected: institutional preview production build passes.

Run: `cd app && node scripts/intelligence-expansion-smoke.mjs`

Expected: every desktop, phone, cross-tenant, flag-on and flag-off assertion passes.

Run: `./supabase/check.sh`

Expected: every migration reconstructs on Postgres 17 and every SQL policy suite passes.

- [ ] **Step 5: Record exact evidence and boundaries**

Document commands, counts, viewports, feature states and failures fixed. Explicitly state that local/sandbox evidence does not prove production SSO, SCIM, LMS, live employer/alumni data, sent actions, official records or legal permission to record.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/experience-preservation.test.ts app/scripts/intelligence-expansion-smoke.mjs app/src/a11y/landmarks.test.ts app/scripts/institutional-preview-smoke.mjs app/src/styles/app.css docs/institutional-rollout/intelligence-expansion-evidence.md docs/IMPLEMENTATION_STATUS.md docs/market-readiness/PRODUCT_READINESS.md
git commit -m "Verify the Semester intelligence expansion"
```

## Final whole-branch review

After Task 12, generate a review package from the merge base through `HEAD`. The reviewer must inspect every Review Focus item, the preservation invariant, cross-tenant and cross-person isolation, policy enforcement, citation ownership, confirmation bypasses, consent withdrawal, stale evidence, route compatibility, feature-off behavior and truthful external-integration language.

Re-grade findings by user impact. Fix Critical and Important findings in one test-first pass, run the complete verification suite again, ledger all rulings and deferred minor findings, then use `superpowers:finishing-a-development-branch`.
