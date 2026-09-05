/**
 * What is held, where it goes, and how to be rid of it.
 *
 * Once a second person's grades are on a server this stops being a personal
 * project, and somebody has to be able to read what happens to their coursework
 * before they hand it over. The words are in `lib/privacy.ts` as data rather
 * than as prose in this file, so the claims can be checked against the code —
 * `privacy.test.ts` asserts that the fields named are the fields the sync
 * actually sends, and that the API key is genuinely absent from it.
 *
 * ## Delete is here rather than buried
 *
 * A privacy page that explains deletion and then makes you hunt for the button
 * is a page that has done the writing and not the work. It is at the bottom of
 * what it describes, behind the same typed confirmation that removing a course
 * uses — because it is the one thing on this screen that an undo cannot fix.
 */

import { useState } from 'react';
import { useStore } from '../state/store';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel } from '../components/ui';
import { TypeToConfirm } from '../components/TypeToConfirm';
import { CLAIMS, SUPPORT, region } from '../lib/privacy';
import { KEEP, LOG_KEY, dump, dumpName, read } from '../lib/diagnose';
import { SCHEMA, migrationLine } from '../lib/migrate';
import { migrationReport } from '../state/shape';
import { cloudConfigured, deleteEverything } from '../lib/cloud';
import { Toggle } from '../components/ui';
import { DESTINATIONS } from '../lib/nav';
import {
  USAGE_KEY,
  neverOpened,
  read as readUsage,
  top,
  total,
  unusedLine,
  usageLine,
  type Counts,
} from '../lib/usage';

export function Privacy() {
  const { account, state, dispatch } = useStore();
  // Read once on mount: the counts live outside React state on purpose, and a
  // page that re-read them on every render would show its own opening being
  // counted while somebody was looking at it.
  const [counts, setCounts] = useState<Counts>(() => {
    try {
      return readUsage(localStorage.getItem(USAGE_KEY));
    } catch {
      return {};
    }
  });
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState('');
  const [saved, setSaved] = useState('');

  const where = region((import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '');

  return (
    <div className="prose" style={{ padding: 18 }}>
      <Blueprint style={{ padding: 16 }}>
        <div className="kicker">Your data</div>
        <div
          className="chrome-text"
          style={{
            fontSize: 'calc(24px * var(--text-scale, 1))',
            lineHeight: 1.15,
            margin: '8px 0 10px',
            textWrap: 'balance',
          }}
        >
          What this app holds
        </div>
        <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', opacity: 0.75, lineHeight: 1.55, textWrap: 'pretty' }}>
          In plain language, and short enough to actually read.
          {where ? ` Your account, if you have one, is on ${where}.` : ''}
          {!cloudConfigured && ' This build has no account service at all — nothing can leave the device.'}
        </div>
      </Blueprint>

      {CLAIMS.map((c) => (
        <div key={c.heading}>
          <SectionLabel style={{ margin: '22px 0 5px' }}>{c.heading}</SectionLabel>
          <div
            style={{
              fontSize: 'calc(13.5px * var(--text-scale, 1))',
              opacity: 0.8,
              lineHeight: 1.6,
              textWrap: 'pretty',
            }}
          >
            {c.body}
          </div>
        </div>
      ))}

      {/*
        The counting, and what it has actually counted.

        Shown rather than described. Somebody deciding whether to leave this on
        can read the numbers it holds, which is a better answer than any
        sentence about them — and the list of screens never opened is the thing
        the counting is for from their side of it.
      */}
      <SectionLabel style={{ margin: '22px 0 5px' }}>Counting screen opens</SectionLabel>
      <Toggle
        label="Count which screens I open"
        on={state.countScreens}
        onChange={() => dispatch({ type: 'countScreens', on: !state.countScreens })}
      />
      <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.7, lineHeight: 1.55, marginTop: 8, textWrap: 'pretty' }}>
        {usageLine(state.countScreens, counts)}
      </div>
      {total(counts) > 0 && (
        <div style={{ marginTop: 10 }}>
          {top(counts).map((t) => (
            <div
              key={t.screen}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 'calc(12.5px * var(--text-scale, 1))',
                padding: '5px 0',
                borderBottom: '1px solid var(--app-line-soft)',
              }}
            >
              <span>{DESTINATIONS.find((d) => d.screen === t.screen)?.label ?? t.screen}</span>
              <span style={{ opacity: 0.6, fontVariantNumeric: 'tabular-nums' }}>{t.n}</span>
            </div>
          ))}
          <div style={{ fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.6, lineHeight: 1.5, marginTop: 8, textWrap: 'pretty' }}>
            {unusedLine(neverOpened(counts, DESTINATIONS.map((d) => d.screen as string)).length, DESTINATIONS.length)}
          </div>
          <button
            type="button"
            className="bare tappable"
            onClick={() => {
              try {
                localStorage.removeItem(USAGE_KEY);
              } catch {
                // Nothing to clear if storage is unavailable.
              }
              setCounts({});
            }}
            style={{
              width: 'auto',
              padding: '6px 10px',
              marginTop: 10,
              borderRadius: 'var(--r-sm)',
              border: '1px solid var(--app-line)',
              fontSize: 'calc(11px * var(--text-scale, 1))',
              fontFamily: 'var(--font-heading)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            Forget the counts
          </button>
        </div>
      )}

      <SectionLabel style={{ margin: '22px 0 5px' }}>If something is wrong</SectionLabel>
      <div style={{ fontSize: 'calc(13.5px * var(--text-scale, 1))', opacity: 0.8, lineHeight: 1.6, textWrap: 'pretty' }}>
        There is no form. Email <strong>{SUPPORT}</strong> and a person will answer — including if
        you want your account removed by hand rather than by the button below.
      </div>

      <SectionLabel style={{ margin: '22px 0 5px' }}>Export diagnostics</SectionLabel>
      <div style={{ fontSize: 'calc(13.5px * var(--text-scale, 1))', opacity: 0.8, lineHeight: 1.6, textWrap: 'pretty' }}>
        Saves a plain text file of the last {KEEP} things that went wrong on this device — error
        messages, which screen you were on, which build. It holds none of your work, and it is
        readable, so you can see what is in it before you send it. Nothing is uploaded on its own.
      </div>
      <button
        type="button"
        className="btn btn-block"
        onClick={() => {
          const log = read(localStorage.getItem(LOG_KEY));
          const m = migrationReport();
          const text = dump(
            {
              build: (import.meta.env.VITE_BUILD as string | undefined) ?? 'dev',
              screen: document.body.dataset.screen ?? '',
              language: navigator.language,
              agent: navigator.userAgent,
              cloud: cloudConfigured,
              signedIn: Boolean(account),
              storageUsed: (localStorage.getItem('semester.v1') ?? '').length,
              schema: m ? migrationLine(m) : String(SCHEMA),
            },
            log,
          );
          try {
            const url = globalThis.URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
            const a = document.createElement('a');
            a.href = url;
            a.download = dumpName(Date.now());
            a.click();
            setTimeout(() => globalThis.URL.revokeObjectURL(url), 30_000);
            setSaved(`Saved ${log.length === 0 ? 'a file — nothing has gone wrong on this device' : `the last ${log.length}`}.`);
          } catch {
            setSaved('This browser would not save the file. Copy it from the console instead.');
          }
        }}
        style={{ marginTop: 12, height: 44, letterSpacing: '0.1em', textTransform: 'uppercase' }}
      >
        Export diagnostics
      </button>
      {saved && (
        <div
          role="status"
          aria-live="polite"
          style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.7, marginTop: 8, lineHeight: 1.5 }}
        >
          {saved}
        </div>
      )}

      <SectionLabel style={{ margin: '26px 0 5px' }}>Delete my account</SectionLabel>
      {account ? (
        <>
          <div style={{ fontSize: 'calc(13.5px * var(--text-scale, 1))', opacity: 0.8, lineHeight: 1.6, textWrap: 'pretty' }}>
            Removes every row belonging to {account.email}: courses, deadlines, notes, grades,
            cards and any queued reminders. It does not touch this device — signing out and
            deleting the account both leave your semester here.
          </div>
          <button
            type="button"
            className="btn btn-block"
            disabled={busy}
            onClick={() => setAsking(true)}
            style={{ marginTop: 12, height: 46, letterSpacing: '0.1em', textTransform: 'uppercase' }}
          >
            {busy ? 'Deleting…' : 'Delete my account'}
          </button>
          {said && (
            <div
              role="status"
              aria-live="polite"
              style={{
                fontSize: 'calc(13px * var(--text-scale, 1))',
                marginTop: 10,
                lineHeight: 1.55,
                textWrap: 'pretty',
              }}
            >
              {said}
            </div>
          )}
        </>
      ) : (
        <div style={{ fontSize: 'calc(13.5px * var(--text-scale, 1))', opacity: 0.8, lineHeight: 1.6, textWrap: 'pretty' }}>
          You are not signed in, so there is no account to delete — nothing about this semester
          has ever left the device.
        </div>
      )}

      {asking && account && (
        <TypeToConfirm
          title="Delete your account"
          what={[
            `Every row belonging to ${account.email} is removed from the server.`,
            'Courses, deadlines, notes, grades, cards and any queued reminders.',
            'This device keeps its own copy — it is not touched.',
            'There is no archive and no undo.',
          ]}
          want="DELETE"
          describe="the word"
          confirmLabel="Delete it"
          onConfirm={() => {
            setAsking(false);
            setBusy(true);
            setSaid('');
            void deleteEverything()
              .then((line) => setSaid(line))
              .catch((e: unknown) =>
                setSaid(e instanceof Error ? e.message : 'That did not work. Try again, or email the address above.'),
              )
              .finally(() => setBusy(false));
          }}
          onCancel={() => setAsking(false)}
        />
      )}

      <div style={{ height: 26 }} />
    </div>
  );
}
