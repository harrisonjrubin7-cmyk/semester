-- Production operational activation for the durable support-notification
-- outbox. Apply after support-reply-notify is deployed. The existing push
-- scheduler secret is also present as CRON_SECRET in both first-party senders.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'support-reply-notify',
  '* * * * *',
  $job$
    select net.http_post(
      url := 'https://lzrqvlugnawcgywkhqlz.supabase.co/functions/v1/support-reply-notify',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret'
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 20000
    );
  $job$
);
