import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { canPush, enrol, enrolled, leave, PUSH_NOTE, queueFor } from '../lib/push';
import { dropDevice, saveDevice, saveQueue, wipeQueue } from '../lib/cloud';
import { railFor, datedItems } from '../lib/select';

const VAPID = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ?? '';

/**
 * Reminders that arrive when the app is shut.
 *
 * Everything above this in the settings list is a rule about *what* is worth
 * saying. This is the one switch about *whether it can reach you* — which
 * until now it could not, because the app only ever called `new Notification`
 * from an open page.
 *
 * Three things have to be true and each is said plainly rather than hidden
 * behind a switch that does nothing: the browser has to support push, the
 * build has to carry a key, and you have to be signed in — because the queue
 * lives on the account, and there is nowhere to put it otherwise.
 */
export function PushSwitch() {
  const { state, catalog, now, account } = useStore();
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState('');

  useEffect(() => {
    void enrolled().then(setOn);
  }, []);

  if (!canPush()) return null;

  const blocked = !VAPID
    ? 'This build has no push key set, so reminders cannot be delivered. See supabase/functions/push.'
    : !account
      ? 'Sign in first — the queue lives on your account, and there is nowhere to keep it otherwise.'
      : '';

  const turnOn = async () => {
    setBusy(true);
    setSaid('');
    const device = await enrol(VAPID);
    if (!device) {
      setSaid('Not switched on. Either the permission was refused, or this browser will not.');
      setBusy(false);
      return;
    }
    await saveDevice(device);
    // The week's reminders, worked out here and left for the sender. The
    // server does none of this arithmetic — see `lib/push.ts`.
    const queue = queueFor(now, state.notifs, (d) => ({
      items: datedItems(catalog, d).filter((i) => !state.done[i.id]),
      classes: railFor(catalog, d, state.appointments, state.commitments)
        .filter((b) => !b.optional && !b.canceled)
        .map((b) => ({ label: b.title, at: b.at, where: b.meta })),
      registrar: state.registrar,
    }));
    await saveQueue(queue);
    setOn(true);
    setSaid(
      queue.length > 0
        ? `On. ${queue.length} ${queue.length === 1 ? 'reminder' : 'reminders'} queued for the next week.`
        : 'On. Nothing to send this week — it will queue as things come up.',
    );
    setBusy(false);
  };

  const turnOff = async () => {
    setBusy(true);
    const endpoint = await leave();
    if (endpoint) await dropDevice(endpoint);
    await wipeQueue();
    setOn(false);
    setSaid('Off, and the queue is deleted.');
    setBusy(false);
  };

  return (
    <div style={{ marginTop: 10 }}>
      <button
        type="button"
        className="btn btn-secondary btn-block"
        disabled={busy || Boolean(blocked)}
        onClick={() => void (on ? turnOff() : turnOn())}
        style={{ height: 40, fontSize: 12.5 }}
      >
        {busy ? 'Just a moment…' : on ? 'Stop sending reminders to this device' : 'Send reminders to this device'}
      </button>

      {(said || blocked) && (
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8, lineHeight: 1.5 }}>
          {blocked || said}
        </div>
      )}

      <div style={{ fontSize: 11, opacity: 0.45, marginTop: 8, lineHeight: 1.45 }}>{PUSH_NOTE}</div>
    </div>
  );
}
