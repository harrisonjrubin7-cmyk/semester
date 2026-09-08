/**
 * The calendar feed, on the Export screen.
 *
 * A downloaded `.ics` is a photograph; a subscription is a window. This is the
 * window: a link Apple Calendar and Google Calendar poll every few hours, so a
 * deadline that moves in the app moves in the calendar without anybody
 * exporting anything again.
 *
 * ## What is on the device and what is on the server
 *
 * The device renders the calendar — `lib/export.ts`, the same emitter the
 * download uses — and uploads the finished text. The Edge Function looks up one
 * row by token and returns the string. It has no idea what a deadline is, which
 * is the point: a second emitter in Deno would drift from this one the moment
 * either was touched, and the calendar would quietly disagree with the app.
 *
 * The cost, said on the screen rather than hidden: the feed is only as fresh as
 * the last publish from a signed-in device. `freshness()` is what says so.
 *
 * ## Ticked-off work is not in the feed
 *
 * `CALENDAR-REVIEW.md` left this open and inclined this way, and it is right: a
 * calendar showing what you have already finished is one you stop reading. The
 * download still carries everything, because an export should be a complete
 * record, and the screen says which is which rather than leaving somebody to
 * notice.
 *
 * ## The link is a password
 *
 * A calendar subscription cannot sign in — there is no header for it to send —
 * so the token in the URL is the whole of the authentication. `SHARE_WARNING`
 * sits beside the link every time, not behind a disclosure, because the one
 * moment it matters is the moment somebody is about to paste it somewhere.
 */

import { useCallback, useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { SectionLabel } from './ui';
import { ALARMS, appointmentEvents, deadlineEvents, toIcs } from '../lib/export';
import { datedItems } from '../lib/select';
import { feedBase, publishFeed, readFeed, replaceFeed } from '../lib/cloud';
import { qrSvg } from '../lib/qr';
import {
  REPLACED_LINE,
  SHARE_WARNING,
  feedItems,
  feedUrl,
  freshness,
  newToken,
  webcalUrl,
  type Published,
} from '../lib/subscribe';

export function Subscribe() {
  const { state, catalog, now, courseCode, account } = useStore();
  const [feed, setFeed] = useState<Published | null>(null);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState('');
  const [replaced, setReplaced] = useState(false);

  // What goes up: everything dated, minus what has been ticked off. The rule
  // and the reasoning are in `lib/subscribe.ts`, next to the copy about it.
  const live = feedItems(datedItems(catalog, now), state.done);

  const body = useCallback(
    () =>
      toIcs(
        [
          ...deadlineEvents(live, courseCode, ALARMS),
          ...appointmentEvents(state.appointments),
        ],
        'Semester',
      ),
    [live, courseCode, state.appointments],
  );

  useEffect(() => {
    if (!account) return;
    let gone = false;
    void readFeed().then((row) => {
      if (!gone) setFeed(row);
    });
    return () => {
      gone = true;
    };
  }, [account]);

  /*
   * Publishing generates a token only when there is not one already.
   *
   * The link somebody has given to their phone has to survive every later
   * publish, or "update my calendar" would silently mean "and re-subscribe on
   * every device". Replacing it is the separate, deliberate act below.
   */
  const publish = async () => {
    setBusy(true);
    setSaid('');
    setReplaced(false);
    try {
      const token = feed?.token ?? newToken();
      await publishFeed({ token, body: body(), name: 'Semester', events: live.length });
      setFeed({ token, updatedAt: Date.now(), events: live.length });
      setSaid('Published.');
    } catch (e) {
      setSaid(e instanceof Error ? e.message : 'That did not go up. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const replace = async () => {
    setBusy(true);
    setSaid('');
    try {
      const token = newToken();
      await replaceFeed(token);
      // Straight back up under the new token, so the new link works the moment
      // it is shown rather than after the next publish.
      await publishFeed({ token, body: body(), name: 'Semester', events: live.length });
      setFeed({ token, updatedAt: Date.now(), events: live.length });
      setReplaced(true);
      setSaid('');
    } catch (e) {
      setSaid(e instanceof Error ? e.message : 'The link could not be replaced. Try again.');
    } finally {
      setBusy(false);
    }
  };

  // Signed out there is no account to hang a feed off, and saying so on a
  // screen full of things that do work would be noise.
  if (!account) return null;

  const url = feed ? feedUrl(feedBase(), feed.token) : '';

  return (
    <section style={{ marginTop: 'var(--sp-7)' }}>
      <SectionLabel>Subscribe in a calendar app</SectionLabel>
      <p style={LEAD}>
        A link Apple Calendar or Google Calendar checks every few hours, so a date that
        moves here moves there. Anything you have ticked off stays out of it — the
        download above still has everything.
      </p>

      {feed ? (
        <>
          <p style={FRESH}>
            {freshness(feed.updatedAt, now)}
            {typeof feed.events === 'number' ? ` ${feed.events} in the calendar.` : ''}
          </p>
          <input
            className="input"
            readOnly
            value={webcalUrl(url)}
            aria-label="Your calendar feed link"
            onFocus={(e) => e.currentTarget.select()}
            style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 'var(--type-xs)' }}
          />
          {/*
            For the phone sitting next to the laptop.

            `dangerouslySetInnerHTML` because `qrSvg` returns markup this
            project generated from a string it was handed — there is no user
            HTML anywhere near it, and building four hundred React elements
            for a 41×41 grid would cost a layout on every render.

            Hidden from screen readers: it encodes the link that is already in
            the field above, so announcing it would be the same information a
            second time with no way to act on it.
          */}
          <div style={QR} aria-hidden="true" dangerouslySetInnerHTML={{ __html: qrSvg(webcalUrl(url)) }} />
          <p style={WARN}>{SHARE_WARNING}</p>
          {replaced && <p style={WARN}>{REPLACED_LINE}</p>}
        </>
      ) : (
        <p style={FRESH}>Nothing published yet.</p>
      )}

      <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-4)' }}>
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void publish()}>
          {feed ? 'Publish again' : 'Publish my calendar'}
        </button>
        {feed && (
          <button type="button" className="bare" disabled={busy} onClick={() => void replace()} style={ACT}>
            REPLACE THIS LINK
          </button>
        )}
      </div>
      {said && <p style={FRESH}>{said}</p>}
    </section>
  );
}

const LEAD = {
  margin: 'var(--sp-3) 0 var(--sp-4)',
  fontSize: 'var(--type-sm)',
  lineHeight: 'var(--leading-normal)',
  opacity: 0.75,
} as const;

const FRESH = {
  margin: 'var(--sp-3) 0 var(--sp-3)',
  fontSize: 'var(--type-xs)',
  opacity: 0.6,
} as const;

const WARN = {
  margin: 'var(--sp-3) 0 0',
  fontSize: 'var(--type-xs)',
  lineHeight: 'var(--leading-normal)',
  opacity: 0.75,
} as const;

/** Big enough for a phone camera at arm's length, small enough not to dominate. */
const QR = {
  width: 148,
  height: 148,
  marginTop: 'var(--sp-4)',
  // The code needs its own light ground whatever the app's is: a dark theme
  // behind a transparent SVG would invert it, and an inverted code is one many
  // scanners refuse.
  background: '#fff',
  padding: 'var(--sp-2)',
  borderRadius: 'var(--r-sm)',
} as const;

const ACT = {
  width: 'auto',
  fontSize: 'var(--type-xs)',
  letterSpacing: '0.08em',
  opacity: 0.55,
} as const;
