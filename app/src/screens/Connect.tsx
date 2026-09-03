import { useRef, useState } from 'react';
import { useStore } from '../state/store';
import {
  MODELS,
  checkKey,
  route,
  saveSettings,
  settings,
  type ClaudeSettings,
} from '../lib/claude';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel } from '../components/ui';
import { parseIcs } from '../lib/ics';
import { CAMPUS_LINKS } from '../data/campus';
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
import type { CampusLink, FeedSource } from '../lib/types';

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
const GROUPS = ['Campus', 'Books', 'Tickets', 'Social', 'Yours'] as const;

function CampusLinks() {
  const { state, dispatch } = useStore();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');

  // Links you add yourself land under "Yours" rather than among the defaults,
  // so which addresses the app guessed and which you chose stays obvious.
  const links: CampusLink[] = [
    ...CAMPUS_LINKS,
    ...state.extraLinks.map((l) => ({ ...l, group: 'Yours' as const })),
  ];
  const addressOf = (link: CampusLink) => state.linkUrls[link.id] ?? link.url;

  const host = (url: string) => {
    try {
      return new URL(url).host.replace(/^www\./, '');
    } catch {
      return url;
    }
  };

  const save = (id: string) => {
    // A bare "yes.vanderbilt.edu" is what people paste; make it a real address
    // rather than refusing it.
    const url = draft.trim();
    dispatch({ type: 'setLinkUrl', id, url: url && !/^https?:\/\//i.test(url) ? `https://${url}` : url });
    setEditing(null);
  };

  return (
    <>
      {/*
        Grouped rather than one flat list. Eleven links under a single
        heading reads as a dump; Campus, Tickets and Social are three
        different errands and you are only ever on one of them.
      */}
      {GROUPS.map((group) => {
        const inGroup = links.filter((l) => (l.group ?? 'Campus') === group);
        if (inGroup.length === 0) return null;
        return (
          <div key={group}>
            <SectionLabel>{group}</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
        {inGroup.map((link) => {
          const url = addressOf(link);
          const open = editing === link.id;
          return (
            <div
              key={link.id}
              style={{ borderBottom: '1px solid var(--app-line)', padding: '12px 0' }}
            >
              <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="bare"
                    style={{ flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}
                  >
                    <span style={{ display: 'block', fontSize: 14.5, lineHeight: 1.3 }}>
                      {link.name}
                    </span>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 11,
                        opacity: 0.5,
                        fontFamily: 'var(--font-heading)',
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        marginTop: 2,
                      }}
                    >
                      {host(url)}
                    </span>
                  </a>
                ) : (
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 14.5, lineHeight: 1.3 }}>
                      {link.name}
                    </span>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 11,
                        opacity: 0.5,
                        fontFamily: 'var(--font-heading)',
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        marginTop: 2,
                      }}
                    >
                      No address yet
                    </span>
                  </span>
                )}
                <button
                  type="button"
                  className="bare"
                  onClick={() => {
                    setDraft(url);
                    setEditing(open ? null : link.id);
                  }}
                  style={{ fontSize: 11, opacity: 0.5, letterSpacing: '0.1em', flex: 'none', width: 'auto' }}
                >
                  {open ? 'CANCEL' : url ? 'EDIT' : 'ADD'}
                </button>
                {state.extraLinks.some((l) => l.id === link.id) && !open && (
                  <button
                    type="button"
                    className="bare"
                    onClick={() => dispatch({ type: 'removeLink', id: link.id })}
                    style={{ fontSize: 11, opacity: 0.5, letterSpacing: '0.1em', flex: 'none', width: 'auto' }}
                  >
                    REMOVE
                  </button>
                )}
              </div>

              {open && (
                <>
                  <input
                    className="input"
                    value={draft}
                    placeholder={link.hint || 'https://…'}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && save(link.id)}
                    style={{ fontSize: 12.5, marginTop: 9 }}
                    aria-label={`${link.name} address`}
                  />
                  {link.note && (
                    <div style={{ fontSize: 11.5, opacity: 0.6, lineHeight: 1.45, marginTop: 7 }}>
                      {link.note}
                    </div>
                  )}
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => save(link.id)}
                    style={{
                      marginTop: 9,
                      fontSize: 11,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Save
                  </button>
                </>
              )}
            </div>
          );
        })}
            </div>
          </div>
        );
      })}

      {adding ? (
        <Blueprint style={{ padding: '13px 14px', marginTop: 12 }}>
          <div className="kicker">Your own link</div>
          <input
            className="input"
            placeholder="What it is — Commodore Card, the gym"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={{ fontSize: 13, marginTop: 9 }}
          />
          <input
            className="input"
            placeholder="https://…"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            style={{ fontSize: 12.5, marginTop: 8 }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setAdding(false)}
              style={{ flex: 1, height: 40, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!newName.trim() || !newUrl.trim()}
              onClick={() => {
                const url = newUrl.trim();
                dispatch({
                  type: 'addLink',
                  name: newName,
                  url: /^https?:\/\//i.test(url) ? url : `https://${url}`,
                });
                setNewName('');
                setNewUrl('');
                setAdding(false);
              }}
              style={{ flex: 1, height: 40, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}
            >
              Add it
            </button>
          </div>
        </Blueprint>
      ) : (
        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={() => setAdding(true)}
          style={{ height: 40, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 12 }}
        >
          Add a link of your own
        </button>
      )}

      <div style={{ fontSize: 11.5, opacity: 0.55, lineHeight: 1.45, marginTop: 10, textWrap: 'pretty' }}>
        These open the system itself — the app on a phone that recognises the address, the site
        otherwise. None of them expose an API a student can use alone, so the app links out rather
        than pretending to read them. Correct any address here and the correction is what sticks.
      </div>
    </>
  );
}

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
/**
 * Your own Claude, connected.
 *
 * Worth being exact about what this is, because the obvious expectation is
 * wrong: there is no "sign in with Claude". Anthropic publishes no consumer
 * OAuth, so a claude.ai Pro or Max subscription cannot be attached to a
 * third-party app by anybody — that capability does not exist to be built. An
 * API key from the developer console is a separate thing on separate billing,
 * and it is what actually works. The screen says so instead of leaving someone
 * hunting for a login button that was never going to be there.
 *
 * The key is checked by using it before it is saved, because the alternative
 * is discovering a typo halfway through generating a course from a syllabus
 * that took five minutes to upload.
 */
function ClaudeAccount() {
  const [config, setConfig] = useState(settings());
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; detail: string } | null>(null);
  const taking = route(config);

  const save = (next: ClaudeSettings) => {
    setConfig(next);
    saveSettings(next);
  };

  const verify = async () => {
    setChecking(true);
    setResult(null);
    const got = await checkKey(config.apiKey);
    setResult(got);
    if (got.ok) save(config);
    setChecking(false);
  };

  const routeLine =
    taking === 'proxy'
      ? 'Going through your proxy, which holds the key server-side. Nothing below is used.'
      : taking === 'own'
        ? 'Going through your own key, on this device.'
        : taking === 'shared'
          ? 'Going through the shared key, because you are signed in. Add your own below to bypass its monthly limit.'
          : 'Nothing connected yet, so the parts of the app that need Claude are switched off.';

  return (
    <>
      <SectionLabel>Claude</SectionLabel>
      <Blueprint style={{ padding: '14px 15px' }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18 }}>Your own Claude key</div>
        <div style={{ fontSize: 13, opacity: 0.75, lineHeight: 1.5, marginTop: 5, textWrap: 'pretty' }}>
          There is no “sign in with Claude” — Anthropic publishes no consumer login for other apps,
          so a claude.ai Pro or Max subscription cannot be linked here by any app. What works is an
          API key from <strong>console.anthropic.com → API keys</strong>, which is billed
          separately, per use. It powers reading a photograph of the board, generating a course
          from a syllabus, taking an assignment apart, and asking questions about a course.
        </div>

        <input
          className="input"
          type="password"
          autoComplete="off"
          placeholder="sk-ant-…"
          value={config.apiKey}
          onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
          aria-label="Anthropic API key"
          style={{ fontSize: 13, marginTop: 12 }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={checking || !config.apiKey.trim()}
            onClick={() => void verify()}
            style={{ flex: 1, height: 40, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}
          >
            {checking ? 'Checking…' : 'Check and save'}
          </button>
          {config.apiKey && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                save({ ...config, apiKey: '' });
                setResult(null);
              }}
              style={{ flex: 'none', padding: '0 14px', height: 40, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}
            >
              Remove
            </button>
          )}
        </div>

        {result && (
          <div
            style={{
              fontSize: 12.5,
              marginTop: 10,
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              color: result.ok ? 'var(--app-fg)' : 'var(--app-accent)',
            }}
          >
            {result.ok ? 'Key works. Saved on this device.' : result.detail}
          </div>
        )}

        <div
          style={{
            marginTop: 12,
            paddingTop: 11,
            borderTop: '1px solid var(--app-line)',
            fontSize: 12,
            opacity: 0.7,
            lineHeight: 1.45,
          }}
        >
          {routeLine}
        </div>
      </Blueprint>

      <div style={{ fontSize: 11.5, opacity: 0.55, marginTop: 10, lineHeight: 1.5, textWrap: 'pretty' }}>
        A key kept in a browser can be read by anything running in that browser. That is a real
        risk and the reason the shared key lives in a server function instead. If you would rather
        not hold one here, sign in and use the shared one, or run a proxy and put its address in
        Settings.
      </div>

      <SectionLabel style={{ margin: '22px 0 6px' }}>Which model</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {MODELS.map((m) => (
          <button
            key={m.id}
            type="button"
            className="bare tappable"
            onClick={() => save({ ...config, model: m.id })}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 0',
              borderBottom: '1px solid var(--app-line)',
              textAlign: 'left',
            }}
          >
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontFamily: 'var(--font-heading)', fontSize: 15 }}>
                {m.label}
              </span>
              <span style={{ display: 'block', fontSize: 12, opacity: 0.55, marginTop: 2 }}>
                {m.note}
              </span>
            </span>
            {config.model === m.id && <span className="tag tag-accent">In use</span>}
          </button>
        ))}
      </div>

    </>
  );
}

export function Connect() {
  const { state, dispatch, catalog } = useStore();
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
    const { events, name: calName } = parseIcs(catalog.courses, text);
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
    // webcal:// is what Apple, Outlook and half the campus systems hand you.
    // It is an https address wearing a different scheme.
    const target = url.trim().replace(/^webcal:\/\//i, 'https://');
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

      {Object.keys(live).length > 0 && (
        <Blueprint
          onClick={() => dispatch({ type: 'go', screen: 'cloud' })}
          style={{ padding: '13px 15px', marginTop: 14, display: 'flex', gap: 12, alignItems: 'center' }}
        >
          <span style={{ width: 8, height: 34, background: 'var(--chrome)', flex: 'none' }} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="kicker" style={{ display: 'block' }}>
              Use what is connected
            </span>
            <span style={{ display: 'block', fontSize: 14, lineHeight: 1.3, marginTop: 2 }}>
              Documents into a course, course mail, deadlines onto your real calendar
            </span>
          </span>
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
          install. Paste it below. Any other calendar link works here too, including a{' '}
          <code style={{ fontSize: 11 }}>webcal://</code> one from iCloud or Outlook.
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
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <a
            href={state.linkUrls.brightspace || 'https://brightspace.vanderbilt.edu/d2l/home'}
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary"
            style={{
              flex: 1,
              height: 40,
              fontSize: 11,
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
        <div style={{ fontSize: 11.5, opacity: 0.55, lineHeight: 1.45, marginTop: 10, textWrap: 'pretty' }}>
          What a Brightspace account can and cannot give this app, plainly: the{' '}
          <strong>calendar feed</strong> carries every due date and needs nothing but the link.{' '}
          <strong>Grades, submissions and files</strong> live behind D2L’s Valence API, whose keys
          are issued to the university rather than to a student — no app you install can read them
          on your behalf, however it asks. So the app reads the dates, links you to each course’s
          own page from the course screen, and takes uploaded files from you directly.
        </div>
      </Blueprint>

      {/* ── OAuth providers ─────────────────────────────────────────────── */}
      <ClaudeAccount />

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
                        style={{ fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase' }}
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
                          style={{ fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase' }}
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
                        style={{ fontSize: 11, opacity: 0.5, letterSpacing: '0.1em' }}
                      >
                        DISCONNECT
                      </button>
                    </>
                  )}
                </div>
              )}

              {id === 'google' && spec.clientId && (
                <div style={{ fontSize: 11.5, opacity: 0.6, lineHeight: 1.5, marginTop: 9 }}>
                  Reading Gmail is a restricted scope: until the OAuth client passes Google's
                  review it works only for the test users listed in the console. Calendar, Drive
                  and Tasks are not restricted and work immediately.
                </div>
              )}

              {spec.caveat && (
                <div
                  style={{
                    fontSize: 11.5,
                    opacity: 0.6,
                    lineHeight: 1.5,
                    marginTop: 10,
                    paddingTop: 10,
                    borderTop: '1px solid var(--app-line)',
                    textWrap: 'pretty',
                  }}
                >
                  {spec.caveat}
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
      {/*
        Campus links sit last on purpose. They used to be the first thing on
        the screen, directly under a paragraph promising to bring calendars in
        — so the section that delivers that promise was below a list of
        bookmarks, and the page opened by answering a question nobody had
        asked. Connecting comes first; shortcuts come after.
      */}
      <CampusLinks />

      <div style={{ height: 22 }} />
    </div>
  );
}
