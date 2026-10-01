import { AGENTS } from '../../../packages/institution/src/agents';
import { useLive } from './live';
import { useAI } from './store';
import { assemble, suggestionsFor } from './assemble';
import { useNow, useStore } from '../state/store';
import { upcomingItems } from '../lib/select';
import type { HelpState } from './converse';

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
  help = { kind: 'ready' },
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
  /** Whether help is available; a course ban trims the starters to planning. */
  help?: HelpState;
}) {
  const ai = useAI();
  const { agent } = useLive();
  const starters = {
    advisor: ['Help me compare academic options', 'Prepare questions for my advisor', 'What needs official advisor review?'],
    tutor: ['Ask me a guiding question about this concept', 'Give me a similar practice problem', 'Help me prepare an office-hours question'],
    'course-guide': ['Explain this course’s AI policy', 'What are this week’s learning objectives?', 'Where can I find course support?'],
  };
  const suggestions = agent === 'assistant' ? suggestionsFor(ai).slice(0, 4) : starters[agent];

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

  /*
   * The starters, less any that could not be answered here.
   *
   * A course whose AI policy bans help with its work still gets planning
   * help, so the planning starters stay and the rest go: a suggestion is an
   * invitation, and one that is going to be refused should not be offered.
   */
  const offered = help.kind === 'course-off' ? suggestions.filter((s) => PLANNING.has(s)) : suggestions;

  return (
    <div className="ask-opening" style={{ marginBottom: tight ? 'var(--sp-7)' : 'calc(var(--sp-7) * 1.6)' }}>
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
        {seen ? `You are on ${seen}.` : 'What would you like help with?'}
      </h2>
      {!seen && (
        <p className="ask-opening-lede">
          {AGENTS[agent].question} I use the context allowed for this role and prepare drafts you review.
        </p>
      )}
      {/*
        What it can see, before what to ask it.

        It used to come last, under the suggestions, as a grey sentence — so a
        student was invited to ask before being told what the answer could be
        drawn from. Context first: what is in use now, and a disclosure for
        what is never used and that nothing changes until you confirm.
      */}
      <div className="ask-context" role="group" aria-label="What Semester Intelligence can see">
        <div className="ask-context-line">
          <span className="ask-context-kicker">Using right now</span>
          <span>
            {agent === 'assistant' && seen ? 'this screen · ' : ''}
            {courses} {courses === 1 ? 'course' : 'courses'} · {soon}{' '}
            {soon === 1 ? 'deadline' : 'deadlines'} in the next two weeks
          </span>
        </div>
        <details className="ask-context-more">
          <summary>What it can and cannot see</summary>
          <ul>
            <li>
              It uses role-scoped context: planning for the Assistant, selected course material for learning roles, and approved sources at your institution. Grades and attendance are excluded from automatic context.
            </li>
            <li>It never sees your notes, your drafts or anyone in People.</li>
            <li>It is not your registrar: it cannot change your official record.</li>
            <li>It can offer to change something. Nothing happens until you tap to confirm.</li>
          </ul>
        </details>
      </div>
      {offered.length > 0 && (
        <>
          <h3 className="ask-starters-label">Suggested starting points</h3>
          <div className={`ask-starters${big ? ' is-grid' : ''}`}>
            {offered.map((s) => (
              <button key={s} type="button" className="ask-starter" onClick={() => onPick(s)}>
                <span className="ask-starter-q">{s}</span>
                {USES[s] && <span className="ask-starter-uses">{USES[s]}</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** The starters that are planning rather than coursework, which a course ban leaves standing. */
const PLANNING = new Set<string>(['What is due this week?', 'Help me plan my week']);

/**
 * What each Ask-tab starter reads, said under it.
 *
 * Every suggestion has an input and an output; this is the input, so a
 * student can see what the answer will be built from before tapping. Only
 * the term-wide starters have one — a screen's own suggestions are about the
 * screen, and the opening already says it is looking at it.
 */
const USES: Record<string, string> = {
  'What is due this week?': 'Uses your deadlines and calendar',
  'What should I study next?': 'Uses your courses and what is coming up',
  'Help me plan my week': 'Uses your calendar — nothing changes until you confirm',
  'Prepare questions for my advisor': 'Uses your courses and your saved plan',
};
