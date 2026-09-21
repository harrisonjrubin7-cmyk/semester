/**
 * One line on Today saying somebody is waiting on you, or nothing at all.
 *
 * The counts this draws have existed since the rooms did — `roomchat.ts`'s
 * `unread` has always known how many messages arrived since you last looked
 * and how many of them said your handle. What was missing was anywhere to
 * *see* them without first guessing they might be there: the numbers were
 * computed inside `screens/Classmates.tsx` and read by that screen alone.
 *
 * So the app could tell you everything about your own week and nothing about
 * anybody else's move. This is the other half of that, and it is deliberately
 * one line rather than a feed — the point is to say *go and look*, not to
 * become somewhere you scroll.
 *
 * `lib/waiting.ts` holds every decision about what counts and what the
 * sentence says; this file is the gate, the fetch and the button.
 *
 * ## It is silent far more often than not
 *
 * Four gates, any one of which draws nothing: no account service in this
 * build, nobody signed in, an address the school does not admit, and — the
 * common one — nothing waiting. A row that appears only when it has something
 * to say can afford to sit at the top; one that is always there, saying
 * "nothing new", is a row the eye learns to skip and then keeps skipping on
 * the day it matters.
 *
 * Nothing renders while the answer is still arriving either. A line that
 * appears a second after the screen settles is worse than one that was never
 * promised, and there is no skeleton here for the same reason.
 *
 * ## The sample cannot reach it, and not by accident
 *
 * `screens/Today.tsx`'s overdue banner had to learn this the hard way: while
 * `state.sample` is true the catalogue carries a whole shipped semester the
 * visitor never asked for, and counting it greeted them with a number about
 * somebody else's term.
 *
 * This is safe from that, but it is worth saying *why* rather than trusting
 * it. `roomsFor` does build a room key for every course in the catalogue,
 * sample ones included — but `joined` comes from `myRooms`, which is a server
 * query against this account, and `lib/waiting.ts` counts only joined rooms.
 * A sample course nobody joined therefore has no messages and no membership,
 * and contributes nought through two independent routes.
 *
 * ## What it costs
 *
 * Three queries, the same three `Classmates` makes, when the gates are open.
 * Visiting both screens asks twice. That is a real cost and the honest
 * accounting is that it buys the only signal in the app that another person
 * did something; a push notification would be cheaper and is not a substitute,
 * because it is gone the moment it is dismissed and this is not.
 */

import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { cloudConfigured } from '../lib/cloud';
import { across, eligible, myProfile, myRooms, roomsFor, termOf, type Message } from '../lib/classmates';
import { bucket, listed, type Say } from '../lib/roomchat';
import { marks as storedMarks } from '../lib/roomprefs';
import { waiting, waitingLine, waitingRoom } from '../lib/waiting';

export function Waiting() {
  const { state, dispatch, catalog, account, school } = useStore();
  const [said, setSaid] = useState<Record<string, Message[]>>({});
  const [rooms, setRooms] = useState<string[]>([]);
  const [handle, setHandle] = useState('');
  const [ready, setReady] = useState(false);

  const term = termOf(new Date());
  const ok = cloudConfigured && !!account && eligible(account?.email, school);

  useEffect(() => {
    if (!ok || !account) return;
    let live = true;
    void (async () => {
      try {
        const [profile, mine] = await Promise.all([myProfile(account.id), myRooms(account.id, term)]);
        if (!live) return;
        setHandle(profile?.handle ?? '');
        setRooms(mine);
        if (mine.length > 0) {
          const recent = await across(term, mine);
          if (live) setSaid(bucket(recent, (m) => m.code));
        }
      } catch {
        /*
         * Silence, and it is the right answer here rather than a lazy one.
         * This row is an extra; a student who opened Today to see what is due
         * is not helped by a sentence about a failed query for something they
         * did not ask for. `screens/Classmates.tsx` is where the same failure
         * is worth reporting, because there it is the screen's whole job.
         */
      } finally {
        if (live) setReady(true);
      }
    })();
    return () => {
      live = false;
    };
  }, [ok, account, term]);

  const w = useMemo(() => {
    if (!account || !state.schoolId) return waiting([]);
    const offered = roomsFor(
      catalog.courses.map((c) => c.code),
      rooms,
      state.schoolId,
    );
    return waiting(
      listed(
        offered,
        said as Record<string, Say[]>,
        storedMarks(),
        account.id,
        // No names on the previews: this draws one sentence, not a list of
        // rows, so it never shows who said what and loading forty profiles to
        // prefix a line nobody reads would be four queries for nothing.
        () => '',
        new Date(),
        handle,
        /*
         * Your own handle, and it has to be here.
         *
         * `pieces` only treats `@name` as a mention when `name` is in this
         * list — an unmatched `@` stays text on purpose, so that the app never
         * paints a mention of somebody who will not be told. Pass an empty
         * list and `@harrison` is plain words, so `mentions` can only ever
         * count `@class`, and the whole "somebody named you" half of this row
         * is dead on arrival. Found by the test, which asserted the named
         * sentence and got the volume one.
         *
         * One entry is all that is wanted. Every other handle in the room is
         * somebody else being named, which is not this row's business.
         */
        handle ? [handle] : [],
      ),
    );
  }, [account, state.schoolId, catalog.courses, rooms, said, handle]);

  const line = waitingLine(w);
  if (!ok || !ready || line === '') return null;

  const code = waitingRoom(w);

  return (
    <button
      type="button"
      className="bare tappable"
      onClick={() => {
        if (code && typeof window !== 'undefined') {
          // The contract `screens/Classmates.tsx` already reads on mount, and
          // clears out of the address once it has. Reusing it means there is
          // one way into a room from elsewhere rather than two.
          const url = new URL(window.location.href);
          url.searchParams.set('room', code);
          window.history.replaceState({}, '', url);
        }
        dispatch({ type: 'go', screen: 'classmates' });
      }}
      style={{
        display: 'flex',
        gap: 'var(--sp-5)',
        alignItems: 'center',
        width: '100%',
        marginTop: 'var(--sp-6)',
        paddingBlock: 'calc(11px * var(--density, 1))',
        paddingInline: 'calc(13px * var(--density, 1))',
        borderRadius: 12,
        textAlign: 'left',
        border: '1px solid var(--app-line)',
        background: 'var(--app-accent-wash)',
      }}
    >
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 'var(--type-base)',
          lineHeight: 'var(--leading-tight-plus)',
        }}
      >
        {line}
      </span>
      <span
        style={{
          flex: 'none',
          fontFamily: 'var(--font-heading)',
          fontSize: 'var(--type-xs)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--app-dim)',
        }}
      >
        Open
      </span>
    </button>
  );
}
