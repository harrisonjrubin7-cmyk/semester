import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import {
  PROVIDER_LABEL,
  namesSaid,
  providersOn,
  sendReset,
  signIn,
  signInWith,
  signUp,
  type Provider,
} from '../lib/cloud';

/**
 * An email address, a password, and the two things they can mean.
 *
 * The app is offline-first and stays that way: nothing here is a gate, and
 * every screen works with this form untouched. What it decides is whether the
 * semester follows you to the laptop.
 *
 * ## Why one component rather than two
 *
 * Registering and signing in are the same two fields and differ in one call.
 * They were written out once, on the account screen, which is the only place
 * that offered them — so a first run never asked, and somebody who had used
 * the app for a month had to find Settings → Account to discover that an
 * account existed at all. The first run asks now, and it asks with this,
 * because a second copy of a password form is a second place for the
 * autocomplete hints, the eight-character floor and the reset link to drift.
 *
 * ## Which way round it opens
 *
 * `state.registered` is set the first time an account is made or signed into
 * on this device, and it is the whole of the "first time" test. Without an
 * account the form opens on **create**, because somebody who has never had one
 * cannot sign in and being shown a sign-in form is being shown a wall. With
 * one it opens on **sign in**, which from then on is all that is ever asked
 * for: the address and the password.
 */
export function Credentials({
  onDone,
}: {
  /** Called once a session exists — not when a confirmation email is sent. */
  onDone?: () => void;
}) {
  const { state, dispatch } = useStore();
  const [mode, setMode] = useState<'in' | 'up'>(state.registered ? 'in' : 'up');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  /*
   * Which provider buttons there are, which is a question about the project
   * and not about this app.
   *
   * `undefined` while the answer is outstanding, `null` when it could not be
   * had, and otherwise the list. The three are not interchangeable and the
   * rendering below turns on all three — see `providersOn`.
   */
  const [on, setOn] = useState<Provider[] | null | undefined>(undefined);

  useEffect(() => {
    // The form unmounts the moment a first run moves on, and the answer can
    // land after that. Setting state on a gone component is the warning this
    // flag exists to not print.
    let alive = true;
    void providersOn().then((got) => {
      if (alive) setOn(got);
    });
    return () => {
      alive = false;
    };
  }, []);

  /*
   * What to draw, from those three cases.
   *
   * Answered — draw what is on, and nothing when nothing is. Unanswered
   * (`null`: offline, blocked, a project that did not reply) — draw all three,
   * which is what this form did before it could ask, because a check that did
   * not happen is not a finding about the project and refusing the only way in
   * on the strength of a failed fetch is worse than a button that errors.
   * Still asking (`undefined`) — draw none *yet*, so that a button on this
   * screen always means a door that opens. The form above it is complete and
   * works on its own in the meantime.
   */
  const shown: Provider[] =
    on === undefined ? [] : (on ?? (Object.keys(PROVIDER_LABEL) as Provider[]));
  const noneOn = Array.isArray(on) && on.length === 0;

  /*
   * What may be sent, and the one rule that is not the same in both modes.
   *
   * Eight characters is a rule about *choosing* a password, and it was applied
   * to typing one you already have. Nothing here sets the project's minimum —
   * SETUP.md does not mention one — so the floor an existing account was made
   * under is whatever the project was configured with, and this form is in no
   * position to assume it was eight. The reset link the form sends leads to
   * Supabase's own page, which sets a password under that floor rather than
   * this one, so the app can hand somebody a password it will then refuse.
   *
   * And refuse silently: the sign-in placeholder is the word "Password", so a
   * shorter one leaves a dead button and nothing on screen saying why. The
   * floor stays where it belongs — on creating one, where the placeholder does
   * say it — and signing in asks only that there is something to send.
   */
  const MADE_FLOOR = 8;
  const ready =
    Boolean(email.trim()) && (mode === 'up' ? password.length >= MADE_FLOOR : password.length > 0);

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

  /*
   * Registering, and remembering that it happened.
   *
   * `registered` is dispatched here rather than left to the session watcher in
   * the store, because with email confirmation on there is no session yet —
   * and the person who has just been told to check their inbox is exactly the
   * person who should come back to a sign-in form rather than to an invitation
   * to make the account they already made.
   */
  const submit = () =>
    run(async () => {
      if (mode === 'in') {
        await signIn(email.trim(), password);
        dispatch({ type: 'registered' });
        onDone?.();
        return;
      }
      const made = await signUp(email.trim(), password);
      dispatch({ type: 'registered' });
      if (made.signedIn) onDone?.();
      // Otherwise the next visit is a sign-in, so leave the form on it with
      // the sentence about the inbox still on screen.
      else setMode('in');
      return made.said;
    });

  return (
    <>
      {/*
        A real form, with labels tied to inputs by id.

        Two inputs with `aria-label` and no `<form>` around them is a shape a
        password manager does not recognise: 1Password and iCloud Keychain look
        for a submittable form with named fields, so filling this had to be done
        by hand. It also means Enter submits and an iOS keyboard shows Go.

        The labels are visually hidden rather than absent — the placeholder says
        the same words, and a placeholder disappears the moment somebody starts
        typing, which is exactly when a label is needed.
      */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (busy || !ready) return;
          void submit();
        }}
      >
        <label className="sr-only" htmlFor="account-email">
          Email
        </label>
        <input
          className="input"
          id="account-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@vanderbilt.edu"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ fontSize: 'var(--type-md)', marginTop: 'var(--sp-7)' }}
        />
        <label className="sr-only" htmlFor="account-password">
          Password
        </label>
        <input
          className="input"
          id="account-password"
          name="password"
          type="password"
          autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
          placeholder={mode === 'in' ? 'Password' : `Password — at least ${MADE_FLOOR} characters`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ fontSize: 'var(--type-md)', marginTop: 'var(--sp-4)' }}
        />

        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={busy || !ready}
          style={{
            height: 50,
            fontSize: 'var(--type-lg)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginTop: 'calc(14px * var(--density, 1))',
          }}
        >
          {busy ? 'Working…' : mode === 'in' ? 'Sign in' : 'Create the account'}
        </button>
      </form>

      {shown.length > 0 && (
        <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-5)' }}>
          {shown.map((p) => (
            <button
              key={p}
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => void run(() => signInWith(p))}
              style={{
                flex: 1,
                height: 42,
                fontSize: 'var(--type-xs)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              {PROVIDER_LABEL[p]}
            </button>
          ))}
        </div>
      )}
      <div
        style={{
          fontSize: 'var(--type-xs)',
          color: 'var(--app-dim)',
          marginTop: 'var(--sp-4)',
          lineHeight: 'var(--leading-normal)',
          textWrap: 'pretty',
        }}
      >
        {shown.length > 0 && (
          <>
            {/* Named from what was drawn, not from the record of what the app
                knows how to draw — a project with one provider on used to get
                one button under a line offering three. */}
            Any {namesSaid(shown.map((p) => PROVIDER_LABEL[p]))} account works — there is no check
            on which university the address belongs to.{' '}
          </>
        )}
        {noneOn && (
          <>
            {/* The honest version of three dead buttons. This project has no
                provider switched on, so there is no sign-in to offer and the
                screen says which way in there is instead of finding out after
                a press. Whoever runs the deployment turns them on in the
                Supabase dashboard — SETUP.md has the steps — and the buttons
                appear here on their own. */}
            An email address and a password is the way in on this copy of Semester: no sign-in
            provider is switched on for it, so there is no{' '}
            {namesSaid(Object.values(PROVIDER_LABEL))} button to press.{' '}
          </>
        )}
        Email and a password is kept as a way in because some universities block third-party
        sign-in outright, and being locked out of the only option is not a good enough reason to be
        locked out of the app.
      </div>

      {/* Two text links side by side, 14px apart — so `tap-y` on both. An
          overlay reaching sideways would have each claiming the other's
          space, and the one later in the DOM would quietly win the overlap.
          Measured 102×19: the size of the words, not of a thumb. */}
      <div style={{ display: 'flex', gap: 'calc(14px * var(--density, 1))', marginTop: 'calc(18px * var(--density, 1))' }}>
        {/*
          Changing your mind clears what the other mode said.

          `submit` switches to sign-in by itself after a registration that
          needs a confirmation, and deliberately leaves the sentence about the
          inbox on screen — that is the instruction, and the switch is what it
          is an instruction about. A person pressing this link is doing the
          opposite: they have read the answer and are asking a different
          question. It used to leave "User already registered" sitting under a
          form now offering to sign in, where it reads as the answer to a press
          that has not happened yet.
        */}
        <button
          type="button"
          className="bare tap-y"
          onClick={() => {
            setMode(mode === 'in' ? 'up' : 'in');
            setError('');
            setNote('');
          }}
          style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)', width: 'auto' }}
        >
          {mode === 'in' ? 'Make an account' : 'I already have one'}
        </button>
        {mode === 'in' && email.trim() && (
          <button
            type="button"
            className="bare tap-y"
            onClick={() => void run(() => sendReset(email.trim()))}
            style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)', width: 'auto' }}
          >
            Send a reset link
          </button>
        )}
      </div>

      {note && (
        <div
          role="status"
          aria-live="polite"
          style={{
            fontSize: 'var(--type-base)',
            color: 'var(--app-dim)',
            marginTop: 'calc(14px * var(--density, 1))',
            lineHeight: 'var(--leading-relaxed)',
            textWrap: 'pretty',
          }}
        >
          {note}
        </div>
      )}
      {error && (
        <div
          role="alert"
          style={{
            fontSize: 'var(--type-base)',
            color: 'var(--app-accent)',
            marginTop: 'calc(14px * var(--density, 1))',
            lineHeight: 'var(--leading-relaxed)',
          }}
        >
          {error}
        </div>
      )}
    </>
  );
}
