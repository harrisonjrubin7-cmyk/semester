# Product Copy and Voice Guide

| Control | Value |
| --- | --- |
| Status | **CONTROLLED GUIDE — AUTOMATED TERMINOLOGY GUARDS PARTIAL; ROUTE-WIDE REVIEW OPEN** |
| Owner | Harrison Rubin — Product, Content Design and Trust coordination; backup content reviewer and customer terminology approver unassigned |
| Evidence date | 2026-10-03 |
| Canonical sources | [`SEMESTER-CONTENT-STANDARDS.md`](../design/SEMESTER-CONTENT-STANDARDS.md), [`STATUS-SOURCE-VISUAL-LANGUAGE.md`](../design/STATUS-SOURCE-VISUAL-LANGUAGE.md), and current product copy guards under `app/src/` |

## Voice

Semester is clear, supportive, calm, direct and honest about uncertainty. It helps a person understand the situation and take the next useful step without shame, pressure, false urgency or institutional impersonation. Use plain language, short sentences, sentence case and specific verbs. Put the action first and supporting detail second.

The product says **you** to students. It does not diagnose motivation, predict failure, rank a person, or turn missed work, disability, finances, health, advising or support needs into a judgment. It does not use gamification or streak language to create guilt.

## Decision-point copy contract

At any consequential decision, answer in this order:

1. **What this is.** Name the object, action or recommendation.
2. **Why it matters now.** Give the relevant date, condition or user choice without manufactured urgency.
3. **Where it came from.** Show source, freshness and uncertainty through the canonical trust components.
4. **What will happen.** State whether the result stays in Semester, opens an official system, sends a request or changes an authoritative record.
5. **What the person can do.** Use a verb-plus-object label and include correction, dismissal, manual/non-AI and help paths where applicable.
6. **How to recover.** Preserve work, name what still works and give a safe next step.

## Canonical language

| Meaning | Use | Avoid or constrain |
| --- | --- | --- |
| concrete next step | **action** | task, to-do, vague “continue” |
| future arrangement | **plan** | roadmap; schedule unless it is a timetable |
| institution source of record | **Institution verified** badge; “official” in prose when accurate | verified without naming who verified it |
| copied data | **Imported** | synced unless a continuing refresh is actually operating |
| person-provided data | **Student entered** | official, institution verified |
| computed value | **Estimated** | exact, guaranteed, official |
| AI involvement | **AI-assisted** | smart, automatic, generated when AI was involved |
| uncertain or questionable data | **Needs review** / needs confirmation | unverified as a generic accusation |
| external consequential action | **Open official system** | register, submit or approve when Semester only hands off |
| saving inside Semester | **Save** | submit or confirm unless the consequence requires it |

The stored and displayed source vocabulary remains controlled by `app/src/lib/source.ts` and `SourceBadge`. `NotOfficial` is the prose boundary and the intelligence disclosure is the AI receipt. Do not invent a parallel badge, freshness term or authority vocabulary. Unknown freshness stays unknown; never replace it with “live,” “current” or a fabricated time.

## Message patterns

| Situation | Required construction | Example |
| --- | --- | --- |
| primary action | verb + object | “Review your plan” |
| empty state | what is absent → why it matters → one action | “No study sessions planned. Add a focused block for upcoming work. Plan a study session.” |
| error | what failed → what remains → recovery → help | “We could not refresh registration details. Your saved plan is available. Try again or open official registration.” |
| success | specific past-tense result → next step | “Changes saved. Review your next action.” |
| destructive action | consequence, scope and unaffected official state → cancel + explicit action | “Delete this plan? This removes it from Semester; it does not change enrollment.” |
| stale/unavailable source | source + last known time/unknown age → impact → retry/official fallback | “Registration data is unavailable. Your saved plan may be out of date. Try again or open official registration.” |
| AI-assisted output | AI label → basis/sources → limit → edit/verify/dismiss/person | “AI-assisted suggestion based on the dates you saved. Review it before using it.” |
| sample/demo content | label before reliance | “Sample course — not your institution record.” |

## Commercial and institutional claims

Use only claims supported by current evidence and the approved claims register. Say “proposed,” “designed,” “repository-tested,” “available in a controlled invitation beta,” or “subject to customer configuration and approval” when those are the true states. Name the tested scope, date and environment.

Never turn a plan, template, flag, demo, local test, draft agreement, policy, repository control or self-assessment into a claim of deployment, customer acceptance, certification, compliance, accessibility conformance, security assurance, guaranteed outcome, live integration, production operation or general availability. Do not claim causal gains in GPA, retention, completion, wellbeing or institutional performance without an approved study.

## Accessibility and localization

- Put essential meaning in text, not only color, icons, position, animation or sound.
- Use descriptive link and button labels; announce status without duplicating speech.
- Keep sentences and headings literal enough to translate. Avoid idioms, sarcasm and culturally specific shorthand in controls.
- Use the shared date, time, number and timezone formatters. Do not hand-format values.
- Machine-translated policy is never presented as authoritative; show the original and the official-language boundary.
- Locale is selected by the person, not inferred from identity or network information.

## Review checklist

For changed product copy, confirm the user and job; one dominant next action; canonical term and label; source/freshness/authority; AI involvement; consequence and official-system boundary; empty/loading/error/stale/offline/restricted/recovery language; calm/non-judgmental tone; accessible name and announcement; localization/date/number behavior; legal or commercial claim source; support route; and an accountable reviewer. A customer-controlled term needs named customer approval before use in a pilot.

## Evidence state

**Code/config evidence.** The repository includes terminology lint and ledger controls, calm-language tests, sales-copy drift tests, source-label tests, accessibility telling guards and shared source/disclosure/error/state components. The existing content standard defines canonical vocabulary and message patterns.

**Operational evidence.** No complete current route-by-route copy inventory, representative comprehension study, qualified localization review or named-customer terminology acceptance covers the finalized product. Automated string scans do not evaluate meaning in every context.

**Missing test/proof.** Generate a route/state copy inventory; reconcile remaining trust/status vocabulary; review high-impact, billing, privacy, accessibility, AI and institutional claims; test source and consequence comprehension with representative users; validate screen-reader announcements and translated expansion; obtain customer approval for institution-specific language; and assign a backup reviewer.

## Claim ceiling

Semester may say it has a documented calm, plain-language product voice and automated guards for selected terminology, trust, sales and non-judgmental language. It may cite exact copy tests with their date and scope.

## Prohibited claims

Do not claim universal copy consistency, plain-language certification, localization readiness, user comprehension, institution-approved terminology or freedom from misleading claims until the missing evidence above is filed.
