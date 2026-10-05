# Consolidating Semester onto one Vercel project

Audited 5 October 2026 against the Vercel team `harrison22`
(`team_v0ugbIoxEJmsnWkUWRQqt4Ys`) and the two Supabase projects the repository
references. Environment-variable **names** only: no value was read, decrypted,
copied or written down while producing this record.

**Target:** one repository (`harrisonjrubin7-cmyk/semester`), one production
branch (`main`), one Vercel project (`semester`), served by the services in the
root [`vercel.json`](../../vercel.json): `app`, `workflow-lab`, `company-site`.

**State on 5 October:** the target exists and already deploys `main` as
production. It carries no custom domain, so what people reach is still served by
a different project. That, and the secrets that project holds, is what is left.

## 1. The three projects

| | `semester` (**canonical**) | `semester-company-site` | `semester-shared-core` |
| --- | --- | --- | --- |
| Project id | `prj_fzII5n3b…` | `prj_5PEZGZEa…` | `prj_0hcR5qnw…` |
| Git link | `harrisonjrubin7-cmyk/semester`, `main` | same repo, same branch | **`semester-shared-core`** (older, separate repo) until 1 Oct; since then CLI deploys of `semester` commit `8da27a2` |
| Framework / Node | vite / 24.x | none (static) / 24.x | vite / 24.x |
| Config in repo | root `vercel.json` services (#1288) | `company-site/vercel.json` | `app/vercel.json` (headers, 2 functions at 30 s) |
| Production deploy | `dpl_2r47cmf4…`, `main` @ `4358847`, READY | `dpl_Ag4Ut6Z3…`, same commit | `dpl_64PeNacP…`, 29 Sep–1 Oct, **no git meta**; 3 of the last 10 deploys ERROR |
| Domains | `semester-rose.vercel.app` (public) + preview aliases | preview aliases only | **`www.semesterintel.tech`**, `semesterintel.tech` (308 → www), `semester-shared-core.vercel.app` |
| Routes (project-level) | none | none | none |
| Crons, KV, queues, drains | none seen | none seen | none seen |
| Blob | none | none | store `Semester_shared_core_*` |
| Integrations | Clerk, Convex, Mem0, Supabase store (preview only) | Clerk, Convex, Supabase/Postgres store | Clerk, Convex, Supabase/Postgres store, Blob |
| SSO protection | all but custom domains | same | same |

In the ten most recent deployment pairs, `semester` and `semester-company-site`
built the same commit on the same push: two projects, one repository, every
branch built twice.

## 2. What is live today

Probed 5 October, unauthenticated.

| URL | Result | Meaning |
| --- | --- | --- |
| `www.semesterintel.tech` | 200, the app, CSP and HSTS headers | production app is the shared-core project |
| `semesterintel.tech` | 308 → `www` | apex redirect is a domain setting on shared-core |
| `www.semesterintel.tech/lab` | 404 | the live build predates the `workflow-lab` service |
| `www.semesterintel.tech/api/institution/health` | 503 | the gateway is deployed but unconfigured (see §4) |
| `semester-rose.vercel.app` | 200, the app | canonical project already serves current `main` |
| `www.semester.website` | 200, "Semester · The student action platform" | **a company site is live on Vercel from a project this audit cannot see** (§3) |

### 2.1 The services config is not in effect yet

`semester` has **Root Directory = `app`** (shown by the Vercel bot on #1292).
Vercel reads `vercel.json` from the root directory, so the root-level `services`
and `rewrites` from #1288 are not applied. Measured: `semester-rose.vercel.app/lab`
and `/lab/auth/sign-in` both return **404** on the production deploy of `main`
at `4358847`. The `company-site` service added in #1292 is inert for the same
reason. Before either works, the project's Root Directory must be the repository
root (empty) with the Services preset, and `app/vercel.json`'s headers and
function limits must be confirmed to apply per service. This is a project
setting, not a code change; it is step 1 of §6.1, and it was not changed here.

## 3. Things that cannot be moved from here

| Item | Why it is external | Needed from the owner |
| --- | --- | --- |
| `semester.website`, `www.semester.website` | Resolves to Vercel and serves the company site, but is attached to **none of the four projects the connected account can list** (`list_domains` is empty; `semester-company-site` has no custom domain). The live HTML differs from `company-site/index.html` in `main`. It is in another Vercel scope or account. | Say which scope holds it. Then remove the domain there and add it to `semester`; the host rewrite in `vercel.json` is already waiting. |
| Supabase Auth redirect allow-list and Site URL | Not readable or writable from this session. | Add the final origin before the domain moves (§6). |
| Secrets and integration stores | Values are encrypted or sensitive. Moving them through an agent would expose them. | Connect the stores to `semester` in the dashboard, or copy with the CLI on your machine (§5). |
| `harrisonjrubin7-cmyk.github.io/semester/` | The company site's sign-in and demo links point at the old GitHub Pages build (`pages.yml`). Hash routes cannot be redirected server-side. | Decide the app origin, then change the links in `company-site/` in a PR that also refreshes `SHA256SUMS`. |
| `Semester.`, `Semester2`, `SemesterInstution-` repositories | No Vercel project is linked to them. Not audited beyond existence. | Say if any should be archived. |

## 4. Data stores

| Store | Used by | Lineage | Data |
| --- | --- | --- | --- |
| Supabase `semester` (`lzrqvlug…`, us-west-2) | the repository, `company-site` CSP, production | the monorepo's lineage, `20260901000100` → `20261005000000`; every remote version is a file in `supabase/migrations/` (184 files, 185 remote rows because a few versions were applied twice) | production |
| Supabase `Semester2` (`kpuulmni…`, us-east-1) | the `semester-shared-core` repo's campus lineage | 11 migrations from 23 September (`prototype_*`, `campus_*`, `account_activity_retention`); **none** are in the monorepo | 4 auth users, ~4 profiles, 1 moderator, 0 storage objects |
| Supabase `semester-restore-drill-2026-10-01` | restore drill | n/a | do not touch |
| Vercel Blob `Semester_shared_core` | shared-core project | n/a | not read |
| Clerk, Convex, Mem0, Prisma/Postgres vars | no code in `app/`, `packages/`, `workflow-lab/` or `company-site/` reads them | n/a | integration residue, not wired |

**The two Supabase projects are not merged and must not be.** They share no
migration lineage, `Semester2` is a prototype data set, and the monorepo's
schema has moved 185 migrations past it. Anything worth keeping from it is a
port (§7) onto the production lineage, never a data copy.

## 5. Environment variables

Names only. `✓` set, `—` absent, `P` preview only. "Used by" is from reading the
code, not from the project settings.

| Variable | `semester` | company-site | shared-core | Used by | Disposition |
| --- | --- | --- | --- | --- | --- |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` | P | ✓ all envs | ✓ all envs | not read by `app/` server code under these names | **CONFLICT**: three projects hold the same set; which Supabase project each points at is unknown without decrypting. Confirm = `lzrqvlug…` before use. |
| `NEXT_PUBLIC_SUPABASE_URL`, `…_PUBLISHABLE_KEY`, `…_ANON_KEY` | P | ✓ | ✓ | `workflow-lab` | **MERGE**: `/lab` has no Supabase config in production on the canonical project. |
| `POSTGRES_*` (7) | P | ✓ | ✓ | nothing | **OBSOLETE** |
| `SEMESTER_APP_ORIGIN` | — | — | production | `app/api`, `app/server` | **MERGE**, then re-point to the final origin |
| `SEMESTER_AI_RUNTIME_STATUS` | — | — | preview, production | gateway | **MERGE** |
| `SEMESTER_AI_PROVIDERS`, `…_MAX_REQUEST_CENTS`, `…_ESTIMATED_REQUEST_CENTS`, `SEMESTER_REQUIRE_AI`, `SEMESTER_MINIMUM_ADAPTERS`, `SEMESTER_INTEGRATIONS_READY`, `SEMESTER_MONITORING_READY` | — | — | preview | gateway | **MERGE** (preview only today; decide for production) |
| `SEMESTER_IMAGE_MODEL`, `SEMESTER_SPEECH_MODEL`, `SEMESTER_IMAGE_ESTIMATED_REQUEST_CENTS`, `SEMESTER_SPEECH_ESTIMATED_REQUEST_CENTS` | — | — | preview | no reader found in `app/` | **OBSOLETE** unless a reader is found |
| `OPENAI_API_KEY` | — | — | preview, production | gateway | **MERGE** (secret) |
| `VITE_SEMESTER_INTELLIGENCE` | — | — | preview, production | client build flag | **MERGE** — a build-time flag: without it the canonical build differs from what is live |
| `VITE_CAMPUS_ENVIRONMENT`, `VITE_CAMPUS_PROFILES_ENABLED` | — | — | production | only the shared-core repo's campus code (§7) | **OBSOLETE** with that code, unless it is ported |
| `Semester_shared_core_READ_WRITE_TOKEN`, `…_STORE_ID`, `…_WEBHOOK_PUBLIC_KEY` | — | — | all envs | no reader found | **EXTERNAL**: confirm nothing reads Blob, then retire with the project |
| `semester_CLERK_SECRET_KEY`, `NEXT_PUBLIC_semester_CLERK_PUBLISHABLE_KEY`, `CONVEX_DEPLOY_KEY` | ✓ | ✓ | ✓ | nothing | **OBSOLETE** (integration residue) |
| `MEM0_API_KEY`, `MEM0_BASE_URL`, `MEM0_ORG_ID`, `MEM0_PROJECT_ID` | ✓ | — | — | nothing | **OBSOLETE** |

**Required by the gateway and set on no project:** `SEMESTER_AUTH_URL`,
`SEMESTER_AUTH_SERVICE_KEY`, `SEMESTER_AUTH_PUBLIC_KEY`, `SEMESTER_JOURNAL_KEY`,
`SEMESTER_SSO_*`, `SEMESTER_INSTITUTION_NAME`, `SEMESTER_SCIM*`,
`SEMESTER_PRODUCTIVITY`, `SEMESTER_GATEWAY_STORE`. That is why
`/api/institution/health` is 503 everywhere. Cutting over loses nothing here;
it also **does not turn the gateway on**.

How to move the `MERGE` rows without a value passing through a log: on a
machine signed in to Vercel, `vercel env pull` from shared-core and
`vercel env add` into `semester`, or connect the integration stores to
`semester` in the dashboard. Set `VITE_*` before the production build that
cutover will use, because they are baked in at build time.

## 6. Cutover runbook

Do not start until every box in §6.1 is ticked. Nothing here has been run.

### 6.1 Before

- [ ] This pull request is merged. **Set `semester`'s Root Directory to the repository root with the Services preset**, redeploy, and confirm `/lab` is no longer 404 on `semester-rose.vercel.app` and that the app's CSP/HSTS headers and the two 30 s function limits from `app/vercel.json` are still present.
- [ ] `MERGE` variables in §5 set on `semester` for Production (and Preview for
      the `SEMESTER_*`/`OPENAI_API_KEY` set), then **redeploy** production.
- [ ] Supabase Auth: Site URL and Redirect URLs include
      `https://www.semesterintel.tech` (unchanged host, so likely already
      there) and `https://semester-rose.vercel.app` is **not** relied on.
- [ ] **Host routing is untested.** The preview of this PR built (READY) but is SSO-protected and this audit had no bypass, so the `semester.website` rewrite has not been exercised. Attach the domain to a preview first, or test with `curl --resolve`.
- [ ] Walk the smoke list against `semester-rose.vercel.app` with the new env:
      `/` , sign in, sign out, Today, Actions, Calendar, Courses, Path, Plan,
      Registration, Copilot, Support, `/lab`, institutional and operations
      routes, mutations, mobile and desktop widths.
- [ ] `GET /api/institution/health` returns the same status as the live site
      (503) or better. Not worse.
- [ ] Which scope owns `semester.website` is known (§3).

### 6.2 Move

A domain can belong to one project, so removing it from the old project is the
moment of risk. Do `www` first, apex second, and keep the old project intact.

1. Remove `www.semesterintel.tech` from `semester-shared-core`; add it to
   `semester` immediately after.
2. Do the same for `semesterintel.tech`, with the 308 redirect to `www`.
3. Remove `semester.website` and `www.semester.website` from wherever they live;
   add them to `semester` (apex redirects to `www`).
4. Run the smoke list against both domains, then watch runtime logs for a day.

### 6.3 Rollback

Re-attach the domain to `semester-shared-core`; its last production deployment
(`dpl_64PeNacP…`) is still a rollback candidate. Nothing in §6.2 deletes a
project, a deployment or a database.

### 6.4 After

Only after a clean day: pause, then archive, `semester-company-site`; then
`semester-shared-core`. **Do not delete** either, and do not touch either
Supabase project.

## 7. What `semester-shared-core` holds that the monorepo does not

See §8 once classified. By path alone the repository has 160 files with no
same-path counterpart: campus profiles and community, account activity,
managed-AI usage, a course sandbox, LMS server code, a "Google shell", and ten
migrations that exist only on `Semester2`.

## 8. Route and redirect map

| Old URL | Canonical | Action | Status |
| --- | --- | --- | --- |
| `www.semesterintel.tech/*` | same | domain moves projects; no URL changes | after §6 |
| `semesterintel.tech/*` | `www.semesterintel.tech/*` | 308, domain setting | after §6 |
| `semester-shared-core.vercel.app/*`, `semester-rose.vercel.app/*` | `www.semesterintel.tech/*` | redirect once the domain is on `semester` | after §6 |
| `www.semester.website/*` | same | host rewrite to `company-site` (this PR), inert until §2.1 | blocked on §2.1 and §3 |
| `semester-company-site*.vercel.app` | — | none, previews only | retire |
| `harrisonjrubin7-cmyk.github.io/semester/#/…` | app origin | change the links in `company-site/`; hash routes cannot be redirected | owner decision |
| `/lab`, `/lab/*` | same | routed in `vercel.json` by #1288, **not effective** until Root Directory changes (§2.1; `/lab` is 404 today) | blocked |
