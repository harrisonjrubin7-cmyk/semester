# University Onboarding

**Status: `NOT_STARTED`** — and partly `BLOCKED`, as marked below.

## The steps, and what each needs from us

| # | Step | Needs | State |
| --- | --- | --- | --- |
| 1 | Create the tenant | A `schools` row: id slug, name, `email_domains` | **Possible today** — admin-only via RLS, but no admin UI |
| 2 | Branding | Logo, accent, short name | Client-side school profiles exist; not tenant-configurable |
| 3 | Academic calendar | Terms, breaks, deadlines | Not tenant-scoped |
| 4 | Schools / departments | Org structure | Not modelled |
| 5 | Feature scope | Per-tenant flags | **Missing entirely** |
| 6 | Identity | SSO metadata exchange | **Missing**; `BLOCKED` on the university's IdP metadata |
| 7 | Integrations | LMS/SIS credentials and scopes | `BLOCKED` on institutional API approval |
| 8 | Roles | Who administers this tenant | Only a global admin bit exists |
| 9 | Policies | Terms, privacy, support contacts | Not tenant-scoped |
| 10 | Pilot cohort | Invite the first users | Invites exist (`invites` table) |

## What is genuinely blocked versus what is not

**Blocked on the university:** SSO metadata (step 6), integration approval and
credentials (step 7). These cannot be coded around, and the correct work while
waiting is the adapter interface and the sandbox — both of which exist.

**Not blocked, just undone:** steps 1–5 and 8–9. Every one of these is our own
work. None of it requires anything from a university.

Do not let a real external blocker on two steps disguise eight that are ours.

## The first honest onboarding

Because the adapter registry is empty, the first university pilot cannot be
"Semester connected to your systems". It is "Semester as a planning and
experience layer, with your students' data entered or imported, and no writes
to your systems of record". That is a real, valuable, deliverable pilot, and it
is the only one this tree can currently support without overstating.
