# Browser grant allowlist: `anon`

Measured 2026-10-04. `anon` holds privileges on **32 public tables** and 1 view. Rows are protected by policy, not by grant.

## Intended public access (keep)
| Object | Grant | Policy |
|---|---|---|
| commercial_plans, commercial_prices, commercial_products | SELECT | active / currently-effective rows only |
| entitlement_definitions, plan_entitlements | SELECT | `true` (catalog) |
| form_publications (+ view `published_forms`) | SELECT | open forms only |
| form_responses | INSERT | check applies; read/delete limited to form owner |
| schools | SELECT | `schools_read` = `true`. **Q1 (product/counsel): is the full school list, with every column, meant to be public to unauthenticated callers?** |

## Over-granted (owner-scoped tables with the Supabase default full grant)
appointments, blocks, calendar_feeds, courses, enrollments, family_grants, group_members, group_tasks, groups, message_reactions, messages, notes, organization_members, organizations, profiles, push_devices, push_queue, referral_codes, referrals, reports, sittings, state, tasks, usage (+ `schools` write privileges).

Each carries DELETE, INSERT, UPDATE, SELECT, TRUNCATE, TRIGGER, REFERENCES (some a subset). Their policies key on `auth.uid()` or capability helpers, which deny `anon`, so no row access was found. **TRUNCATE is not governed by RLS.** PostgREST does not expose it, so I found no exploit path; I did not test one. It is a defence-in-depth gap, severity **P2**.

Verified false alarm, recorded so nobody re-raises it: INSERT policies showed `true` only because a null USING was coalesced. Query 3 finds no insert/update policy with a null or literal-true `WITH CHECK` on any anon-insertable table.

## Proposal
`proposed/anon_grant_reduction.sql`. **Not applied.** Revoke all from `anon` on the over-granted set; keep the allowlist above. Needs: owner decision on Q1, the check suites, and confirmation that no unauthenticated app path relies on the dropped privileges. Reversal: re-grant.

The 22 `private` helper functions executable by `anon` (`classmate`, `in_class`, `has_capability`, `is_app_admin`, ...) exist because policies on anon-granted tables call them. After the revoke, re-test whether that EXECUTE can also go.

## Not done
`authenticated`: 270 SELECT and 129 write tables. Allowlist not written.
