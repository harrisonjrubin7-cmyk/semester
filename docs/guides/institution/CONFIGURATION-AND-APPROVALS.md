# Configuration and approvals

> **Type:** how-to · **Audience:** institution-admins, implementers · **Owner:** `product` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/institution-guides.test.ts`

This page shows how to draft, review and publish your school's configuration and workflow definitions under the two-person rule; stop reading if you want a setting to change what students see today, because nothing reads these settings yet.

**Status:** `IMPLEMENTED_NOT_RELEASED`. The Configuration and Workflows tabs are built, tested and off by default (`VITE_CONFIGURATION_STUDIO`, `VITE_WORKFLOW_BUILDER`). **Nothing in the app reads a published configuration or runs a published workflow yet.** The screen says so on its first lines. Until a domain is wired to `effectiveConfig`, Semester runs on its own defaults.

<!-- status: Tenants, memberships, roles, scopes = IMPLEMENTED_NOT_RELEASED -->
<!-- labels: app/src/screens/University.tsx :: Configuration, Workflows -->
<!-- labels: app/src/components/institutional/ConfigurationStudio.tsx :: Save draft, Start a draft, Discard draft, All domains -->
<!-- labels: app/src/lib/config/studio.ts :: Academic structure, Workflows, Roles, Branding and terminology, Content, AI, Notifications, Data, Features, Accessibility, Reporting -->
<!-- capabilities: config:manage, config:publish, config:view, workflow:manage, workflow:publish, workflow:view, tenant:configure, ai:configure, killswitch:engage -->
<!-- roles: university_admin, implementation_manager, integration_admin, registrar, institutional_researcher -->

## Who holds what

| Capability | Lets you | Held by |
| --- | --- | --- |
| `config:manage` | Draft a configuration | `implementation_manager`, `integration_admin`, `university_admin` |
| `config:publish` | Publish a draft | `registrar`, `university_admin` |
| `config:view` | Read drafts and versions | the roles above |
| `workflow:manage` | Draft a workflow definition | `implementation_manager`, `integration_admin`, `university_admin` |
| `workflow:publish` | Publish a workflow draft | `registrar`, `university_admin` |
| `workflow:view` | Read workflow drafts and versions | the roles above and `institutional_researcher` |

A `university_admin` holds both the draft and the publish capability, and still cannot publish a change they drafted. Editing a draft makes you its drafter, so a publisher cannot quietly rewrite someone else's draft and publish it.

## Configure a domain

The Configuration tab lists eleven domains: `Academic structure`, `Workflows`, `Roles`, `Branding and terminology`, `Content`, `AI`, `Notifications`, `Data`, `Features`, `Accessibility` and `Reporting`. Each domain is a closed list of keys with a type and a range. You cannot add a key of your own, put a card number in typed text, or exceed 8 KB a version.

1. Open University, then the `Configuration` tab, then choose a domain.
2. Use `All domains` to return to the list. Read the default shown beside each setting. That default is what runs today.
3. Change the settings and add a note saying why. Press `Start a draft`. After the first save the button reads `Save draft`.
4. Ask a colleague who holds `config:publish` to open the same domain. They read the changes the screen lists against the last published version, or against the defaults when nothing is published.
5. They press `Publish as version N`. The button is disabled while the draft has unsaved changes ("a draft is published as it was reviewed"), and when you drafted it yourself the screen says why.
6. To undo a version, choose a past version, press `Start from version N`, and have a colleague publish the result. A rollback is a new draft, never an edit of history.
7. `Discard draft` removes a draft you no longer want.

What you can check afterwards: published versions are numbered 1, 2, 3 and are never edited or deleted. Every draft, save, publish and discard is recorded in `tenant_policy_audit_event` with the actor's grant. A draft saved after the publisher opened it is not published; the publish call filters on the draft's `updated_at`.

## Workflows

The Workflows tab holds the definition of a workflow, not a student going through one. A definition is a title, an ordered list of steps (each with a kind, an owner and an optional wait), eligibility checks and the office it hands off to. There are ten starting templates, including the registration clearance checklist, advisor approval request and graduation application preparation. Credit numbers and office names in the templates are placeholders you change.

Rules the database enforces: no expression of your own (steps, owners, facts and comparisons are closed lists); the student confirms before any official handoff; a handoff names its office; a workflow ends by completing; a rule may read eight facts and none of them is a grade, balance, diagnosis, disciplinary or immigration detail. The draft and publish rule is the same as for configuration, with `workflow:manage` and `workflow:publish`.

The policy engine evaluates a definition with the same answer every time and calls no model. When a fact is unknown, the answer is "cannot be told", never a pass.

## Modules, AI and kill switches

- `Modules` (needs `tenant:configure`) switches modules for your school. A switch is refused to anyone else.
- `ai:configure` changes your tenant's AI policy and budget.
- `killswitch:engage` lets a `university_admin` stop a school's connection or feature at once. See [`INTEGRATION-OPERATOR-RUNBOOK.md`](../../INTEGRATION-OPERATOR-RUNBOOK.md).

## Not built, so not described here

- Wiring any domain to behaviour. The domain-to-feature table is in [`CONFIGURATION-STUDIO.md`](../../CONFIGURATION-STUDIO.md).
- Running a published workflow for a student.
- A tenant contract compared to live configuration: [`TENANT-CONTRACT.md`](../../TENANT-CONTRACT.md) is pure logic with no screen, route or table, and no contract is recorded for any school.

## Where to read the details

[`CONFIGURATION-STUDIO.md`](../../CONFIGURATION-STUDIO.md), [`WORKFLOW-BUILDER.md`](../../WORKFLOW-BUILDER.md), `supabase/configuration-studio.check.sql`, `supabase/workflow-builder.check.sql`.
