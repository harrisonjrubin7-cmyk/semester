-- Verified listings link only to https.
--
-- `public.opportunities` is where an office or employer publishes a job,
-- internship, scholarship or program, and a moderator makes it visible. Its
-- `url` column took any text, so a published listing could point a student at
-- `http://` or `javascript:` behind a "Verified" label. New rows must now be
-- https. `not valid` so existing rows are not rewritten or refused here; the
-- client drops a non-https link on the way out either way.
--
-- What this deliberately does not change: the moderator update policy
-- ("a moderator publishes or removes") lets a moderator change any column,
-- including a listing's title and body. The report queue settled the same
-- question the other way — reviewers move a status and nothing else — and the
-- PR recommends the same column grant here. It is a change to who can write
-- what, so it is left for a decision rather than made silently.

alter table public.opportunities
  drop constraint if exists opportunities_url_https;
alter table public.opportunities
  add constraint opportunities_url_https check (url is null or url ~ '^https://') not valid;

-- Rolling back: `alter table public.opportunities drop constraint if exists opportunities_url_https;`
