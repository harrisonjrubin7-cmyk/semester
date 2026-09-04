/**
 * The sender.
 *
 * Runs on a schedule, takes whatever is due out of `push_queue`, and posts it
 * to each of that account's devices. It knows nothing about semesters,
 * deadlines or terms — the app worked all of that out and left it a time and
 * two strings. See `app/src/lib/push.ts` for why it is arranged that way.
 *
 * Deploy:
 *     psql "$DATABASE_URL" -f supabase/push.sql
 *     npx web-push generate-vapid-keys          # once, keep both halves
 *     supabase secrets set VAPID_PUBLIC_KEY=…
 *     supabase secrets set VAPID_PRIVATE_KEY=…
 *     supabase secrets set VAPID_SUBJECT=mailto:you@example.com
 *     supabase functions deploy push --no-verify-jwt
 *
 * Then schedule it. Every fifteen minutes matches the resolution the app
 * queues at, and nothing is gained by going finer:
 *     select cron.schedule('push', '*\/15 * * * *', $$
 *       select net.http_post(
 *         url := 'https://<project>.functions.supabase.co/push',
 *         headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.cron_secret'))
 *       );
 *     $$);
 *
 * `--no-verify-jwt` is right here and would be wrong on the Claude function:
 * this one is called by the scheduler, not by a browser, and it authenticates
 * with a shared secret of its own rather than a user's token. Without
 * CRON_SECRET set it refuses every request, so a misconfigured deploy is
 * silent rather than open.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'https://esm.sh/web-push@3.6.7';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? '';
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';

/** How many reminders one run will send. A cap, so a bad week cannot run away. */
const PER_RUN = 500;

interface Row {
  user_id: string;
  id: string;
  title: string;
  body: string;
  screen: string;
  item: string;
}

interface Device {
  endpoint: string;
  user_id: string;
  p256dh: string;
  auth: string;
}

Deno.serve(async (req) => {
  // No secret configured means no sender. A function that is open because
  // somebody forgot to set an environment variable is the worst kind of open.
  if (!CRON_SECRET) {
    return new Response('not configured', { status: 503 });
  }
  if (req.headers.get('Authorization') !== `Bearer ${CRON_SECRET}`) {
    return new Response('no', { status: 401 });
  }
  if (!VAPID_PUBLIC || !VAPID_PRIVATE || !VAPID_SUBJECT) {
    return new Response('no vapid keys', { status: 503 });
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: due, error } = await db
    .from('push_queue')
    .select('user_id, id, title, body, screen, item')
    .lte('send_at', new Date().toISOString())
    .limit(PER_RUN);

  if (error) return new Response(error.message, { status: 500 });
  const rows = (due ?? []) as Row[];
  if (rows.length === 0) return Response.json({ sent: 0, devices: 0 });

  // One lookup for every account in this batch rather than one per reminder.
  const users = [...new Set(rows.map((r) => r.user_id))];
  const { data: deviceRows } = await db
    .from('push_devices')
    .select('endpoint, user_id, p256dh, auth')
    .in('user_id', users);

  const byUser = new Map<string, Device[]>();
  for (const d of (deviceRows ?? []) as Device[]) {
    byUser.set(d.user_id, [...(byUser.get(d.user_id) ?? []), d]);
  }

  let sent = 0;
  const dead: string[] = [];

  for (const row of rows) {
    for (const device of byUser.get(row.user_id) ?? []) {
      try {
        await webpush.sendNotification(
          {
            endpoint: device.endpoint,
            keys: { p256dh: device.p256dh, auth: device.auth },
          },
          JSON.stringify({
            id: row.id,
            title: row.title,
            body: row.body,
            screen: row.screen,
            // Relayed, not interpreted. The page decides what to do with it —
            // see `lib/land.ts`, which refuses a screen it does not know.
            item: row.item ?? '',
          }),
        );
        sent += 1;
      } catch (e) {
        // 404 and 410 mean the subscription is gone for good — the app was
        // uninstalled, or the browser rotated it. Anything else is transient
        // and the row stays for the next run.
        const status = (e as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) dead.push(device.endpoint);
      }
    }
  }

  // Delivered, so the queue forgets it. The text of a reminder should not sit
  // on a server any longer than it has to.
  await db
    .from('push_queue')
    .delete()
    .in(
      'id',
      rows.map((r) => r.id),
    )
    .in('user_id', users);

  if (dead.length > 0) {
    await db.from('push_devices').delete().in('endpoint', dead);
  }

  return Response.json({ sent, devices: byUser.size, dropped: dead.length });
});
