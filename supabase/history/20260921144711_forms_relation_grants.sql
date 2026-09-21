-- ── The grant half of forms.sql, which it never wrote ────────────────────
--
-- `20260901001100_forms.sql` says `grant select on public.published_forms to
-- anon, authenticated` and `revoke all on public.forms from anon`, and both
-- lines are written as though a new relation in `public` starts with no
-- privileges. On Supabase it does not. The default privileges say
--
--     alter default privileges in schema public
--       grant all on tables to anon, authenticated, service_role;
--
-- and in Postgres "TABLES" covers views. So the migration's grant was a no-op
-- on top of a grant of ALL, and what `anon` actually held on `published_forms`
-- was DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE and UPDATE.
--
-- That is not a tidiness problem, because of what kind of relation this is.
-- `published_forms` selects six plain columns from one table with no
-- aggregate, no DISTINCT and no GROUP BY, which makes it **auto-updatable** —
-- `information_schema.views.is_updatable` says YES — and it is left with the
-- definer's rights on purpose, so that its WHERE clause can be the whole gate
-- in front of `forms`' owner-only policies. Definer rights plus a write grant
-- means a write that runs as the view's owner and never meets those policies.
--
-- Measured against the live project before this ran, as `anon`:
--
--     update public.published_forms set title = '…'  →  ALLOWED, 1 row
--     update public.forms          set title = '…'  →  permission denied   (control)
--     delete from public.published_forms            →  ALLOWED, 1 row
--
-- The control is the half that makes the first line mean anything. And the
-- delete is the worst of the three: the view carries its own WHERE, so
-- `delete from public.published_forms` with no clause of its own removes every
-- form that is currently published, from a role whose key ships in the page
-- source.
--
-- The fix is the pattern `access_log.sql` already uses and this file did not:
-- revoke everything from the client roles by name, then grant back exactly
-- what each one is meant to have. Never grant alone.

-- Owner-only, through row-level security. `authenticated` needs the four verbs
-- at table level for its policies to have anything to act on; `anon` needs
-- nothing here at all and reads the view instead.
revoke all on public.forms from anon, authenticated;
grant select, insert, update, delete on public.forms to authenticated;

-- Read, and only read. See above for what the other verbs were doing here.
revoke all on public.published_forms from anon, authenticated;
grant select on public.published_forms to anon, authenticated;

-- A respondent may add an answer and never see one. The owner reads them back
-- and may clear them; nobody updates one, which is why UPDATE is absent from
-- both lines rather than merely unmentioned.
revoke all on public.form_responses from anon, authenticated;
grant insert on public.form_responses to anon, authenticated;
grant select, delete on public.form_responses to authenticated;