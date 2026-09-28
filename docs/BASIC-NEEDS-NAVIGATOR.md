# Basic-Needs Navigator

<!-- Rendered from app/src/lib/basicneeds.ts by basicneeds.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).

A private, nonjudgmental, one-stop resource and action layer. The Hope Center
describes comprehensive approaches as including central resource hubs, awareness
of public benefits and regular assessment of needs; basic needs span more than
food and housing — health care, technology, transportation, hygiene and child
care. A filterable directory is a content and routing system, not a central
database of student hardship.

**A student should never have to trade privacy for help, and an institution should never have to trade safety for usefulness.**

| Supplied document | What it holds |
| --- | --- |
| [Tell me more about basic-needs navigators](expansion/Transfer-Hub-Career-Safe-AI-and-Basic-Needs.pdf) | The student experience, the categories, the resource object model, privacy-preserving intake and the five levels. |
| [Build a student support resource navigator: a filterable directory](expansion/FERPA-Consent-AI-Training-Policy-and-800-1-Checklist.pdf) | The directory schema with an example row, the student filters and the six-step access workflow. |

## What the app has today

`app/src/lib/support.ts` is the map: care, basic needs, access, safety and the
campus, every entry routing to an office, a national line or a screen, with its
privacy level drawn before the link. `app/src/lib/help-routes.ts` sends a
previewed request to an office and refuses to store one for wellbeing, money or
accessibility. `app/src/lib/campusdirectory.ts` holds a school-imported
departments-and-offices directory with hours and appointment details. Held by
`app/src/lib/journey.guards.test.ts` and `app/src/lib/help-routes.test.ts`. What
is missing is the resource object: an entry is an office pointer, not an
institution-verified resource with eligibility, documents, cost, hours, language,
accessibility, an owner and a review date.

## Student experience

1. “I need help with…” — choose a category or type a plain-language request
2. See institution-verified options first
3. See eligibility, cost, hours, location, language, accessibility and documents
4. Start a private checklist
5. Book, or hand off to the official service
6. Save, return, or ask for a human navigator
7. Report outdated information

## Categories

10 of 17 route somewhere in the support directory today; the test reads the directory to say which.

| Category | Offices it routes to | In the directory |
| --- | --- | --- |
| Food and nutrition | `basicneeds`, `dining` | yes |
| Housing and housing instability | `basicneeds`, `housing` | yes |
| Emergency financial support | `deanofstudents`, `financialaid` | yes |
| Technology, internet and device access | — | no |
| Transportation and parking or transit | `transit` | yes |
| Health-care and insurance navigation | `health` | yes |
| Mental-health and wellness resource routing | `counseling`, `care` | yes |
| Childcare and family support | `basicneeds` | yes |
| Personal hygiene and clothing | — | no |
| Legal aid or advocacy, where institutionally offered | `deanofstudents` | yes |
| Safety and emergency information | `safety` | yes |
| Financial aid and student-account services | `financialaid`, `bursar` | no |
| Employment and work-study | `career`, `financialaid` | no |
| Disability and accessibility services | `access` | yes |
| International-student services | `international` | no |
| Veteran and military-connected services | — | no |
| Community and public-benefits referrals | — | no |

## Resource object model

Every resource needs an accountable owner and freshness controls. 9 of 15 fields have somewhere to live on the app’s own types; the rest are the object model the navigator needs.

| Field | Carried by | Note |
| --- | --- | --- |
| Resource name | `Entry.title` | What the student reads. |
| Institution, partner or official status | `Entry.studentRun` | Only “student-run” is distinguished; institution, verified partner and public benefit are not. |
| Owner office or verified provider | `Entry.office` | An office id with what it decides; no verified community provider can be an owner. |
| Who it is for and eligibility | **none** | Not on an entry. Office actions carry eligibility the student chose; resources do not. |
| What it provides | `Entry.what` | One sentence. |
| Cost and payment details | **none** | Nothing says whether a resource is free. |
| Hours, locations, remote options | `CampusListing.details` | Only where a school imported its directory; the shipped entries have no hours. |
| Languages and accessibility features | **none** | Nothing on either type. |
| Required documents | **none** | Nothing on either type. |
| Application, appointment or official handoff link | `CampusListing.url` | The office link resolves through officeUrl(), which returns nothing rather than guess. |
| Emergency or non-emergency label | `Entry.call` | The three national lines carry a number; the section says it is not an emergency service. |
| Last reviewed date | `CampusListing.starts` | A directory carries one `updated` stamp for the whole import, not one per resource; an entry has none. |
| Expiry or review date | **none** | Nothing expires a resource. |
| Feedback and broken-link route | **none** | “This source is out of date” under About this screen is a report about a screen, not a queue per resource. |
| Privacy note | `Entry.privacy` | Confidential, private, reports or public, drawn before the link. |

### Directory schema, by example

| Field | Example |
| --- | --- |
| Resource name | Emergency grocery support |
| Category | Food and nutrition |
| Provider type | Institution office / verified community partner / public benefit |
| Owner | Basic Needs Center |
| Status | Institution verified |
| Eligibility | Currently enrolled students; check current policy |
| Documentation | Student ID; appointment may be required |
| Cost | Free |
| Access type | Walk-in, appointment, online request |
| Location / service area | Student Union, Room 120 / remote option |
| Hours | Mon–Fri, 9 AM–5 PM |
| Languages | English, Spanish, interpretation available |
| Accessibility | Step-free entrance; remote intake option |
| Privacy note | Browsing does not notify staff; a referral shares only selected details |
| Emergency note | Not an emergency service; use the official emergency route for immediate danger |
| Official source URL | Institution resource page |
| Last reviewed | 2026-09-15 |
| Review due | 2026-12-15 |
| Content owner | Named office or role |
| Report issue | Broken-link or outdated-information form |

### Student filters

- Need category
- Urgency: today, this week, planning ahead
- Eligibility group, only if voluntarily selected
- Cost: free, low cost, insurance accepted
- Location and transit access
- Remote or hybrid availability
- Hours: evening, weekend, open now
- Language
- Accessibility features
- Appointment needed
- Documentation required
- Institutional or community provider

## Privacy-preserving intake

Default to resource discovery without personal disclosure. If a student wants a
referral or an appointment, collect only what the designated owner needs.

- **Level 0.** Browse anonymously where permitted.
- **Level 1.** Save a private resource or checklist.
- **Level 2.** Request an appointment or referral with the minimum necessary information.
- **Level 3.** Consent to share a defined request with a named office.
- **Level 4.** Follow the official office workflow outside Semester if sensitive intake is required.

**Do not automatically notify an advisor, parent, faculty member, employer, club leader or institution simply because a student browsed a basic-needs resource.** The support screen already prints “Nobody is told that you opened this page.” and help-routes stores nothing for a wellbeing, money or accessibility look; the test holds both.

### Access workflow

| Step | What it keeps private |
| --- | --- |
| Browse | No login, or no staff-visible record, where feasible. |
| Save | A private student bookmark or checklist; no staff notification. |
| Prepare | The student sees documents, eligibility, hours, questions and the official link. |
| Request | The student explicitly selects a named recipient and shares only required fields. |
| Refer | The receiving office accepts or declines the assignment and updates a limited referral status. |
| Close | The student receives outcome options; sensitive details remain in the official service system, not the general Semester platform. |

Who may see what, module by module, is [`MODULE-PRIVACY-MODEL.md`](MODULE-PRIVACY-MODEL.md);
the module’s place among the twenty-six services is
[`SERVICE-EXPANSION-REGISTER.md`](SERVICE-EXPANSION-REGISTER.md#s01).
