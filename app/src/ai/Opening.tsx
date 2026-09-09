import { useAI } from './store';

/**
 * A new conversation, which is not a blank page.
 *
 * One component, drawn on both surfaces, for the same reason there is one
 * `Turns.tsx` and one `Composer.tsx`: the first screen of a chat is the screen
 * a student sees most often, and having the sheet greet you with four naked
 * buttons while the tab greeted you with a sentence and a disclosure made them
 * read as two different assistants.
 *
 * What it says: what it can see, three or four things worth asking from the
 * screen you came from, and one line about what it can do. The suggestions
 * come from that screen's own provider, so they are about what is actually on
 * it rather than a fixed list that would be wrong four screens out of five.
 */
export function Opening({
  onPick,
  tight = false,
  big = false,
}: {
  onPick: (q: string) => void;
  tight?: boolean;
  /**
   * The full-screen reading of it: a greeting the size of a greeting.
   *
   * The sheet's copy is a panel over a screen and its first line is one line
   * of a stack — `tight` is that. The tab has the window to itself and the
   * opening is centred in it, where a 14px sentence floating in the middle of
   * a phone reads as a caption for something missing. Same words, same three
   * suggestions, same disclosure; the difference is only how much room the
   * surface has to give them.
   */
  big?: boolean;
}) {
  const ai = useAI();
  const suggestions = ai.suggestions().slice(0, 4);

  /*
   * What it is looking at — unless the answer is this page.
   *
   * The sheet's version of this line is the point of the sheet: it comes up
   * over Grades and says so, because the question you are about to ask is
   * about what is behind it. On the tab there is nothing behind it, and the
   * first draft printed "You are on Chat." — the assistant telling you that
   * you have opened the assistant. So there the line says what it can see
   * rather than where you are, which is the thing that was actually worth
   * saying.
   */
  const seen = ai.screen === 'ask' ? null : ai.look().label;

  return (
    <div style={{ marginBottom: tight ? 'var(--sp-7)' : 'calc(var(--sp-7) * 1.6)' }}>
      <div
        style={{
          fontSize: big ? 'var(--type-xl)' : tight ? 'var(--type-lg)' : 'var(--type-md)',
          fontFamily: big ? 'var(--font-display)' : undefined,
          lineHeight: 'var(--leading-tight)',
          textWrap: 'pretty',
          marginBottom: big ? 'var(--sp-3)' : undefined,
        }}
      >
        {seen ? `You are on ${seen}.` : 'Ask about your term.'}
      </div>
      {suggestions.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--sp-4)',
            marginTop: big ? 'var(--sp-7)' : 'var(--sp-6)',
          }}
        >
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              className="btn btn-secondary"
              onClick={() => onPick(s)}
              style={{
                height: 'auto',
                // A thumb, not a hairline. 10px of padding was fine as a row
                // in a stack of rows; as the only thing on an empty screen a
                // suggestion is the thing you are being invited to tap.
                padding: big ? 'var(--sp-6) var(--sp-7)' : 'var(--sp-5) var(--sp-6)',
                textAlign: 'left',
                justifyContent: 'flex-start',
                fontSize: big ? 'var(--type-md)' : 'var(--type-sm)',
                lineHeight: 'var(--leading-normal)',
                // Round, to match the composer they are a shortcut to.
                borderRadius: big ? '16px' : undefined,
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <div
        style={{
          fontSize: 'var(--type-xs)',
          opacity: 0.5,
          lineHeight: 'var(--leading-normal)',
          marginTop: 'var(--sp-6)',
          textWrap: 'pretty',
        }}
      >
        {seen ? 'It sees what this screen is showing, your ' : 'It sees your '}
        deadlines and your grades — never your notes, your drafts or anyone in People. It can offer
        to change something, and nothing happens until you tap it.
      </div>
    </div>
  );
}
