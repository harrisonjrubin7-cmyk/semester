import { useEffect, useState } from 'react';
import { secondLine } from '../lib/dim';
import { useNow, useStore } from '../state/store';
import {
  canPush,
  enrol,
  enrolled,
  leave,
  markRefilled,
  neverArrived,
  PUSH_NOTE,
  queueFor,
  stalledLine,
} from '../lib/push';
import { INSTALL_FIRST, NO_PUSH_HERE, reach } from '../lib/onhome';
import { atRiskToday } from '../lib/atrisk';
import { classesToNudge } from '../lib/notify';
import { cloudConfigured, dropDevice, queuedSendAts, saveDevice, saveQueue, wipeQueue } from '../lib/cloud';
import { railFor, datedItems } from '../lib/select';
import { beginNow, planFrom } from '../lib/start';

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
 *
 * ## The fourth, which used to be said by drawing nothing
 *
 * `canPush()` being false returned `null` here, and on one platform that was
 * the whole feature failing silently. Safari delivers push only to a page the
 * student has added to their home screen, and offers no prompt to do it —
 * so every iPhone opening this screen in a tab found the row simply absent,
 * with nothing anywhere saying that reminders were one gesture away. See
 * `lib/onhome.ts`: where the answer is fixable it is now said, and where it
 * is not, that is said too rather than leaving a hole somebody has to guess
 * the meaning of.
 */
export function PushSwitch() {
  const { state, catalog, account, courseCode } = useStore();
  const now = useNow();
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState('');
  const [stalled, setStalled] = useState('');

  useEffect(() => {
    void enrolled().then(setOn);
  }, []);

  /*
   * Whether anything is actually being delivered.
   *
   * The switch has always been able to say "on" while nothing arrived, because
   * "on" was only ever a fact about this browser: a `PushSubscription` exists,
   * the queue has rows in it, and both remain true when the sender is not
   * running. `REFILL_HOURS` in `lib/push.ts` caught the version of this where
   * the queue empties; this is the version where it does not.
   *
   * Asked once per switch-on rather than on a timer. It is a question about a
   * job that runs every fifteen minutes, so polling it would cost a request an
   * hour to learn something that changes about once a deploy.
   *
   * A failure here is not reported. This is the check that tells you the
   * reminders are broken, and a check that announces its own network error
   * would put a second, wronger sentence in front of exactly the person the
   * first one was written for.
   */
  useEffect(() => {
    // Not `if (!on) setStalled('')`. Clearing it synchronously here is a
    // setState inside an effect, which the React rules rightly count against
    // the warning budget — and the rule's own advice is the better shape
    // anyway: the thing that makes this stale is the switch being turned off,
    // so `turnOff` clears it, at the event that caused the change.
    if (!on) return;
    let live = true;
    void queuedSendAts()
      .then((ats) => {
        if (live) setStalled(stalledLine(neverArrived(ats, Date.now())));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [on]);

  // Not `if (!canPush()) return null`. See the note above: on iOS the absence
  // of push is a thing the student can fix in two taps, and drawing nothing
  // was the app declining to mention it.
  const can = reach(canPush());
  if (can !== 'ready') {
    return (
      <div style={{ marginTop: 'var(--sp-5)' }}>
        <div
          style={{
            fontSize: 'var(--type-sm)',
            color: 'var(--app-dim)',
            lineHeight: 'var(--leading-relaxed)',
            textWrap: 'pretty',
          }}
        >
          {can === 'install-first' ? INSTALL_FIRST : NO_PUSH_HERE}
        </div>
      </div>
    );
  }

  /*
   * Three reasons, not two. The build can lack the push key, the build can
   * lack an account service, or the person can simply be signed out — and
   * only the last of those is an instruction they can act on.
   *
   * The middle one used to fall through to "Sign in first", which on a build
   * with `VITE_SUPABASE_URL` set and `VITE_SUPABASE_KEY` unset is advice with
   * nothing behind it: `screens/Account` says there is no account service, and
   * there is no form to fill in. The push key already had its own sentence
   * here for exactly this reason; the account service did not.
   */
  const blocked = !VAPID
    ? 'This build has no push key set, so reminders cannot be delivered. See supabase/functions/push.'
    : !cloudConfigured
      ? 'This build has no account service, and the queue lives on an account, so reminders cannot be delivered.'
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
      classes: classesToNudge(railFor(catalog, d, state.appointments, state.commitments)),
      registrar: state.registrar,
      /*
       * A muted course is silent here too, and so are quiet hours.
       *
       * Both were passed by the in-page tick and by neither of the two callers
       * that fill this queue, which meant the two switches worked on the tab
       * and not on the phone — the surface a reminder was muted *for*. A rule
       * enforced in one of three callers is a rule that leaks, in the words of
       * `lib/notify.ts`, "and the thing it leaks is a notification somebody
       * explicitly switched off".
       */
      muted: state.mutedCourses,
      quiet: state.quiet,
      // Before the class, not after the absence. See `lib/atrisk.ts`.
      atRisk: atRiskToday(
        railFor(catalog, d, state.appointments, state.commitments),
        state.attendance,
        state.attendPolicy,
        courseCode,
      ),
      // The day to begin, not the day it is due. See `lib/start.ts`.
      starts: beginNow(
        planFrom({
          items: datedItems(catalog, d),
          done: state.done,
          spent: state.spent,
          windows: state.windows,
          now: d,
        }),
      ),
    }));
    await saveQueue(queue);
    markRefilled(Date.now());
    setOn(true);
    setSaid(
      queue.length > 0
        ? `On. ${queue.length} ${queue.length === 1 ? 'reminder' : 'reminders'} queued for the next week.`
        : 'On. Nothing to send this week. The queue is rebuilt whenever you open the app, so anything new gets picked up.',
    );
    setBusy(false);
  };

  const turnOff = async () => {
    setBusy(true);
    const endpoint = await leave();
    if (endpoint) await dropDevice(endpoint);
    await wipeQueue();
    setOn(false);
    // The queue is gone, so nothing is overdue in it any more.
    setStalled('');
    setSaid('Off, and the queue is deleted.');
    setBusy(false);
  };

  return (
    <div style={{ marginTop: 'var(--sp-5)' }}>
      <button
        type="button"
        className="btn btn-secondary btn-block"
        disabled={busy || Boolean(blocked)}
        onClick={() => void (on ? turnOff() : turnOn())}
        style={{ height: 40, fontSize: 'var(--type-sm-plus)' }}
      >
        {busy ? 'Just a moment…' : on ? 'Stop sending reminders to this device' : 'Send reminders to this device'}
      </button>

      {(said || blocked) && (
        <div style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)', marginTop: 'var(--sp-4)', lineHeight: 'var(--leading-relaxed)' }}>
          {blocked || said}
        </div>
      )}

      {stalled && (
        <div
          role="status"
          style={{
            fontSize: 'var(--type-sm)',
            color: 'var(--app-warn)',
            background: 'var(--app-warn-wash)',
            border: '1px solid var(--app-warn-line)',
            borderRadius: 'var(--radius-sm)',
            padding: 'var(--sp-4)',
            marginTop: 'var(--sp-4)',
            lineHeight: 'var(--leading-relaxed)',
            textWrap: 'pretty',
          }}
        >
          {stalled}
        </div>
      )}

      <div style={{ fontSize: 'var(--type-xs)', ...secondLine(), marginTop: 'var(--sp-4)', lineHeight: 'var(--leading-normal)' }}>{PUSH_NOTE}</div>
    </div>
  );
}
