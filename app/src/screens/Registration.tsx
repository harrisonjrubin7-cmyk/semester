import { useEffect, useState } from 'react';
import { useNow, useStore } from '../state/store';
import { Page } from '../components/Page';
import { EmptyState, Notice, TabList } from '../components/ui';
import { ModuleGateState } from '../components/ModuleGateState';
import { PilotFactMark } from '../components/PilotFactMark';
import { ASK_LABEL, noteSupportAsk } from '../lib/supporthandoff';
import { Field } from '../components/academic/Form';
import { StudentRegistration } from '../components/enrollment/StudentRegistration';
import { RegistrarDesk } from '../components/enrollment/RegistrarDesk';
import { useModuleGate } from '../lib/modulegate';
import { loadMyCapabilitiesOrThrow, type Grant } from '../lib/capabilities';
import { FLAG } from '../lib/enrollment/service';
import { REGISTRAR_CAPABILITY, holdsRegistrar, loadTerms, type TermCalendar } from '../lib/enrollment/client';
import { termOf } from '../lib/gradebook/client';

/**
 * Enrollment: the official registration transaction, for a person.
 *
 * `lib/enrollment/` and `20260929300000_registration_transaction.sql` built
 * the ledger — enroll, the waitlist, drop, withdraw, holds, approvals and
 * overrides — behind `writeback.registration_submit`. This is the screen that
 * drives it. It is not the Registration planner (`yes`, `RegistrationPortal`):
 * the planner is the student's own cart and registration-day plan, kept on
 * their device, and it is shown here only as a marker beside the live section
 * it names. Nothing here writes to it.
 *
 * The gate is the first thing, because it is closed at every school today:
 * the screen asks the database the two questions its writers ask
 * (`lib/modulegate.ts`) and, when the answer is off, says so in one sentence
 * and stops. There is no preview, and no stub behind it.
 *
 * The registrar's half is offered only when `my_capabilities` says the caller
 * holds `registration:administer` over this school; the database refuses
 * every registrar write to anyone else regardless.
 */

export const BLURB = 'Enroll, join a waitlist, drop or withdraw in your school’s registration, and see whether a hold is in the way.';

const OFF =
  'Your school has not turned on registration in Semester, so enrolling, dropping and withdrawing still happen in your school’s own registration system — your plan on the Registration screen is unaffected.';

type View = 'mine' | 'registrar';

/** The term to open on: the first whose withdrawal deadline has not passed, else the newest. */
export function openingTerm(terms: readonly TermCalendar[], now: Date): TermCalendar | null {
  const current = [...terms]
    .filter((t) => Date.parse(t.withdrawEndsAt) >= now.getTime())
    .sort((a, b) => Date.parse(a.opensAt) - Date.parse(b.opensAt));
  return current[0] ?? terms[0] ?? null;
}

export function Registration() {
  const gate = useModuleGate(FLAG, REGISTRAR_CAPABILITY);
  const { dispatch } = useStore();
  if (gate.status !== 'on') {
    return (
      <Page blurb={BLURB}>
        <ModuleGateState gate={gate} what="registration" off={OFF} />
        {gate.status === 'off' && (
          <>
            <section aria-labelledby="readiness-gaps">
              <h2 id="readiness-gaps" className="sr-only">What Semester can see</h2>
              <PilotFactMark surface="registration" seeded={false} />
              <ul>
                <li>Registration window: unavailable. Semester cannot see whether one is open.</li>
                <li>Hold: unavailable. Semester cannot see whether a hold is in the way.</li>
                <li>Section: unavailable. Semester cannot see seats or meeting times.</li>
              </ul>
            </section>
            <button type="button" className="btn" onClick={() => dispatch({ type: 'go', screen: 'yes' })}>
              Open your registration plan
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                noteSupportAsk('registration_readiness');
                dispatch({ type: 'go', screen: 'help' });
              }}
            >
              {ASK_LABEL}
            </button>
          </>
        )}
      </Page>
    );
  }
  return (
    <Page blurb={BLURB}>
      <Desk school={gate.school} />
    </Page>
  );
}

function Desk({ school }: { school: string }) {
  const now = useNow();
  const [grants, setGrants] = useState<Grant[] | null | string>(null);
  const [grantReads, setGrantReads] = useState(0);
  const [terms, setTerms] = useState<TermCalendar[] | null | string>(null);
  const [term, setTerm] = useState('');
  const [view, setView] = useState<View>('mine');
  const [reads, setReads] = useState(0);

  useEffect(() => {
    let live = true;
    // A failed read is not "no capabilities": a registrar whose check failed
    // is told so and can ask again, rather than silently losing the desk.
    loadMyCapabilitiesOrThrow().then((g) => { if (live) setGrants(g); }, (e: unknown) => { if (live) setGrants(e instanceof Error ? e.message : 'Could not check your staff permissions.'); });
    return () => { live = false; };
  }, [grantReads]);

  useEffect(() => {
    let live = true;
    loadTerms().then(
      (t) => {
        if (!live) return;
        setTerms(t);
        setTerm((was) => (was && t.some((x) => x.term === was) ? was : (openingTerm(t, new Date())?.term ?? '')));
      },
      (e: unknown) => { if (live) setTerms(e instanceof Error ? e.message : 'Could not load the registration calendar.'); },
    );
    return () => { live = false; };
  }, [reads]);

  if (typeof terms === 'string') {
    return (
      <>
        <Notice alert>{terms} Nothing has changed. Try again, or use your school’s own registration system.</Notice>
        <button type="button" className="btn" onClick={() => setReads((n) => n + 1)}>
          Load again
        </button>
      </>
    );
  }
  if (terms === null || grants === null) return <p role="status">Loading your registration…</p>;

  const grantsFailed = typeof grants === 'string';
  const registrar = !grantsFailed && holdsRegistrar(grants, school);
  const calendar = terms.find((t) => t.term === term) ?? null;
  // A registrar with no term yet still needs the desk, to create one.
  const deskTerm = term || termOf(now);

  return (
    <>
      {grantsFailed && (
        <>
          <Notice alert>{grants} If you work in the registrar’s office, its views stay hidden until this loads.</Notice>
          <button type="button" className="btn" onClick={() => { setGrants(null); setGrantReads((n) => n + 1); }}>
            Check again
          </button>
        </>
      )}
      {registrar && (
        <TabList
          label="Enrollment views"
          value={view}
          onChange={setView}
          tabs={[
            { id: 'mine', label: 'Your registration' },
            { id: 'registrar', label: 'Registrar' },
          ]}
        />
      )}
      {terms.length > 1 && (
        <Field label="Term">
          {(ids) => (
            <select id={ids.id} aria-describedby={ids.hint} className="input" value={term} onChange={(e) => setTerm(e.target.value)}>
              {terms.map((t) => (
                <option key={t.term} value={t.term}>
                  {t.term}
                </option>
              ))}
            </select>
          )}
        </Field>
      )}
      {view === 'registrar' && registrar ? (
        <RegistrarDesk key={deskTerm} term={deskTerm} calendar={calendar} onTermSaved={() => setReads((n) => n + 1)} />
      ) : terms.length === 0 ? (
        <EmptyState
          title="No registration term yet"
          body="Your registrar has not opened a term in Semester. Your plan on the Registration screen is unaffected, and this fills in when they do."
        />
      ) : (
        <StudentRegistration key={term} term={term} calendar={calendar} />
      )}
    </>
  );
}
