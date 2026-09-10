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
import { Page } from '../components/Page';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel } from '../components/ui';
import { TypeToConfirm } from '../components/TypeToConfirm';
import { CLAIMS, SUPPORT, region } from '../lib/privacy';
import { KEEP, LOG_KEY, dump, dumpName, read } from '../lib/diagnose';
import { SCHEMA, migrationLine } from '../lib/migrate';
import { migrationReport } from '../state/shape';
import { cloudConfigured, deleteEverything } from '../lib/cloud';
import { eraseDevice } from '../lib/erase';
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

/**
 * A stored value, or null, even where the browser refuses to be asked.
 *
 * Safari with site data blocked throws a `SecurityError` on the *access*
 * rather than answering null, and this app is meant to run there —
 * `lib/keep.ts` has the sentence for it: *"This browser will not let the app
 * store anything, so nothing you do here will survive a reload."*
 *
 * Both reads below sat outside the handler's own `try`, which covers writing
 * the file. So in exactly that browser the button did nothing at all: no file,
 * no message, no explanation. It is the button somebody presses *because*
 * something has gone wrong, which makes it the worst one to fail quietly.
 */
function stored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

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
  /*
   * Two destructive things on one screen, and they must never be one.
   *
   * `asking` is the account — every row on the server belonging to this
   * email. `erasing` is this device — everything in this browser and nothing
   * anywhere else. They share no state on purpose: a single `asking` flag
   * with a kind beside it is one wrong branch away from emptying the account
   * when somebody asked to clear a borrowed laptop.
   */
  const [erasing, setErasing] = useState(false);
  const [wiping, setWiping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState('');
  const [saved, setSaved] = useState('');

  const where = region((import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '');

  return (
    <Page className="prose" bottom={26}>
      <Blueprint style={{ padding: 'var(--sp-7)' }}>
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
        <div style={{ fontSize: 'var(--type-base)', opacity: 0.75, lineHeight: 1.55, textWrap: 'pretty' }}>
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
      <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.7, lineHeight: 1.55, marginTop: 'var(--sp-4)', textWrap: 'pretty' }}>
        {usageLine(state.countScreens, counts)}
      </div>
      {total(counts) > 0 && (
        <div style={{ marginTop: 'var(--sp-5)' }}>
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
          <div style={{ fontSize: 'var(--type-sm)', opacity: 0.6, lineHeight: 'var(--leading-relaxed)', marginTop: 'var(--sp-4)', textWrap: 'pretty' }}>
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
              marginTop: 'var(--sp-5)',
              borderRadius: 'var(--r-sm)',
              border: '1px solid var(--app-line)',
              fontSize: 'var(--type-xs)',
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
          const log = read(stored(LOG_KEY));
          const m = migrationReport();
          const text = dump(
            {
              build: (import.meta.env.VITE_BUILD as string | undefined) ?? 'dev',
              screen: document.body.dataset.screen ?? '',
              language: navigator.language,
              agent: navigator.userAgent,
              cloud: cloudConfigured,
              signedIn: Boolean(account),
              storageUsed: (stored('semester.v1') ?? '').length,
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
        style={{ marginTop: 'var(--sp-6)', height: 44, letterSpacing: '0.1em', textTransform: 'uppercase' }}
      >
        Export diagnostics
      </button>
      {saved && (
        <div
          role="status"
          aria-live="polite"
          style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.7, marginTop: 'var(--sp-4)', lineHeight: 'var(--leading-relaxed)' }}
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
            style={{ marginTop: 'var(--sp-6)', height: 46, letterSpacing: '0.1em', textTransform: 'uppercase' }}
          >
            {busy ? 'Deleting…' : 'Delete my account'}
          </button>
          {said && (
            <div
              role="status"
              aria-live="polite"
              style={{
                fontSize: 'var(--type-base)',
                marginTop: 'var(--sp-5)',
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

      {/* Tokens rather than the numbers its neighbours were written with:
          this file is at its own budget in `styles/rules.ts`, and a new
          section is the wrong place to spend the last of it. */}
      <SectionLabel>Erase from this device</SectionLabel>
      <div style={{ fontSize: 'var(--type-base)', opacity: 0.8, lineHeight: 'var(--leading-relaxed)', textWrap: 'pretty' }}>
        Removes everything this app has put in this browser: your semester, the courses you added,
        notes, tasks, attachments, the assistant's threads, the daily copies, and any keys or
        connected accounts. {account ? 'Your account is not touched — what has synced stays on the server, and this device signs out.' : 'Nothing has ever left this device, so this is all of it.'} The app restarts empty, as it was
        the first time you opened it.
      </div>
      <button
        type="button"
        className="btn btn-block"
        disabled={wiping}
        onClick={() => setErasing(true)}
        style={{ marginTop: 'var(--sp-6)', letterSpacing: '0.1em', textTransform: 'uppercase' }}
      >
        {wiping ? 'Erasing…' : 'Erase from this device'}
      </button>

      {erasing && (
        <TypeToConfirm
          title="Erase from this device"
          what={[
            'Your semester on this device: courses, deadlines, notes, tasks, grades and cards.',
            'Attachments, the daily copies you could have restored from, and the assistant’s threads.',
            'Any connected accounts and keys — this browser signs out.',
            account
              ? `Nothing belonging to ${account.email} on the server is touched, and it can be synced back.`
              : 'Nothing has ever left this device, so there is nowhere to sync it back from.',
            'There is no undo.',
          ]}
          want="ERASE"
          describe="the word"
          confirmLabel="Erase it"
          onConfirm={() => {
            setErasing(false);
            setWiping(true);
            /*
             * Reload rather than dispatch.
             *
             * The store is a reducer in memory and every screen is holding
             * something derived from it. Emptying the disk underneath that
             * would leave the app rendering a semester that no longer exists
             * until something happened to re-read it — and the one thing a
             * person needs to see after pressing this is that it is gone.
             * `eraseDevice` stops the writer first, so nothing in flight
             * lands between the erase and the reload.
             */
            void eraseDevice().finally(() => window.location.reload());
          }}
          onCancel={() => setErasing(false)}
        />
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
    </Page>
  );
}
