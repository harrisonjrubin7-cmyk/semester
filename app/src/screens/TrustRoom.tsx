import { useEffect, useRef, useState } from 'react';
import { listRoom, openDocument, type Listed, type RoomItem } from '../lib/trustroom';
import { secondLine } from '../lib/dim';
import { formatDate } from '../lib/locale';

/**
 * The procurement room, as a reviewer at a university sees it.
 *
 * They were sent a `#room=` link by Semester's account team (see
 * `lib/trustlink.ts`). They have no account, no semester and no reason to
 * meet the app, so this is mounted in place of it, the way `Respond.tsx` is
 * for a published form: one `<main>`, one `<h1>`, the list of documents their
 * grant covers, and a way to open each one.
 *
 * A document opens through a signed URL that lasts one minute. So the page
 * asks for it only when the reviewer asks, shows it as an ordinary link they
 * activate themselves (a new tab opened after a network call is what pop-up
 * blockers exist to stop), and takes it away again when it expires.
 *
 * Every failure the server can have about a token reads the same here as it
 * does there — wrong, expired and withdrawn are one sentence — because the
 * reviewer can do the same one thing about all of them.
 */
export default function TrustRoom({ token }: { token: string }) {
  const [listed, setListed] = useState<Listed | null>(null);

  useEffect(() => {
    let live = true;
    void listRoom(token).then((l) => {
      if (live) setListed(l);
    });
    return () => {
      live = false;
    };
  }, [token]);

  /* Longhand spacing, for the reason `Respond.tsx` gives. */
  const wrap = {
    maxWidth: 640,
    margin: '0 auto',
    paddingTop: 'var(--sp-7)',
    paddingBottom: 'var(--sp-7)',
    paddingInline: 'var(--sp-7)',
    minHeight: '100dvh',
  } as const;
  const body = { fontSize: 'var(--type-base)', lineHeight: 'var(--leading-relaxed)', textWrap: 'pretty' } as const;
  const quiet = { fontSize: 'var(--type-sm)', ...secondLine(), lineHeight: 'var(--leading-normal)' } as const;
  const heading = { fontFamily: 'var(--font-heading)', fontSize: 'var(--type-xl)', textWrap: 'pretty' } as const;

  const foot = (
    <p style={{ ...quiet, marginTop: 'var(--sp-7)' }}>
      Shared by Semester under your institution’s agreement. Each time a document is opened it is recorded, and
      the record is visible to your institution.
    </p>
  );

  if (listed === null) {
    return (
      <main style={wrap}>
        <p role="status" style={body}>
          Opening the documents shared with you…
        </p>
      </main>
    );
  }

  if (listed.kind !== 'ok') {
    return (
      <main style={wrap}>
        <h1 style={heading}>
          {listed.kind === 'not_found' ? 'This link is not working' : 'The documents could not be reached'}
        </h1>
        <p style={{ ...body, marginTop: 'var(--sp-4)' }}>
          {listed.kind === 'not_found'
            ? 'It may have expired or been withdrawn. Ask the person at Semester who sent it for a new one.'
            : 'Check your connection and reload this page. If it keeps happening, tell the person who sent the link.'}
        </p>
        {foot}
      </main>
    );
  }

  return (
    <main style={wrap}>
      <h1 style={heading}>Documents shared with you</h1>
      <p style={{ ...body, marginTop: 'var(--sp-4)' }}>
        These are the exact versions Semester granted for your review. This link works until{' '}
        {formatDate(listed.expiresAt, { dateStyle: 'long' })}.
      </p>
      <p style={{ ...quiet, marginTop: 'var(--sp-3)' }}>
        Generated from commit <code>{listed.packetCommit.slice(0, 12)}</code>.
      </p>

      <ul style={{ listStyle: 'none', padding: 0, marginTop: 'var(--sp-6)' }}>
        {listed.items.map((item) => (
          <Document key={item.artifact} token={token} item={item} body={body} quiet={quiet} />
        ))}
      </ul>
      {foot}
    </main>
  );
}

type Style = Record<string, string | number>;

function Document({ token, item, body, quiet }: { token: string; item: RoomItem; body: Style; quiet: Style }) {
  const [link, setLink] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const ask = () => {
    setBusy(true);
    setNote('');
    void openDocument(token, item.artifact)
      .then((o) => {
        if (o.kind === 'ok') {
          setLink(o.url);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => {
            setLink(null);
            setNote('That link has expired. Ask for a new one if you still need it.');
          }, o.seconds * 1000);
          return;
        }
        setNote(
          o.kind === 'not_found'
            ? 'This document is no longer available through your link.'
            : o.kind === 'unavailable'
              ? 'This document is not in place yet. Tell the person who sent the link.'
              : 'It could not be reached. Check your connection and try again.',
        );
      })
      .finally(() => setBusy(false));
  };

  return (
    <li style={{ paddingBlock: 'var(--sp-4)', borderTop: '1px solid var(--app-line)' }}>
      <p style={{ ...body, fontWeight: 600 }}>{item.title}</p>
      <p style={quiet}>
        Version {item.version}
        {item.sourceCommit ? ` · from commit ${item.sourceCommit.slice(0, 12)}` : ''}
      </p>
      <div style={{ marginTop: 'var(--sp-3)' }}>
        {link ? (
          <a className="btn btn-primary" href={link} target="_blank" rel="noopener noreferrer">
            Open {item.title} (link works for one minute)
          </a>
        ) : (
          /*
           * Colours inherited from the page, not the button's own tokens. This
           * page is mounted in place of the app, so the theme the app applies
           * never arrives, and `.btn`'s `--color-text` stays the light
           * palette's near-black on this dark page — the button drew as a
           * blank outline. Seen in a screenshot, not in any test.
           */
          <button
            type="button"
            className="btn btn-secondary"
            style={{ color: 'inherit', borderColor: 'currentColor' }}
            onClick={ask}
            disabled={busy}
          >
            {busy ? 'Getting a link…' : `Get a link to ${item.title}`}
          </button>
        )}
      </div>
      {note && (
        <p role="status" style={{ ...quiet, marginTop: 'var(--sp-2)' }}>
          {note}
        </p>
      )}
    </li>
  );
}
