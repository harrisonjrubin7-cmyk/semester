# Response to the company-site and operations-console reviews

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).

Two reviews arrived on 28 September 2026, of two HTML prototypes that are not
in this repository: a company site with a HECVAT simulator, a procurement
accelerator, an integrations directory and an interactive demo, and an
operations console with tiered roles, a sensitive-action dialog and a
hash-chained audit log in the browser. Both reviews reached the same finding:
the prototypes were strong in shape and ahead of the product in what they
said. This page records what was done about each recommendation *in the
repository*, which is where the real site (`app/src/site/`) and the real
operating registers (`app/src/lib/ops/`) live. The decision is
[D-110](DECISION-LOG.md).

The first thing to say is that the repository's site had never made most of
the claims the review flagged. It has no "193 tables", no "10,000 tests", no
SAML on a page, no HECVAT simulator, no cancellation flow with an end date,
no contact form, and no invented company addresses. What it lacked was a
mechanism that would stop it, and the reviews' most useful recommendation —
label every capability with a status the evidence supports — is the
mechanism. That is what landed.

## The company-site review

| # | Recommendation | Disposition |
| --- | --- | --- |
| 1 | Replace demo-only forms with secure backend workflows (contact, demo, procurement, careers, barrier reports, billing) | **Not applicable to this site, on purpose.** It has no forms: its policy carries `form-action 'none'`, contact is `mailto:`, and nothing typed is stored. A backend for forms is a product decision (D-009 keeps billing out; support tickets exist server-side, off by default). The barrier-report and security-report *expectations* the review asks for are now stated on `/accessibility/`, `/security/` and `/contact/`: read by a person, treated as a bug, no response time promised, and how to escalate. |
| 2 | Claims ahead of reality; add a shared claim-status component everywhere a capability is described | **Done, as a register with a test.** `app/src/lib/ops/claims.ts` holds every capability the site names, with one of six words (Available now, Limited beta, Institution-configured, Built and tested, In preparation, Planned), the master-register rows it rests on, the tests or documents behind it, and the pages it appears on. `claims.test.ts` renders the site and refuses a word above its rows, an "available" with no test, a page that does not print the wording, and any label the register does not know. `app/src/site/claims.tsx` prints them. Rendered at [`ops/claims/README.md`](../ops/claims/README.md). The review's own examples come out as: SAML SSO **In preparation**; LTI 1.3 **Built and tested, not yet deployed**; VPAT/ACR **Planned**; self-service export and deletion **Available now**. |
| 3 | Pricing needs currency, billing period, tax, trial, upgrade, cancellation, what remains, refunds, receipts, billing contact, institution-sponsored access | **Done** on `/pricing/`, under "Before anything goes on sale", with the claim `no-sale` labelled Planned. No checkout exists and none is added (D-009). The review's "do not expose a cancellation flow with a specific end date": the site never had one. |
| 4 | Real company addresses (hello@, support@, security@ …) | **Not done, and recorded as a decision.** The company does not own a domain; printing addresses at one would be an invented claim, the exact fault the register exists to stop. Instead `/contact/` routes every topic to a council seat with its response expectation, and the claim `company-addresses` is labelled Planned against LEG-001. |
| 5 | Integrations directory with stricter deployment states and per-connector fields | **Partly.** The site has no directory to tighten. The six connections it names (SSO, SCIM, LTI 1.3, SIS, connector health, support access) are claims with the stricter words the review asked for, including "Built and tested, not yet deployed". Per-connector prerequisites, freshness targets and last-tested dates belong to the integration catalog (`app/src/lib/integration/catalog.ts`) and a directory page is not added until a connector is deployed for someone. |
| 6 | Accessibility: a live evidence table and an operational barrier-report route | **Done.** `/accessibility/` carries a table of five areas (this site, the app, human review, VPAT/ACR, course authoring and assessments) with status, how checked, known limitation and owner, from the register; and a "Report a barrier" section with what to include, what to expect and how to escalate. "Last tested" is "every change, by test" or "not yet", never a typed date. |
| 7 | Resource Hub editorial governance | **Done as a published standard** on `/resources/`: author and reviewer, audience, published, last and next review, sources and method, accessible format, error route and related screen. There are no guides yet; the first one carries it. |
| 8 | Site search with permission-aware indexing | **Not applicable.** The site has no search; it ships no script on content pages. The classification of what a search may index is written into the console controls (below) for when one exists. |
| 9 | Formal legal-policy versioning at `/legal/versions` | **Done as `/legal/`.** Eleven policies with status (not started, outline, draft, in force), version and effective date; none is in force, and the page says what it will show when one is. `POLICIES` in `claims.ts` is held to the tree: a path exactly when something is written, a version and date only when in force. |
| 10 | Independent status page, incident and release operation | **Partly, before this.** The status page exists (`app/public/status.html`, #902) and probes from the reader's browser; `/launch-readiness/` links it and says there is no uptime history. Component definitions, incident workflow and release notes are operations work in `docs/operating-model/` and not a site change. |
| — | "Start here" audience router near the hero | **Done** on the home page: six answers, each to a real page. |
| — | An evidence-based "Are we ready?" page | **Done as `/launch-readiness/`:** every claim, grouped by the four audiences' questions, with what the words mean and how the page is kept honest. |
| — | A customer proof policy page | **Done as `/proof/`:** six rules, why there is no testimonial, and how a claim gets onto the site. `PROOF_RULES` are data, so the register page and the site print the same words. |
| — | Separate demo, staging and production links; real authentication behind Log in | **Landed before this**, in #900 and #901: the deployed site is the product, the demo is beside it, and Log in opens a sign-in page. |

## The operations-console review

There is no operations console in the repository, and the operating system
register says so ("Operations Console map": missing). The review's
conversion steps are product work. What can be done before a console exists is
to write the policy it will read as data, so the first screen cannot quietly
re-decide it. That is [`ops/operations-console/README.md`](../ops/operations-console/README.md),
rendered from `app/src/lib/ops/console.ts`.

| # | Recommendation | Disposition |
| --- | --- | --- |
| 1 | Replace demo and browser-local state with authenticated backend data, server-side RBAC, RLS, real approvals | **Recorded as the five conversion steps**, each against the master-register rows it would move and what exists today. Not built here. |
| 2 | Audit log immutability: server-written, insert-only, separate writer, fail closed | **Production rules,** two `held` by existing checks (the role-grant audit refuses update and delete; no service-role credential reaches a browser) and one `stated` (fail closed), with the file that will hold it. |
| 3 | No production impersonation; role preview only in a sandbox; support access by grant | **Production rule `no-impersonation`,** held by the strategic boundaries (no fake production data, no browser service role) and the support-access policy suite. |
| 4 | Every console figure carries source, window, environment, owner, refresh, evidence, limitation | **`FIGURE_PROVENANCE`,** and the rule `figures-from-evidence`, held by the master-register and claims tests: a status cites the file that shows it, and a word may not exceed its rows. |
| 5 | No fictitious institutions in production-like screens | **Production rule,** held by the deployed-site test (TRUST-005). |
| +1 | Production context bar | **`CONTEXT_BAR`:** environment as a word, scope, operator's real identity, roles from grants, MFA freshness, session expiry, open support access; and the production-write notice. |
| +2 | Data classification on every table and view, applied to search, export, AI, support | **Six classes with controls on four surfaces,** and ten record kinds the platform already holds, each tied to the file that defines it. Credentials are never indexed, exported or retrieved; AI never reads restricted records; student and education records are never indexed. |
| +3 | "Why can I see this?" | **`ACCESS_BASIS`:** basis, tenant, scope, purpose, expiry. |
| +4 | Customer-impact panel on every failure | **`CUSTOMER_IMPACT`:** five questions before the diagnosis. |
| +5 | Approval and segregation-of-duties matrix | **`DUTIES`:** eleven actions. The test refuses a requester who is also an approver, one approver for a two-person action, and a party that is not a council seat, an `app_roles` row or the student. Finance roles the review names do not exist in `public.app_roles`; the refund row uses `business_admin` and says no billing exists. |
| +6 | Real integration health panels | **Not built.** Connector health is `INT-014`, behind a flag; the customer-impact and provenance rules apply to it when it is. |
| +7 | Evidence freshness automation (30 days, 7 days, expiry) | **`ESCALATION` and `escalation()`,** tested on each side of each step. The proof calendar has no dates yet, so nothing fires; the ladder is what fires when it does. |
| +8 | Claim-to-evidence control | **Done, as the claims register.** Every public claim names its rows and tests, and the build fails when a word is above them. Expiry's last step flags every public claim resting on the expired artifact. |

## What this does not do

- It does not make any claim true. It makes every claim checkable, and it
  refuses the ones the register cannot support.
- It does not fill the vacant seats. Every owner is a seat, and the pages say
  the seats are vacant.
- It does not build a console, a form backend, a search, or an integrations
  directory. Each is listed above with what would have to exist first.

## Addendum, 28 September 2026: the console was built

The section above was written when the policy existed and the console did
not. The same day, the thirteen capabilities the prototype faked were built
in the repository, each held to the tree by a test:

- **Backend.** `supabase/migrations/20260929100000_console_control_plane.sql`
  (operator preferences, council seat holders, the fresh-MFA predicate, the
  duty matrix as rows, a hash-chained insert-only audit archive with its own
  writer role, signed daily manifests, a nightly integrity job and audited
  reads, the demo flag on a school, and figures with provenance) and
  `20260929110000_console_approvals_and_break_glass.sql` (approval requests
  with server-side refusal of self-approval, the fail-closed `console_act()`,
  break-glass with expiry and post-use review, and the tenant-scoped customer,
  commitment and contract records). `supabase/console-control-plane.check.sql`
  and `supabase/console-approvals.check.sql` prove each, including that a
  high-risk write leaves nothing behind when its audit event cannot be written.
- **Screen.** `app/src/screens/Console.tsx`, behind `console:operate`, with the
  context bar, approvals, break-glass, audit, customers, figures, evidence and
  saved views. The map is [`OPERATIONS-CONSOLE-MAP.md`](OPERATIONS-CONSOLE-MAP.md).
- **Register.** The rows and what holds each are the "From prototype to
  control plane" table of [`ops/operations-console/README.md`](../ops/operations-console/README.md).

The last bullet of "What this does not do" is therefore out of date for the
console; the form backend, search and integrations directory stand as written.
