import { useEffect, useRef, type KeyboardEvent } from 'react';
import { TOUCH, useMedia } from '../lib/media';

/**
 * The box you type into, on both surfaces.
 *
 * One component because the sheet and the full chat have to agree about what
 * Enter does. Two composers drift, and the way that drift shows up is somebody
 * losing half a question to a key that sent it on one screen and did not on
 * the other.
 *
 * ## Enter is not the same key everywhere
 *
 * With a hardware keyboard, Enter sends and Shift+Enter breaks the line: that
 * is what every other box like this does, and a chat where you have to reach
 * for the mouse to send is a chat people abandon.
 *
 * On a touch keyboard there is no Shift+Enter. Making Enter send there means
 * a two-sentence question is impossible to type, so on touch Enter breaks the
 * line and the button is the only way to send. The placeholder says which one
 * you are getting, because a box that sends on Enter without warning eats the
 * first half of somebody's question and they do not try again.
 */
export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  onRecall,
  busy,
  placeholder,
  autoFocus = false,
}: {
  value: string;
  onChange: (next: string) => void;
  onSend: () => void;
  onStop: () => void;
  /**
   * Put the last question back in the box, for Up in an empty one.
   *
   * The terminal gesture, and the one people try in a chat box without being
   * told: you asked something slightly wrong and want to fix three words of
   * it rather than retype the sentence. Both surfaces pass it — they are two
   * views of one conversation, so the last question is the same question on
   * either. Still optional, for a caller with nothing behind the box.
   */
  onRecall?: () => string | null;
  busy: boolean;
  placeholder: string;
  autoFocus?: boolean;
}) {
  const box = useRef<HTMLTextAreaElement>(null);
  const touch = useMedia(TOUCH);

  /*
   * Grown by measuring, not by counting newlines.
   *
   * Counting `\n` was the first version and it is wrong for the commonest
   * case: a long question with no newlines in it wraps to four lines and the
   * count says one. Setting the height to `scrollHeight` asks the browser how
   * tall the text actually is, which is the only thing that knows about
   * wrapping, the reader's type size and their line height at once.
   */
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = 'auto';
    // Eight lines, then it scrolls inside itself rather than eating the
    // conversation above it.
    const line = parseFloat(getComputedStyle(el).lineHeight) || 20;
    const max = line * 8 + 20;
    el.style.height = `${Math.min(max, el.scrollHeight)}px`;
    el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden';
  }, [value]);

  useEffect(() => {
    if (autoFocus) box.current?.focus();
  }, [autoFocus]);

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    /*
     * Up, in an empty box, brings back the last question.
     *
     * Only when the box is empty: in a box with anything in it Up moves the
     * caret, and a key that jumps the caret to the top on a four-line
     * question would be worse than not having this at all.
     */
    if (e.key === 'ArrowUp' && !value && onRecall && !busy) {
      const last = onRecall();
      if (last) {
        e.preventDefault();
        onChange(last);
      }
      return;
    }
    if (e.key !== 'Enter' || e.shiftKey || e.altKey || touch) return;
    e.preventDefault();
    if (!busy && value.trim()) onSend();
  };

  return (
    /*
     * One rounded field with the button inside it, rather than a rectangle
     * with a button parked on top.
     *
     * The old shape was a `.input` at the app's 6px radius with the send
     * button absolutely positioned over its bottom-right corner, which is
     * what a search box looks like. A composer is the one control on the
     * screen you are meant to reach for, and every chat anybody has used
     * draws it as a single pill: the field, the button and the ring around
     * them are one object, and the focus ring goes round the whole thing
     * rather than round the text area inside it.
     *
     * The class does the drawing (`.ai-composer` in `styles/app.css`) so the
     * ring, the hover and the three grounds are stated once in the same place
     * as every other control's, rather than as inline styles that only this
     * component knows how to keep in step with the themes.
     */
    <div className="ai-composer">
      <textarea
        ref={box}
        id="ai-composer"
        className="input ai-composer-field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKey}
        rows={1}
        placeholder={placeholder}
        // A real label, not a placeholder standing in for one: the placeholder
        // is gone the moment there is any text in the box, and a screen reader
        // that reaches the field mid-question would otherwise find it unnamed.
        aria-label="Your question"
        style={{
          margin: 0,
          resize: 'none',
          fontSize: 'var(--type-sm)',
          lineHeight: 'var(--leading-relaxed)',
        }}
      />
      <button
        type="button"
        className="btn btn-primary ai-send"
        // Never disabled while answering — Stop has to be reachable, including
        // by keyboard, and a disabled button is not.
        disabled={busy ? false : !value.trim()}
        onClick={() => (busy ? onStop() : onSend())}
        aria-label={busy ? 'Stop answering' : 'Send your question'}
      >
        <span aria-hidden>{busy ? '■' : '↑'}</span>
      </button>
    </div>
  );
}

/** What the placeholder should say, given how Enter behaves here. */
export function sendHint(touch: boolean): string {
  return touch ? 'Enter for a new line — the arrow sends' : 'Enter sends, Shift+Enter for a new line';
}
