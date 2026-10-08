import { Suspense, lazy, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useModal } from '../a11y/modal';
import {
  changeEmail,
  onPasswordRecovery,
  setNewPassword,
  signOutOtherDevices,
} from '../lib/cloud';
import { passwordProblem, PASSWORD_FLOOR } from '../lib/password';
import { ConfirmDialog } from './ConfirmDialog';
import { FieldMessage, useFieldErrors } from './FieldMessage';
import { ActionPreview } from './unity/ActionPreview';

/** Read when the section is open: it asks the network and has its own loading state. */
const SignedInDevices = lazy(() => import('./SignedInDevices').then((m) => ({ default: m.SignedInDevices })));

/**
 * What an account can do about its own sign-in, once it has one.
 *
 * Before this the reset link led to Supabase's own page, which enforced a
 * different password floor from this app's form, and a signed-in account had
 * no way to change its password or address, or to see that another device was
 * still signed in. The three things here close that (full-beta G-02):
 *
 * - `RecoveryDialog` opens by itself when an emailed reset link has been
 *   followed, and asks for the new password under the same floor the sign-up
 *   form uses (`PASSWORD_FLOOR`).
 * - `AccountSecurity` sits on the Account screen: change password, change
 *   address (which waits for the emailed confirmation and says so), and sign
 *   out every other device behind a preview and an explicit confirmation.
 *
 * The calls are props so a test can hand fakes; the defaults are the real ones.
 */

interface Calls {
  setPassword?: (password: string) => Promise<string>;
  changeAddress?: (email: string) => Promise<string>;
  signOutOthers?: () => Promise<string>;
}

/** The new-password form, shared by the recovery dialog and the Account panel. */
function PasswordForm({
  setPassword = setNewPassword,
  onDone,
  submitLabel,
}: {
  setPassword?: (password: string) => Promise<string>;
  onDone?: (said: string) => void;
  submitLabel: string;
}) {
  const fields = useFieldErrors(['password', 'again'] as const);
  const [password, setValue] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [failure, setFailure] = useState('');
  const hint = useId();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNote('');
    setFailure('');
    const ok = fields.check({
      password: passwordProblem(password) ?? '',
      again: password === again ? '' : 'The two passwords are not the same.',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const said = await setPassword(password);
      setValue('');
      setAgain('');
      setNote(said);
      onDone?.(said);
    } catch (err) {
      setFailure(err instanceof Error ? err.message : 'The password was not changed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} noValidate>
      <p id={hint} style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)' }}>
        At least {PASSWORD_FLOOR} characters.
      </p>
      <label htmlFor={fields.control('password', hint).id} style={{ display: 'block', marginTop: 'var(--sp-3)' }}>
        New password
      </label>
      <input
        {...fields.control('password', hint)}
        aria-label="New password"
        className="input"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => {
          setValue(e.target.value);
          fields.clear('password');
        }}
      />
      <FieldMessage {...fields.message('password')} />
      <label htmlFor={fields.control('again').id} style={{ display: 'block', marginTop: 'var(--sp-3)' }}>
        New password again
      </label>
      <input
        {...fields.control('again')}
        aria-label="New password again"
        className="input"
        type="password"
        autoComplete="new-password"
        value={again}
        onChange={(e) => {
          setAgain(e.target.value);
          fields.clear('again');
        }}
      />
      <FieldMessage {...fields.message('again')} />
      <button type="submit" className="btn btn-primary" disabled={busy} style={{ marginTop: 'var(--sp-4)' }}>
        {busy ? 'Saving…' : submitLabel}
      </button>
      {note && (
        <p role="status" aria-live="polite" style={{ marginTop: 'var(--sp-3)' }}>
          {note}
        </p>
      )}
      {failure && (
        <p role="alert" style={{ marginTop: 'var(--sp-3)' }}>
          {failure}
        </p>
      )}
    </form>
  );
}

/**
 * Opens when a reset link has been followed. Mounted once, near the top of the
 * app. It can be closed: the recovery session stays, and the same form is on
 * Account, so closing it strands nobody.
 */
export function RecoveryDialog({
  watch = onPasswordRecovery,
  setPassword,
}: {
  watch?: (fn: () => void) => () => void;
  setPassword?: (password: string) => Promise<string>;
} = {}) {
  const [open, setOpen] = useState(false);
  useEffect(() => watch(() => setOpen(true)), [watch]);
  if (!open) return null;
  return <RecoveryBody onClose={() => setOpen(false)} setPassword={setPassword} />;
}

function RecoveryBody({
  onClose,
  setPassword,
}: {
  onClose: () => void;
  setPassword?: (password: string) => Promise<string>;
}) {
  const titleId = useId();
  const close = useRef<HTMLButtonElement>(null);
  const { ref, onKeyDown } = useModal<HTMLDivElement>({ onClose });
  const dialog = (
    <div className="dialog-backdrop">
      <div ref={ref} className="dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={onKeyDown}>
        <h2 id={titleId} className="dialog-title">
          Choose a new password
        </h2>
        <div className="dialog-body">
          <PasswordForm setPassword={setPassword} submitLabel="Set password" onDone={() => close.current?.focus()} />
        </div>
        <div className="dialog-actions">
          <button ref={close} type="button" className="explain-close" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
  const host = typeof document === 'undefined' ? null : document.querySelector('.device');
  return host ? createPortal(dialog, host) : dialog;
}

/** The Account screen's section: password, address, other devices. */
export function AccountSecurity({ setPassword, changeAddress = changeEmail, signOutOthers = signOutOtherDevices }: Calls = {}) {
  const fields = useFieldErrors(['email'] as const);
  const [email, setEmail] = useState('');
  const [emailNote, setEmailNote] = useState('');
  const [emailFailure, setEmailFailure] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [otherNote, setOtherNote] = useState('');
  const [otherFailure, setOtherFailure] = useState('');

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailNote('');
    setEmailFailure('');
    const address = email.trim();
    if (!fields.check({ email: /^\S+@\S+\.\S+$/.test(address) ? '' : 'Enter a full email address.' })) return;
    try {
      setEmailNote(await changeAddress(address));
    } catch (err) {
      setEmailFailure(err instanceof Error ? err.message : 'The address was not changed.');
    }
  };

  const others = async () => {
    setConfirming(false);
    setOtherNote('');
    setOtherFailure('');
    try {
      setOtherNote(await signOutOthers());
    } catch (err) {
      setOtherFailure(err instanceof Error ? err.message : 'Other devices were not signed out.');
    }
  };

  return (
    <section aria-labelledby="account-security-title" style={{ marginTop: 'var(--sp-7)' }}>
      <h3 id="account-security-title">Sign-in and security</h3>

      <h4>Change password</h4>
      <PasswordForm setPassword={setPassword} submitLabel="Change password" />

      <h4 style={{ marginTop: 'var(--sp-6)' }}>Change email address</h4>
      <form onSubmit={(e) => void submitEmail(e)} noValidate>
        <label htmlFor={fields.control('email').id}>New email address</label>
        <input
          {...fields.control('email')}
          aria-label="New email address"
          className="input"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            fields.clear('email');
          }}
        />
        <FieldMessage {...fields.message('email')} />
        <button type="submit" className="btn btn-primary" style={{ marginTop: 'var(--sp-4)' }}>
          Send confirmation link
        </button>
        {emailNote && (
          <p role="status" aria-live="polite">
            {emailNote}
          </p>
        )}
        {emailFailure && <p role="alert">{emailFailure}</p>}
      </form>

      <Suspense fallback={<p role="status">Checking where you are signed in…</p>}>
        <SignedInDevices />
      </Suspense>

      <h4 style={{ marginTop: 'var(--sp-6)' }}>Other devices</h4>
      <p style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)' }}>
        Lost a phone or left yourself signed in on a shared computer? This signs every other device out. This one stays
        signed in, and nothing is deleted anywhere.
      </p>
      <button type="button" className="btn" onClick={() => setConfirming(true)}>
        Sign out other devices
      </button>
      {otherNote && (
        <p role="status" aria-live="polite">
          {otherNote}
        </p>
      )}
      {otherFailure && <p role="alert">{otherFailure}</p>}
      {confirming && (
        <ConfirmDialog
          title="Sign out other devices?"
          preview={
            <ActionPreview
              subject="Other devices"
              says="Every other browser and phone signed in to this account will be asked to sign in again."
              doesNotChange="This device stays signed in, and nothing is deleted."
              recovery={{ kind: 'none', how: 'Those devices sign in again themselves.' }}
            />
          }
          confirmLabel="Sign out other devices"
          onConfirm={() => void others()}
          onCancel={() => setConfirming(false)}
        />
      )}
    </section>
  );
}
