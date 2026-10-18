# In-product guidance and enablement requirements

| Control | Value |
| --- | --- |
| Status | **REQUIREMENTS — PART EXISTS ON `main`; THE REST IS UNBUILT** |
| Owner | Enablement lead seat with the design system lead; engineering owns each build |
| Evidence date | 2026-10-04 at `origin/main` `7287ddc` |
| Used in | the [Academy](TRAINING-PLAN-AND-ACADEMY.md) and every [phase](METHODOLOGY.md) |
| Builds on | [`../ONBOARDING-AND-CONTEXTUAL-HELP.md`](../ONBOARDING-AND-CONTEXTUAL-HELP.md), [`../ETHICAL-ENGAGEMENT-AND-NOTIFICATIONS.md`](../ETHICAL-ENGAGEMENT-AND-NOTIFICATIONS.md) |

Training reaches the people who are trained. In-product guidance reaches
everyone, at the moment of need, so it has to carry the weight a classroom
cannot. This document is the list of what the product must do, what already
does it, and the test that would prove each.

## Principles

1. **Value before setup.** Ask what the person came for and take them there; defer
   everything else until a workflow needs it (the `FirstGoal` rule).
2. **Help is the same help in the same place** on every screen (WCAG 2.2 SC 3.2.6
   Consistent Help). Rendered by the shell so it cannot be forgotten on one.
3. **Never block, never nag.** Guidance is dismissible, skippable and
   re-openable; it never covers what it explains or moves focus unexpectedly; it
   respects reduced motion; there are no dark patterns, streaks or guilt.
4. **Say where it came from.** Every suggestion can show why it appears and what
   source it rests on; an estimate is labeled as one.
5. **Role- and tenant-aware, from governed content.** Campus facts come from the
   content register with an owner and an expiry; nothing is hand-typed per school.
6. **Measure without surveillance.** Aggregate only, above the privacy floor, no
   per-person tracking of guidance use.
7. **Works when the network does not.** Help, limitations and first-day
   checklists are available offline for the screens a student relies on.

## Requirements

State: **EXISTS** (on `main`, with the named test), **PARTIAL**, **NOT BUILT**.

| ID | Requirement | Acceptance (what a test or reviewer checks) | State |
| --- | --- | --- | --- |
| E1 | First-session goal on Today; nothing asked first; folds to one line; changeable | `lib/unity.test.ts`, `components/unity/unity.test.tsx` | **EXISTS** |
| E2 | "About this screen" on every screen: What is this / why it matters / where the information comes from / what next | every screen has all four answers over ten characters; drawn last on every screen, including full-bleed | **EXISTS** |
| E3 | Source and details for any recommendation; "why am I seeing this" disclosures | each suggestion exposes source and reason | **EXISTS** (Today disclosures, Source & details) |
| E4 | Guidebook (`help`) generated from the app; keyboard sheet (⌘K / Ctrl+K) | guidebook lists every screen | **EXISTS** |
| E5 | Empty-catalogue first-run that says what to do next | `screens/firstrun.test.ts` | **EXISTS** |
| E6 | **Role-aware first-day checklist** for faculty, advisor, administrator inside the product, drawn from `FIRST-DAY-CHECKLISTS.md` and typed to real screens | each step navigates to a real `Screen`; shown only to holders of the role; dismissible | **PARTIAL** — the checklists exist as documents with typed screens; no in-product surface renders them |
| E7 | **Administrator implementation panel:** the school's own view of where its rollout stands (rollout state, gate evidence, open milestones, owners and backups) | readable by `tenant:configure` and `audit:read` holders only (the rollout table already restricts reads this way); no other tenant's data; states "record, not a switch" in plain words | **NOT BUILT** |
| E8 | **Known limitations in the product**, per tenant, generated from the same source as `KNOWN-LIMITATIONS.md` | every excluded capability of the order is listed; a limitation cannot be removed while the capability is off | **NOT BUILT** (page exists as a document) |
| E9 | **Integration status for students** — what is connected, why, freshness, how to turn it off | shows freshness labels and consent state; matches the Integration Dashboard | **NOT BUILT** (staff dashboard exists behind its flag; no student page) |
| E10 | **What changed:** release notes in plain language, scoped to the screens a person uses, shown once, dismissible | no more than one notice per session; none during a critical period freeze | **NOT BUILT** |
| E11 | **Help request with consented diagnostics** and a reference number; the person sees what will be sent | no password, token, course content or sensitive category in the payload | **PARTIAL** — tickets to Semester support are behind a flag |
| E12 | **Offline help:** guidebook, limitations and first-day checklists available without a network | works with the network disabled on the priority screens | **NOT BUILT** |
| E13 | **Tenant-specific facts from governed content** (calendar, emergency contacts, services) with owner, review interval, expiry, correction route; emergency and policy items never estimated | stale or expired items are hidden or labeled, not shown as current | **PARTIAL** — the content register and review rules exist; surfaces read them unevenly |
| E14 | **Accessibility of guidance itself:** keyboard-only, screen-reader named regions, 2.2 AA contrast in every theme, reduced motion honored, no time limits | covered by the app's accessibility and contrast suites for each new surface | applies to every new surface |
| E15 | **Plain language and localization:** reading level target, glossary, translatable strings | strings extracted; a language ships only when its modules pass the same checks | **PARTIAL** |
| E16 | **Enablement analytics, aggregate only:** share reaching first goal, help-route use, top help topics — above n ≥ 10, no per-person log | the metrics dictionary defines each; a small cell is suppressed, not shown | **NOT BUILT** |
| E17 | **Contextual prompts for destructive or consequential actions** (publish config, approve a scope, promote a roster, start offboarding) that say what happens, who is told, and how to undo | each prompt names the undo path; typed confirmation for irreversible ones | **PARTIAL** — typed-confirmation account deletion exists; admin flows vary |
| E18 | **In-product route to the Academy** for a seat that has not passed readiness, non-blocking | a link, never a gate that locks a student out | **NOT BUILT** |

## Rules for new guidance surfaces

- A new surface is added through the same shell slot or its documented exception;
  it does not introduce a second help pattern.
- Every claim in guidance is held by a test, as the Privacy screen's are.
- A tour is optional, short (three steps at most), and can be reopened from About
  this screen. A modal tour on first load is refused.
- Guidance never gates a capability and never penalizes skipping it.
- Words are reviewed by someone who is not the author, and by the accessibility
  lead for any new pattern.

## How requirements become work

Each NOT BUILT or PARTIAL row is a product-escalation item with a named owner,
raised through [`FEEDBACK-AND-ESCALATION.md`](FEEDBACK-AND-ESCALATION.md) and
referenced from the implementation that needed it. An implementation may not
promise a row to a customer that is not `EXISTS`; it is listed in the order as an
exclusion or a dated, owned dependency.

## Evidence state

**Repository evidence.** E1–E5 exist with the tests named; E6, E11, E13 and E15
exist in part.

**Operational evidence.** None: no tenant has used any of this with real users.

**Missing test/proof.** Build and test E7–E10, E12, E16, E18; extend E6, E11,
E13, E15, E17; run a usability pass with real students and an assistive-technology
pass on each new surface.

## Claim ceiling

Semester may describe E1–E5 as present and the rest as planned requirements.

## Prohibited claims

Do not claim in-product onboarding, adoption guidance, localization or offline
help beyond what the table marks EXISTS; do not claim guidance changes outcomes.
