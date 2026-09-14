/**
 * The sender.
 *
 * Runs on a schedule, takes whatever is due out of `push_queue`, and posts it
 * to each of that account's devices. It knows nothing about semesters,
 * deadlines or terms — the app worked all of that out and left it a time and
 * two strings. See `app/src/lib/push.ts` for why it is arranged that way.
 *
 * Deploy:
 *     psql "$DATABASE_URL" -f supabase/migrations/20260901000600_push.sql
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
  /**
   * When a gateway last said this subscription was gone.
   *
   * The column has been in the schema since the table shipped, with a comment
   * saying a subscription is kept for one pass so a transient 404 does not
   * silently unsubscribe somebody — and nothing read it or wrote it. A single
   * 404 deleted the device outright, which is exactly the behaviour the column
   * exists to prevent, and it is invisible when it happens: the student's
   * phone simply stops getting reminders and no screen has anything to say
   * about it. Two passes now, as written.
   */
  gone_at: string | null;
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

  /*
   * Oldest first, and the `order` is the whole of the change.
   *
   * `limit` without `order` takes an arbitrary five hundred: SQL guarantees no
   * order without `ORDER BY`, so which of them a run picks up is whatever the
   * planner found convenient that time. That is invisible until there is a
   * backlog — and `PER_RUN` exists because the author expected one ("a cap, so
   * a bad week cannot run away") — at which point the queue drains in no
   * particular order and a reminder due three hours ago goes out after one due
   * five minutes ago, for no reason anybody can see.
   *
   * Ascending rather than descending, because the alternative stalls: newest
   * first means a backlog that keeps growing never reaches its own tail, and
   * the oldest reminders are the ones that never send at all. Oldest first
   * drains in the order things actually came due, which is also the order
   * somebody would guess.
   *
   * Free, as it happens: `push_queue_due` is already an index on `send_at`.
   */
  const { data: due, error } = await db
    .from('push_queue')
    .select('user_id, id, title, body, screen, item')
    .lte('send_at', new Date().toISOString())
    .order('send_at', { ascending: true })
    .limit(PER_RUN);

  if (error) return new Response(error.message, { status: 500 });
  const rows = (due ?? []) as Row[];
  if (rows.length === 0) return Response.json({ sent: 0, devices: 0 });

  // One lookup for every account in this batch rather than one per reminder.
  const users = [...new Set(rows.map((r) => r.user_id))];
  const { data: deviceRows } = await db
    .from('push_devices')
    .select('endpoint, user_id, p256dh, auth, gone_at')
    .in('user_id', users);

  const byUser = new Map<string, Device[]>();
  for (const d of (deviceRows ?? []) as Device[]) {
    byUser.set(d.user_id, [...(byUser.get(d.user_id) ?? []), d]);
  }

  let sent = 0;
  /** Gone twice running: retired. */
  const dead = new Set<string>();
  /** Gone for the first time: marked, and given one more run to come back. */
  const failing = new Set<string>();
  /** Answered at any point in this run. */
  const answered = new Set<string>();
  /** Answered after having been marked: the mark comes off. */
  const revived = new Set<string>();

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
        answered.add(device.endpoint);
        if (device.gone_at) revived.add(device.endpoint);
      } catch (e) {
        // 404 and 410 mean the subscription is gone — the app was uninstalled,
        // or the browser rotated it. Gateways also answer them during their own
        // outages, so the first one only marks the device; a device that is
        // still gone on the next run is the one that is retired. Anything else
        // is transient and nothing is recorded at all.
        const status = (e as { statusCode?: number })?.statusCode;
        if (status !== 404 && status !== 410) continue;
        (device.gone_at ? dead : failing).add(device.endpoint);
      }
    }
  }

  /*
   * Delivered, so the queue forgets it — this account's row, and only this
   * account's.
   *
   * It used to be `.in('id', everyId).in('user_id', everyUser)`, which is not
   * the list of rows that were just sent: it is every combination of them. A
   * reminder id is not unique across accounts and was never meant to be —
   * `lib/notify.ts` builds `today:2026-09-14` and `sun:2026-09-14` from the
   * date alone, so every account in the batch has the same handful of ids. Two
   * students in one run meant each of them deleting the other's reminders,
   * including ones not due for hours and never sent. The symptom is a
   * notification that silently never arrives, on the days when somebody else
   * happened to be in the same batch, which is every day once there are two
   * users.
   *
   * Composite keys are not something PostgREST can filter on in one call, so
   * this deletes per account: each account's own ids, scoped to that account.
   */
  const queuedByUser = new Map<string, string[]>();
  for (const row of rows) queuedByUser.set(row.user_id, [...(queuedByUser.get(row.user_id) ?? []), row.id]);
  for (const [userId, ids] of queuedByUser) {
    await db.from('push_queue').delete().eq('user_id', userId).in('id', ids);
  }

  /*
   * A device is looked at once per reminder, so one run can have both a
   * success and a 410 for the same endpoint — a gateway rejecting one payload,
   * or rotating the subscription part-way through the batch. Proof that it is
   * alive outranks proof that it is not, in both directions: an endpoint that
   * answered at any point in this run is neither marked nor retired.
   */
  const mark = [...failing].filter((e) => !answered.has(e));
  const retire = [...dead].filter((e) => !answered.has(e));
  const clear = [...revived];

  if (mark.length > 0) {
    await db.from('push_devices').update({ gone_at: new Date().toISOString() }).in('endpoint', mark);
  }
  if (clear.length > 0) {
    await db.from('push_devices').update({ gone_at: null }).in('endpoint', clear);
  }
  if (retire.length > 0) {
    await db.from('push_devices').delete().in('endpoint', retire);
  }

  return Response.json({
    sent,
    devices: byUser.size,
    dropped: retire.length,
    marked: mark.length,
  });
});
