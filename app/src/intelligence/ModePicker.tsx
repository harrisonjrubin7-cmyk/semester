import { useId } from 'react';
import { effectiveIntegrityMode, type IntegrityMode, type IntegrityPolicy } from './contracts';

/**
 * What each mode does, in the words a student would use.
 *
 * Read off `lib/socratic.ts`, which is what the mode actually changes in the
 * prompt — so this line cannot promise more than the tutor paragraph does.
 * Five pills with a one-word name each were the old picker, and "Review" or
 * "Draft" alone left a student guessing whether the assistant would rewrite
 * or send anything. The description of the chosen one is always on screen.
 */
export const MODE_HELP: Record<IntegrityMode, { label: string; help: string }> = {
  explain: { label: 'Explain', help: 'Explains the idea plainly and directly.' },
  hint: { label: 'Hint', help: 'Gives one hint at a time and leaves the next step to you.' },
  practice: { label: 'Practice', help: 'Sets you one question at a time and waits for your answer.' },
  review: { label: 'Review', help: 'Checks your own work or reasoning without rewriting it.' },
  draft: {
    label: 'Draft',
    help: 'Helps you plan and revise your own writing. It never writes or sends a submission.',
  },
};

const ORDER: IntegrityMode[] = ['explain', 'hint', 'practice', 'review', 'draft'];

/**
 * How the assistant should help: one choice of five, as a radio group.
 *
 * Native radios inside a fieldset rather than five toggle buttons. A group of
 * `aria-pressed` buttons says "five switches", and a screen reader offers them
 * as five independent things; this is one choice, and radios are what say so —
 * arrow keys move between them, Tab enters and leaves the group once, and the
 * legend names the question. A mode the course policy does not allow is
 * `disabled` and the reason is printed under the group, so the boundary is
 * explained rather than only greyed.
 */
export function IntegrityModePicker({
  requested,
  policy,
  onChange,
}: {
  requested: IntegrityMode;
  policy: IntegrityPolicy;
  onChange: (mode: IntegrityMode) => void;
}) {
  const decision = effectiveIntegrityMode(requested, policy);
  const name = useId();
  const helpId = `${name}-help`;
  const current = decision.effective;
  return (
    <fieldset className="mode-picker" aria-describedby={helpId}>
      <legend className="mode-picker-legend">How it helps</legend>
      <div className="mode-picker-row">
        {ORDER.map((id) => {
          const allowed = policy.allowed.includes(id);
          return (
            <label key={id} className="mode-picker-option" data-disabled={allowed ? undefined : ''}>
              <input
                type="radio"
                className="sr-only"
                name={name}
                value={id}
                checked={current === id}
                disabled={!allowed}
                onChange={() => onChange(id)}
              />
              <span>{MODE_HELP[id].label}</span>
            </label>
          );
        })}
      </div>
      <p id={helpId} className="mode-picker-help" aria-live="polite">
        {current ? MODE_HELP[current].help : 'No help mode is available for this course.'}
        {decision.restricted && decision.reason ? ` ${decision.reason}` : ''}
      </p>
    </fieldset>
  );
}
