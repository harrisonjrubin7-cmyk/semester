import { useEffect, useState } from 'react';
import { SectionLabel } from './ui';
import { myAgeStatus, stateMyAge, type AgeStatus } from '../lib/cloud';
import { MINIMUM_AGE, SAID, standing, todayIso } from '../lib/age';

/**
 * The one time an account made without a birth date is asked for it.
 *
 * Accounts made through Google, Microsoft, Apple, institution SSO or LTI never
 * saw the sign-up form, so the database does not know whether they are a
 * minor. This asks once; `state_my_age` takes the first answer and refuses a
 * second, so a minor cannot later say otherwise. Afterwards it shows the
 * standing — never the date, which is not kept.
 *
 * The rules are the database's (`20260929150000_minimum_age.sql`); this only
 * explains them. The two calls are props so the test can hand it fakes.
 */
export function AgeStatement({
  status: readStatus = myAgeStatus,
  state = stateMyAge,
}: {
  status?: () => Promise<AgeStatus>;
  state?: typeof stateMyAge;
} = {}) {
  const [status, setStatus] = useState<AgeStatus | null>(null);
  const [bornOn, setBornOn] = useState('');
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState('');

  useEffect(() => {
    let live = true;
    readStatus()
      .then((s) => live && setStatus(s))
      // A read that fails says nothing rather than asking a question it cannot record.
      .catch(() => live && setStatus(null));
    return () => {
      live = false;
    };
  }, [readStatus]);

  if (status === null || status === 'adult') return null;

  if (status === 'minor') {
    return (
      <div style={{ marginTop: 'var(--sp-7)' }}>
        <SectionLabel>Under 18</SectionLabel>
        <p style={{ fontSize: 'var(--type-base)', color: 'var(--app-dim)', lineHeight: 'var(--leading-relaxed-plus)' }}>{SAID.minor}</p>
      </div>
    );
  }

  if (status === 'under_minimum') {
    return (
      <div style={{ marginTop: 'var(--sp-7)' }}>
        <SectionLabel>Under {MINIMUM_AGE}</SectionLabel>
        <p style={{ fontSize: 'var(--type-base)', color: 'var(--app-dim)', lineHeight: 'var(--leading-relaxed-plus)' }}>
          Semester accounts are for people {MINIMUM_AGE} and over, so nothing that involves other people is available on
          this one. Everything on this device keeps working, and you can delete the account below.
        </p>
      </div>
    );
  }

  const send = async () => {
    const age = standing(bornOn, todayIso());
    if (age === 'invalid') {
      setSaid(SAID.invalid);
      return;
    }
    setBusy(true);
    setSaid('');
    try {
      const got = await state(bornOn);
      setStatus(got === 'under_minimum_age' ? 'under_minimum' : got === 'already_stated' ? await readStatus() : got);
    } catch (e) {
      setSaid(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginTop: 'var(--sp-7)' }}>
      <SectionLabel>Your date of birth</SectionLabel>
      <p style={{ fontSize: 'var(--type-base)', color: 'var(--app-dim)', lineHeight: 'var(--leading-relaxed-plus)' }}>
        This account was made without one. Semester asks once, because features where other people can find or message you
        are for people 18 and over, and they stay off until you answer. The date itself is not kept, and it cannot be
        changed later.
      </p>
      <label htmlFor="age-born" className="sr-only">
        Date of birth
      </label>
      <input
        className="input"
        id="age-born"
        type="date"
        autoComplete="bday"
        max={todayIso()}
        value={bornOn}
        onChange={(e) => setBornOn(e.target.value)}
        style={{ fontSize: 'var(--type-md)', marginTop: 'var(--sp-3)' }}
      />
      <button
        type="button"
        className="btn btn-block"
        disabled={busy || !bornOn}
        onClick={() => void send()}
        style={{ marginTop: 'var(--sp-3)' }}
      >
        {busy ? 'Saving…' : 'Save'}
      </button>
      {said && (
        <p role="alert" style={{ fontSize: 'var(--type-sm)', marginTop: 'var(--sp-3)' }}>
          {said}
        </p>
      )}
    </div>
  );
}
