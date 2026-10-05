import { useId } from 'react';
import { useStore } from '../../state/store';
import { closeOverlay } from '../../lib/unity';

export type Audience = 'only-me' | 'course' | 'collaborators' | 'portfolio';

export const AUDIENCES: { id: Audience; label: string; about: string }[] = [
  { id: 'only-me', label: 'Only me', about: 'Nobody else can see it.' },
  { id: 'course', label: 'Course', about: 'People enrolled in the course it is attached to.' },
  { id: 'collaborators', label: 'Selected collaborators', about: 'Only the people you add by name.' },
  { id: 'portfolio', label: 'Public portfolio', about: 'Anyone with the link to your portfolio.' },
];

export type DataOrigin = 'student-entered' | 'institution-provided' | 'connected-system';

const ORIGIN_SAID: Record<DataOrigin, string> = {
  'student-entered': 'Entered by you',
  'institution-provided': 'Provided by your institution',
  'connected-system': 'From a system you connected',
};

/**
 * Who can see this — the one privacy pattern.
 *
 * The same question, the same four answers and the same "Learn more" in every
 * module, so a student learns it once. `allowed` is how a module says which
 * audiences it can actually honour: a choice this build has no way to carry
 * out is not offered, rather than offered and silently ignored. `locked`
 * draws the statement alone, for places where the answer is fixed.
 *
 * Presentation only. Choosing an audience here never grants access by
 * itself — the module that owns the data decides, under its own rules.
 */
export function Visibility({
  value,
  onChange,
  allowed = ['only-me'],
  locked = false,
  origin = 'student-entered',
}: {
  value: Audience;
  onChange?: (a: Audience) => void;
  allowed?: Audience[];
  locked?: boolean;
  origin?: DataOrigin;
}) {
  const { dispatch } = useStore();
  const name = useId();
  const chosen = AUDIENCES.find((a) => a.id === value) ?? AUDIENCES[0];
  return (
    <div className="visibility">
      {locked ? (
        <p className="visibility-said">
          <span className="kicker">Who can see this</span> {chosen.label} — {chosen.about}
        </p>
      ) : (
        <fieldset className="visibility-choices">
          <legend className="kicker">Who can see this?</legend>
          {AUDIENCES.filter((a) => allowed.includes(a.id)).map((a) => (
            <label key={a.id} className="visibility-choice">
              <input
                type="radio"
                name={name}
                value={a.id}
                checked={value === a.id}
                onChange={() => onChange?.(a.id)}
              />
              <span>
                {a.label}
                <span className="visibility-about">{a.about}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
      <p className="visibility-said">
        <span className="kicker">Data source</span> {ORIGIN_SAID[origin]} ·{' '}
        <button type="button" className="bare link-quiet tap-y" onClick={() => {
            closeOverlay();
            dispatch({ type: 'go', screen: 'privacy' });
          }}>
          Learn more
        </button>
      </p>
    </div>
  );
}
