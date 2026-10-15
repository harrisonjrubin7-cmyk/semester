# Semester multi-role workflow wireframe

## Run
Use Node with npm. Extract this project, run `npm install`, then `npm run dev`.
Use `npm run build` to typecheck and compile. Dependencies are not bundled.

## Files
- src/App.tsx: complete React wireframe, reducer, role switcher, workflow and escalation simulators.
- src/styles.css: responsive shell and accessible focus styles.
- university_rls.sql: fresh-project Supabase reference migration.

## Demonstration
1. Select Faculty, save a grade, release it.
2. Request a correction.
3. Select Registrar, approve and publish the correction.
4. Select Advisor to inspect the released result.
5. Finance and Student Affairs demonstrate separate actions.
6. Use the state selector to inspect default/loading/empty/error/forbidden/offline.
7. Use separate reviewer personas to advance the escalation simulator.

The navigation entries change the selected page label but use a shared inspection surface.
The full demo ledger and student projection are developer inspection tools, not production permissions.
All roles are granted locally; no actual authorization, sessions, API, or database connection exists.
State is in memory and resets on refresh. No real student data is included.

## Database integration boundaries
The SQL is a standalone fresh-project reference, not a migration for an existing schema.
It uses Supabase auth.users, auth.uid(), auth.jwt(), anon, authenticated, and supabase_auth_admin.
A trusted endpoint must validate a requested grant and update private.session_contexts using the
verified JWT session_id and user identity. Then refresh the client session and verify workspace.grant_id.
Browser users must not write the context table. Keep private unexposed.
Register private.custom_access_token_hook as the Custom Access Token Hook.
Only client reads are enabled. Write command handlers and authorization tests are not included.
Service credentials bypass RLS and must stay server-side. Helpers are owned by the privileged migration
role; audit ownership and search_path before deployment. Do not indiscriminately apply this migration.
The correction command must ensure grade_id matches the student and section, enforce expected version,
independent reviewer rules, and append workflow events atomically. Grade release must preserve prior
published history; this starter schema does not implement that publication transaction.
No pgTAP suite or live compilation was run in the generation environment.

## FERPA
This is an access-control reference, not a certification. Institutional policy, notice, access rights,
consent/exceptions, disclosure record requirements, retention, vendors, and other legal obligations require
separate review. Pseudonymous IDs and masked strings are not automatically de-identified.
