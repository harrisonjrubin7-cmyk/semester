# Production public-signup access-gate readback — 2026-10-02

## Result

The production Supabase project `lzrqvlugnawcgywkhqlz` returned
`invite_only = false` from the singleton `public.access_gate` row. The stored
change time was `2026-10-01 16:47:00.993687+00` (11:47 AM CDT).

This confirms that Semester's database-level public-signup gate is open. No
production setting or row was changed during this verification.

## Method

An authenticated operator ran this read-only query in the Supabase SQL Editor
for the production project:

```sql
select invite_only, changed_at
from public.access_gate
where only_one;
```

The query returned one row:

| invite_only | changed_at |
| --- | --- |
| `false` | `2026-10-01 16:47:00.993687+00` |

## Scope and limits

- This verifies the live database access-gate state, not a completed anonymous
  browser signup journey.
- Auth provider settings, email delivery, account creation, and post-signup
  onboarding still require the production golden-path acceptance run.
- Re-run this readback after any access-policy change and before launch review.

