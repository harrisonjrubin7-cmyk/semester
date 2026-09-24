# Semester Intelligence and Journey Expansion Design

**Status:** Approved conversational design; written specification awaiting owner review

**Date:** 23 September 2026

**Extends:** `2026-09-23-semester-institutional-rollout-design.md`

**Implementation target:** The existing Semester React, TypeScript, Supabase and institution-gateway repository

## 1. Purpose

Semester will add six connected product systems without replacing or visually separating the application that exists today:

1. Semester Intelligence
2. Journey-based navigation
3. Adaptive learning
4. Career and skills graph
5. Multimodal course capture
6. University control plane

The objective is to make Semester easier to enter, more useful every day and governable by a university while preserving the existing product foundation and complete capability catalog.

The end-to-end student loop is:

> Start or capture -> confirm the source -> choose the next action -> learn or complete work -> record evidence -> adapt the plan -> connect the evidence to longer-term outcomes

## 2. Binding product decisions

### 2.1 Preserve the current product

The existing `App` root, shell, routes, design tokens, component language, deep links, tabs, bookmarks, navigation preferences, search, directory and stored records remain authoritative.

This expansion must not:

- mount a second application;
- replace the existing shell or visual system;
- delete or silently rename a route;
- hide an existing capability;
- overwrite a user's saved navigation preferences;
- create a separate institutional fork;
- duplicate a screen solely to give a role different data;
- describe sample or inferred information as verified institutional data.

New experiences attach to current screens and registries. Feature-disabled behavior remains equivalent to the current product.

### 2.2 Build one shared operating layer

The six additions share the same context, evidence, policy, consent, provenance and action contracts. They must not grow six incompatible representations of a course, concept, skill, source, person or institution.

### 2.3 Keep non-AI paths complete

Planning, reviewing sources, choosing study activities, recording evidence, managing applications and inspecting institutional settings remain usable when no model is configured or AI is disallowed.

### 2.4 Tell the truth about external systems

Where production authorization is absent, Semester may provide a complete sandbox adapter and administration flow, but the interface must say **Awaiting institution authorization**. It must not simulate a live sync, sent message, booking, submission, registration, official record or verified directory result.

## 3. Shared domain contracts

### 3.1 Context envelope

Every intelligent or adaptive operation receives an explicit, inspectable context envelope containing only authorized fields:

- tenant, campus and person scope;
- active role and resource grants;
- current screen and selected entity;
- course, assignment, deadline and calendar context;
- approved source references;
- learning evidence and confidence state;
- relevant career evidence;
- institutional AI policy and integrity mode;
- consent state;
- feature entitlements;
- request timestamp and timezone.

The envelope is assembled from the existing screen-provider pattern. Screens continue to decide what they may disclose. Private messages, family records, unshared notes and other protected material remain excluded unless a purpose-specific permission explicitly includes them.

### 3.2 Evidence reference

Every factual claim that can affect academic, career or institutional action uses an evidence reference with:

- stable source identifier;
- source kind: course material, institutional record, user record, web result or inference;
- human-readable title;
- precise locator such as page, section, timestamp, row or record field;
- captured excerpt or structured value;
- retrieved or verified timestamp;
- provenance and authority level;
- tenant and permission scope;
- optional confidence and freshness state.

An inference cites the evidence it was inferred from and is visibly labelled as inference. A web result is never presented as course-authoritative material.

### 3.3 Proposed action

Intelligence may read and prepare automatically within policy. Any mutation is represented as a proposed action containing:

- plain-language effect;
- target record or external system;
- values before and after;
- reason and supporting evidence;
- reversibility;
- confirmation class;
- policy decision;
- execution status;
- authoritative receipt when executed.

Internal reversible writes require a visible confirmation or a previously configured automation. Consequential actions such as send, submit, register, purchase, drop or alter an official record always require explicit confirmation and authoritative readback.

### 3.4 Feature and policy decision

Every new capability is governed by tenant-level feature and policy decisions. A decision records the tenant, capability, enabled state, permitted roles, provider/model allowlist, data categories, retention rule, budget or rate limit, reason, author, effective time and audit reference.

Client flags control discovery only. Authorization and sensitive policy enforcement occur in Supabase policies, edge functions or the institution gateway.

## 4. Semester Intelligence

### 4.1 Product identity

The user-facing product is **Semester Intelligence** and the primary navigation label is **Ask Semester**. Provider names appear only in configuration, cost disclosure, diagnostics and legally required notices.

The existing `#/ask` route, conversation history, keyboard entry points and assistant panel remain. Existing saved links continue to work. User-facing references to “Ask Claude,” “Claude settings” and provider-specific failure copy are migrated to provider-neutral language.

### 4.2 Model-independent gateway

The current Anthropic and OpenAI paths become adapters behind one provider-neutral request contract. The contract supports:

- managed institutional gateway;
- institution-approved direct provider;
- user-supplied provider key where policy permits;
- deterministic local answer when no model is needed;
- unavailable state when policy or configuration blocks generation.

Routing considers tenant policy, task type, required modalities, model health, cost ceiling and user preference. A provider switch cannot mix identities inside a response or expose one provider's credentials to another.

### 4.3 Integrity modes

Every conversation or embedded intelligent action uses one visible mode:

| Mode | Intended behavior |
| --- | --- |
| Explain | Teach a concept using permitted sources without completing assessed work |
| Hint | Give the smallest useful next step and preserve productive struggle |
| Practice | Generate or select practice and evaluate the attempt |
| Review | Critique student-created work against sources or a rubric |
| Draft | Prepare editable material when course and university policy permit it |

The effective mode is constrained by course and tenant policy. If Draft is prohibited for an assessed task, Semester explains the restriction and offers Hint, Explain or Review instead.

### 4.4 Response disclosure

Each substantive response exposes:

- answer content;
- exact citations linked to their source locations;
- source-origin labels;
- “Information Semester used” disclosure;
- current integrity mode and relevant policy;
- uncertainty or conflict notice;
- proposed actions, each requiring the appropriate confirmation.

No-source responses must say that they are general guidance or inference. Citation rendering is generated from application-owned evidence records, not unverified citation text invented by a model.

## 5. Journey-based navigation

### 5.1 Journeys

Semester adds six stable journeys:

1. Start my semester
2. Plan today
3. Learn and practice
4. Complete an assignment
5. Work with people
6. Prepare for what comes next

Journeys are registry-backed collections of existing destinations and context-sensitive steps. They are not routes that copy the underlying tools.

### 5.2 Placement

- Home presents the most relevant journey and the reason it is recommended.
- Search recognizes journey language and returns both a journey and matching tools.
- The app directory opens with journeys and a clear **All tools** option.
- Existing catalog groups, pins, bookmarks, shortcuts and internal tabs remain available.
- Institutional preview navigation remains compatible with the approved primary destination hierarchy.

### 5.3 Recommendation rules

Journey ranking is deterministic before it is intelligent. It uses confirmed deadlines, current screen, incomplete setup, due review, active collaboration and career deadlines. AI may explain or refine a recommendation but cannot hide alternatives or invent urgency.

## 6. Adaptive learning engine

### 6.1 Concept graph

Each course gains a graph of stable concepts and relationships. Concepts link to source evidence, assessments, practice items, mistakes, study activities and skills.

Learning evidence uses explainable states rather than a fabricated authoritative percentage:

- Unseen
- Introduced
- Practising
- Retained
- Needs review

Where a numeric forecast is shown, it is a range with inputs, date and uncertainty—not a grade prediction or certified mastery score.

### 6.2 Continuous loop

The adaptive loop is:

> diagnostic -> next concept -> activity -> response -> mistake classification -> evidence update -> retrieval schedule -> new recommendation

It connects the existing cards, study guides, quizzes, practice papers, teach-back and mistake journal. A student may inspect the evidence, correct classification, dismiss a recommendation or reset course evidence.

### 6.3 Mistake taxonomy

Mistakes may be classified as concept gap, recall gap, procedure error, misread prompt, source misuse, calculation error, unsupported claim or confidence mismatch. Automatic classifications are suggestions until confirmed or supported by objective evidence.

### 6.4 Exam readiness

Exam readiness uses coverage, retrieval stability, recency, mistake recurrence, practice conditions and time remaining. The forecast shows:

- readiness range;
- concepts driving the range;
- missing evidence;
- recommended next activity;
- why that activity is expected to help.

## 7. Career and skills graph

### 7.1 Evidence model

Courses, projects, employment, organizations and service may suggest skills. A skill claim records level, evidence, source, verification state, verifier and expiry or review date where appropriate.

Semester distinguishes:

- suggested;
- student-confirmed;
- institution-verified;
- externally verified;
- expired or disputed.

### 7.2 Opportunity matching

Natural-language search operates over permissioned opportunity adapters. Job-fit results show matched evidence, missing requirements, uncertain interpretations and freshness. Fit is explanatory—not an opaque employability score.

### 7.3 Student workflow

The Career workspace adds:

- evidence-backed skills profile;
- missing-skill plan tied to coursework and activities;
- resume and portfolio evidence selection;
- interview practice using the selected opportunity;
- application deadlines on the shared calendar;
- opt-in mentor, alumni and career-center referral requests.

Live opportunities and network members appear only from authorized providers. Synthetic preview records remain visibly synthetic.

## 8. Multimodal course capture

### 8.1 Consent and policy first

Capture begins with a visible policy and consent decision. The effective policy may disable recording, require participant notice, limit retention, prohibit model processing or restrict source reuse.

Semester records the consent basis, participants or notice state, purpose, allowed processing, retention and deletion status. A declined or prohibited recording is never initialized.

### 8.2 Capture pipeline

The pipeline supports uploaded or locally captured audio, video, image and document inputs:

> acquire -> preserve original -> transcribe or extract -> segment -> link timestamps/regions -> propose facts and actions -> user confirms -> generate study derivatives

Original bytes, hashes and stable identifiers are preserved. Failed processing cannot destroy the original.

### 8.3 Outputs

Outputs may include:

- searchable transcript;
- timestamp-linked summary;
- confirmable deadlines and action items;
- notes, flashcards, quizzes and audio review;
- questions grounded in video moments or diagram regions;
- photographed-problem guided mode using the selected integrity policy.

Extracted deadlines and institutional facts remain proposals until confirmed or verified against an authoritative source.

## 9. University control plane

The existing University route gains role-gated modules rather than a separate administrator application.

### 9.1 Modules

- Identity: SSO configuration, SCIM readiness, domains and lifecycle status
- Roles: scoped role grants, provenance, expiry and least-privilege review
- Integrations: LTI 1.3, LMS adapters, declared scopes, health and receipts
- Intelligence: providers, model allowlist, policy, integrity rules, budgets and limits
- Sources: faculty-approved materials, authority, freshness and withdrawal
- Data governance: retention, consent, export, deletion and legal holds
- Audit: configuration, access, AI and consequential-action events
- Accessibility: automated results, manual verification and unresolved issues
- Outcomes: adoption, journey completion and learning-evidence trends
- Support: explainable early-support signals and consented support access

### 9.2 Early-support safeguards

Signals may identify missed confirmed deadlines, repeated failed retrieval, abrupt disengagement or an explicit request for help. Every signal shows its inputs and reason, permits correction and avoids protected-trait inference, emotion detection, hidden risk scoring or disciplinary use.

Support access is time-boxed, purpose-limited, consented where appropriate and fully audited.

### 9.3 Integration completion standard

LTI, SSO, SCIM or LMS status is shown as one of:

- contract only;
- sandbox tested;
- awaiting authorization;
- connected but degraded;
- production verified.

A configured-looking form is not evidence of a working integration.

## 10. Persistence and migration

New local records use versioned keys that include tenant, role, person and relevant resource scope. New shared records use forward-only Supabase migrations with database-enforced tenant isolation.

Migrations preserve existing identifiers and data, quarantine ambiguous imports and never infer institutional authority from an email domain or client flag. Production migrations require Postgres 17 staging rehearsal, policy tests, backup, restore and rollback evidence.

## 11. Failure and degraded states

Every new surface provides meaningful loading, empty, validation, offline, denied, disconnected, stale, conflict and retry states.

- Loading retains the shape of the destination and never resembles an empty success state.
- Offline mode distinguishes locally available evidence from unavailable provider data.
- A policy denial explains which rule applies and offers permitted alternatives.
- Conflicting sources remain visible until the user or an authorized source resolves them.
- Partial model output is marked incomplete and cannot execute an action.
- Failed external writes retain the proposal and display no success receipt.

## 12. Accessibility and visual integrity

The additions reuse current typography, spacing, color and component primitives. They must not add a second token system or generic administration-dashboard styling.

Requirements include:

- WCAG 2.2 AA contrast for text and interactive states;
- no essential label dependent on tiny condensed uppercase text;
- one page heading and one main landmark per shell;
- complete keyboard operation and visible focus;
- screen-reader names, status announcements and error associations;
- reduced-motion support;
- charts with textual equivalents;
- phone layouts that preserve the primary action and disclosure controls;
- loading states announced without appearing to be an empty page.

## 13. Feature flags and rollout

The expansion ships through independent tenant-aware flags:

- `semester_intelligence`
- `journey_navigation`
- `adaptive_learning`
- `career_skills_graph`
- `multimodal_capture`
- `university_control_plane`

Flags have off, synthetic preview, sandbox and authorized-production states where relevant. Dependencies are explicit: later flags may require shared contracts, but disabling one feature cannot remove an existing route or corrupt its data.

Rollout order is:

1. Shared contracts and preservation tests
2. Semester Intelligence and journey navigation
3. Adaptive learning
4. Career and skills graph
5. Multimodal capture
6. University control plane and operational evidence
7. Controlled institutional pilot

## 14. Verification and acceptance

Each implementation slice must include:

- a failing test observed before production code;
- pure contract and policy tests;
- feature-on and feature-off regression tests;
- tenant, role, person and resource isolation tests;
- citation and disclosure tests;
- action-confirmation and receipt tests;
- accessibility and structural audits;
- desktop and phone browser journeys;
- default and institutional-preview production builds;
- shuffled and multi-timezone suites where date behavior changes;
- migration, RLS and database reconstruction checks for shared records;
- truthful degraded-state verification when external credentials are absent.

The expansion is acceptable only when:

1. All existing capabilities remain reachable.
2. Existing saved routes and preferences remain compatible.
3. The default build does not expose preview-only institutional data.
4. Semester Intelligence identifies sources, information used, origin and integrity mode.
5. State-changing actions cannot bypass confirmation policy.
6. Learning and job-fit recommendations explain their evidence.
7. Recording cannot begin outside effective consent and policy.
8. Tenant and person switching does not leak context, evidence, recordings or settings.
9. External integrations never claim success without authoritative readback.
10. The full repository verification suite remains green.

## 15. Explicit non-goals for the first implementation program

The first implementation program does not claim:

- production SSO or SCIM without an institution identity provider;
- a production LMS connection without approved credentials and sandbox access;
- live employer, alumni or mentor data without an authorized directory;
- unattended consequential actions;
- infallible mastery, job-fit or support-risk predictions;
- permission to record where law or institutional policy prohibits it;
- replacement of an SIS, LMS or official records system before its adapter is verified.

These are external activation gates, not reasons to leave the internal contracts, sandbox flows, administration, tests or truthful unavailable states incomplete.
