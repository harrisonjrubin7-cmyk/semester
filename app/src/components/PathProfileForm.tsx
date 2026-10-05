import { useState } from 'react';
import { useDeviceLibrary } from '../lib/device-library';
import {
  EMPTY_PATH_PROFILE,
  MAX_GOALS,
  PATH_PROFILE_PREFIX,
  SEASONS,
  readPathProfile,
  type PathProfile,
  type Season,
} from '../lib/path-profile';
import { useStore } from '../state/store';

/** The profile for whoever is signed in on this device, or the device itself. */
export function usePathProfile() {
  const { account } = useStore();
  return useDeviceLibrary(`${PATH_PROFILE_PREFIX}:${account?.id || 'device'}`, readPathProfile, EMPTY_PATH_PROFILE);
}

const field = { display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', fontSize: 'var(--type-sm)' } as const;

/**
 * Programme, target term, credits needed and goals — all optional.
 *
 * Used in two places: collapsed on the onboarding step that already asks for
 * term and school, and on My Path. Saving is explicit: a half-typed year is
 * not stored as a target.
 */
export function PathProfileForm({ onSaved }: { onSaved?: () => void }) {
  const library = usePathProfile();
  const p = library.value;
  const [programme, setProgramme] = useState(p.programme);
  const [season, setSeason] = useState<Season | ''>(p.targetTerm?.season ?? '');
  const [year, setYear] = useState(p.targetTerm ? String(p.targetTerm.year) : '');
  const [credits, setCredits] = useState(p.creditTarget ? String(p.creditTarget) : '');
  const [goals, setGoals] = useState(p.goals.join('\n'));
  const [said, setSaid] = useState('');

  const save = () => {
    const y = Number(year);
    const c = Number(credits);
    const next: PathProfile = {
      version: 1,
      programme,
      targetTerm: season && Number.isInteger(y) && y >= 2000 && y <= 2100 ? { season, year: y } : null,
      creditTarget: credits.trim() && Number.isFinite(c) && c >= 1 && c <= 400 ? Math.round(c) : null,
      goals: goals.split('\n').map((g) => g.trim()).filter(Boolean).slice(0, MAX_GOALS),
      updatedAt: Date.now(),
    };
    const warn = [
      season && !next.targetTerm ? 'the target year was not a year between 2000 and 2100' : '',
      credits.trim() && next.creditTarget === null ? 'credits needed must be a number from 1 to 400' : '',
    ].filter(Boolean);
    if (!library.update(next)) {
      setSaid('That could not be saved on this device.');
      return;
    }
    setSaid(warn.length ? `Saved, except: ${warn.join('; ')}.` : 'Saved on this device.');
    onSaved?.();
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}
    >
      {library.error && <p role="alert">{library.error}</p>}
      <label style={field}>
        Programme or major
        <input className="input" value={programme} onChange={(e) => setProgramme(e.target.value)} maxLength={200} placeholder="For example, Economics BA" />
      </label>
      <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
        <legend style={{ fontSize: 'var(--type-sm)', marginBottom: 'var(--sp-2)' }}>When you hope to graduate</legend>
        <select className="input" aria-label="Graduation season" value={season} onChange={(e) => setSeason(e.target.value as Season | '')}>
          <option value="">Not sure yet</option>
          {SEASONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input className="input" aria-label="Graduation year" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} placeholder="Year" style={{ maxWidth: '8em' }} />
      </fieldset>
      <label style={field}>
        Credits your degree needs, from your audit
        <input className="input" inputMode="numeric" value={credits} onChange={(e) => setCredits(e.target.value)} placeholder="Leave blank if you do not know" style={{ maxWidth: '16em' }} />
      </label>
      <label style={field}>
        Goals, one per line (up to {MAX_GOALS})
        <textarea className="input" rows={3} value={goals} onChange={(e) => setGoals(e.target.value)} maxLength={1000} />
      </label>
      <div style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="submit" className="btn btn-secondary">Save path details</button>
        {said && <span role="status" style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)' }}>{said}</span>}
      </div>
    </form>
  );
}
