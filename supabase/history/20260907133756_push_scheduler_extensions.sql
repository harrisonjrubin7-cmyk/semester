-- The two extensions the reminder scheduler needs.
--
-- pg_cron runs the job; pg_net makes the outbound HTTP call to the `push`
-- Edge Function. Supabase installs both into the `extensions` schema rather
-- than `public`, which is where its own advisor expects to find them.
--
-- Nothing is scheduled here. Creating the job is a separate step and is
-- deliberately not part of this migration: the function refuses every request
-- until CRON_SECRET is set on it, so a job created first would hit a 503
-- every fifteen minutes and fill the logs with a failure nobody asked for.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;