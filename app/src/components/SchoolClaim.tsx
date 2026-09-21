import { useEffect, useState } from 'react';
import { ActionButton, Notice, SectionLabel } from './ui';
import { useStore } from '../state/store';
import {
  claimSchool,
  claimedSchool,
  knownSchools,
  looksClaimable,
  type KnownSchool,
} from '../lib/schoolclaim';

/**
 * Telling the server which university you are at, rather than telling yourself.
 *
 * The app has always had a school, and it has always been a client-side fact:
 * `SchoolPicker` writes one into the device's own state, and the bundled
 * profile decides which screens exist and what a meal swipe is called. That is
 * the right shape for everything it does — none of it is a claim about anybody
 * but the person holding the phone.
 *
 * This is the other kind. `profiles.school_id` is what the *server* believes,
 * and the only way to set it is `claim_school()`, which reads the address the
 * account service confirmed rather than the one this screen was told. Nothing
 * here can admit anybody: if this file were replaced wholesale with something
 * that returned success to everything, no row would change.
 *
 * ## What it is worth today, said plainly on the screen
 *
 * Nothing reads `school_id` yet. No policy calls `same_school()`, so claiming
 * changes nothing a student can see this afternoon, and the screen says so
 * instead of implying a protection that is not switched on.
 *
 * It is still the right thing to ship now, and the order is the reason.
 * `20260921170000_schools.sql` spelled it out: every profile has `school_id`
 * null the moment it lands, so a policy that required a claimed school would
 * empty every room the instant it was applied — every student refused the
 * feature outright, which is the exact failure the migration before it was
 * written to end. Claims have to be collectable *before* the tightening or the
 * tightening cannot happen. A screen nobody has used yet is what makes the
 * later change deployable.
 *
 * ## Why the list can be empty, and why that is not a bug
 *
 * The schools table is seeded with nothing, deliberately — putting Vanderbilt
 * in the schema would put one university's name in a table every other
 * university has to live in. Universities are added operationally, by somebody
 * on the admin list. Until one is, this says so in a sentence rather than
 * showing an empty box.
 */
export function SchoolClaim() {
  const { account } = useStore();

  /** `null` while the first read is in flight, so "none" is never shown early. */
  const [schools, setSchools] = useState<KnownSchool[] | null>(null);
  const [claimed, setClaimed] = useState('');
  /** The id being claimed right now, or ''. One at a time, by construction. */
  const [claiming, setClaiming] = useState('');
  const [refused, setRefused] = useState('');

  useEffect(() => {
    // `alive` rather than a bare call, because both reads are network round
    // trips and this section is on a screen somebody can leave immediately.
    // Setting state on a component that is gone is a warning in development
    // and a leak in a long session.
    let alive = true;
    void (async () => {
      const [known, already] = await Promise.all([knownSchools(), claimedSchool()]);
      if (!alive) return;
      setSchools(known);
      setClaimed(already);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const claim = async (school: KnownSchool) => {
    setClaiming(school.id);
    setRefused('');
    const said = await claimSchool(school.id);
    // Read the column back rather than trusting the return. The value of this
    // column is that it cannot be bluffed, and a screen that reported its own
    // optimism would be the one place that could bluff it.
    if (said.ok) setClaimed(await claimedSchool());
    else setRefused(said.because);
    setClaiming('');
  };

  const address = account?.email ?? '';
  const mine = schools?.find((s) => s.id === claimed) ?? null;

  return (
    <section>
      <SectionLabel>Your university</SectionLabel>

      {claimed ? (
        <Notice>
          The server has you at <strong>{mine ? mine.name : claimed}</strong>, proved by the
          address it confirmed for this account. Nothing uses that yet — when rooms are
          limited to one university, this is what will put you inside rather than outside.
        </Notice>
      ) : schools === null ? (
        <Notice>Checking…</Notice>
      ) : schools.length === 0 ? (
        <Notice>
          No universities are set up on this server yet, so there is nothing to claim. This
          is added by an administrator rather than in the app, and the list appears here on
          its own once one exists.
        </Notice>
      ) : (
        <>
          <Notice>
            Claiming proves to the server which university you are at, using the address it
            already confirmed — not the one typed anywhere. It changes nothing you can see
            today. It is worth doing now because course rooms can only be limited to one
            university once the people in them have claimed.
          </Notice>

          {refused && <Notice alert>{refused}</Notice>}

          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {schools.map((school) => {
              const fits = address !== '' && looksClaimable(address, school);
              return (
                <li key={school.id} style={{ marginBlockEnd: 'var(--sp-4)' }}>
                  <div style={{ fontSize: 'var(--type-base)' }}>{school.name}</div>
                  <div
                    style={{
                      fontSize: 'var(--type-sm)',
                      color: 'var(--app-dim)',
                      lineHeight: 'var(--leading-normal)',
                      marginBlockStart: 'var(--sp-2)',
                    }}
                  >
                    {school.domains.length === 0
                      ? 'This one publishes no addresses yet, so nobody can claim it.'
                      : fits
                        ? `Your address is one ${school.shortName || school.name} publishes.`
                        : `Claimable with an address ending ${school.domains
                            .map((d) => `@${d}`)
                            .join(' or ')}.`}
                  </div>
                  <ActionButton
                    onClick={() => void claim(school)}
                    disabled={claiming !== '' || school.domains.length === 0}
                    style={{ marginBlockStart: 'var(--sp-3)' }}
                  >
                    {claiming === school.id ? 'Claiming…' : `Claim ${school.shortName || school.name}`}
                  </ActionButton>
                </li>
              );
            })}
          </ul>

          <p
            style={{
              fontSize: 'var(--type-sm)',
              color: 'var(--app-dim)',
              lineHeight: 'var(--leading-normal)',
            }}
          >
            The button is offered even where your address does not look right, because this
            screen is not the check. The server asks the same question of the address it
            confirmed, and its answer is the one that counts — including when it disagrees
            with the sentence above.
          </p>
        </>
      )}
    </section>
  );
}
