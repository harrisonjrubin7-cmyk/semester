# Extension ecosystem governance

Part 12 of the expansion command. Phase 5. **Waits for #779's data
classification.** Nothing here is built yet, and nothing like it exists.

## What exists on main

- A built-in tool catalogue: `app/src/lib/toolkit/catalog.ts`,
  `app/src/lib/toolkit/tools.ts`, `app/src/lib/toolkit/recommend.ts`. Its entries
  are first-party.
- `externalConnectors` and `codeExecution` are hard-coded off in
  `app/src/lib/toolkit/flags.ts`.
- Role `marketplace_partner` exists with no surface.

## In flight

#779's T0–T6 classes and `routeAllowed(class, 'external_connector')` are the
ceiling every extension is checked against. Without them there is nothing to
set a ceiling with.

## Entity plan

| Command entity | Decision | Why |
|---|---|---|
| `extension_catalog`, `extension_versions` | **New** | Provider identity, type, version, launch method, review date |
| `tenant_extensions` | **New** | Per school: state (`available · approved · restricted · pilot · deprecated · suspended · removed`), eligibility, flag |
| `extension_reviews` | **New** | Privacy, security and accessibility review, each with reviewer and date |
| `extension_data_policies` | **Columns** on `extension_catalog`: classification ceiling, data shared, retention | |
| `extension_access_rules` | **Columns** on `tenant_extensions`: course and program eligibility | |
| `extension_support_owners` | **Columns** on `tenant_extensions` | |
| `extension_offboarding_records` | **New** | Removal date, data return or deletion confirmation |
| `extension_usage_audits` | **New**, launch events only, no content | Aggregate by school |

## Capabilities and flags

- **`extension:approve`**, new, at `school` scope.
- One flag per extension per school, `off`; global kill switch
  `kill.extensions`.

## Hard boundaries

- No extension launches for a school that has not approved it, at a version it
  has not approved.
- No data leaves without the sharing notice being shown and accepted, and never
  above the classification ceiling.
- Removal has a path before approval: an extension without an offboarding plan
  cannot be approved.
- Extensions never read community data (#770) or supporter grants.

## Tests

- An unapproved extension does not appear; a `restricted` one appears only to
  its eligible courses.
- A T4 payload to an extension with a T2 ceiling is refused.
- Suspending an extension removes it on next load everywhere.
- Offboarding records a deletion confirmation or blocks completion.
