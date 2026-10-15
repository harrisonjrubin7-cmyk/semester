import { useCallback, useEffect, useId, useRef, useState } from 'react';

/**
 * The one way a form field says it is wrong.
 *
 * Before this, every form that validated its own input drew the complaint by
 * hand: a `<div>` in the warning colour under the boxes, and nothing else. The
 * sentence was there for the eye and missing for everyone else — no
 * `aria-invalid` on the box, nothing tying the sentence to the box it was
 * about, nothing that moved a keyboard user to the field that needed fixing,
 * and on five of the six forms not even a live region (Timers had a
 * `role="status"`), so pressing "Log it" on a bad amount was silent to a
 * screen reader. The one field that did set `aria-invalid` (the proxy address
 * in Settings) still left its sentence unconnected, so a reader heard
 * "invalid entry" and never why.
 *
 * So there is one pattern, and `src/a11y/fielderror.test.ts` holds the tree
 * to it:
 *
 * - the box gets `aria-invalid="true"` only while it is wrong, and
 *   `aria-describedby` pointing at its hint (if any) and its message;
 * - the message lives in an element with an id that is **always in the
 *   document**, so the reference never dangles and a live region is already
 *   being watched when the text arrives;
 * - the message carries an icon and its words — never colour alone
 *   (WCAG 1.4.1) — and a visually hidden "Error:" so the description reads as
 *   one;
 * - on a submit that fails, focus moves to the first field that is wrong, in
 *   the order the form lists them, so a keyboard user lands where the fix is
 *   and hears the field, "invalid", and the description;
 * - the message region is a *polite* live region as well. Focus alone is not
 *   enough: pressing Enter in the Timers box fails with focus already in that
 *   box, `focus()` on the focused element fires nothing, and the reader said
 *   nothing — the `role="status"` it replaced did better. A reader may hear a
 *   moved-to field's error twice; that is the cheaper failure. Never
 *   `role="alert"`: the proxy address is validated per keystroke, and an
 *   assertive interruption per keystroke is worse than the silence it
 *   replaced.
 */

/** Whatever a form calls its fields, mapped to what is wrong with each. Empty string = fine. */
export type FieldProblems<K extends string> = Partial<Record<K, string>>;

/** The attributes a field's box needs, whatever the form. */
export function fieldProps(
  id: string,
  error: string | undefined,
  hintId?: string,
): { id: string; 'aria-invalid': true | undefined; 'aria-describedby': string } {
  return {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': [hintId, messageId(id)].filter(Boolean).join(' '),
  };
}

/** The id of the message that belongs to the box with this id. */
export function messageId(id: string): string {
  return `${id}-error`;
}

/**
 * The line under a field. Always rendered — empty when there is nothing wrong —
 * so `aria-describedby` never points at nothing and a live region is watched
 * before its text arrives.
 */
export function FieldMessage({
  id,
  error,
}: {
  /** The *box's* id; the message takes `messageId(id)`. */
  id: string;
  error: string | undefined;
}) {
  return (
    <p className="field-message" id={messageId(id)} aria-live="polite">
      {error ? (
        <>
          <svg
            className="field-message-icon"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 7v6" />
            <path d="M12 17h.01" />
          </svg>
          <span>
            <span className="sr-only">Error: </span>
            {error}
          </span>
        </>
      ) : null}
    </p>
  );
}

/**
 * The state a validating form keeps, and the moves it makes.
 *
 * `order` is the fields in the order they are on screen: it decides which one
 * takes focus when several are wrong at once.
 */
export function useFieldErrors<K extends string>(order: readonly K[]) {
  const base = useId();
  const [errors, setErrors] = useState<FieldProblems<K>>({});
  const boxes = useRef(new Map<K, HTMLElement>());
  // Which box to move to after a failed submit, and a count so two failures
  // in a row on the same box still move focus. Focus moves in an effect,
  // after the render that set `aria-invalid` and filled the message — so what
  // a reader hears on arriving is the new state, not the old one.
  const [focusing, setFocusing] = useState<{ on: K; n: number } | null>(null);

  useEffect(() => {
    if (focusing) boxes.current.get(focusing.on)?.focus();
  }, [focusing]);

  const idOf = useCallback((k: K) => `${base}-${k}`, [base]);

  /**
   * Run on submit. Records every problem at once, moves focus to the first,
   * and answers whether the form is clean — so a submit reads
   * `if (!fields.check({...})) return;`.
   */
  const check = (problems: FieldProblems<K>): boolean => {
    const kept: FieldProblems<K> = {};
    for (const k of Object.keys(problems) as K[]) if (problems[k]) kept[k] = problems[k];
    setErrors(kept);
    const first = order.find((k) => kept[k]) ?? (Object.keys(kept)[0] as K | undefined);
    if (first) setFocusing((was) => ({ on: first, n: (was?.n ?? 0) + 1 }));
    return first === undefined;
  };

  /** Forget one field's problem — on edit — or all of them. */
  const clear = useCallback((k?: K) => {
    setErrors((was) => {
      if (k === undefined) return Object.keys(was).length ? {} : was;
      if (!was[k]) return was;
      const next = { ...was };
      delete next[k];
      return next;
    });
  }, []);

  /** Spread onto the box. Its accessible name still goes on the box itself. */
  const control = (k: K, hintId?: string) => ({
    ...fieldProps(idOf(k), errors[k], hintId),
    ref: (node: HTMLElement | null) => {
      if (node) boxes.current.set(k, node);
      else boxes.current.delete(k);
    },
  });

  /** Spread onto the `<FieldMessage>` that belongs to that box. */
  const message = (k: K) => ({ id: idOf(k), error: errors[k] });

  /** Move focus to one field's box, for the summary's links. */
  const focusOn = useCallback((k: K) => boxes.current.get(k)?.focus(), []);

  /**
   * Spread onto `<ErrorSummary>`. `labels` is what each field is called to a
   * person; the items follow screen order, not the order the form wrote them.
   */
  const summary = (labels: Record<K, string>) => ({
    items: order.filter((k) => errors[k]).map((k) => ({ key: k, id: idOf(k), label: labels[k], message: errors[k] as string })),
    onPick: focusOn as (k: string) => void,
  });

  return { errors, check, clear, control, message, summary, focusOn };
}

/**
 * Every problem a failed submit found, in one place, each a link to its field.
 *
 * `FieldMessage` says what is wrong *at* a field, and focus lands on the first.
 * That serves someone who is moving through the form. It does not serve someone
 * who wants to know how much is wrong before they start, or who must get back
 * to the third field from the first without tabbing past the second — so with
 * two or more problems this lists them all.
 *
 * With one problem it draws nothing: focus is already on that field and its
 * message is in a live region, and a summary of one would say it a third time.
 *
 * It is not a live region and does not take focus. The first wrong field does
 * (`useFieldErrors.check`), and what a reader hears there already names the
 * problem; a second announcement from here would talk over it. A link moves
 * focus to the field it names; `preventDefault` because the fragment URL
 * would put `#…` in the address and, in a hash-routed app, change the route.
 */
export function ErrorSummary({
  items,
  onPick,
}: {
  items: readonly { key: string; id: string; label: string; message: string }[];
  onPick: (key: string) => void;
}) {
  const heading = useId();
  if (items.length < 2) return null;
  return (
    <section className="error-summary" aria-labelledby={heading}>
      <h3 id={heading} className="error-summary-title">
        {items.length} things need fixing
      </h3>
      <ul>
        {items.map((i) => (
          <li key={i.key}>
            <a
              href={`#${i.id}`}
              onClick={(e) => {
                e.preventDefault();
                onPick(i.key);
              }}
            >
              {i.label}: {i.message}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
