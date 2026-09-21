/**
 * Saying something is wrong, in the app, rather than in an email about it.
 *
 * This replaces a row that read *"Write to {SUPPORT}. A bug report that names
 * the screen and what you expected is worth ten that say it is broken."* Every
 * word of that was true and the whole of it was the app asking the student to
 * do its own job: the screen is something the app knows, the build is
 * something only the app knows, and somebody who has just hit a bug is the
 * least likely person alive to open a mail client and compose a tidy report.
 *
 * So the app composes the context and the person writes the one thing no
 * machine can supply — what they expected to happen.
 *
 * ## Nothing goes with it that is not on the screen
 *
 * `shownLine` prints the three context values above the button, in the words
 * they will be stored in. That is deliberate and it is the reason the shaping
 * happens in `lib/feedback.ts` rather than here: a route reduced to
 * `/course/:id` is a thing you can show somebody, and a raw route is a thing
 * you would have to explain.
 *
 * `supabase/feedback.check.sql` refuses the raw one at the column, so this is
 * not the only thing standing between a student and an accidental disclosure
 * — it is the part that tells them so.
 *
 * ## The email address stays, for the people this cannot serve
 *
 * Sending needs an account, because the row is keyed to one. A signed-out
 * visitor, or a build with no account service, still gets the address — the
 * form is the better path, not the only one, and removing the fallback would
 * make "something is broken" unanswerable for exactly the people most likely
 * to be looking at a broken thing.
 */

import { useState } from 'react';
import { useStore } from '../state/store';
import { cloudConfigured } from '../lib/cloud';
import { KINDS, context, sayable, send, shownLine, type Kind } from '../lib/feedback';
import { SUPPORT } from '../lib/privacy';
import { ActionButton } from './ui';
import { secondLine } from '../lib/dim';

export function SaySomething() {
  const { account } = useStore();
  const [kind, setKind] = useState<Kind>('bug');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [trouble, setTrouble] = useState('');

  if (!cloudConfigured || !account) {
    return (
      <p style={{ margin: 0, ...secondLine() }}>
        Write to {SUPPORT}. Sending from inside the app needs an account, so that a reply has
        somewhere to go.
      </p>
    );
  }

  if (sent) {
    return (
      <p style={{ margin: 0 }}>
        Sent. Thank you — this goes to the person who builds the app, with the screen you were on.
      </p>
    );
  }

  /*
   * The version is empty, and that is a gap worth naming rather than hiding.
   *
   * The column takes one and `shownLine` prints one when it is there; what is
   * missing is a build stamp, and adding one means a `define` in the Vite
   * config whose value changes on every build. That would give every build new
   * content hashes with no source change, which is exactly the signal the
   * deploy is verified by. Worth doing deliberately, not as a side effect of
   * this.
   */
  const ctx = context(
    typeof window === 'undefined' ? '' : window.location.href,
    typeof window === 'undefined' ? 1440 : window.innerWidth,
    '',
  );
  const can = sayable(note);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      <div
        role="radiogroup"
        aria-label="What kind of thing is this"
        style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)' }}
      >
        {KINDS.map((k) => {
          const on = k.id === kind;
          return (
            <button
              key={k.id}
              type="button"
              role="radio"
              aria-checked={on}
              className="bare tappable"
              onClick={() => setKind(k.id)}
              style={{
                paddingBlock: 'calc(6px * var(--density, 1))',
                paddingInline: 'calc(10px * var(--density, 1))',
                borderRadius: 'var(--r-sm)',
                fontSize: 'var(--type-sm)',
                border: `1px solid ${on ? 'var(--app-accent)' : 'var(--app-line)'}`,
                background: on ? 'var(--app-accent-wash)' : 'transparent',
                color: 'var(--app-fg)',
              }}
            >
              {k.label}
            </button>
          );
        })}
      </div>

      <textarea
        aria-label="What happened"
        placeholder={KINDS.find((k) => k.id === kind)?.blurb || 'What happened?'}
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          setTrouble('');
        }}
        rows={4}
        style={{
          width: '100%',
          resize: 'vertical',
          border: '1px solid var(--app-line)',
          borderRadius: 'var(--r-lg)',
          background: 'var(--app-panel)',
          color: 'var(--app-fg)',
          padding: 'var(--sp-4)',
          fontSize: 'var(--type-base)',
          fontFamily: 'inherit',
        }}
      />

      <p style={{ margin: 0, fontSize: 'var(--type-xs)', ...secondLine() }}>{shownLine(ctx)}</p>

      {trouble && (
        <p role="status" style={{ margin: 0, fontSize: 'var(--type-sm)', color: 'var(--app-warn)' }}>
          {trouble} You can still write to {SUPPORT}.
        </p>
      )}

      <ActionButton
        disabled={!can.ok || sending}
        onClick={() => {
          const ok = sayable(note);
          if (!ok.ok) {
            setTrouble(ok.why);
            return;
          }
          setSending(true);
          setTrouble('');
          void send(account.id, kind, note, ctx)
            .then(() => setSent(true))
            .catch((e: unknown) => setTrouble(e instanceof Error ? e.message : String(e)))
            .finally(() => setSending(false));
        }}
      >
        {sending ? 'Sending…' : 'Send'}
      </ActionButton>
    </div>
  );
}
