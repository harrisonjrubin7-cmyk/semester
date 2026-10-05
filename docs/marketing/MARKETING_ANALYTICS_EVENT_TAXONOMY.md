# Marketing analytics event taxonomy

Status: **proposed; nothing is collected and nothing may be until the preconditions in §2 pass.**
This is the largest conflict between the brief and the repository, so it is stated first.

## 1. The conflict

The repository's analytics position is deliberately narrow: `ANALYTICS.md` collects three
figures (activation, weekly active use, 30-day retention) as three marks in `public.activity`,
only for signed-in accounts; there are no cookies, no consent banner, no third-party
analytics, and `phase5docs.test.ts` fails if a vendor host enters the CSP. The privacy model is
"signed out, nothing leaves the device". The only public-site measurement is lead attribution,
which travels with a form the visitor chooses to submit. The brief asks for 20 `marketing_*`
events. Adding collection changes what the company says about itself, so it is a decision, not
a build task.

## 2. Preconditions (all required before any collection ships)

1. Owner decision recorded as `docs/decisions/D-<PR number>.md`.
2. `ANALYTICS.md` updated with the question each event answers (the file's own rule for
   adding a mark), and `docs/legal/COOKIE-AND-STORAGE-NOTICE-DRAFT.md` and
   `COOKIE-CONSENT-IMPLEMENTATION-SPEC.md` updated and reviewed.
3. Collection is **first-party only**: an Edge Function the site posts to; no third-party
   script, tag manager, pixel or session replay. CSP changes only to add that one endpoint,
   with the `phase5docs` guard updated deliberately.
4. **Fail-closed consent**: no event, no identifier and no storage until the visitor grants
   analytics consent; "Reject" is as prominent as "Accept"; a persistent control to change it.
   Essential first-party operation (the form the visitor submits) needs no analytics consent.
5. Retention and access owner named; cohort floor `MIN_COHORT = 10` applies to any reporting.
6. A `FORBIDDEN` denylist test (extends the one in `institution-ops.ts`) rejecting any
   payload key outside the allow-list below.

Until then the correct implementation is the **event contract and a no-op sink**: typed
event builders, the allow-list and its tests, wired to nothing.

## 3. Allow-listed fields (nothing else is ever sent)

`event`, `ts`, `page_type`, `page_slug`, `cta_id`, `utm_source`, `utm_medium`,
`utm_campaign`, `utm_content`, `consent_state` (`granted|denied|unset`), `schema_version`,
`anon_id` (only after consent; random, rotated, never derived from an email or device),
`user_id` and `tenant_id` only for authenticated product events and only where permitted.
`referrer` is host only.

**Never sent:** academic records, grades, accommodations, financial aid, health or
disciplinary information, student-support content, raw tickets, private institution data,
secrets, credentials, email addresses, names, free-text from forms, IP addresses.

## 4. Events

| Event | Fires when | Extra safe fields |
| --- | --- | --- |
| `marketing_page_viewed` | page render, after consent | — |
| `marketing_cta_clicked` | CTA activation | `cta_id` |
| `marketing_demo_started` | first interaction with the demo/pilot form | `form_id` |
| `marketing_demo_submitted` | server accepted the request | `route_key` (no lead id) |
| `marketing_demo_qualified` | **internal only**, from the CRM stage change; never browser-side | `stage` |
| `marketing_calendar_opened` | calendar link opened | — |
| `marketing_calendar_booked` | **internal only** | — |
| `marketing_resource_viewed` / `_downloaded` | resource page / download | `resource_slug` |
| `marketing_webinar_registered` | registration accepted | `resource_slug` |
| `marketing_pricing_viewed` | pricing page | — |
| `marketing_pilot_page_viewed` | `/pilot` | — |
| `marketing_trust_center_viewed` | any `/trust*` page | `page_slug` |
| `marketing_case_study_viewed` | case study (none exist yet) | `resource_slug` |
| `marketing_signup_started` / `_completed` | app sign-up handoff | — |
| `marketing_activation_completed` | the `activity` activation mark | — |
| `marketing_first_meaningful_action` | first-action mark | — |
| `marketing_referral_started` / `_completed` | referral code taken / redeemed | — |

Server-observed events (`qualified`, `booked`, `activation`, `first_meaningful_action`,
`referral_completed`) are derived from internal records and carry no browser identifiers.
`activation` and `first_meaningful_action` map to the existing `opened`/`studied` marks; they
are not new collection.

## 5. Schema

`{ "v": 1, ...allow-listed fields }`; unknown keys are rejected, not dropped silently;
`schema_version` increments on any change; the contract lives in one typed module and one
test enumerates the events above.

## 6. Reporting

Aggregates only, with the cohort floor; no per-person view; weekly review owner named;
dashboards are not built in this phase.
