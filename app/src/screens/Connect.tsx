import { useState } from 'react';
import { useStore } from '../state/store';
import { Page } from '../components/Page';
import { useRowStyle } from '../components/shell/useShell';
import { configured, modelLabel, routeLabel } from '../lib/claude';
import { Blueprint } from '../components/Blueprint';
import { ChipRow, FilePick, SectionLabel } from '../components/ui';
import { parseIcs } from '../lib/ics';
import { fetchCalendar, isCalendar, notCalendar, readLink } from '../lib/feedlink';
import { cloudConfigured, fetchIcsVia } from '../lib/cloud';
import {
  PROVIDERS,
  addEvent,
  addTask,
  beginAuth,
  describe,
  forget,
  listRemoteFiles,
  pullCalendar,
  tokens,
  writable,
  type ProviderId,
  type RemoteFile,
} from '../lib/connect';
import { datedItems, railFor } from '../lib/select';
import { dateToIso } from '../lib/date';
import type { FeedSource } from '../lib/types';

/**
 * The campus systems the app links out to rather than reads.
 *
 * myVU, YES and AnchorLink have no API a student can use alone, so pretending
 * to integrate with them would mean pretending. What is real is the tap: the
 * address is held here, opens the installed app where the phone recognises it,
 * and is editable — because these are the university's addresses to change, and
 * a link that has gone stale should be a ten-second fix rather than a bug.
 *
 * myVU starts empty on purpose. Where it opens differs between people and
 * devices, and a confident wrong link is worse than a field that asks.
 */

/**
 * The Connect screen.
 *
 * Two routes to the same place, and the screen is honest about which is which.
 *
 * The **file route** works right now, for everyone, with no setup: every one of
 * these systems can hand you an .ics — Brightspace publishes a personal
 * subscribe link, Outlook and Google both export one, Zoom emails one with the
 * invitation. Paste the link or drop the file and the dates are in.
 *
 * The **account route** is a real sign-in over OAuth, which needs a client ID
 * registered by whoever runs this app. When one is missing the card says so and
 * says where to get it, rather than showing a button that fails.
 *
 * The app never asks for a password to any of these, and there is no server to
 * send one to.
 */
export function Connect() {
  const { state, dispatch, now, catalog, account } = useStore();
  const rowTen = useRowStyle(10);
  const rowEleven = useRowStyle(11);
  const [busy, setBusy] = useState<string>('');
  // A sign-in comes back as a page load, so whatever main.tsx left behind is
  // read once, on the way in.
  const [note, setNote] = useState<string>(() => {
    try {
      const left = sessionStorage.getItem('semester.oauth.note') ?? '';
      if (left) sessionStorage.removeItem('semester.oauth.note');
      return left;
    } catch {
      return '';
    }
  });
  const [url, setUrl] = useState('');
  const [files, setFiles] = useState<{ id: ProviderId; list: RemoteFile[] } | null>(null);
  // Kept apart from `note`, which is read at the top of a long screen: a send
  // is started from a button near the bottom and its answer has to be next to
  // the button, not scrolled off above the accounts.
  const [sent, setSent] = useState('');
  const [sendTo, setSendTo] = useState<ProviderId>('google');
  // Whether a file is being dragged over the card, so the drop target is
  // visible before the mouse is let go rather than after.
  const [dropping, setDropping] = useState(false);
  const live = tokens();

  // Who can be written to, which is not the same question as who publishes a
  // calendar — see `writable` in `lib/connect.ts` for the one that bit.
  const outbound = writable(live);
  // A stale pick cannot survive a disconnect: if the chosen one is gone, the
  // first one still connected answers for it.
  const out = outbound.includes(sendTo) ? sendTo : outbound[0];

  /**
   * One calendar's worth of text, in — however it arrived.
   *
   * Returns how many events landed, so a caller adding several files can say
   * one thing at the end rather than four things that overwrite each other.
   *
   * Reading the same calendar twice is a **refresh, not a second copy**. A
   * subscribed link is matched on its address and an imported file on its name,
   * because the alternative is a student who pastes the Brightspace link again
   * next month and finds every deadline listed twice with no way to tell which
   * is which.
   */
  const addIcsText = (text: string, name: string, from: string, kind: FeedSource['kind']): number => {
    /** "1 event", never "1 events" — the count is read, not skimmed. */
    const said = (n: number) => `${n} ${n === 1 ? 'event' : 'events'}`;
    // A sign-in page is not an empty calendar, and saying "no events" for one
    // sends somebody looking for the fault in their calendar rather than in
    // their link.
    if (!isCalendar(text)) {
      setNote(notCalendar(text));
      return 0;
    }
    const { events, name: calName } = parseIcs(catalog.courses, text);
    const title = calName || name;
    if (events.length === 0) {
      setNote(
        `${title} was read, but there is nothing dated in it. That is usually the wrong one of several calendars rather than an empty term.`,
      );
      return 0;
    }
    const already = from
      ? state.feeds.find((f) => f.url === from)
      : state.feeds.find((f) => !f.url && f.name === title);
    if (already) {
      dispatch({ type: 'syncFeed', id: already.id, events, status: said(events.length) });
      setNote(`${title} refreshed — ${said(events.length)}, replacing what was there.`);
      return events.length;
    }
    dispatch({
      type: 'addFeed',
      feed: {
        kind,
        name: title,
        url: from,
        synced: Date.now(),
        status: `${said(events.length)} read`,
        count: events.length,
      },
      events,
    });
    setNote(`${said(events.length)} from ${title}.`);
    return events.length;
  };

  /** What the field currently holds, read as a link. Drives the hint and the button. */
  const reading = url.trim() ? readLink(url) : null;

  /*
   * The routes a fetch may take, worked out once.
   *
   * The account's forwarder is offered only when there is an account to sign
   * the call: `fetchCalendar` tries the calendar itself and the dev server
   * first and only reaches for this on a deployed build, which is exactly
   * where the other two are not there.
   */
  const routes = { account: cloudConfigured && account ? fetchIcsVia : undefined };

  /**
   * The pasted link, whoever published it.
   *
   * Brightspace is the one the card names because it is the one every student
   * here has, but nothing below is about Brightspace: `readLink` works out who
   * published it from the address, and the connected list is labelled with what
   * it found.
   */
  const subscribe = async () => {
    const read = readLink(url);
    if (!read.ok) {
      setNote(read.why);
      return;
    }
    const { url: target, kind, name } = read.link;
    setBusy('feed');
    try {
      const { text } = await fetchCalendar(target, routes);
      if (addIcsText(text, name, target, kind) > 0) setUrl('');
    } catch (e) {
      setNote(describe(e));
    } finally {
      setBusy('');
    }
  };

  /** A subscribed link, fetched again. The events it had are replaced, not added to. */
  const refresh = async (feed: FeedSource) => {
    setBusy(feed.id);
    try {
      // `fetchCalendar` has already refused anything that is not a calendar,
      // so what comes back here is one.
      const { text } = await fetchCalendar(feed.url, routes);
      const { events } = parseIcs(catalog.courses, text);
      const said = `${events.length} ${events.length === 1 ? 'event' : 'events'}`;
      dispatch({ type: 'syncFeed', id: feed.id, events, status: said });
      setNote(`${feed.name}: ${said}.`);
    } catch (e) {
      const message = describe(e);
      dispatch({ type: 'failFeed', id: feed.id, status: 'could not be reached' });
      setNote(message);
    } finally {
      setBusy('');
    }
  };

  /**
   * Files, from the button or from a drop.
   *
   * Several at once because a student exporting a term usually has one file per
   * calendar, and `.ics` is not the only extension the exports carry — Outlook
   * writes `.ics`, some systems write `.ical`, and a few hand over a file with
   * no extension at all and the right contents. What decides is `isCalendar`
   * inside `addIcsText`, not the name.
   */
  const addFiles = async (chosen: File[]) => {
    const files = chosen.filter((f) => f.size > 0);
    if (files.length === 0) return;
    setBusy('file');
    try {
      let total = 0;
      for (const file of files) {
        total += addIcsText(await file.text(), file.name.replace(/\.[^.]+$/, ''), '', 'ics');
      }
      if (files.length > 1) {
        setNote(
          total > 0
            ? `${total} ${total === 1 ? 'event' : 'events'} from ${files.length} files.`
            : `Nothing dated in any of those ${files.length} files.`,
        );
      }
    } catch (e) {
      setNote(`That file could not be read. ${describe(e)}`);
    } finally {
      setBusy('');
    }
  };

  const connect = async (id: ProviderId) => {
    setBusy(id);
    try {
      await beginAuth(id);
    } catch (e) {
      setNote(describe(e));
      setBusy('');
    }
  };

  const sync = async (feed: FeedSource, id: ProviderId) => {
    setBusy(feed.id);
    try {
      const events = await pullCalendar(catalog.courses, id);
      dispatch({ type: 'syncFeed', id: feed.id, events, status: `${events.length} events` });
      setNote(`${PROVIDERS[id].name}: ${events.length} events.`);
    } catch (e) {
      const message = describe(e);
      dispatch({ type: 'failFeed', id: feed.id, status: message });
      setNote(message);
    } finally {
      setBusy('');
    }
  };

  /** One send, with its own busy word and its answer beside the buttons. */
  const sending = async (what: string, fn: (id: ProviderId) => Promise<string>) => {
    if (!out) return;
    setBusy(`send-${what}`);
    setSent('');
    try {
      setSent(await fn(out));
    } catch (e) {
      setSent(describe(e));
    } finally {
      setBusy('');
    }
  };

  /** Everything ahead, onto the calendar you actually use. */
  const sendDeadlines = () =>
    sending('deadlines', async (id) => {
      const ahead = datedItems(catalog, now).filter((i) => !i.isPast);
      for (const item of ahead) {
        await addEvent(id, {
          title: `${catalog.byId[item.c].code} — ${item.title}`,
          date: dateToIso(item.date),
          at: null,
          minutes: 0,
          note: [item.detail, item.weight, item.quote && `“${item.quote}”`]
            .filter(Boolean)
            .join('\n\n'),
        });
      }
      return `${ahead.length} deadlines added to ${PROVIDERS[id].name}. They are all-day entries, so they sit at the top of the day rather than blocking an hour.`;
    });

  const sendWeek = () =>
    sending('week', async (id) => {
      let added = 0;
      for (let ahead = 0; ahead < 7; ahead += 1) {
        const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ahead);
        for (const block of railFor(catalog, day, [])) {
          if (block.canceled || block.optional) continue;
          await addEvent(id, {
            title: block.title,
            date: dateToIso(day),
            at: block.at,
            minutes: 50,
            note: block.meta,
          });
          added += 1;
        }
      }
      return `${added} classes added for the next seven days. Repeat it next week, or subscribe to the campus calendar feed above instead.`;
    });

  const sendTasks = () =>
    sending('tasks', async (id) => {
      const mine = state.tasks.filter((t) => !t.done);
      for (const t of mine) {
        await addTask(id, { title: t.title, date: t.date, note: t.note });
      }
      return `${mine.length} of your own tasks sent to ${id === 'google' ? 'Google Tasks' : 'Microsoft To Do'}.`;
    });

  const browse = async (id: ProviderId) => {
    setBusy(`${id}-files`);
    try {
      setFiles({ id, list: await listRemoteFiles(id) });
    } catch (e) {
      setNote(describe(e));
    } finally {
      setBusy('');
    }
  };

  return (
    <Page>
      <div className="chrome-text" style={{ fontSize: 'var(--type-xl)', lineHeight: 1.1 }}>
        Everything in one place
      </div>
      <div style={{ fontSize: 'var(--type-base)', opacity: 0.7, marginTop: 'var(--sp-3)', textWrap: 'pretty' }}>
        Brightspace, Outlook, Google and Zoom all publish calendars. Point the app at them and
        their dates sit on the same day rail as your classes — kept apart, and labelled.
      </div>

      {note && (
        <Blueprint style={{ padding: '12px 14px', marginTop: 14, background: 'var(--app-hero)' }}>
          <div style={{ fontSize: 'var(--type-base)', lineHeight: 'var(--leading-relaxed)', textWrap: 'pretty' }}>{note}</div>
        </Blueprint>
      )}

      {/* ── a calendar link, from anywhere ──────────────────────────────── */}
      {/*
        One field for every calendar, rather than one card per system.

        This card was Brightspace's alone, and the code behind it filed whatever
        was pasted as Brightspace whatever it was — so an Outlook link arrived
        labelled as something it is not, and there was no way to fetch it again
        later. Nothing about pasting a link is Brightspace-specific: the address
        says who published it (`lib/feedlink.ts`), so the app reads it off the
        address and says what it found before anybody presses anything.

        Brightspace still leads the copy, because it is the one calendar every
        student here already has and the instructions for finding its link are
        worth stating exactly.
      */}
      <SectionLabel>Calendars</SectionLabel>
      <Blueprint
        style={{ padding: '14px 15px', outline: dropping ? '2px dashed var(--app-ink)' : undefined }}
        onDragOver={(e) => {
          e.preventDefault();
          setDropping(true);
        }}
        onDragLeave={() => setDropping(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDropping(false);
          void addFiles([...e.dataTransfer.files]);
        }}
      >
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'calc(18px * var(--text-scale, 1))' }}>
          Paste a calendar link
        </div>
        <div style={{ fontSize: 'var(--type-base)', opacity: 0.75, lineHeight: 'var(--leading-relaxed)', marginTop: 5, textWrap: 'pretty' }}>
          In Brightspace, open <strong>Calendar</strong>, click <strong>Subscribe</strong>, and copy
          the link it gives you. It already carries your access — no password, and nothing to
          install. <strong>Outlook, Google, iCloud, Canvas and Zoom</strong> all publish the same
          kind of link, and all of them work here: paste it below and the app works out whose it is.
          A <code style={{ fontSize: 'var(--type-xs)' }}>webcal://</code> link is fine, and so is one
          with the <code style={{ fontSize: 'var(--type-xs)' }}>https://</code> missing off the front.
        </div>
        <input
          className="input"
          type="url"
          inputMode="url"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          aria-label="Calendar link"
          placeholder="https://brightspace.vanderbilt.edu/d2l/le/calendar/feed/user/feed.ics?token=…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            // Enter is what a pasted address ends with on a phone keyboard.
            if (e.key === 'Enter' && url.trim() && busy !== 'feed') void subscribe();
          }}
          style={{ fontSize: 'var(--type-sm)', marginTop: 'var(--sp-5)' }}
        />
        {/*
          What the app makes of the link, before it is asked to fetch it.

          A typo in a pasted URL is the commonest failure on this screen, and the
          cheapest moment to say so is while the field is still in front of you.
        */}
        {reading && (
          <div
            style={{
              fontSize: 'var(--type-xs)',
              opacity: 0.7,
              lineHeight: 'var(--leading-normal)',
              marginTop: 'var(--sp-3)',
              textWrap: 'pretty',
            }}
          >
            {reading.ok ? `Looks like ${reading.link.name}.` : reading.why}
          </div>
        )}
        <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-4)' }}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!reading?.ok || busy === 'feed'}
            onClick={() => void subscribe()}
            style={{ flex: 1, height: 42, fontSize: 'var(--type-sm)', letterSpacing: '0.1em', textTransform: 'uppercase' }}
          >
            {busy === 'feed' ? 'Reading…' : 'Subscribe'}
          </button>
          <FilePick
            disabled={busy === 'file'}
            block={false}
            accept=".ics,.ical,.ifb,text/calendar"
            onPick={(chosen) => void addFiles(chosen)}
            style={{ flex: 1, height: 42, fontSize: 'var(--type-sm)' }}
          >
            {busy === 'file' ? 'Reading…' : 'Add an .ics file'}
          </FilePick>
        </div>
        <div style={{ fontSize: 'var(--type-xs)', opacity: 0.55, lineHeight: 'var(--leading-normal)', marginTop: 'var(--sp-3)', textWrap: 'pretty' }}>
          {dropping
            ? 'Let go to read it.'
            : 'A downloaded .ics works the same way, and needs nothing of the network — pick one, several at once, or drag them onto this card. Adding the same calendar again refreshes it rather than duplicating it.'}
        </div>
        <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-4)' }}>
          <a
            href={state.linkUrls.brightspace || 'https://brightspace.vanderbilt.edu/d2l/home'}
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary"
            style={{
              flex: 1,
              height: 40,
              fontSize: 'var(--type-xs)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              display: 'grid',
              placeItems: 'center',
              textDecoration: 'none',
            }}
          >
            Open Brightspace
          </a>
        </div>
        <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, lineHeight: 'var(--leading-normal)', marginTop: 'var(--sp-5)', textWrap: 'pretty' }}>
          What a Brightspace account can and cannot give this app, plainly: the{' '}
          <strong>calendar feed</strong> carries every due date and needs nothing but the link.{' '}
          <strong>Grades, submissions and files</strong> live behind D2L’s Valence API, whose keys
          are issued to the university rather than to a student — no app you install can read them
          on your behalf, however it asks. So the app reads the dates, links you to each course’s
          own page from the course screen, and takes uploaded files from you directly.
        </div>
      </Blueprint>

      {/* ── OAuth providers ─────────────────────────────────────────────── */}
      {/*
        Where the Claude settings were.

        Connect accounts had its own key field, model picker and `saveSettings`
        call, and so did Settings → The assistant — two implementations of one
        setting, which is a setting that can disagree with itself. Settings won
        because it is the superset: two providers, the routing between them, and
        what the month has cost. What this screen had and that one did not — the
        check-the-key button, and the sentence saying there is no "sign in with
        Claude" to hunt for — moved there rather than dying with the copy.

        A row rather than nothing at all: this is where the key lived for a year,
        and somebody coming back for it should be told where it went.
      */}
      <SectionLabel>Claude</SectionLabel>
      <Blueprint
        onClick={() => dispatch({ type: 'go', screen: 'setAssistant' })}
        style={{ padding: '13px 15px', display: 'flex', gap: 'var(--sp-6)', alignItems: 'center' }}
      >
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontFamily: 'var(--font-heading)', fontSize: 'var(--type-lg)' }}>
            The assistant
          </span>
          <span style={{ display: 'block', fontSize: 'var(--type-sm)', opacity: 0.6, marginTop: 'var(--sp-1)', textWrap: 'pretty' }}>
            {configured()
              ? `${modelLabel()} · ${routeLabel()}. Change it in Settings.`
              : 'No key yet, so the parts of the app that need Claude are switched off. Set one in Settings.'}
          </span>
        </span>
      </Blueprint>


      <SectionLabel>Accounts</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        {(Object.keys(PROVIDERS) as ProviderId[]).map((id) => {
          const spec = PROVIDERS[id];
          const token = live[id];
          const feed = state.feeds.find((f) => f.kind === (id === 'microsoft' ? 'microsoft' : 'ics') && f.url === id);
          return (
            <Blueprint plain key={id} style={{ padding: '14px 15px' }}>
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--sp-5)' }}
              >
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'calc(18px * var(--text-scale, 1))' }}>{spec.name}</div>
                {token && <span className="tag tag-accent">Connected</span>}
              </div>
              <div style={{ fontSize: 'var(--type-base)', opacity: 0.75, lineHeight: 'var(--leading-relaxed)', marginTop: 'var(--sp-2)' }}>
                {spec.blurb}
              </div>

              {!spec.clientId ? (
                <div
                  style={{
                    fontSize: 'var(--type-sm)',
                    opacity: 0.7,
                    lineHeight: 'var(--leading-relaxed)',
                    marginTop: 'var(--sp-5)',
                    paddingTop: 'var(--sp-5)',
                    borderTop: '1px solid var(--app-line)',
                    textWrap: 'pretty',
                    overflowWrap: 'anywhere',
                  }}
                >
                  No client ID yet. Register one at <strong>{spec.console}</strong>, allow{' '}
                  <code style={{ fontSize: 'var(--type-xs)' }}>{window.location.origin}</code> as the redirect,
                  and put it in <code style={{ fontSize: 'var(--type-xs)' }}>app/.env.local</code>. Until then,
                  export a calendar from {spec.name} and add the .ics above — same dates, no setup.
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-6)', flexWrap: 'wrap' }}>
                  {!token ? (
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busy === id}
                      onClick={() => void connect(id)}
                      style={{ flex: 1, height: 42, fontSize: 'var(--type-sm)', letterSpacing: '0.1em', textTransform: 'uppercase' }}
                    >
                      {busy === id ? 'Opening…' : `Sign in with ${spec.name}`}
                    </button>
                  ) : (
                    <>
                      {spec.calendar && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={busy !== ''}
                        onClick={() => {
                          const existing =
                            feed ??
                            state.feeds.find((f) => f.name === spec.name);
                          if (existing) return void sync(existing, id);
                          // First pull creates the feed the events hang off.
                          setBusy(id);
                          pullCalendar(catalog.courses, id)
                            .then((events) => {
                              dispatch({
                                type: 'addFeed',
                                feed: {
                                  kind: id === 'microsoft' ? 'microsoft' : 'ics',
                                  name: spec.name,
                                  url: id,
                                  synced: Date.now(),
                                  status: `${events.length} events`,
                                  count: events.length,
                                },
                                events,
                              });
                              setNote(`${spec.name}: ${events.length} events.`);
                            })
                            .catch((e: unknown) => setNote(describe(e)))
                            .finally(() => setBusy(''));
                        }}
                        style={{ fontSize: 'var(--type-sm)', letterSpacing: '0.1em', textTransform: 'uppercase' }}
                      >
                        Pull calendar
                      </button>
                      )}
                      {spec.calendar && (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          disabled={busy !== ''}
                          onClick={() => void browse(id)}
                          style={{ fontSize: 'var(--type-sm)', letterSpacing: '0.1em', textTransform: 'uppercase' }}
                        >
                          {id === 'zoom' ? 'Recordings' : 'Recent files'}
                        </button>
                      )}
                      <button
                        type="button"
                        className="bare"
                        onClick={() => {
                          forget(id);
                          setNote(`${spec.name} disconnected. The token is gone from this device.`);
                        }}
                        style={{ fontSize: 'var(--type-xs)', opacity: 0.5, letterSpacing: '0.1em' }}
                      >
                        DISCONNECT
                      </button>
                    </>
                  )}
                </div>
              )}

              {id === 'google' && spec.clientId && (
                <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.6, lineHeight: 'var(--leading-relaxed)', marginTop: 9 }}>
                  Reading Gmail is a restricted scope: until the OAuth client passes Google's
                  review it works only for the test users listed in the console. Calendar, Drive
                  and Tasks are not restricted and work immediately.
                </div>
              )}

              {spec.caveat && (
                <div
                  style={{
                    fontSize: 'calc(11.5px * var(--text-scale, 1))',
                    opacity: 0.6,
                    lineHeight: 'var(--leading-relaxed)',
                    marginTop: 'var(--sp-5)',
                    paddingTop: 'var(--sp-5)',
                    borderTop: '1px solid var(--app-line)',
                    textWrap: 'pretty',
                  }}
                >
                  {spec.caveat}
                </div>
              )}

              {spec.needsProxy && spec.clientId && (
                <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, lineHeight: 'var(--leading-normal)', marginTop: 9 }}>
                  {spec.name}’s API refuses browser calls, so this one goes through the dev proxy
                  (<code style={{ fontSize: 'var(--type-xs)' }}>VITE_OAUTH_PROXY</code>).
                </div>
              )}
            </Blueprint>
          );
        })}
      </div>

      {files && files.list.length > 0 && (
        <>
          <SectionLabel>{PROVIDERS[files.id].name} — recent</SectionLabel>
          {files.list.slice(0, 20).map((f) => (
            <div
              key={f.id}
              style={{
                display: 'flex',
                gap: 'var(--sp-5)',
                alignItems: 'baseline',
                ...rowTen,
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    display: 'block',
                    fontSize: 'calc(13.5px * var(--text-scale, 1))',
                    lineHeight: 'var(--leading-tight)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {f.name}
                </span>
                <span style={{ display: 'block', fontSize: 'var(--type-xs)', opacity: 0.5 }}>{f.modified}</span>
              </span>
              <a
                href={f.link}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 'var(--type-xs)', letterSpacing: '0.1em', flex: 'none', opacity: 0.7 }}
              >
                OPEN
              </a>
            </div>
          ))}
        </>
      )}

      {/* ── send out ─────────────────────────────────────────────────────── */}
      {/*
        What a connected account is for, in the other direction.

        This was the third tab of a screen called Files & mail, and that
        screen is gone: its Files tab listed what this screen lists a few
        inches above, its Mail tab read an inbox that Write an email is the
        screen for, and it sat in the directory one row below this one, which
        is how somebody ends up opening both to find out which is which.

        Pushing dates out is the part that had nowhere else to live, so it
        lives here, under the accounts it writes to. Nothing on this screen
        deletes anything at either end.
      */}
      {out && (
        <>
          <SectionLabel>Send out</SectionLabel>
          <div
            style={{
              fontSize: 'var(--type-base)',
              opacity: 0.68,
              lineHeight: 'var(--leading-relaxed)',
              textWrap: 'pretty',
            }}
          >
            Your dates onto the calendar and task list you already live in. These add rather than
            sync — running one twice makes duplicates, and nothing here removes anything.
          </div>

          {outbound.length > 1 && (
            <ChipRow
              options={outbound}
              value={out}
              onChange={setSendTo}
              labels={Object.fromEntries(outbound.map((id) => [id, PROVIDERS[id].name]))}
              style={{ marginTop: 'var(--sp-5)' }}
            />
          )}

          <button
            type="button"
            className="btn btn-secondary btn-block"
            disabled={busy !== ''}
            onClick={() => void sendDeadlines()}
            style={{ height: 44, marginTop: 'var(--sp-5)' }}
          >
            {busy === 'send-deadlines'
              ? 'Sending…'
              : `Add ${datedItems(catalog, now).filter((i) => !i.isPast).length} deadlines to ${PROVIDERS[out].name}`}
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-block"
            disabled={busy !== ''}
            onClick={() => void sendWeek()}
            style={{ height: 44, marginTop: 'var(--sp-4)' }}
          >
            {busy === 'send-week' ? 'Sending…' : 'Add the next seven days of classes'}
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-block"
            disabled={busy !== '' || state.tasks.filter((t) => !t.done).length === 0}
            onClick={() => void sendTasks()}
            style={{ height: 44, marginTop: 'var(--sp-4)' }}
          >
            {busy === 'send-tasks'
              ? 'Sending…'
              : `Send ${state.tasks.filter((t) => !t.done).length} unfinished to ${
                  out === 'google' ? 'Google Tasks' : 'Microsoft To Do'
                }`}
          </button>

          {sent && (
            <Blueprint style={{ marginTop: 'var(--sp-5)', background: 'var(--app-hero)' }}>
              <div
                style={{
                  fontSize: 'var(--type-base)',
                  lineHeight: 'var(--leading-relaxed)',
                  textWrap: 'pretty',
                  padding: 'var(--sp-6)',
                }}
              >
                {sent}
              </div>
            </Blueprint>
          )}
        </>
      )}

      {/* ── what is connected ───────────────────────────────────────────── */}
      {state.feeds.length > 0 && (
        <>
          <SectionLabel>Connected calendars</SectionLabel>
          {state.feeds.map((f) => (
            <div
              key={f.id}
              style={{
                display: 'flex',
                gap: 'var(--sp-5)',
                alignItems: 'baseline',
                ...rowEleven,
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 'var(--type-md)' }}>{f.name}</span>
                <span
                  style={{
                    display: 'block',
                    fontSize: 'var(--type-xs)',
                    opacity: 0.55,
                    fontFamily: 'var(--font-heading)',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    marginTop: 'var(--sp-1)',
                  }}
                >
                  {f.kind} · {f.status}
                </span>
              </span>
              {/*
                A subscribed link is worth fetching again; an imported file has
                nowhere to fetch from, so it gets no button that would fail.
              */}
              {f.url && !(f.url in PROVIDERS) && (
                <button
                  type="button"
                  className="bare"
                  disabled={busy !== ''}
                  onClick={() => void refresh(f)}
                  style={{ fontSize: 'var(--type-xs)', opacity: 0.5, letterSpacing: '0.1em', flex: 'none' }}
                >
                  {busy === f.id ? 'READING…' : 'REFRESH'}
                </button>
              )}
              <button
                type="button"
                className="bare"
                onClick={() => dispatch({ type: 'removeFeed', id: f.id })}
                style={{ fontSize: 'var(--type-xs)', opacity: 0.5, letterSpacing: '0.1em', flex: 'none' }}
              >
                REMOVE
              </button>
            </div>
          ))}
          <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, lineHeight: 'var(--leading-normal)', marginTop: 'var(--sp-5)' }}>
            Feed events show on the calendar under Campus, marked with where they came from. They
            never overwrite a deadline the syllabus stated.
          </div>
        </>
      )}
      {/*
        The links moved out to a screen of their own — see `screens/Links.tsx`.
        A row is left here rather than nothing at all: this is where they were
        for a year, and somebody who comes looking should be told where they
        went rather than concluding they were deleted.
      */}
      {/*
        The same app on a bigger screen — and it is the same app.

        This used to link to three separately-built static pages under
        `/web/`: a front door, a second copy of the term, and a second copy of
        the study side. Three megabytes of generated bundles that could not be
        edited, could not be tested, and drifted from the app the moment
        anything here changed — a second version of the same product, one tap
        from the real one, which is exactly what somebody discovers when they
        say the app feels like two systems.

        There is one now. It already knows what to do with a wide screen: from
        760px the tab bar unrolls into a rail beside the reading column, which
        is what a laptop was being sent somewhere else for.
      */}
      <SectionLabel>On a desktop</SectionLabel>
      <div className="kicker" style={{ marginTop: 'var(--sp-3)', textTransform: 'none', letterSpacing: 0, opacity: 0.6 }}>
        Open this same address on a laptop. It is one app rather than a phone
        version and a desktop one: the navigation moves to a rail down the side,
        the reading column keeps its width, and it is the same sign-in and the
        same data because it is the same page.
      </div>

      <SectionLabel>Links</SectionLabel>
      <button
        type="button"
        className="btn btn-secondary btn-block"
        onClick={() => dispatch({ type: 'go', screen: 'links' })}
        style={{ height: 44 }}
      >
        Campus, books, tickets and your own
      </button>
    </Page>
  );
}
