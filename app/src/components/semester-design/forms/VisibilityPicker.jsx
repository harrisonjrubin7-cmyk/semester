import React, { useId } from 'react';
const AUDIENCES = [
  { id: 'only-me', label: 'Only me', about: 'Nobody else can see it.' },
  { id: 'course', label: 'Course', about: 'People enrolled in the course it is attached to.' },
  { id: 'collaborators', label: 'Selected collaborators', about: 'Only the people you add by name.' },
  { id: 'portfolio', label: 'Public portfolio', about: 'Anyone with the link to your portfolio.' },
];
const ORIGIN = { 'student-entered': 'Entered by you', 'institution-provided': 'Provided by your institution', 'connected-system': 'From a system you connected' };
/** "Who can see this?" — the one privacy pattern, same four answers in every module. Only offers audiences the module can honour. */
export function VisibilityPicker({ value = 'only-me', onChange, allowed = ['only-me', 'course', 'collaborators', 'portfolio'], locked = false, origin = 'student-entered', onLearnMore }) {
  const name = useId(); const chosen = AUDIENCES.find((a) => a.id === value) || AUDIENCES[0];
  return (
    <div className="visibility">
      {locked ? <p className="visibility-said"><span className="kicker">Who can see this</span>{chosen.label} — {chosen.about}</p> : (
        <fieldset><legend className="kicker" style={{ marginBottom: 'var(--sp-2)' }}>Who can see this?</legend>
          {AUDIENCES.filter((a) => allowed.includes(a.id)).map((a) => (
            <label key={a.id} className="choice"><input type="radio" name={name} checked={value === a.id} onChange={() => onChange && onChange(a.id)} /><span>{a.label}<span className="choice-about">{a.about}</span></span></label>
          ))}
        </fieldset>
      )}
      <p className="visibility-said"><span className="kicker">Data source</span>{ORIGIN[origin]} · <button type="button" className="link-quiet" onClick={onLearnMore}>Learn more</button></p>
    </div>
  );
}
