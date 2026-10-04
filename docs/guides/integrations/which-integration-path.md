# Which integration path do I want?

> **Type:** explanation · **Audience:** implementers, institution-admins · **Owner:** `engineering` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/examples.test.ts`

This page maps what you want to connect to the integration path that does it, and says what state each path is in today; stop reading if you already know the protocol and only need its runbook.

**Status:** mixed. Only calendar feeds are `LIVE`. Each row below carries the word the truth table gives it, and the test compares them. The truth table is a reading of the repository, not of a running production system ([`docs/FEATURE-TRUTH-TABLE.md`](../../FEATURE-TRUTH-TABLE.md)). The public claims register governs what may be said outside the company ([`docs/PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md)); [`docs/INTEROPERABILITY-ROADMAP.md`](../../INTEROPERABILITY-ROADMAP.md) uses that register's words ("Planned", "In preparation") for the same standards.

## Start with what you want

| You want to | Use | Section |
| --- | --- | --- |
| Let people sign in with the school's account | SAML single sign-on (OIDC is planned) | [Sign-in](#sign-in) |
| Create, change and retire accounts from the school's identity system | SCIM provisioning | [Accounts](#accounts) |
| Open Semester from a course in the learning system | LTI 1.3 | [Course launch](#course-launch) |
| Read a school system's records, or let a person act on them with a review | An institution gateway and a SIS adapter | [Records and actions](#records-and-actions) |
| Read rosters and enrolments in a standard format | OneRoster (planned) | [Records and actions](#records-and-actions) |
| React to something that happened inside Semester | Events | [Events](#events) |
| Get a school or course calendar into a student's plan | ICS calendar feeds | [Calendar](#calendar) |
| Save a web page into a student's own Semester inbox | The Semester Capture browser extension | [Browser](#browser) |

## The paths and their state

| Path | State | Who does the work | Start with |
| --- | --- | --- | --- |
| SAML single sign-on | `IMPLEMENTED_NOT_RELEASED` and **BLOCKED** | The school's identity team, with an operator | [`docs/INSTITUTIONAL-SSO-ARCHITECTURE.md`](../../INSTITUTIONAL-SSO-ARCHITECTURE.md) |
| OIDC single sign-on | `PLANNED` | Nobody yet | [`docs/INSTITUTIONAL-SSO-ARCHITECTURE.md`](../../INSTITUTIONAL-SSO-ARCHITECTURE.md) |
| SCIM provisioning | `IMPLEMENTED_NOT_RELEASED` | The school's identity provider | [Provision users over SCIM](scim-provisioner.md) |
| LTI 1.3 | `IMPLEMENTED_NOT_RELEASED` and **BLOCKED** | The school's LMS administrator, with an operator | [`docs/LTI-1.3-LAUNCH-RUNBOOK.md`](../../LTI-1.3-LAUNCH-RUNBOOK.md) |
| SIS adapter | `PLANNED` | The school's integrator | [Write a SIS adapter](sis-adapter.md) |
| Institution gateway | `MOCK_DEMO` | A developer calling it | [Call the institution gateway](gateway-client.md) |
| OneRoster | `PLANNED` | Nobody yet | [`docs/INTEROPERABILITY-ROADMAP.md`](../../INTEROPERABILITY-ROADMAP.md) |
| Calendar (ICS) feeds | `LIVE` | The student; the school publishes a calendar link | [Calendar](#calendar) |
| Events | No truth-table row | A developer inside the repository | [Consume events](event-consumer.md) |
| Browser extension | No truth-table row | A student | [Browser](#browser) |

**BLOCKED** is the truth table's word for needing an external approval, credential, contract or decision. The row for SIS connectors reads `PLANNED`, with "every production adapter needs a school-approved credentialed adapter" as the block.

## Sign-in

SAML sign-in proves who a person is. SCIM decides membership and ends it. LTI carries course context. None of the three grants a role directly: roles come from administrator-approved group mappings. [`docs/INSTITUTIONAL-SSO-ARCHITECTURE.md`](../../INSTITUTIONAL-SSO-ARCHITECTURE.md) is the index to all three and is the authority; it says its own status in the first lines. Read it before you plan a rollout.

There is no developer how-to for SAML on this page. Registering an identity provider is an operator task today ("IdP registered by hand" in the truth table).

## Accounts

SCIM 2.0 is the way an identity provider creates, changes and deactivates accounts. It is off unless the gateway runs with `SEMESTER_SCIM=on`, and has never run against a real identity provider. If you build the client side, follow [Provision users over SCIM](scim-provisioner.md). The rules for groups, roles and deprovisioning are in [`docs/SCIM-LIFECYCLE-MANAGEMENT.md`](../../SCIM-LIFECYCLE-MANAGEMENT.md).

## Course launch

LTI 1.3 opens Semester from a course and carries which course, which resource and which role. A launch never creates a membership. Registration and the launch checks are in [`docs/LTI-1.3-LAUNCH-RUNBOOK.md`](../../LTI-1.3-LAUNCH-RUNBOOK.md). The truth table notes it has never launched from a real platform, and this repository has no developer example for it.

## Records and actions

The institution gateway is the one front door for a school's records (courses, grades, bills, registration) and for actions on them. Nothing is done in one request: an action is prepared, shown to the person, and only then committed.

- If you call the gateway, follow [Call the institution gateway](gateway-client.md).
- If you connect a school system to it, you write an adapter: [Write a SIS adapter](sis-adapter.md).
- The gateway has no production adapters, so every real service answers 503 today. Operating a connection once one exists is in [`docs/INTEGRATION-OPERATOR-RUNBOOK.md`](../../INTEGRATION-OPERATOR-RUNBOOK.md).

OneRoster would give a standard roster feed from a SIS. It is `PLANNED` with no adapter. Do not plan around it.

## Events

Modules inside Semester can pass events in a common envelope through an outbox. The code exists and is tested. One producer exists (the productivity command service), but nothing mounts it and nothing publishes what it writes, so there is no event stream for a partner to subscribe to. If you are adding or consuming an event inside the repository, follow [Consume events](event-consumer.md). There is no subscription or delivery endpoint for outside systems, and this page does not promise one.

## Calendar

A student pastes the subscribe link their learning system, Outlook, Google or iCloud gave them, or imports an `.ics` file, and Semester reads it. A browser cannot fetch most calendar servers directly, so a Supabase function (`fetchcal`) fetches the feed for a signed-in device. It accepts only an `https` URL on a public host, only a body that starts a `VCALENDAR`, and reads at most one megabyte or fifteen seconds, whichever comes first. The school's part is to publish a subscribe link. There is no institution-level calendar connector; the truth table lists the calendar as `LIVE` with device and server ICS feeds, and notes that calendar writes still need a preview and confirm audit.

## Browser

`extensions/semester-capture` is a Manifest V3 browser extension. From the current page it reads the title, the URL and, if the person asks, the selected text, and opens the Semester app at an address that carries them for the person to review and save to their own inbox. It asks for the `activeTab`, `scripting` and `storage` permissions ([`manifest.json`](../../../extensions/semester-capture/manifest.json)). It sends nothing to a school. The truth table has no row for it, and whether it is published in a browser store is not verified here. [`docs/EXTENSION-ECOSYSTEM-GOVERNANCE.md`](../../EXTENSION-ECOSYSTEM-GOVERNANCE.md) says that governance for third-party extensions is not built.

## Where each guide runs

Every example runs in `app/src/lib/docs/examples.test.ts` against the real gateway, SCIM service and event code. See [`examples/README.md`](../../../examples/README.md).

## Next

- [Integration guides](README.md): the index.
- [`docs/reference/API-GATEWAY.md`](../../reference/API-GATEWAY.md), [`docs/reference/SCIM-API.md`](../../reference/SCIM-API.md), [`docs/reference/ERRORS.md`](../../reference/ERRORS.md) and [`docs/reference/EVENTS.md`](../../reference/EVENTS.md) for the wire references.
