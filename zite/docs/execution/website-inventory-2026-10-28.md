# Semester Website — phase 1 inventory and gap report (owner source S-94), 28 Oct 2026

S-94 phase 1 is "Inventory and gap report": what the public site (Zite app `qd1fxwimuc`, `apps/semester-site`) actually has today, measured against the S-94 specification. This is read-only. Nothing was changed, published or re-routed. S-94 forbids publishing, DNS or domain changes, access-setting changes and outside messages.

## 1. What exists

| Area | Today |
|---|---|
| Routes (16) | `/`, `/pilot`, `/pilot/request`, `/pricing`, `/programs`, `/trust` (+ `security`, `privacy`, `accessibility`, `responsible-ai`, `status`), `/updates`, `/updates/:slug`, `/mission`, `/contact`, `*` (not found) |
| Navigation | Programs, Pilot, Pricing, Trust, Updates, Mission, Contact; button "Request a pilot". No Sign in. Footer: Product (pilot), Company |
| Endpoints (all public) | `submitRequest` (intake), `programs` (institution-published programs only), `publishedPosts`, `trustCenter` |
| Homepage | Hero "One clear next step for every student.", what-students-get, pilot call to action |
| Page `<title>` | "Zite App" on every route; no per-route description, canonical URL or social preview; no `robots.txt` or sitemap |

## 2. Claims audit (S-94 §4, §8): clean

- The code already carries the rules "Status, not certifications" and "every public claim or number needs a source".
- **Customers and testimonials:** no customer is named and there are no testimonials.
- **Pricing:** no price is published; it reads "Price on request" ("Priced after the pilot, not before").
- **Trust centre:** states status ("Verified in test" means synthetic data only) and "never a certification we don't hold".
- **Search:** found no certification, SOC 2, ISO, "compliant", uptime, percentage or price claims. The "leading" matches are CSS classes.
- **S-94 corrections that apply:**
  - "Your official systems stay official" appears in the hero (`pages.tsx` line 22) and the footer (`Layout.tsx` line 86). S-94 asks for a transition message instead: incumbent systems stay authoritative until a domain is verified, reconciled and authorized.
  - "Registration Readiness Pilot" is presented as the product. S-94 makes it one entry point (`/solutions/registration-readiness`), not the definition of the company.

## 3. Intake form against S-94 §6 (10 behaviours)

| # | Behaviour | Today |
|---|---|---|
| 1 | Server-side validation | ✓ every field re-checked on the server |
| 2 | Length limits and abuse protection | ✓ limits, honeypot, at most 3 requests per email per hour |
| 3 | Duplicate-submit prevention | Partial: the button is disabled while sending, but there is no request key, so a retry after a timeout can create a second request |
| 4 | Saved to an approved destination | ✓ Postgres `site_inbound_requests` (system of record), mirrored to the Company OS inbox |
| 5 | Reference returned only after persistence | ✗ returns `{ ok }`; no reference is shown |
| 6 | Received / routing pending / routing failed shown separately | ✗ a mirror failure is only logged; the visitor always sees "received" |
| 7 | Notify only through a configured workflow | ✓ no notification is sent (none configured) |
| 8 | Keep the request if notification or routing fails | ✓ a mirror failure never loses the request |
| 9 | Never claim "meeting booked" without the scheduler | ✓ no booking claim |
| 10 | Marketing consent kept separate | ✓ consent covers replying only ("We don't add you to a mailing list") |
| — | No-sensitive-data warning beside free text | ✗ missing |
| — | Honest unavailable state if the backend is unconfigured | ✗ a failure shows a generic retry message |

## 4. Visual tokens against S-94 §5

| S-94 token | S-94 value | Current | Current value | Gap |
|---|---|---|---|---|
| canvas | #F4F1E9 | background | #F5F2EB | ≈ match |
| surface | #FFFEFA | card | #FBF9F4 | slightly darker |
| ink | #21211D | foreground | #101219 | darker, cooler |
| muted | #62635B | muted-foreground | #67615B | ≈ |
| olive (accent) | #6B5B32 | editorial | #6B5B33 | match, but used for editorial type only |
| border | #DDD9CE | border | #D8D3CA | ≈ |
| sage | #E6EBDD | — | — | missing (current accent is a blue-grey, #DFE6EC) |
| — | — | primary | #416181 (blue) | S-94 has no blue; buttons and links would move to olive |

Contrast must be re-measured for any change (S-94 §5). Typefaces and the 1280/720 widths and 8/14/22 px radii have not been audited yet.

## 5. Information architecture: target routes against today

**Present (11 of about 45):** `/`, `/pricing`, `/contact`, `/mission`, `/updates`, `/trust`, `/trust/security`, `/trust/privacy`, `/trust/accessibility`, `/trust/responsible-ai`, not found. `/trust/status` and `/programs` exist and are extra to S-94.

**Partly present:** `/request-pilot` exists as `/pilot/request` and needs a redirect, not a second page; `/solutions/registration-readiness` exists as `/pilot`.

**Missing:**
- **Product pages:** `/product` and its 11 pages (action-center, workspace, search, ai, planning, learning, registration, advising-support, career, campus, institutional-operations).
- **Audience pages:** `/for/` students, faculty, institutions, applicants, families, employers, and advisors and staff.
- **Solutions:** `/solutions` and career-readiness, connected-learning, student-support.
- **Implementation:** `/implementation`, `/implementation/integrations`, `/implementation/migration`.
- **Other pages:** `/request-demo`, `/resources`, `/faq`.
- **Legal:** `/legal/privacy`, `/legal/terms`, `/legal/security`.
- **Account:** `/sign-in`, which routes to verified app destinations only and never exposes Company OS, Security Lab or Developers.

**Homepage:** 3 of S-94's 13 sections exist (hero, a value section, call to action). Missing: the Action Center demo with 3 synthetic scenarios, fragmentation diagram, foundations, domain tiles, audience explorer, registration journey, lifecycle, trust, engagement options, FAQ and the five-group footer.

## 6. What an honest product page can say today

S-94 §4 requires each product claim to have an owner, evidence and wording. The evidence exists in the repository:
- the connection register (`lib/connectionRegister.ts`): 23 connections, 15 observed;
- the domain register (`lib/replacementRegister.ts`): 44 domains, 25 tested and none deployed or authorized;
- the permission evidence register (`lib/permissionEvidence.ts`): 8 of S-92's 13 denial tests evidenced.

Any page copy should draw its status words from these registers, using their own wording ("tested", "not deployed"). It should not use marketing adjectives.

## 7. Phase 2 and later (S-94 §9), in order, and what needs the owner

1. Fix the two corrections in §2, the page title and per-route metadata. The domain is not touched.
2. Bring the intake form to all 10 behaviours: request key, reference after save, routing states, sensitive-data warning.
3. Shared shell and tokens: decide olive versus blue for primary actions (**owner decision**), add sage, measure contrast.
4. Homepage sections with **labelled synthetic** demos, then the product, audience, solution and implementation templates.
5. Sign-in routing to verified destinations only.

**Owner inputs needed before publishing anything:** approved positioning wording, claim owners and reviewers, legal pages (privacy, terms, security) from counsel, the primary-colour decision, and permission to publish (publishing remains yours).

## Phase 2, first items (same day)

Done without touching the domain, access settings or publishing:

- **Wording corrections from S-94:**
  - Hero: "Your current systems stay authoritative until each area is verified, reconciled and authorized to move."
  - Footer: "Current systems stay authoritative until each move is verified and authorized."
- **Titles:** every page with a page heading now sets its own browser title ("… · Semester"); the home page sets "Semester · One clear next step for every student". `index.html` is titled "Semester" and has a description. Canonical URLs, social previews and a sitemap wait for the domain decision.
- **Intake form, now 8 of the 10 behaviours plus the warning:**
  - A request key per filled-in form: a retry returns the same saved request, and the same key with different details is refused.
  - A reference (`SR-` plus 8 random hex characters, not a counter) is returned only after the row is saved.
  - Routing is recorded as `routed` or `pending`, and the visitor is told which; a pending request is still saved.
  - A no-sensitive-data note sits under the message box.
  - Errors say nothing was sent and that the visitor's answers are kept.
- **Live check** against the real endpoint, with one labelled synthetic request left in the inbox: 6/6. Saved and routed with reference SR-8403F05C; a retry returned the same reference; a reused key with other details was refused; the honeypot stored nothing; a short key was refused.
- **NOT RUN:** the pending-routing message (the inbox copy succeeded); browser screenshots; contrast measurement.

Still open: the primary-colour decision (blue versus olive) and sage; the homepage sections, product, audience, solution and implementation pages; sign-in routing; legal pages from counsel.
