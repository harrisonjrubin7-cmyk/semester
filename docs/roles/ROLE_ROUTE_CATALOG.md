# Role route catalog

**As of** 2026-10-05 · **Part of** [`ROLE_SYSTEM_MASTER_MAP.md`](ROLE_SYSTEM_MASTER_MAP.md) · **Status** audit evidence.

## Routing as built

- **Hash router, hand-rolled.** No router library. `app/src/lib/route.ts` (`toHash`, `fromHash`), the store listens for `popstate` and `hashchange` (`app/src/state/store.tsx`). Chosen because the app was served from a GitHub Pages subpath with no rewrites.
- **95 route keys** in `SCREENS` (`app/src/screens.tsx`). Ids ride in the path (`#/course/econ`, `#/call/<code>`, `#/write/<id>`); `guide?mode=` is the only query parameter.
- **The requested `/app/t/:tenantSlug/...` scheme does not exist.** A search for `/app/t/` and `tenantSlug` finds nothing. There is no tenant, school or role in any route. Tenant comes from the signed-in account and `profiles.school_id`; the client copy `state.schoolId` is display only.
- **Unknown route renders Today** (`App.tsx`), not a not-found state. An unknown id on `#/guide/<x>` draws the first course.
- **Vercel:** root `vercel.json` rewrites host `(www.)semester.website` to the `company-site` service and `/lab*` to `workflow-lab`; everything else goes to `app`. `app/vercel.json` has no SPA rewrite, which hash routing does not need. Adopting path routes would need rewrites for `app`.

## Authorization at the route boundary

| Layer | Checked at route? | Detail |
| --- | --- | --- |
| Role | Partly | `screenForRole` blocks 12 student-only screens for non-student local roles (`degree`, `runway`, `behind`, `groupwork`, `meals`, `housing`, `yes`, `classmates`, `activities`, `costs`, `applying`, `launchpad`). Applied on navigation, **not on the first render from a hash**, so a bookmark can render once. The local role is a self-selected setting, not authority |
| Capability | No | Checked inside screens via `my_capabilities()` (Console, Gradebook, Registration, University tabs) |
| School capability | No | `allowed(screen, caps)` filters navigation lists only; typing `#/meals` still renders |
| Entitlement, membership | No | |
| Kill switch, module state | Per screen | `useModuleGate` for Gradebook and Registration only |
| Server | Yes, where it matters | RLS, `has_capability`, `console_act` re-check every call (UNVERIFIED per function) |

A role-blocked route redirects to home with no explanation; there is no shared forbidden page. `ModuleGateState` renders on, loading, off, stopped, signed-out, no-school and error for Gradebook, Registration and a few components; Console, Moderation, Agreements and Volunteers use ad-hoc notices without retry.

## Staff routes that exist (all by typed hash or inline link, not in the nav)

`#/console` (needs `console:operate`), `#/moderation`, `#/volunteers`, `#/agreements`, `#/registration` (Registrar tab needs `registration:administer`), `#/gradebook` (instructor view by course-scoped capability), `#/university` (capability-built tabs), `#/dining`. `#/registrar` is the student term planner, not a registrar desk.

## Requested catalog against reality

| Requested | Today |
| --- | --- |
| `/app/t/:tenantSlug/student/*` (13 routes) | Student screens exist under the 95 keys: today, plan (`degree`, `pathway`), registration (`registration`, `yes`), courses, study, support, campus, community, career, account (`account`, `bill`, `costs`), privacy, settings. No tenant segment |
| `/app/t/:tenantSlug/faculty/*` (7) | `gradebook`; Course Studio inside `account`; no courses, teaching, assessments, office-hours or course-policy screens |
| `/app/t/:tenantSlug/advisor/*` (6) | None. `degree` carries the student side of advisor meeting mode |
| `/app/t/:tenantSlug/registrar/*` (11) | `registration` Registrar tab covers terms, sections, requests and overrides; holds, records, degree-audit, graduation and reconciliation have no screen |
| `/app/t/:tenantSlug/institution/*` (14) | `university` tabs; no overview, student-success, community-safety, career, identity, governance or portability screen |
| `/app/ops/*` (about 38) | `console` tabs: Command center, Support, Approvals, Break-glass, Audit, Customers, Figures, Finance model, Releases and flags, Evidence, Views |

## Public site

Single `index.html` with `data-page` sections and path routing by `history.pushState` (`company-site/site.js`). Every path returns HTTP 200 through a catch-all rewrite; an unknown path renders a client-side not-found page.

| Requested | Today |
| --- | --- |
| `/`, `/product`, `/pricing`, `/trust`, `/developers`, `/careers` | Exist |
| `/solutions` | No; audience pages exist at `/departments`, `/advising`, `/registrars`, `/faculty`, `/it`, `/enterprise`, `/k12`, `/advancement` |
| `/pilot` | No page; nearest `/launch`, `/launch-kit`, `/design-partners` |
| `/demo` | No; `/demo-lab`, `/experience`; links go to a GitHub Pages origin |
| `/partners` | No; `/partner-portal`, `/design-partners` |
| `/auth`, `/onboarding`, `/download`, `/app` | No. Log-in and sign-up are external links to the GitHub Pages app (`#/login`, `#/signup`) |

Two production origins appear in the repository (Vercel and GitHub Pages); whether that is intended is UNVERIFIED. The demo build is served at `/demo/` on the same origin as the real app and shares browser storage with it (RG-14).

## Decision needed before the route work

Adopting `/app/t/:tenantSlug/...` changes the router, every deep link, the Pages deployment and the offline and service-worker scope. It is a decision for an ADR (RG-25), not a documentation task. The tenant segment would be a display and routing hint only; the server must keep deriving the tenant from the account, never from the URL (`docs/platform/adr/tenant-is-derived-never-submitted.md`).
