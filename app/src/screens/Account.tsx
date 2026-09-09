import { useState } from 'react';
import { useStore } from '../state/store';
import { Page } from '../components/Page';
import { Blueprint } from '../components/Blueprint';
import { StorageRoom } from '../components/StorageRoom';
import { syncLine } from '../lib/merge';
import { ActionButton, SectionLabel } from '../components/ui';
import { Credentials } from '../components/Credentials';
import { cloudConfigured, signOut } from '../lib/cloud';

/**
 * The account screen.
 *
 * An account exists for one reason: so the semester on the phone and the
 * semester on the laptop are the same semester. The app works signed out — it
 * always has — and this screen says so rather than putting a wall in front of a
 * student who just wants to read tonight's cards.
 */
export function AccountScreen() {
  const { state, account, sync, refresh } = useStore();
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true);
    setError('');
    setNote('');
    try {
      const said = await fn();
      if (typeof said === 'string') setNote(said);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!cloudConfigured) {
    return (
      <Page>
        <Blueprint style={{ padding: 'var(--sp-7)', background: 'var(--app-hero)' }}>
          <div className="kicker">Device only</div>
          <div className="chrome-text" style={{ fontSize: 'var(--type-xl)', marginTop: 'var(--sp-4)', lineHeight: 1.1 }}>
            This build has no account service
          </div>
          <div style={{ fontSize: 'var(--type-base)', opacity: 0.78, marginTop: 'var(--sp-4)', lineHeight: 'var(--leading-relaxed)' }}>
            Everything works, and everything stays on this device. To turn on accounts, set
            VITE_SUPABASE_URL and VITE_SUPABASE_KEY and redeploy — see SETUP.md.
          </div>
        </Blueprint>
      </Page>
    );
  }

  if (account) {
    const counts = [
      `${state.courses.length} ${state.courses.length === 1 ? 'course' : 'courses'}`,
      `${state.updates.length} added`,
      `${state.notes.length} notes`,
      `${state.tasks.length} tasks`,
    ].join(' · ');

    return (
      <Page>
        <Blueprint style={{ padding: 'var(--sp-7)', background: 'var(--app-hero)' }}>
          <div className="kicker">Signed in</div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'calc(20px * var(--text-scale, 1))', marginTop: 'var(--sp-3)' }}>
            {account.email}
          </div>
          {account.via && (
            <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, marginTop: 3 }}>
              {/* Which button they pressed, which is what somebody needs to
                  know when signing in on a second device. */}
              Through {account.via}.
            </div>
          )}
          <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.7, marginTop: 'var(--sp-4)', lineHeight: 'var(--leading-relaxed)' }}>
            {sync.status === 'syncing' && 'Catching up with your account…'}
            {sync.status === 'synced' &&
              `Synced ${sync.at ? new Date(sync.at).toLocaleTimeString() : ''} · ${counts}`}
            {sync.status === 'error' && (
              <span style={{ whiteSpace: 'pre-wrap' }}>Sync failed. {sync.error}</span>
            )}
          </div>
          {/*
            What the last sync actually did, which was never reported.

            The decisions were always being made — a `theirs` field replaced
            silently, a `union` field combined — and nothing anywhere said so.
            See `lib/merge.ts`.
          */}
          {state.lastSync ? (
            <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, marginTop: 'var(--sp-3)', lineHeight: 'var(--leading-normal)', textWrap: 'pretty' }}>
              {syncLine(state.lastSync.notes)}
            </div>
          ) : null}

          {/* The same check the pull-down gesture makes, for a laptop, which
              has no pull-down. It answers in a sentence rather than leaving a
              spinner to be interpreted — see `lib/refresh.ts`. */}
          <button
            type="button"
            className="btn btn-block"
            disabled={checking}
            onClick={() => {
              setChecking(true);
              setChecked('');
              void refresh().then((line) => {
                setChecking(false);
                setChecked(line);
              });
            }}
            style={{ marginTop: 14 }}
          >
            {checking ? 'Checking…' : 'Check now'}
          </button>
          {checked && (
            <div
              role="status"
              aria-live="polite"
              style={{
                fontSize: 'calc(12.5px * var(--text-scale, 1))',
                opacity: 0.8,
                marginTop: 9,
                lineHeight: 'var(--leading-relaxed)',
                textWrap: 'pretty',
              }}
            >
              {checked}
            </div>
          )}
        </Blueprint>

        <SectionLabel>What syncs</SectionLabel>
        <div style={{ fontSize: 'var(--type-base)', opacity: 0.75, lineHeight: 1.55, textWrap: 'pretty' }}>
          Your courses, everything you have added to them, your tasks, appointments, notes and
          connected calendars. Sign in on a laptop and the same semester is there.
        </div>

        <SectionLabel>What does not</SectionLabel>
        <div style={{ fontSize: 'var(--type-base)', opacity: 0.75, lineHeight: 1.55, textWrap: 'pretty' }}>
          Files you attach stay on the device that has them — a lecture deck can be tens of
          megabytes and uploading it on a phone plan is not a choice the app should make for you.
          The sample semester's audio ships with the app, so it plays anywhere.
        </div>

        <SectionLabel>How conflicts resolve</SectionLabel>
        <div style={{ fontSize: 'var(--type-base)', opacity: 0.75, lineHeight: 1.55, textWrap: 'pretty' }}>
          Nothing you added on one device is dropped because you added something on the other.
          Write a note on the laptop and another on your phone while it is offline, and you end up
          with both; tick one box here and a different one there, and both stay ticked. Settings
          are the exception, and deliberately so — your colours are whatever you last chose,
          wherever you chose it.
        </div>
        <div style={{ fontSize: 'var(--type-base)', opacity: 0.75, lineHeight: 1.55, textWrap: 'pretty', marginTop: 'var(--sp-4)' }}>
          What still does not merge is the same note edited on both: the later edit is the one that
          survives. The app would rather say so than pretend.
        </div>

        <ActionButton
          disabled={busy}
          onClick={() => void run(signOut)}
          style={{ fontSize: 'var(--type-sm)', marginTop: 20 }}
        >
          Sign out (keeps data on this device)
        </ActionButton>
        <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, marginTop: 'var(--sp-4)', lineHeight: 'var(--leading-normal)' }}>
          Signing out leaves this device's copy alone — nothing is deleted here, and nothing stops
          working.
        </div>
        {/* Signing out can fail — a network that has gone, most often — and a
            button that appears to do nothing is the worst thing this screen
            could do with an account still signed in. */}
        {note && (
          <div role="status" aria-live="polite" style={{ fontSize: 'var(--type-base)', opacity: 0.85, marginTop: 'var(--sp-7)', lineHeight: 'var(--leading-relaxed)' }}>
            {note}
          </div>
        )}
        {error && (
          <div role="alert" style={{ fontSize: 'var(--type-base)', color: 'var(--app-accent)', marginTop: 'var(--sp-7)', lineHeight: 'var(--leading-relaxed)' }}>
            {error}
          </div>
        )}
      </Page>
    );
  }

  return (
    <Page>
      {/* The same test the form opens by, and it has to be made here because
          the form owns which way round it is: somebody with an account is
          coming back to it, and somebody without one has never seen it. */}
      <div className="chrome-text" style={{ fontSize: 'calc(28px * var(--text-scale, 1))', lineHeight: 1.08 }}>
        {state.registered ? 'Pick up where you left off.' : 'One semester, every device.'}
      </div>
      <div style={{ fontSize: 'var(--type-md)', opacity: 0.72, marginTop: 'var(--sp-3)', lineHeight: 'var(--leading-relaxed)', textWrap: 'pretty' }}>
        An account keeps your courses, notes and progress in step between your phone and your
        laptop. The app works without one — this only decides whether it follows you.
      </div>

      {/*
        The form itself lives in `components/Credentials.tsx`.

        It is the same two fields the first run asks for, and it was written
        out here when here was the only place that asked. A second copy is a
        second place for the autocomplete hints, the eight-character floor and
        the reset link to drift apart, so both places render this one.
      */}
      <Credentials />

      <SectionLabel>Before you sign up</SectionLabel>
      <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.65, lineHeight: 1.55, textWrap: 'pretty' }}>
        What you already have on this device is kept. The first sync sends it up, and if the
        account already holds a semester the two are merged rather than one replacing the other —
        you end up with both sides' courses, notes and ticked boxes.
      </div>
      <StorageRoom />
    </Page>
  );
}
