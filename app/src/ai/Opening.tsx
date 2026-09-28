import { useAI } from './store';
import { assemble, suggestionsFor } from './assemble';
import { useNow, useStore } from '../state/store';
import { upcomingItems } from '../lib/select';

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
  const suggestions = suggestionsFor(ai).slice(0, 4);

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
  const seen = ai.screen === 'ask' ? null : assemble(ai).label;
  const { catalog } = useStore();
  const now = useNow();
  const courses = catalog.courses.length;
  const soon = upcomingItems(catalog, now).filter((i) => i.daysAway <= 14).length;

  return (
    <div style={{ marginBottom: tight ? 'var(--sp-7)' : 'calc(var(--sp-7) * 1.6)' }}>
      {/*
        A question, not a slogan.

        This was "Ask about your term." in the display serif — a second page
        title under the header's own, and a decoration rather than an
        invitation. The operational type and a question that names the job
        is the pattern every other empty state here follows.
      */}
      <h2
        style={{
          margin: 0,
          fontSize: big ? 'var(--type-xl)' : tight ? 'var(--type-lg)' : 'var(--type-md)',
          fontWeight: 600,
          lineHeight: 'var(--leading-tight)',
          textWrap: 'pretty',
          marginBottom: big ? 'var(--sp-3)' : undefined,
        }}
      >
        {seen ? `You are on ${seen}.` : 'What can I help you with?'}
      </h2>
      {!seen && (
        <div style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)', lineHeight: 'var(--leading-normal)' }}>
          Explain course material, plan your study time, practice a concept or work on a draft you
          review.
        </div>
      )}
      {suggestions.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--sp-3)',
            marginTop: 'var(--sp-6)',
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
                padding: big ? 'var(--sp-5) var(--sp-7)' : 'var(--sp-5) var(--sp-6)',
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
      {/*
        What it can see, as a tray rather than a sentence of small print.

        The old line was right and too quiet: one grey paragraph under the
        suggestions that nobody read, and nothing to open. The summary line
        says what is in scope now, with numbers; the details say what is never
        in scope, and that nothing changes until you confirm it.
      */}
      <div className="ask-context" role="group" aria-label="What Semester Intelligence can see">
        <div className="ask-context-line">
          <span className="ask-context-kicker">Uses</span>{' '}
          {seen ? 'this screen · ' : ''}
          {courses} {courses === 1 ? 'course' : 'courses'} · {soon}{' '}
          {soon === 1 ? 'deadline' : 'deadlines'} in the next two weeks · your grades
        </div>
        <details className="ask-context-more">
          <summary>What it can and cannot see</summary>
          <ul>
            <li>
              It can see {seen ? 'what this screen is showing, ' : ''}your courses, deadlines and
              grades.
            </li>
            <li>It never sees your notes, your drafts or anyone in People.</li>
            <li>It can offer to change something. Nothing happens until you tap to confirm.</li>
          </ul>
        </details>
      </div>
    </div>
  );
}
