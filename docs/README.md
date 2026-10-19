# Semester documentation

> **Type:** explanation · **Audience:** students, families, faculty, institution-admins, implementers, partner-developers, contributors, operators, support, buyers, security-reviewers · **Owner:** `engineering` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/docsystem.test.ts`

The way in. Find who you are in the first table, open the page it names, and
stop. If you are not sure whether something is built yet, read [what is
true today](#what-is-true-today) first.

## Start with who you are

| I am… | I want to… | Open |
| --- | --- | --- |
| A **student** or a parent | Use the app, or fix something that is not working | [Help](help/README.md) · [Fix a problem](support/README.md) |
| An **instructor** | Know what Semester does for a course | [Help](help/README.md) |
| A **campus administrator or implementer** | Adopt, configure, run and leave Semester | [Institution guides](guides/institution/README.md) · [SSO onboarding](SSO-TENANT-ONBOARDING.md) · [Integration operator runbook](INTEGRATION-OPERATOR-RUNBOOK.md) |
| A **developer building against Semester** | Call the gateway, provision users, consume events | [Reference](reference/README.md) · [Integration guides](guides/integrations/README.md) · [Reference applications](../examples/README.md) |
| A **contributor** | Get a change from clone to merge | [CONTRIBUTING](../CONTRIBUTING.md) · [Developer docs](developers/README.md) · [`CLAUDE.md`](../CLAUDE.md) |
| On **call or operating** the system | Respond to something going wrong, or switch something on | [Runbooks](RUNBOOKS.md) · [Rollback](../ROLLBACK.md) · [Restore](../RESTORE.md) |
| In **support** | Triage, answer, escalate | [Support operations](support/README.md) |
| A **security reviewer or buyer** | See what controls exist, where the evidence is, and what is not done | [Trust document map](trust/DOCUMENT-MAP.md) · [Security overview](trust/SECURITY-OVERVIEW.md) · [Trust Center](TRUST-CENTER.md) |
| Telling people **what changed** | Write a release note or a change notice | [Releases and change communication](releases/README.md) |
| **Writing or reviewing documentation** | Know the rules | [The documentation system](documentation/README.md) |

Looking for something and not finding it above? [`INDEX.md`](documentation/INDEX.md)
lists every page this system governs by audience and by kind, and
`grep -ril "<word>" docs` from the repository root finds the rest.

## What is true today

Documentation here describes what the product does. Before relying on a page,
check the status it carries and these three sources, which are the ones the rest
of the repository defers to:

- [`FEATURE-TRUTH-TABLE.md`](FEATURE-TRUTH-TABLE.md) says, for each capability,
  whether it is `LIVE`, built but not released, partial, a demo, planned or
  blocked.
- [`LAUNCH-READINESS-COUNCIL.md`](LAUNCH-READINESS-COUNCIL.md) holds the go/no-go
  verdict, computed from gates and seats. It is the answer to "has any
  institution gone live", and no page in this system may say otherwise.
- [`CAPABILITY-ACTIVATION-REGISTER.md`](CAPABILITY-ACTIVATION-REGISTER.md) says
  what is switched on, for whom.

Where a page documents something that runs only against a sandbox, or is off, it
says so in its first screen, in those words.

## How the pages are organised

| Folder | Holds | Kept honest by |
| --- | --- | --- |
| [`reference/`](reference/README.md) | Facts: routes, errors, events, functions, configuration | A test that renders it from the code or fails when it differs |
| [`guides/`](guides/README.md) | How to do something: institutions, integrations | A test that checks the identifiers and quotes the example code |
| [`help/`](help/README.md) and [`support/`](support/README.md) | What a person does in the product, and what to do when it fails | A test that checks every quoted label exists in the app |
| [`developers/`](developers/README.md) | Onboarding, repository map, standards, how-tos | A test that checks every command and path exists |
| [`releases/`](releases/README.md) | Release notes and change communication | A test that checks each note against `CHANGELOG.md` |
| [`documentation/`](documentation/README.md) | The charter, style, ownership, gates and templates | The gate itself |

Every page opens with a one-line **card**: its kind, audience, owning seat, how
it is held, and the date a person last read it against the product. What the
card fields mean is in the [charter](documentation/README.md#the-card).

## The rest of the repository's documentation

About three hundred older documents sit beside these. They are not moved or
renumbered. Most are audits of a moment or plans that were overtaken; the pages
below are the ones that are authoritative, or that explain how to find the one
that is.

| For… | Read |
| --- | --- |
| What the product is and how to run it | [`README.md`](../README.md) · [`SETUP.md`](../SETUP.md) · [`CHANGELOG.md`](../CHANGELOG.md) |
| Which page wins for each company control | [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md) |
| Why it is built the way it is | [Architecture decisions](architecture/README.md) · [Decision records](decisions/README.md) · [Decision log](DECISION-LOG.md) |
| The proposed target architecture (not yet accepted) | [Target architecture pack](target-architecture/README.md) |
| What is deliberately not being built | [`DO-NOT-BUILD.md`](DO-NOT-BUILD.md) |
| Where the product is headed | [`PRODUCT-ROADMAP.md`](PRODUCT-ROADMAP.md) |
| Revision-bound Education OS audit and gap snapshots | [`audit/CURRENT_STATE.md`](audit/CURRENT_STATE.md) · [`audit/ROLE_AND_SCREEN_GAP_ANALYSIS.md`](audit/ROLE_AND_SCREEN_GAP_ANALYSIS.md) · [`audit/SYSTEM_AND_WORKFLOW_GAP_ANALYSIS.md`](audit/SYSTEM_AND_WORKFLOW_GAP_ANALYSIS.md) · [`roadmap/P0-P3-IMPLEMENTATION_PLAN.md`](roadmap/P0-P3-IMPLEMENTATION_PLAN.md) |
| Design and in-product wording | [Design system](design/README.md) · [Content standards](design/SEMESTER-CONTENT-STANDARDS.md) |
| Security, privacy and compliance material | [`SECURITY.md`](../SECURITY.md) · [`SECRETS.md`](../SECRETS.md) · [`RETENTION.md`](../RETENTION.md) · [Compliance](compliance/README.md) · [Subprocessors](SUBPROCESSORS.md) |
| Launch, pilots and market readiness | [Market readiness](market-readiness/README.md) · [Pilot and individual release profiles](PILOT-AND-INDIVIDUAL-RELEASE-PROFILES.md) · [Operating model](operating-model/README.md) |
| Running the public site | [`PUBLIC-SITE.md`](PUBLIC-SITE.md) |
