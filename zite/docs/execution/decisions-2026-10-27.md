# Decisions, 27 Oct 2026

The owner delegated these ("you decide whatever you recommend"). Each records the choice, why, and what changed.

## C20 — S-54's ~50 proposed roles: not added as roles
The 69-role baseline stays the role set. A proposed role becomes a **role template** on an existing role (an approved bundle of
existing permissions, lib/roleTemplates.ts) only when an increment needs it, and only if no current role covers it. Reason: every
new role multiplies permission review and authorization tests; most proposals (library, facilities, research, finance staff) are
already served by Staff plus the S-76 campus apps built since. proposed-roles.csv stays as the backlog. Status: closed.

## C22 — appointment stores: apt-001 canonical, no hosted-data migration
New bookable slots live only in apt_slots/apt_bookings. The legacy Zite Appointments table keeps its existing rows (still atomic
through apt_claims) and alumni mentoring, which is one-to-one. The legacy rows are **not** moved: that would rewrite live
records for no user-visible gain. Status: closed.

## C25 — one role registry
Company OS /roles now redirects to /atlas, which reads apps/semester/src/lib/roleApps.ts. The hand-written copy
(company-os lib/roleRegistry.ts and RoleRegistryPage.tsx) is deleted. Status: closed (this commit).

## C26 — authoritative environments
Zite is the authoritative build and publish lane for every environment; GitHub (harrisonjrubin7-cmyk/semester) is the source
mirror. None of the Supabase projects (semester, Semester2, Semester-Platform, restore-drill) or the Vercel projects is
authoritative for any environment, and nothing is deployed to or changed in them. Reason: all live data and every check so far
run on Zite's Postgres; adding a second lane would split the source of truth. Revisit only if the product leaves Zite; restore-drill
must never hold real data. Status: closed.

## Security Lab reads need a company role
Reading Security Lab (findings, gates, policies, capability evidence) now needs `security_reader` or `security_lead` (co_roles,
granted in Company OS). Reason: RLS findings describe exploitable weaknesses; "any signed-in user of the app" is too wide.
Also closed the Atlas gap from 26 Oct: whoever recorded a capability's previous stage cannot record the next one.
