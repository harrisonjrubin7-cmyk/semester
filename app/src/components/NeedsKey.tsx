import { useStore } from '../state/store';
import { Blueprint } from './Blueprint';
import { ActionButton } from './ui';
import { Page } from './Page';
import { provider } from '../lib/claude';

/**
 * The eight places that told you where the key lives, and now take you there.
 *
 * Eight screens gated on a key wrote the same sentence by hand — *"Needs a key
 * first — set one under Settings → The assistant"*, *"Sign in to use the shared
 * key, or add your own under Settings → The assistant"* — and not one of them
 * was a link. That is a dead end with directions printed on it: the app knows
 * exactly which page it is naming, and made you go and find it.
 *
 * The Ask tab had already answered this, and said why in its own margin:
 * "somebody who wants to change the model should not have to guess that it is
 * under Settings now, so the way there is one tap from the conversation it
 * changes." The same is true of a diagram you cannot draw and a paper you
 * cannot write. See `ai/Chat.tsx`.
 *
 * So this is one component, in two shapes, for the two situations the eight
 * split into:
 *
 *   - **`frame`** — the screen is nothing *but* the gate. Work, Draw and Solve
 *     had three copies of an identical `Blueprint`, down to the padding.
 *   - Otherwise, inline: the gate stands where the primary button would be,
 *     under a form you can still fill in. Exam, Deck, Essay and Changes drew a
 *     line of grey 12.5px prose there — the one place on the screen where an
 *     action belongs, spent on saying that the action is elsewhere.
 *
 * Both end in the same button, because there is one destination and the
 * distinction between the shapes is about the room available, not about what
 * you would want to do next.
 *
 * ## Why the sentence is here rather than passed in
 *
 * It was eight sentences saying one thing in four wordings, two of which
 * mentioned the shared key and two of which did not — so the same install, on
 * two screens, was told two different stories about whether signing in would
 * be enough. `also` carries what is genuinely local (Exam's "a paper from your
 * cards needs no key at all"), and everything true of every screen is written
 * once.
 */
export function NeedsKey({
  also,
  frame = false,
  action = 'Set up the assistant',
}: {
  /** What is true on this screen only, appended to the shared sentence. */
  also?: string;
  /** The whole screen is the gate, rather than the foot of a form. */
  frame?: boolean;
  /** The button's words, where the screen can say something better. */
  action?: string;
}) {
  const { dispatch } = useStore();
  const go = () => dispatch({ type: 'go', screen: 'setAssistant' });

  const says = (
    <>
      Sign in to use the shared key, or add your own. Everything else in the app works
      without it.
      {also ? ` ${also}` : ''}
    </>
  );

  if (!frame) {
    return (
      <div style={{ marginTop: 'var(--sp-7)' }}>
        <div
          style={{
            fontSize: 'var(--type-sm)',
            opacity: 0.6,
            lineHeight: 'var(--leading-relaxed)',
            textWrap: 'pretty',
          }}
        >
          Needs {provider()}. {says}
        </div>
        <ActionButton onClick={go} style={{ marginTop: 'var(--sp-6)' }}>
          {action}
        </ActionButton>
      </div>
    );
  }

  return (
    <Page>
      <Blueprint style={{ padding: 'var(--sp-7)', background: 'var(--app-hero)' }}>
        <div className="kicker">Needs {provider()}</div>
        <div
          style={{
            fontSize: 'var(--type-md)',
            marginTop: 'var(--sp-4)',
            lineHeight: 'var(--leading-relaxed)',
            opacity: 0.8,
            textWrap: 'pretty',
          }}
        >
          {says}
        </div>
        <ActionButton onClick={go} tone="primary" style={{ marginTop: 'var(--sp-7)' }}>
          {action}
        </ActionButton>
      </Blueprint>
    </Page>
  );
}
