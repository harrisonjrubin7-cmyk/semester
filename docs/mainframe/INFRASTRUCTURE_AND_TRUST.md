# Infrastructure and trust

The mainframe PDF says the documented stack is not a live infrastructure audit. This session confirms that limit.

## Inspected locally

- Workspace install and scripts in `app/package.json`.
- `app/vercel.json` present. No deployment was performed.
- `supabase/migrations`: 185 SQL files. None were applied to a remote database.
- Accessibility label gate and style gate, run this session (`npm run lint` from `app/`, exit 0).
- Typecheck `npx tsc -b` from `app/`, exit 0.

## Not inspected

Hosted project name, database host, backup, restore drill, secret store, production RLS, log drain, pager, and retention job. Mark unverified.

## Trust rules that already bind the plan

- No secrets in `docs/specifications/` or these pages.
- No student record from a real person. Tests use `ECON 1020` and `PSCI 1104`.
- No email, notification, charge, or academic write.
- Tenant isolation for a future server command remains the gateway and RLS, not the client route.

Privacy, accessibility, and retention are cross-cutting. They are not a module to add after the consoles exist. The label audit failing closed this batch until the term and course fields were wrapped in labels.
