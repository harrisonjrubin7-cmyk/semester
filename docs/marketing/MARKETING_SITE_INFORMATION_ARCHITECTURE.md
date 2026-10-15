# Marketing site information architecture

Status: proposed. The requested route set is mapped onto what exists, with a state for
each route so unfinished or unapproved pages are never presented as generally available.

## 1. States

`live` exists and is public · `adapt` exists in some form and needs rework to the target ·
`new` does not exist · `draft` build behind a non-indexed state · `coming-soon` honest
placeholder · `internal` not public · `blocked` cannot go public until a stated gate clears.
A page carries a state in its content record; `draft`, `internal` and `blocked` pages are
not in the sitemap and are `noindex`.

## 2. Route map

| Target route | Closest existing | State | Notes / gate |
| --- | --- | --- | --- |
| `/` | company-site `home`; app/site `/` | adapt | Homepage wireframe from the brief; **keep the claims in §3 of the audit out** |
| `/product` | `product` / `/product/` | adapt | |
| `/product/student-workspace` | `students` | adapt | |
| `/product/institution-platform` | `institutions` | adapt | no "replaces" language (CLM-006) |
| `/product/registration-readiness` | `design-partners`, `launch` | new | the pilot wedge |
| `/product/advising-and-student-success` | — | new, draft | |
| `/product/governed-ai` | `trust-data-ai`, `ai-governance-canvas` | adapt | CLM-011 qualifications |
| `/product/integrations` | `integrations`, `compatibility`, `/platform/integrations/` | adapt, **blocked** | CLM-005: no integration listed as available unless a live accepted connector exists |
| `/solutions/*` (students, advisors, student-success, registrars, academic-departments, institutions, enterprise) | generated `SOL` pages | adapt | enterprise is `blocked` (NO-GO broad sale) |
| `/pilot` | `design-partners`, `launch`, `implementation-readiness` | new | non-activation conversation only |
| `/pricing` | `pricing` | adapt, **blocked for amounts** | request-pricing until an approval record exists |
| `/compare` | `compare`, `why-semester` | adapt | comparison needs sourced evidence per row |
| `/demo` | `experience`, `demo-lab`, github.io demo | adapt | fictional data labelled |
| `/security` `/privacy` `/accessibility` | `trust-security`, `student-data-rights`, `accessibility` | adapt | statement stays draft until its four conditions pass |
| `/trust`, `/trust/*` | `trust`, `trustsub` | adapt | see Trust Center architecture |
| `/resources`, `/resources/guides|webinars|research|case-studies|product-updates|faq` | `tools`, `kits`, `research`, `updates`, `help` | adapt | `case-studies` is `coming-soon` (none exist) |
| `/partners` `/ambassadors` `/careers` `/company` `/contact` | `partner-portal`, `fellows`/`refer`, `careers`, `company`, `contact` | adapt | disclosure rules apply to ambassadors |
| `/legal`, `/legal/terms|privacy|acceptable-use|dpa|cookies` | `legal`, `legal-versions` | adapt | all are DRAFT and counsel-gated; render the draft status |
| `/login` | `/login/` handoff | live | |

Extra existing company-site views (about 60, e.g. `build-my-semester`, `launch-estimator`,
`outcomes`, `executive-briefing`, `rfp`, `procurement-tracker`) are **not in the target set**.
They are not deleted by this work. They are inventoried in the backlog for a keep/merge/retire
decision, because `outcomes`, `executive-briefing`, `launch-estimator` and calculators are
the likeliest to carry claims that need the audit's classification.

## 3. Navigation

Header (target): Semester logo · Product · Solutions · Trust · Resources · Pricing ·
Company · Sign in · Request demo / request pilot. Mobile: a labelled drawer with correct
dialog semantics, Esc, focus trap and return. Current page via `aria-current`. No
hover-only navigation. Help/contact/status in the same relative place on every page (WCAG
3.2.6). Footer: Product, Solutions, Trust, Resources, Company, Legal, Accessibility, Privacy,
Status, Contact, Report a vulnerability.

## 4. One renderer

Recommendation (agrees with `docs/product/company-site-audit.md`): **converge on
`app/src/site` as the one renderer** and freeze `company-site/` to redirects once parity
exists. Reasons from the audit: it already prerenders a real HTML file per route (real
404s, readable without JS, `h1` in the HTML); uses the app's tokens directly (no hand-copied
values); is covered by vitest like the rest of the app; and can be component-tested
and axe-tested under the existing infrastructure.
What it lacks and must gain before it can be authoritative: lead forms (it has none),
a deployment target and `SITE_ORIGIN` (canonical, sitemap, OG), the JS that forms need,
and the content of the converted pages.
Risks: company-site is the *deployed* site and carries 21 forms; migrating without parity
would regress live conversion. So the order is: **(1)** fix `company-site` defects in place
(F-01, F-02, removals) because they are live; **(2)** build new surfaces in `app/src/site`
using the shared component library; **(3)** port intake; **(4)** point `www.semester.website`
at the new build with redirects from every old hash/path; **(5)** retire. This is a
decision for the owner (backlog D-2); this phase builds neither site.

## 5. SEO structure

One canonical origin; canonical + `og:*` per page from content records; sitemap generated
from the route table (not hand-maintained); `robots.txt` excluding `draft`/`internal`; real
404 page; redirect table for the old hash/path URLs; breadcrumbs as `nav[aria-label=Breadcrumb]`
where depth > 1; internal-link map by topic cluster (registration readiness, advising,
student next steps, governed AI, trust); structured data only where accurate and approved
(`Organization` with an approved contact, `WebSite`, `BreadcrumbList`; **no** `Product`/`Review`/`Offer`
schema while there is no approved price or review). Titles and descriptions unique per page.

## 6. Resource hub taxonomy

Type: guide, webinar, research, case study (empty), product update, FAQ.
Topic clusters: registration readiness, advising workflows, student success, governed AI,
accessibility and privacy, procurement. Every resource carries author/source, publish and
update dates, reading time, owner and `next_review_at`, and no gated download without a clear
data-use explanation.
