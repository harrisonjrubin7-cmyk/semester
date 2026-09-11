import { useEffect, useRef, useState } from 'react';
import {
  EVERYONE,
  FACES,
  mentionQuery,
  mentionable,
  withMention,
  type Who,
} from '../../lib/roomchat';
import { secondLine } from '../../lib/dim';

/**
 * The box you type into, and the two things that go in a message besides words.
 *
 * ## The toolbar is two buttons
 *
 * Every chat this is shaped like has a row of ten under the box — format,
 * attach, sticker, GIF, schedule, praise. Two of them can be honest here. A
 * mention is real: it changes what the other person sees, because their row in
 * the list grows an `@`. A face is real for the same reason. The rest would be
 * buttons that either do nothing or promise storage this app does not have —
 * see the note in `lib/cloud.ts` about what does not sync — and a disabled
 * paperclip is worse than no paperclip.
 *
 * ## Enter sends
 *
 * With shift for a new line, which is the arrangement every chat has and the
 * reason is worth stating: the common act is sending, and a common act should
 * not need a second key. A multi-line message is rare enough to cost one.
 *
 * ## The picker is a list, not a popup over the text
 *
 * It sits above the box rather than floating at the caret. At 390px a popup
 * anchored to a caret has nowhere to go — it covers either the text being
 * typed or the keyboard — and anchoring it properly means measuring the caret,
 * which is a font-metrics problem nobody should have in a class chat.
 */
export function Write({
  value,
  onChange,
  onSend,
  people,
  code,
  sending,
}: {
  value: string;
  onChange: (text: string) => void;
  onSend: () => void;
  /** Everybody in the room, for the `@` list. */
  people: Who[];
  /** The room's course code, for the placeholder. */
  code: string;
  sending: boolean;
}) {
  const box = useRef<HTMLTextAreaElement>(null);
  /** Where the caret was when the text last changed, for the `@` lookup. */
  const [caret, setCaret] = useState(0);
  const [faces, setFaces] = useState(false);
  /** Where the caret should go after a mention is chosen. */
  const put = useRef<number | null>(null);

  const asking = mentionQuery(value, caret);
  const offered = asking
    ? mentionable([...people, { user_id: EVERYONE, handle: EVERYONE }], asking.query)
    : [];

  // Setting `selectionStart` has to happen after React has written the new
  // value, or the browser puts the caret at the end of the old one.
  useEffect(() => {
    if (put.current === null) return;
    const at = put.current;
    put.current = null;
    box.current?.focus();
    box.current?.setSelectionRange(at, at);
    setCaret(at);
  }, [value]);

  const take = (handle: string) => {
    if (!asking) return;
    const next = withMention(value, asking.at, caret, handle);
    put.current = next.caret;
    onChange(next.text);
  };

  const insert = (text: string) => {
    const at = box.current?.selectionStart ?? value.length;
    put.current = at + text.length;
    onChange(value.slice(0, at) + text + value.slice(box.current?.selectionEnd ?? at));
  };

  return (
    <div style={{ flex: 'none' }}>
      {offered.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--sp-3)',
            paddingBottom: 'var(--sp-4)',
          }}
        >
          {offered.map((person) => (
            <button
              key={person.user_id}
              type="button"
              className="bare tap-y"
              onClick={() => take(person.handle)}
              style={{
                width: 'auto',
                height: 26,
                paddingLeft: 'var(--sp-5)',
                paddingRight: 'var(--sp-5)',
                borderRadius: 'var(--r-lg)',
                border: '1px solid var(--app-line)',
                background: 'var(--app-raise)',
                fontSize: 'var(--type-sm)',
              }}
            >
              @{person.handle}
            </button>
          ))}
        </div>
      )}

      {faces && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--sp-3)',
            paddingBottom: 'var(--sp-4)',
          }}
        >
          {FACES.map((face) => (
            <button
              key={face}
              type="button"
              className="bare tap"
              aria-label={`Put ${face} in the message`}
              onClick={() => {
                insert(face);
                setFaces(false);
              }}
              style={{
                width: 30,
                height: 30,
                borderRadius: 'var(--r-lg)',
                border: '1px solid var(--app-line)',
                background: 'var(--app-raise)',
                fontSize: 'var(--type-md)',
              }}
            >
              {face}
            </button>
          ))}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--sp-3)',
          border: '1px solid var(--app-line)',
          borderRadius: 'var(--r-lg)',
          background: 'var(--app-panel)',
          padding: 'var(--sp-4)',
        }}
      >
        <textarea
          ref={box}
          aria-label="Your message"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setCaret(e.target.selectionStart ?? e.target.value.length);
          }}
          onKeyUp={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
          onClick={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
            // An open picker takes Escape before the screen does, so the way
            // out of a list of names is not also the way out of the room.
            if (e.key === 'Escape' && (offered.length > 0 || faces)) {
              e.stopPropagation();
              setFaces(false);
              setCaret(0);
            }
          }}
          placeholder={`Say something to ${code}`}
          rows={2}
          style={{
            width: '100%',
            background: 'transparent',
            border: 0,
            outline: 'none',
            resize: 'vertical',
            color: 'var(--app-fg)',
            fontSize: 'var(--type-md)',
            lineHeight: 'var(--leading-relaxed)',
            minHeight: 44,
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
          <button
            type="button"
            className="bare tap"
            aria-label="Mention somebody in the class"
            onClick={() => insert('@')}
            style={{ width: 'auto', fontSize: 'var(--type-md)', ...secondLine() }}
          >
            @
          </button>
          <button
            type="button"
            className="bare tap"
            aria-label={faces ? 'Close the faces' : 'Put a face in the message'}
            aria-expanded={faces}
            onClick={() => setFaces((s) => !s)}
            style={{ width: 'auto', fontSize: 'var(--type-md)' }}
          >
            <span aria-hidden="true">🙂</span>
          </button>
          <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--type-xs)', ...secondLine() }}>
            Enter sends · Shift + Enter for a new line
          </span>
          <button
            type="button"
            className="btn btn-primary"
            disabled={sending || !value.trim()}
            onClick={onSend}
            style={{
              flex: 'none',
              height: 34,
              width: 'auto',
              paddingLeft: 'var(--sp-7)',
              paddingRight: 'var(--sp-7)',
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
