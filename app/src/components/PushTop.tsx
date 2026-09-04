/**
 * Keeping the reminder queue fed.
 *
 * The queue holds a week and was written once, at the moment the switch was
 * turned on. Seven days later it was empty, nothing arrived again, and the
 * switch still said "on" — a feature that stops working without saying so,
 * which is the worst failure a reminder can have.
 *
 * So this is mounted once at the top of the app, like `Keys` and `Ringing`,
 * and rebuilds the queue at most twice a day while the switch is on. It draws
 * nothing, blocks nothing, and says nothing when it cannot: an offline device
 * or a signed-out account simply leaves the queue as it was, and the next
 * opening tries again.
 *
 * The arithmetic is still the client's. See `lib/push.ts` — a server that
 * worked out what was due would keep its own copy of the date rules and drift
 * from `lib/notify.ts` within a term.
 */

import { useEffect, useRef } from 'react';
import { useStore } from '../state/store';
import { enrolled, lastRefill, markRefilled, needsRefill, queueFor } from '../lib/push';
import { saveQueue } from '../lib/cloud';
import { datedItems, railFor } from '../lib/select';

export function PushTop() {
  const { state, catalog, now, account } = useStore();
  // Once per mount, not once per render: `now` ticks every thirty seconds and
  // the effect's other dependencies change whenever anything is ticked off.
  const tried = useRef(false);

  useEffect(() => {
    if (tried.current || !account) return;
    if (!needsRefill(lastRefill(), Date.now())) return;
    tried.current = true;

    void (async () => {
      try {
        if (!(await enrolled())) return;
        const queue = queueFor(now, state.notifs, (d) => ({
          items: datedItems(catalog, d).filter((i) => !state.done[i.id]),
          classes: railFor(catalog, d, state.appointments, state.commitments)
            .filter((b) => !b.optional && !b.canceled)
            .map((b) => ({ label: b.title, at: b.at, where: b.meta })),
          registrar: state.registrar,
        }));
        await saveQueue(queue);
        markRefilled(Date.now());
      } catch {
        // Offline, or the account is not reachable. The stamp is deliberately
        // not written, so the next opening tries again rather than waiting
        // twelve hours after a failure.
      }
    })();
  }, [account, catalog, now, state.notifs, state.done, state.appointments, state.commitments, state.registrar]);

  return null;
}
