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
import { cloudConfigured, deleteEverything } from '../lib/cloud';

export function Privacy() {
  const { account } = useStore();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState('');

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

      <SectionLabel style={{ margin: '22px 0 5px' }}>If something is wrong</SectionLabel>
      <div style={{ fontSize: 'calc(13.5px * var(--text-scale, 1))', opacity: 0.8, lineHeight: 1.6, textWrap: 'pretty' }}>
        There is no form. Email <strong>{SUPPORT}</strong> and a person will answer — including if
        you want your account removed by hand rather than by the button below.
      </div>

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
