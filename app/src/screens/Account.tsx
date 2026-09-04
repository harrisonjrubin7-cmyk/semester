import { useState } from 'react';
import { useStore } from '../state/store';
import { Blueprint } from '../components/Blueprint';
import { StorageRoom } from '../components/StorageRoom';
import { SectionLabel } from '../components/ui';
import { cloudConfigured, sendReset, signIn, signInWith, signOut, signUp } from '../lib/cloud';

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
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      <div style={{ padding: 18 }}>
        <Blueprint style={{ padding: 16, background: 'var(--app-hero)' }}>
          <div className="kicker">Device only</div>
          <div className="chrome-text" style={{ fontSize: 'calc(26px * var(--text-scale, 1))', marginTop: 8, lineHeight: 1.1 }}>
            This build has no account service
          </div>
          <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', opacity: 0.78, marginTop: 8, lineHeight: 1.5 }}>
            Everything works, and everything stays on this device. To turn on accounts, set
            VITE_SUPABASE_URL and VITE_SUPABASE_KEY and redeploy — see SETUP.md.
          </div>
        </Blueprint>
      </div>
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
      <div style={{ padding: 18 }}>
        <Blueprint style={{ padding: 16, background: 'var(--app-hero)' }}>
          <div className="kicker">Signed in</div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'calc(20px * var(--text-scale, 1))', marginTop: 6 }}>
            {account.email}
          </div>
          <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.7, marginTop: 8, lineHeight: 1.5 }}>
            {sync.status === 'syncing' && 'Catching up with your account…'}
            {sync.status === 'synced' &&
              `Synced ${sync.at ? new Date(sync.at).toLocaleTimeString() : ''} · ${counts}`}
            {sync.status === 'error' && (
              <span style={{ whiteSpace: 'pre-wrap' }}>Sync failed. {sync.error}</span>
            )}
          </div>
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
                lineHeight: 1.5,
                textWrap: 'pretty',
              }}
            >
              {checked}
            </div>
          )}
        </Blueprint>

        <SectionLabel>What syncs</SectionLabel>
        <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', opacity: 0.75, lineHeight: 1.55, textWrap: 'pretty' }}>
          Your courses, everything you have added to them, your tasks, appointments, notes and
          connected calendars. Sign in on a laptop and the same semester is there.
        </div>

        <SectionLabel>What does not</SectionLabel>
        <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', opacity: 0.75, lineHeight: 1.55, textWrap: 'pretty' }}>
          Files you attach stay on the device that has them — a lecture deck can be tens of
          megabytes and uploading it on a phone plan is not a choice the app should make for you.
          The sample semester's audio ships with the app, so it plays anywhere.
        </div>

        <SectionLabel>How conflicts resolve</SectionLabel>
        <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', opacity: 0.75, lineHeight: 1.55, textWrap: 'pretty' }}>
          Nothing you added on one device is dropped because you added something on the other.
          Write a note on the laptop and another on your phone while it is offline, and you end up
          with both; tick one box here and a different one there, and both stay ticked. Settings
          are the exception, and deliberately so — your colours are whatever you last chose,
          wherever you chose it.
        </div>
        <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', opacity: 0.75, lineHeight: 1.55, textWrap: 'pretty', marginTop: 8 }}>
          What still does not merge is the same note edited on both: the later edit is the one that
          survives. The app would rather say so than pretend.
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-block"
          disabled={busy}
          onClick={() => void run(signOut)}
          style={{
            height: 44,
            fontSize: 'calc(12px * var(--text-scale, 1))',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginTop: 20,
          }}
        >
          Sign out
        </button>
        <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, marginTop: 8, lineHeight: 1.45 }}>
          Signing out leaves this device's copy alone — nothing is deleted here, and nothing stops
          working.
        </div>
        <div style={{ height: 22 }} />
      </div>
    );
  }

  return (
    <div style={{ padding: 18 }}>
      <div className="chrome-text" style={{ fontSize: 'calc(28px * var(--text-scale, 1))', lineHeight: 1.08 }}>
        {mode === 'in' ? 'Pick up where you left off.' : 'One semester, every device.'}
      </div>
      <div style={{ fontSize: 'calc(14px * var(--text-scale, 1))', opacity: 0.72, marginTop: 6, lineHeight: 1.5, textWrap: 'pretty' }}>
        An account keeps your courses, notes and progress in step between your phone and your
        laptop. The app works without one — this only decides whether it follows you.
      </div>

      <input
        className="input"
        type="email"
        autoComplete="email"
        placeholder="you@vanderbilt.edu"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ fontSize: 'calc(14px * var(--text-scale, 1))', marginTop: 16 }}
        aria-label="Email"
      />
      <input
        className="input"
        type="password"
        autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
        placeholder={mode === 'in' ? 'Password' : 'Password — at least 8 characters'}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ fontSize: 'calc(14px * var(--text-scale, 1))', marginTop: 8 }}
        aria-label="Password"
      />

      <button
        type="button"
        className="btn btn-primary btn-block"
        disabled={busy || !email.trim() || password.length < 8}
        onClick={() =>
          void run(() =>
            mode === 'in' ? signIn(email.trim(), password) : signUp(email.trim(), password),
          )
        }
        style={{
          height: 50,
          fontSize: 'calc(15px * var(--text-scale, 1))',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginTop: 14,
        }}
      >
        {busy ? 'Working…' : mode === 'in' ? 'Sign in' : 'Create the account'}
      </button>

      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy}
          onClick={() => void run(() => signInWith('google'))}
          style={{ flex: 1, height: 42, fontSize: 'calc(11px * var(--text-scale, 1))', letterSpacing: '0.1em', textTransform: 'uppercase' }}
        >
          Google
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy}
          onClick={() => void run(() => signInWith('apple'))}
          style={{ flex: 1, height: 42, fontSize: 'calc(11px * var(--text-scale, 1))', letterSpacing: '0.1em', textTransform: 'uppercase' }}
        >
          Apple
        </button>
      </div>
      <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, marginTop: 8, lineHeight: 1.45 }}>
        Google and Apple work once they are switched on for the project — until then they answer
        with a provider error, which is the truth rather than a broken button.
      </div>

      <div style={{ display: 'flex', gap: 14, marginTop: 18 }}>
        <button
          type="button"
          className="bare"
          onClick={() => setMode(mode === 'in' ? 'up' : 'in')}
          style={{ fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.7, width: 'auto' }}
        >
          {mode === 'in' ? 'Make an account' : 'I already have one'}
        </button>
        {mode === 'in' && email.trim() && (
          <button
            type="button"
            className="bare"
            onClick={() => void run(() => sendReset(email.trim()))}
            style={{ fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.5, width: 'auto' }}
          >
            Send a reset link
          </button>
        )}
      </div>

      {note && (
        <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', opacity: 0.85, marginTop: 14, lineHeight: 1.5 }}>{note}</div>
      )}
      {error && (
        <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', color: 'var(--app-accent)', marginTop: 14, lineHeight: 1.5 }}>
          {error}
        </div>
      )}

      <SectionLabel>Before you sign up</SectionLabel>
      <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.65, lineHeight: 1.55, textWrap: 'pretty' }}>
        What you already have on this device is kept. The first sync sends it up, and if the
        account already holds a semester the two are merged rather than one replacing the other —
        you end up with both sides' courses, notes and ticked boxes.
      </div>
      <StorageRoom />

      <div style={{ height: 22 }} />
    </div>
  );
}
