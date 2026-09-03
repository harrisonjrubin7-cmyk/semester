import { useRef, useState } from 'react';
import { useStore } from '../state/store';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel } from '../components/ui';
import { parseIcs } from '../lib/ics';
import {
  PROVIDERS,
  beginAuth,
  describe,
  forget,
  listRemoteFiles,
  pullCalendar,
  tokens,
  type ProviderId,
  type RemoteFile,
} from '../lib/connect';
import type { FeedSource } from '../lib/types';

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
  const { state, dispatch } = useStore();
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
  const fileInput = useRef<HTMLInputElement>(null);
  const live = tokens();

  const addIcsText = (text: string, name: string, from: string, kind: FeedSource['kind']) => {
    const { events, name: calName } = parseIcs(text);
    if (events.length === 0) {
      setNote('No events in that calendar. It may be the wrong link — the feed has to be the .ics one.');
      return;
    }
    dispatch({
      type: 'addFeed',
      feed: {
        kind,
        name: calName || name,
        url: from,
        synced: Date.now(),
        status: `${events.length} events read`,
        count: events.length,
      },
      events,
    });
    setNote(`${events.length} events from ${calName || name}.`);
  };

  const subscribe = async (kind: FeedSource['kind']) => {
    const target = url.trim();
    if (!target) return;
    setBusy('feed');
    try {
      // A calendar server sends no CORS headers, so the fetch goes through the
      // dev proxy. Without it, the file route is the one that works.
      const res = await fetch(`/feed?url=${encodeURIComponent(target)}`);
      if (!res.ok) throw new Error(`The feed answered ${res.status}.`);
      const text = await res.text();
      addIcsText(text, 'Subscribed calendar', target, kind);
      setUrl('');
    } catch (e) {
      setNote(
        `${describe(e)} A subscribed link needs the dev proxy running. Downloading the .ics and adding the file works either way.`,
      );
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
      const events = await pullCalendar(id);
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
    <div style={{ padding: 18 }}>
      <div className="chrome-text" style={{ fontSize: 26, lineHeight: 1.1 }}>
        Everything in one place
      </div>
      <div style={{ fontSize: 13, opacity: 0.7, marginTop: 6, textWrap: 'pretty' }}>
        Brightspace, Outlook, Google and Zoom all publish calendars. Point the app at them and
        their dates sit on the same day rail as your classes — kept apart, and labelled.
      </div>

      {note && (
        <Blueprint style={{ padding: '12px 14px', marginTop: 14, background: 'var(--app-hero)' }}>
          <div style={{ fontSize: 13, lineHeight: 1.5, textWrap: 'pretty' }}>{note}</div>
        </Blueprint>
      )}

      {/* ── Brightspace ─────────────────────────────────────────────────── */}
      <SectionLabel>Brightspace</SectionLabel>
      <Blueprint style={{ padding: '14px 15px' }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18 }}>
          Vanderbilt Brightspace
        </div>
        <div style={{ fontSize: 13, opacity: 0.75, lineHeight: 1.5, marginTop: 5, textWrap: 'pretty' }}>
          In Brightspace, open <strong>Calendar</strong>, click <strong>Subscribe</strong>, and copy
          the link it gives you. It already carries your access — no password, and nothing to
          install. Paste it below.
        </div>
        <input
          className="input"
          placeholder="https://brightspace.vanderbilt.edu/d2l/le/calendar/feed/user/feed.ics?token=…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          style={{ fontSize: 12, marginTop: 10 }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!url.trim() || busy === 'feed'}
            onClick={() => void subscribe('brightspace')}
            style={{ flex: 1, height: 42, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase' }}
          >
            {busy === 'feed' ? 'Reading…' : 'Subscribe'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => fileInput.current?.click()}
            style={{ flex: 1, height: 42, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase' }}
          >
            Add an .ics file
          </button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".ics,text/calendar"
          style={{ display: 'none' }}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            addIcsText(await file.text(), file.name.replace(/\.ics$/i, ''), '', 'ics');
          }}
        />
        <div style={{ fontSize: 11.5, opacity: 0.55, lineHeight: 1.45, marginTop: 10 }}>
          Grades and submissions need D2L’s Valence API, which Vanderbilt has to issue a key for.
          The calendar feed is what a student can turn on alone, and it carries the dates.
        </div>
      </Blueprint>

      {/* ── OAuth providers ─────────────────────────────────────────────── */}
      <SectionLabel>Accounts</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        {(Object.keys(PROVIDERS) as ProviderId[]).map((id) => {
          const spec = PROVIDERS[id];
          const token = live[id];
          const feed = state.feeds.find((f) => f.kind === (id === 'microsoft' ? 'microsoft' : 'ics') && f.url === id);
          return (
            <Blueprint key={id} style={{ padding: '14px 15px' }}>
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}
              >
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18 }}>{spec.name}</div>
                {token && <span className="tag tag-accent">Connected</span>}
              </div>
              <div style={{ fontSize: 13, opacity: 0.75, lineHeight: 1.5, marginTop: 4 }}>
                {spec.blurb}
              </div>

              {!spec.clientId ? (
                <div
                  style={{
                    fontSize: 12,
                    opacity: 0.7,
                    lineHeight: 1.5,
                    marginTop: 10,
                    paddingTop: 10,
                    borderTop: '1px solid var(--app-line)',
                    textWrap: 'pretty',
                    overflowWrap: 'anywhere',
                  }}
                >
                  No client ID yet. Register one at <strong>{spec.console}</strong>, allow{' '}
                  <code style={{ fontSize: 11 }}>{window.location.origin}</code> as the redirect,
                  and put it in <code style={{ fontSize: 11 }}>app/.env.local</code>. Until then,
                  export a calendar from {spec.name} and add the .ics above — same dates, no setup.
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  {!token ? (
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busy === id}
                      onClick={() => void connect(id)}
                      style={{ flex: 1, height: 42, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase' }}
                    >
                      {busy === id ? 'Opening…' : `Sign in with ${spec.name}`}
                    </button>
                  ) : (
                    <>
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
                          pullCalendar(id)
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
                        style={{ fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase' }}
                      >
                        Pull calendar
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={busy !== ''}
                        onClick={() => void browse(id)}
                        style={{ fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase' }}
                      >
                        {id === 'zoom' ? 'Recordings' : 'Recent files'}
                      </button>
                      <button
                        type="button"
                        className="bare"
                        onClick={() => {
                          forget(id);
                          setNote(`${spec.name} disconnected. The token is gone from this device.`);
                        }}
                        style={{ fontSize: 11, opacity: 0.5, letterSpacing: '0.1em' }}
                      >
                        DISCONNECT
                      </button>
                    </>
                  )}
                </div>
              )}

              {spec.needsProxy && spec.clientId && (
                <div style={{ fontSize: 11.5, opacity: 0.55, lineHeight: 1.45, marginTop: 9 }}>
                  {spec.name}’s API refuses browser calls, so this one goes through the dev proxy
                  (<code style={{ fontSize: 11 }}>VITE_OAUTH_PROXY</code>).
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
                gap: 10,
                alignItems: 'baseline',
                padding: '10px 0',
                borderBottom: '1px solid var(--app-line)',
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    display: 'block',
                    fontSize: 13.5,
                    lineHeight: 1.3,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {f.name}
                </span>
                <span style={{ display: 'block', fontSize: 11, opacity: 0.5 }}>{f.modified}</span>
              </span>
              <a
                href={f.link}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 11, letterSpacing: '0.1em', flex: 'none', opacity: 0.7 }}
              >
                OPEN
              </a>
            </div>
          ))}
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
                gap: 10,
                alignItems: 'baseline',
                padding: '11px 0',
                borderBottom: '1px solid var(--app-line)',
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14 }}>{f.name}</span>
                <span
                  style={{
                    display: 'block',
                    fontSize: 11,
                    opacity: 0.55,
                    fontFamily: 'var(--font-heading)',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    marginTop: 2,
                  }}
                >
                  {f.kind} · {f.status}
                </span>
              </span>
              <button
                type="button"
                className="bare"
                onClick={() => dispatch({ type: 'removeFeed', id: f.id })}
                style={{ fontSize: 11, opacity: 0.5, letterSpacing: '0.1em', flex: 'none' }}
              >
                REMOVE
              </button>
            </div>
          ))}
          <div style={{ fontSize: 11.5, opacity: 0.55, lineHeight: 1.45, marginTop: 10 }}>
            Feed events show on the calendar under Campus, marked with where they came from. They
            never overwrite a deadline the syllabus stated.
          </div>
        </>
      )}
      <div style={{ height: 22 }} />
    </div>
  );
}
