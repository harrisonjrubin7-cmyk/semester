# Conflicts and decisions

Each entry: the conflict, where it comes from, what the build does now, who decides, and whether it is resolved.

| # | Conflict | Sources | What the build does now | Decision owner | State |
|---|---|---|---|---|---|
| C1 | AI access to student records: "never" vs "institution-controlled per data type" | Book 1 hosting fact and checklist #22; Book 2 prototype notes; context brief 1.8 | No student-record egress. Only public catalog text reaches OpenAI (`aiGate.sendableToAI`, unit-tested). | Founder + institution | **Default applied**. Widening needs a reconciled policy. |
| C2 | Accessibility target: WCAG 2.1 AA (VPAT item) vs 2.2 AA (personas, brief) | Book 1 checklist #34; GTM personas; brief 1.7 | Site states 2.2 AA as a target, not conformance. | Founder + accessibility reviewer | Open |
| C3 | Role count: 49 + 3 actors vs 51 | Book 2 catalog vs role pages | No dependency yet. | Founder | Open |
| C4 | Screen count: 589 vs 673 (84 gap screens) | Book 2 catalog vs screens list | Pilot priority list (107 screens) used instead. | Founder | Open |
| C5 | Hosting: Vercel + Supabase (books) vs Zite (this build) | Book 1 facts; this workspace | Built on Zite; capability gaps listed in `zite-capability-assessment.md`. | Founder | **Open: blocks production** |
| C6 | Deploy now vs no production deploy without explicit approval | Founder request 22 Oct ("deploy verified release") vs blueprint Safety and context brief 1.9 | Committed and built; **not published**. Asking the founder. | Founder | **Pending** |
| C7 | Source-label vocabulary: app uses Official, Connected, Made Here, Yours, Sample, AI Assisted; brief lists Official, Connected, Yours, AI-assisted, Estimated, Needs review, Sample | App tables; brief 1.7 | Existing labels kept. Registrar decisions recorded as Made Here (not Official) until the SIS is connected. | Founder (design) | Open |
| C8 | Planning prices ($18/student/yr, $30k floor, Student Premium $8.99/mo) vs "publish no price without approval" | Book 1 GTM plan and finance model; brief 1.6 | Not published. Site says "Price on request". | Founder | Resolved for the site |
| C9 | Pilot customer naming ("Vanderbilt is pilot #1", "paid pilot signed") vs claims rule | Book 1 facts; brief 1.6, 1.9 | No customer named, no pilot claimed. | Founder + customer permission | Resolved for the site |
| C10 | Two database plans: Zite tables vs proposed Postgres schemas (context/02, 06) | Context docs | Existing Zite tables extended (Regrade Requests, Inbound Requests, Source Register); no parallel model. | Founder | Open (tied to C5) |
| C11 | Sign-up is open on the Semester app vs "never let someone obtain a staff role by choosing it" | App auth config; brief 1.3 | Staff roles need an admin-approved request. Open sign-up only creates a personal workspace or a pending join. | Founder | Decided 25 Oct (D1): no self-service Administrator in the shared sample; real institutions invite + approval |
| C12 | Registration: "enroll" vs "request" | Book 2 workflow name; blueprint Prompt 4 | Student submits a request (status Requested). Registrar decisions are recorded in Semester with the SIS authoritative. | Registrar (institution) | Resolved for pilot |
| C13 | Role inventory: 69 role apps (74/79 packs) vs 79 roles (workbook) vs 50-role overlay vs 97 agent profiles | S-09, S-44, S-18, S-35, S-25 | 69 apps are the mandatory minimum (`roleApps.ts`); agent profiles map to apps via `profilesForRoles`; workbook-only roles not yet reconciled | Founder | Open |
| C14 | Two codebases: `app/` (Vite + Supabase, GitHub main) vs `zite/` (Zite monorepo, imported to main via PR #1687) | Repository; S-02 vs S-11 | Zite is source of truth for `zite/`; no code shared or merged between them | Founder (repository authority) | **Open: blocks consolidation** |
| C15 | Parallel schema: CORE_SCHEMA_DRAFT.sql and openapi.proposed.json vs existing Zite tables | S-39 | Not applied; existing tables extended per feature | Founder | Default applied |
| C16 | 552-task execution board vs implemented increments | S-12 | Board kept as reference; tasks not traced one by one | Product + platform | Open |
| C17 | Staff desk `setEnrollment` sets Enrolled/Dropped on Zite rows directly, outside the registrar ledger (no capacity lock, no waitlist promotion) | `api/staff.ts` vs `reg_decide` / `reg_change_decide` | Left as is; ledger paths are the ones with invariants | Registrar (institution) + founder | Resolved 25 Oct: direct write removed; desk is read-only and changes go through the ledger queues |
| C18 | Security owner decisions from S-07/S-21/S-29: open sign-up with self-chosen Active roles on Sample/personal paths (SEC-004, ties to C11); external private file store (SEC-053/057); SSO before real data; one DB credential doing DDL and serving requests (SEC-051); no staging DB (SEC-061) | security-requirements.csv | Unchanged; uploads stay off | Founder + security reviewer | Decided 25 Oct (D1–D4): sign-up closed for sample admin; private store in-stack, uploads off until tested; SSO before real data; founder interim owner. Still open: separate DDL credential (SEC-051), staging DB (SEC-061) |
| C19 | Registrar sources ask for auto-processing from queue, payment sessions and provider-webhook posting (REG-084/094/095) | registrar-requirements.csv | Not built: human-initiated decisions only; no money movement | Founder + institution | Default applied |
| C20 | S-54 proposes ~50 roles beyond the 69 (admissions, research, library, workforce, finance, facilities, advancement, governance, clinical) | S-54 §4 vs 69-role baseline (S-09) | Decided 27 Oct: not added as roles; templates on existing roles when an increment needs them (decisions-2026-10-27.md) | Founder (delegated) | Closed |
| C21 | S-55 proposes Semester Institution and Semester Faculty as separate Zite apps | S-55 §1/§4 vs one-product rule and shared auth in apps/semester | Decided 26 Oct (delegated D-all): build both as dedicated experiences inside apps/semester (/institution, Faculty next) so identity, authorization and canonical records are not duplicated; a separate Zite app object can wrap them later if editor/access isolation requires it | Builder | Decided |
| C22 | Two appointment stores: legacy Zite Appointments (single-person, seeded) and apt-001 slots | Existing table vs new atomic booking | Decided 26 Oct: apt-001 is canonical for new slots; legacy rows stay bookable but atomic via apt_claims; move legacy rows into apt_slots after hosted-data approval | Decided 27 Oct: no migration of legacy rows; legacy table kept for existing rows and mentoring | Builder | Closed |
| C23 | Two Semester Institution builds: apps/semester-institution (commit 97074f0, another agent session, separate Zite app 3nybmrumkp, Zite "Section Requests" table) and /institution + sreq-001 in apps/semester (f277acd) | 97074f0 vs C21 | Observed 26 Oct: the "Section Requests" table does not exist in the live workspace ("Unknown table"), so apps/semester-institution fails typecheck (8 errors) and its request flow cannot run; it has create/list/read only (no chair/registrar decisions, no section creation). sreq-001 is complete and tested. Recommendation: keep one flow. Either (a) make 3nybmrumkp a thin front door that calls the existing workflow, or (b) remove it. Not changed by this session | Founder | Decided 26 Oct: option (a). apps/semester-institution now re-exports sectionRequests, institutionOps and institutionConsole from apps/semester; its own Section Requests endpoints were removed. One workflow, one data store. |

Decisions taken on 25 Oct are recorded in [`decisions-2026-10-25.md`](decisions-2026-10-25.md).

## Decision register: inputs needed (blueprint §10)
Repository authority (Zite vs GitHub `semester` repo) · first launch cohort · institution-authorized data fields · authoritative system per record type · approved roles and delegation policy · approved AI use cases and providers · production platform and environments · support commitments · retention and deletion obligations · approved commercial plans · named security, legal, accounting and accessibility reviewers · budget and capacity.

## C24 — superseded (26 Oct)
The owner reversed the merge: "no need to merge all three apps can keep seprate". Commit 6513093 is reverted; Company OS, Security Lab and Developers stay separate Zite apps with their own endpoints. Closed.

## C25 — two role registries (26 Oct; closed 27 Oct: /roles redirects to /atlas, copy deleted)
`apps/semester-company-os/src/lib/roleRegistry.ts` (hand-written 24 Oct; statuses only partial/missing) duplicates the maintained
register `apps/semester/src/lib/roleApps.ts` (built/partial/missing per capability, updated with every increment). S-73 asks for
one Atlas, not a second disconnected one. Interim: the new Company OS Atlas (/atlas) reads `roleApps.ts`; the older
/roles page still reads its own copy. Proposed resolution: point /roles at `roleApps.ts` and delete the copy. Owner: product. Open.

## Gap noted for Atlas (26 Oct)
Security Lab's capability-evidence endpoint records evidence for any stage without a reviewer-separation check (internal Zite app,
so only workspace members reach it). Record it in Atlas's gap register as high severity, owner: platform. Closed 27 Oct: previous-stage reviewer cannot record the next stage.
