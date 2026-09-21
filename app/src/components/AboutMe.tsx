/**
 * What you have told the assistant about you — the whole list, editable.
 *
 * The list itself is `lib/aboutme.ts`; this is the part a person can see. That
 * split matters more here than it usually does, because the feature's only
 * defence is that it is legible: a memory the app keeps and does not show is
 * the thing people are right to object to, and every line here is one the
 * student typed, shown in full, with an × beside it.
 *
 * So there is no summarising, no "and 4 more", and no fold. Twelve lines of a
 * hundred and sixty characters fit on a phone, which is why those are the
 * caps — see `MOST_FACTS`.
 *
 * ## Why the examples are examples and not a picker
 *
 * The first draft of this had a set of suggested preferences to tap: citation
 * style, when you work, how you like explanations. It reads well and it is the
 * wrong shape — a picker teaches people that the list is a form with a right
 * set of answers, and the whole value is the sentence nobody would have
 * thought to offer as an option. They are placeholder text instead, which
 * shows the *kind* of thing without being one.
 */

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { MOST_CHARS, MOST_FACTS, addFact, dropFact, editFact } from '../lib/aboutme';
import { useRowStyle } from './shell/useShell';

/**
 * What goes in the empty box.
 *
 * Three kinds on purpose — a professor's requirement, a fact about how the
 * person works, and a constraint on the answers themselves — because one
 * example teaches the list is for that one thing.
 */
const EXAMPLE =
  'e.g. Professor Larsen wants Chicago footnotes, not APA';

/**
 * A textarea the height of what is in it.
 *
 * Both boxes on this screen hold one sentence that has to be readable whole —
 * that is the claim the screen makes — and neither of the two obvious controls
 * does it. An `input` scrolls a long line sideways and shows the middle of a
 * word against the right edge. A textarea wraps, but `textarea.input` in
 * `styles/industry.css` carries a 90px floor for the boxes it was written for,
 * so a one-line preference sits in four lines of empty panel, and twelve of
 * them make a settings page you scroll past rather than read.
 *
 * So it measures. `scrollHeight` after a reset to `auto` is the content's own
 * height, which is the only number that is right for both the short line and
 * the one that wraps to three.
 *
 * In a layout effect rather than an effect, so the height is set before the
 * browser paints and a line does not visibly jump on every keystroke. The
 * floor is the 44px a field gets for being something to aim at.
 */
function Grows({
  value,
  label,
  ...rest
}: { value: string; label: string } & React.ComponentProps<'textarea'>) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const fit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(44, el.scrollHeight)}px`;
  }, []);

  // On the value rather than on every render: the height is a function of the
  // text, and a parent re-rendering for its own reasons has not changed it.
  useLayoutEffect(fit, [fit, value]);

  return (
    <textarea
      {...rest}
      ref={ref}
      value={value}
      rows={1}
      /*
       * Spelled out here rather than passed through `rest`, which worked and
       * was invisible to `scripts/labels.mjs` — it reads the JSX, so a name
       * arriving inside a spread is a name it has to take on trust. The point
       * of that audit is that nothing is taken on trust.
       */
      aria-label={label}
      style={{
        minHeight: 44,
        lineHeight: 'var(--leading-relaxed)',
        // It sizes itself, so the grip would offer a height the next keystroke
        // takes back.
        resize: 'none',
        overflow: 'hidden',
        ...rest.style,
      }}
    />
  );
}

export function AboutMe() {
  const { state, dispatch } = useStore();
  const facts = state.aboutMe;
  const [typed, setTyped] = useState('');
  const row = useRowStyle(11);

  const set = (next: typeof facts) => dispatch({ type: 'setAboutMe', facts: next });

  const add = () => {
    if (!typed.trim()) return;
    set(addFact(facts, typed));
    setTyped('');
  };

  return (
    <div>
      {facts.map((f) => (
        <div key={f.id} style={{ ...row, display: 'flex', gap: 'calc(9px * var(--density, 1))', alignItems: 'flex-start' }}>
          {/*
            Editable in place rather than behind a pencil. A line somebody
            wants to change is usually a line that is nearly right, and the
            two-step version of that — tap to edit, tap to save — is how a
            list stops being worth correcting.

            A textarea rather than an input, which is the one thing about this
            screen a screenshot caught and the tests could not. Both hold the
            same string; an `input` scrolls it sideways, so a line near the
            160-character cap showed "…Chicago footnotes, not AP" against the
            right edge with the rest reachable only by dragging a caret. The
            claim this screen makes is that you can read what the app will
            send, and a line clipped mid-word is not that. It wraps instead.
          */}
          <Grows
            className="input"
            value={f.text}
            maxLength={MOST_CHARS}
            label={`What you told the assistant: ${f.text}`}
            onChange={(e) => set(editFact(facts, f.id, e.target.value))}
            style={{ flex: 1, minWidth: 0, fontSize: 'var(--type-base)' }}
          />
          <button
            type="button"
            className="bare"
            onClick={() => set(dropFact(facts, f.id))}
            aria-label={`Delete: ${f.text}`}
            style={{ flex: 'none', width: 28, color: 'var(--app-dim)', fontSize: 'var(--type-lg)' }}
          >
            ×
          </button>
        </div>
      ))}

      {facts.length < MOST_FACTS ? (
        <div style={{ display: 'flex', gap: 'calc(7px * var(--density, 1))', marginTop: 'var(--sp-5)' }}>
          <Grows
            className="input"
            value={typed}
            maxLength={MOST_CHARS}
            placeholder={EXAMPLE}
            label="Something to tell the assistant about you"
            onChange={(e) => setTyped(e.target.value)}
            /*
             * Enter adds it, because the alternative is typing a sentence and
             * then hunting for a button on a phone keyboard that covers it.
             *
             * It is a textarea for the wrapping, not for multi-line entry —
             * `clean` collapses a newline anyway, so letting Enter insert one
             * would make the box do something the stored line cannot keep.
             */
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
            style={{ flex: 1, minWidth: 0, fontSize: 'var(--type-base)' }}
          />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={add}
            disabled={!typed.trim()}
            style={{ flex: 'none', paddingInline: 'var(--sp-5)', alignSelf: 'flex-start', height: 44 }}
          >
            Add
          </button>
        </div>
      ) : (
        <div style={{ fontSize: 'var(--type-sm-plus)', color: 'var(--app-dim)', marginTop: 'var(--sp-5)' }}>
          {MOST_FACTS} is the limit. Delete one to say something else — a list longer than this
          stops being something you can check before it stops being something the assistant reads.
        </div>
      )}
    </div>
  );
}
