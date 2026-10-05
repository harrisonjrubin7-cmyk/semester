import { CourseStudioEntry } from '../components/CourseStudio';
import { useState } from 'react';
import { SYNC_WORDS } from '../lib/syncstatus';
import { Review } from '../components/Review';
import { WaitingSends } from '../components/WaitingSends';
import { useStore } from '../state/store';
import { Page } from '../components/Page';
import { Blueprint } from '../components/Blueprint';
import { StorageRoom } from '../components/StorageRoom';
import { syncLine } from '../lib/merge';
import { ActionButton, SectionLabel } from '../components/ui';
import { Credentials } from '../components/Credentials';
import { AccountSecurity } from '../components/AccountSecurity';
import { SchoolClaim } from '../components/SchoolClaim';
import { ReferralLink } from '../components/ReferralLink';
import { AgeStatement } from '../components/AgeStatement';
import { MembershipPanel } from '../components/MembershipPanel';
import { cloudConfigured, signOut } from '../lib/cloud';
import { formatTime } from '../lib/locale';
import { ErrorState } from '../components/unity/States';

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
          <div className="chrome-text" style={{ fontSize: 'var(--type-xl)', marginTop: 'var(--sp-4)', lineHeight: 'var(--leading-display-lg)' }}>
            This build has no account service
          </div>
          <div style={{ fontSize: 'var(--type-base)', color: 'var(--app-dim)', marginTop: 'var(--sp-4)', lineHeight: 'var(--leading-relaxed)' }}>
            Accounts are not switched on in this copy of Semester, so there is nothing to sign
            in to. Everything works without one, and everything stays in this browser.
          </div>
        </Blueprint>
        <MembershipPanel />
      </Page>
    );
  }

  if (account) {
    const counts = [
      `${state.courses.length} ${state.courses.length === 1 ? 'course' : 'courses'}`,
      `${state.updates.length} added`,
      `${state.notes.length} notes`,
      `${state.tasks.length} action${state.tasks.length === 1 ? '' : 's'}`,
    ].join(' · ');

    // The same check the pull-down gesture makes. The error state's recovery
    // and the button below are one function, so they cannot drift apart.
    const check = () => {
      setChecking(true);
      setChecked('');
      void refresh().then((line) => {
        setChecking(false);
        setChecked(line);
      });
    };
    // `explainSync` ends its sentence with "Reference: SEM-…"; the error state
    // has a slot for exactly that, so it goes there rather than in the body.
    const ref = /\n\nReference: (\S+)\s*$/.exec(sync.error);
    const syncFailure = {
      body: (ref ? sync.error.slice(0, ref.index) : sync.error).trim(),
      reference: ref?.[1],
    };

    return (
      <Page>
        <Blueprint style={{ padding: 'var(--sp-7)', background: 'var(--app-hero)' }}>
          <div className="kicker">Signed in</div>
          <div className="account-identity" style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--type-display-sm)', marginTop: 'var(--sp-3)' }}>
            {account.email}
          </div>
          {account.via && (
            <div style={{ fontSize: 'var(--type-xs-plus)', color: 'var(--app-dim)', marginTop: 'calc(3px * var(--density, 1))' }}>
              {/* Which button they pressed, which is what somebody needs to
                  know when signing in on a second device. */}
              Through {account.via}.
            </div>
          )}
          {/* A live region, so a screen reader hears "Queued" when the
              connection drops and "Synced" when it comes back, rather than
              finding out on the next visit to this screen. */}
          <div role="status" style={{ fontSize: 'var(--type-sm-plus)', color: 'var(--app-dim)', marginTop: 'var(--sp-4)', lineHeight: 'var(--leading-relaxed)' }}>
            {sync.status === 'syncing' && SYNC_WORDS.syncing.sentence}
            {(sync.status === 'offline' || sync.status === 'queued' || sync.status === 'read-only' || sync.status === 'conflict' || sync.status === 'review') &&
              SYNC_WORDS[sync.status].sentence}
            {sync.status === 'synced' &&
              `Synced ${sync.at ? formatTime(sync.at) : ''} · ${counts}`}
            {/* An error is said once, by the announced ErrorState below,
                which carries the failure and the way to retry. */}
          </div>
          {sync.status === 'error' && (
            <div style={{ marginTop: 'var(--sp-4)' }}>
              <ErrorState
                title="Sync did not finish"
                body={syncFailure.body}
                reference={syncFailure.reference}
                recover={{ label: checking ? 'Checking…' : 'Check now', run: check }}
                busy={checking}
              />
            </div>
          )}
          {/*
            What the last sync actually did, which was never reported.

            The decisions were always being made — a `theirs` field replaced
            silently, a `union` field combined — and nothing anywhere said so.
            See `lib/merge.ts`.
          */}
          {state.lastSync ? (
            <div style={{ fontSize: 'var(--type-xs-plus)', color: 'var(--app-dim)', marginTop: 'var(--sp-3)', lineHeight: 'var(--leading-normal)', textWrap: 'pretty' }}>
              {syncLine(state.lastSync.notes)}
            </div>
          ) : null}

          {/* Two devices' edits of one thing, and the choice. See `lib/conflicts.ts`. */}
          <Review />

          {/* Sends the student kept for later, and the one tap that sends each. See `lib/sync/outbox.ts`. */}
          <WaitingSends />

          {/* The same check the pull-down gesture makes, for a laptop, which
              has no pull-down. It answers in a sentence rather than leaving a
              spinner to be interpreted — see `lib/refresh.ts`. */}
          {sync.status !== 'error' && (
            <button
              type="button"
              className="btn btn-block"
              disabled={checking}
              onClick={check}
              style={{ marginTop: 'calc(14px * var(--density, 1))' }}
            >
              {checking ? 'Checking…' : 'Check now'}
            </button>
          )}
          {checked && (
            <div
              role="status"
              aria-live="polite"
              style={{
                fontSize: 'var(--type-sm-plus)',
                color: 'var(--app-dim)',
                marginTop: 'calc(9px * var(--density, 1))',
                lineHeight: 'var(--leading-relaxed)',
                textWrap: 'pretty',
              }}
            >
              {checked}
            </div>
          )}
        </Blueprint>

        {/* Which university the *server* believes this account is at, which is
            a different fact from the school profile the device picked and the
            only one a policy can ever read. See `components/SchoolClaim.tsx`. */}
        <SchoolClaim />

        {/* Faculty Course Studio (D-100): shown only to an account the school
            has made faculty on a course, with the module on. See
            `components/CourseStudio.tsx`. */}
        <CourseStudioEntry />

        <SectionLabel>What syncs</SectionLabel>
        <div style={{ fontSize: 'var(--type-base)', color: 'var(--app-dim)', lineHeight: 'var(--leading-relaxed-plus)', textWrap: 'pretty' }}>
          Everything you have typed into this app, not a selection from it: your courses and what
          you have added to them, your actions, appointments, notes and connected calendars, the
          documents, spreadsheets, decks and graphs you have made, the email you have drafted,
          your grades and degree plan, what you have recorded the term costing, and how the app is
          set up. Privacy and your rights lists it group by group. Sign in on a laptop and the same
          semester is there.
        </div>

        <SectionLabel>What does not</SectionLabel>
        <div style={{ fontSize: 'var(--type-base)', color: 'var(--app-dim)', lineHeight: 'var(--leading-relaxed-plus)', textWrap: 'pretty' }}>
          Files you attach stay on the device that has them — a lecture deck can be tens of
          megabytes and uploading it on a phone plan is not a choice the app should make for you.
          The sample semester's audio ships with the app, so it plays anywhere.
        </div>

        <SectionLabel>How conflicts resolve</SectionLabel>
        <div style={{ fontSize: 'var(--type-base)', color: 'var(--app-dim)', lineHeight: 'var(--leading-relaxed-plus)', textWrap: 'pretty' }}>
          Nothing you added on one device is dropped because you added something on the other.
          Notes and checked actions from both devices are kept. Settings use the latest choice.
        </div>
        <div style={{ fontSize: 'var(--type-base)', color: 'var(--app-dim)', lineHeight: 'var(--leading-relaxed-plus)', textWrap: 'pretty', marginTop: 'var(--sp-4)' }}>
          If the same note is edited on both devices, the later edit wins.
        </div>

        {/* Between what the account does and leaving it: the one thing on
            this screen that is about somebody other than the account holder.
            See `components/ReferralLink.tsx`. */}
        {/* Asked once, for an account made without a birth date (D-139). */}
        <AgeStatement />

        <ReferralLink />

        <AccountSecurity />

        <ActionButton
          disabled={busy}
          onClick={() => void run(signOut)}
          style={{ fontSize: 'var(--type-sm)', marginTop: 'calc(20px * var(--density, 1))' }}
        >
          Sign out (keeps data on this device)
        </ActionButton>
        <div style={{ fontSize: 'var(--type-xs-plus)', color: 'var(--app-dim)', marginTop: 'var(--sp-4)', lineHeight: 'var(--leading-normal)' }}>
          Signing out leaves this device's copy alone — nothing is deleted here, and nothing stops
          working.
        </div>
        {/* Signing out can fail — a network that has gone, most often — and a
            button that appears to do nothing is the worst thing this screen
            could do with an account still signed in. */}
        {note && (
          <div role="status" aria-live="polite" style={{ fontSize: 'var(--type-base)', color: 'var(--app-dim)', marginTop: 'var(--sp-7)', lineHeight: 'var(--leading-relaxed)' }}>
            {note}
          </div>
        )}
        {error && (
          <div role="alert" style={{ fontSize: 'var(--type-base)', color: 'var(--app-accent)', marginTop: 'var(--sp-7)', lineHeight: 'var(--leading-relaxed)' }}>
            {error}
          </div>
        )}
        <MembershipPanel />
      </Page>
    );
  }

  return (
    <Page>
      {/* The same test the form opens by, and it has to be made here because
          the form owns which way round it is: somebody with an account is
          coming back to it, and somebody without one has never seen it. */}
      <div className="chrome-text" style={{ fontSize: 'var(--type-2xl)', lineHeight: 'var(--leading-display-xl)' }}>
        {state.registered ? 'Pick up where you left off.' : 'One semester, every device.'}
      </div>
      <div style={{ fontSize: 'var(--type-md)', color: 'var(--app-dim)', marginTop: 'var(--sp-3)', lineHeight: 'var(--leading-relaxed)', textWrap: 'pretty' }}>
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

      <div style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)', marginTop: 'var(--sp-4)', lineHeight: 'var(--leading-relaxed)', textWrap: 'pretty' }}>
        An institution sign-in option appears only after the university has authorized its identity
        provider and Semester has verified the connection.
      </div>

      <SectionLabel>Before you sign up</SectionLabel>
      <div style={{ fontSize: 'var(--type-sm-plus)', color: 'var(--app-dim)', lineHeight: 'var(--leading-relaxed-plus)', textWrap: 'pretty' }}>
        What you already have on this device is kept. The first sync sends it up, and if the
        account already holds a semester the two are merged rather than one replacing the other —
        you end up with both sides' courses, notes and ticked boxes.
      </div>
      <StorageRoom />
      <MembershipPanel />
    </Page>
  );
}
