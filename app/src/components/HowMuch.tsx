/**
 * How much study material to make, at what level, and how many cards.
 *
 * One component in both places material is generated — the syllabus pipeline
 * on Add a course, and Add a reading — because they make the same thing out of
 * the same model, and a student who wants shorter decks wants them from both.
 * Two copies of this would be two settings that disagree, which is the failure
 * `.claude/commands/simplify.md` exists to stop.
 *
 * ## Folded away by default
 *
 * The defaults are the app as it shipped and are right for almost everybody,
 * so this opens closed with its one line of state showing. A student who has
 * never thought about depth should not have to decide about it before they can
 * add a reading; a student who wants a shorter deck should not have to hunt
 * through Settings for it while looking at the reading.
 *
 * The arithmetic and every word that reaches the model are in
 * `lib/controls.ts`. This file only draws them.
 */

import { useStore } from '../state/store';
import { Folding } from './Fold';
import { SectionLabel, Segmented } from './ui';
import { secondLine } from '../lib/dim';
import { MOST_CARDS, capsFor, line, type Depth, type Level } from '../lib/controls';

export function HowMuch() {
  const { state, dispatch } = useStore();
  const c = state.controls;
  const caps = capsFor(c);

  return (
    <Folding name="HowMuch">
      <SectionLabel style={{ margin: 'calc(20px * var(--density, 1)) 0 calc(6px * var(--density, 1))' }}>
        How much to make
      </SectionLabel>

      <div
        style={{
          fontSize: 'calc(12.5px * var(--text-scale, 1))',
          opacity: 0.65,
          lineHeight: 'var(--leading-relaxed)',
          marginBottom: 9,
        }}
      >
        {line(c)}
      </div>

      <Segmented
        options={[
          { id: 'brief', label: 'Brief' },
          { id: 'standard', label: 'Usual' },
          { id: 'full', label: 'Thorough' },
        ]}
        value={c.depth}
        onChange={(depth: Depth) => dispatch({ type: 'setControls', patch: { depth } })}
        style={{ marginBottom: 'var(--sp-4)' }}
      />

      <Segmented
        options={[
          { id: 'plainer', label: 'Plainer' },
          { id: 'course', label: 'Course level' },
          { id: 'harder', label: 'Harder' },
        ]}
        value={c.level}
        onChange={(level: Level) => dispatch({ type: 'setControls', patch: { level } })}
        style={{ marginBottom: 'var(--sp-4)' }}
      />

      <div style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'center' }}>
        <input
          className="input"
          type="number"
          min={0}
          max={MOST_CARDS}
          value={c.cards}
          aria-label="How many cards at most"
          onChange={(e) =>
            dispatch({
              type: 'setControls',
              patch: { cards: Math.max(0, Math.min(MOST_CARDS, Math.round(Number(e.target.value)))) },
            })
          }
          style={{ width: 90, flex: 'none' }}
        />
        <span style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.6, lineHeight: 'var(--leading-normal)' }}>
          {/* Zero is the default and is not "no cards" — said here rather than
              left to be discovered by typing it and getting a full deck. */}
          {c.cards === 0
            ? `cards — leave at zero for as many as the material supports, which is up to ${caps.cards}`
            : `cards at most, whatever the depth says`}
        </span>
      </div>

      <div
        style={{
          fontSize: 'var(--type-xs)',
          ...secondLine(),
          marginTop: 11,
          lineHeight: 'var(--leading-normal)',
        }}
      >
        Every one of these is a ceiling, never a quota: a thin reading returns three cards whatever
        you ask for. Harder means asking more of the material, not inventing material to ask about —
        nothing here loosens the rule that everything must come from the text.
      </div>
    </Folding>
  );
}
