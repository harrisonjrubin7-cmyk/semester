# Decisions, 28 Oct 2026

The owner asked Claude to decide both items ("also you handle these", 08:35 CT). Each is recorded with its evidence and
what would change it. Neither makes anything institution-authorized or production-enabled.

## D-2026-10-28-permissions: no platform default-deny exists; access stays deny-by-default in endpoint code

- Finding: Zite's permissions file "defines roles. It does not enforce anything" and has no `defaultPolicy` setting
  (https://developers.zite.com/framework/permissions-file, https://developers.zite.com/recipes/roles-permissions).
  The earlier open item ("rules are inert unless defaultPolicy is deny") assumed a setting the platform does not have.
  Browsers cannot query tables; only endpoints can (zite-capability-assessment.md row 5, observed).
- Decision: keep `zite.permissions.json` with no platform roles. Authorization stays where it is enforced: endpoint code
  (`requireAccess` / `requireAction`, deny-by-default, Memberships reloaded per call). Company roles are never granted by code.
- New guard: `apps/semester/tests/endpointAuth.test.ts` reads every endpoint in all ten apps and fails unless it has
  `authenticated: true` or is on a reviewed public list with a reason. It failed on first run (4 endpoints: Company OS
  `atlas`, `decisions`; Developers `platform`, `sandbox`), which now require sign-in. Public by design: the 3 Site endpoints
  and the token-authenticated `sandboxApi`.
- Changes this if: Zite ships platform table rules, or a signed-in two-account probe shows direct table access.

## D-2026-10-28-grading: sample grading policy until an institution approves its own

- Scale: A+ 4.0, A 4.0, A- 3.7, B+ 3.3, B 3.0, B- 2.7, C+ 2.3, C 2.0, C- 1.7, D+ 1.3, D 1.0, D- 0.7, F 0.0.
  GPA truncated to two decimals. P/S/CR earn credit outside GPA; NP/U/NC attempted, no credit; W/AU not attempted;
  I/IP attempted, no credit yet.
- Repeats: by course code, the latest completed attempt counts; earlier attempts stay on the transcript marked
  "repeated, excluded". A later W or I never replaces an earlier grade; a later F does (the rule is latest, not best).
  `highest` and `all` are supported for institutions whose policy differs.
- One scale for the product: the grade tracker's copy (no A+, D+, D-) now re-exports this one.
- Every transcript states it uses the sample policy. A real institution's policy replaces it only through its registrar,
  and is refused if `policyProblems()` reports anything. Storing an institution's approved policy is the next increment.
- Evidence: `tests/transcript.test.ts` 12/12; with the repeat rule removed, 3 repeat tests fail.
