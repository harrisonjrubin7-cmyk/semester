import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { Page } from '../components/Page';
import { Notice } from '../components/ui';
import { RunAudit } from '../components/degreeaudit/RunAudit';
import { loadMyCapabilitiesOrThrow } from '../lib/capabilities';
import { useDegreeAuditAccess, modeSentence } from '../lib/degreeaudit/access';
import { degreeCapabilities, loadPrograms, myStudentRef } from '../lib/degreeaudit/client';
import type { Program } from '../lib/degreeaudit/model';

/**
 * Your school's degree audit, run on the school's own requirements and the
 * school's own academic record.
 *
 * `lib/degreeaudit/` and `20260930250000_degree_audit.sql` built it: a school
 * publishes a degree program for a catalog year, and the database audits one
 * student's record against it as of a date and keeps the answer, with who
 * asked and a fingerprint of what it read. It is a Core module (D-151): it
 * shows only at a school that has switched `degree_audit` to Core, read the way
 * the database reads it (`lib/modulemode.ts`). At every other school it says,
 * in one sentence, that the school's audit is still in its own system, and
 * stops.
 *
 * It is not The degree (`screens/Degree.tsx`), which is a calculator over
 * requirements a student types in, labelled as an estimate, and unchanged. The
 * two are kept apart on purpose: that one is the student's arithmetic, this is
 * the school's record, and nothing here reads or writes the other.
 *
 * Who sees what comes from the caller's own school grants. An account holding
 * `degree:audit` (a registrar, dean or academic advisor) types a student's
 * reference and chooses a program; anybody else audits only the record the
 * school linked to their account, and is told plainly if it has linked none.
 * When the school has published no program there is nothing to audit against,
 * and the screen says so rather than inventing requirements.
 */

export const BLURB = 'Your school’s own audit of a degree program’s requirements against its academic record, as of a date you choose. Not a transcript.';

export function DegreeAudit() {
  const access = useDegreeAuditAccess();
  const { dispatch } = useStore();
  const toCalculator = () => dispatch({ type: 'go', screen: 'degree' });

  if (access.status === 'loading') return <Page blurb={BLURB}><p role="status">Checking how your school runs its degree audit…</p></Page>;
  if (access.status === 'off') {
    return (
      <Page blurb={BLURB}>
        <Notice>The school’s degree audit needs an account, and this build is not connected to one. The calculator under The degree works without it.</Notice>
        <button type="button" className="btn" onClick={toCalculator}>Open The degree</button>
      </Page>
    );
  }
  if (access.status === 'signed_out' || access.status === 'no_school') {
    return (
      <Page blurb={BLURB}>
        <Notice>
          {access.status === 'signed_out'
            ? 'Sign in with your school account to see your school’s degree audit. It reads your school’s record, so Semester needs to know who you are first.'
            : 'Your account has no school yet, so there is no school audit to show. Claim your school from the Me tab.'}
        </Notice>
      </Page>
    );
  }
  if (access.status === 'error') {
    return (
      <Page blurb={BLURB}>
        <Notice alert>{access.message} Nothing has changed.</Notice>
        <button type="button" className="btn" onClick={access.retry}>Try again</button>
      </Page>
    );
  }
  const said = modeSentence(access.mode);
  if (access.mode.mode !== 'core' && !access.mode.frozen) {
    return (
      <Page blurb={BLURB}>
        <Notice>{said}</Notice>
        <button type="button" className="btn" onClick={toCalculator}>Open The degree</button>
      </Page>
    );
  }
  return (
    <Page blurb={BLURB}>
      {said && <Notice alert={access.mode.source === 'kill-switch'}>{said}</Notice>}
      <Loaded school={access.school} me={access.userId} writable={said === null} />
    </Page>
  );
}

interface Ready {
  staff: boolean;
  programs: Program[];
  ref: string | null;
}

function Loaded({ school, me, writable }: { school: string; me: string; writable: boolean }) {
  const [ready, setReady] = useState<Ready | null | 'error'>(null);
  const [reads, setReads] = useState(0);

  useEffect(() => {
    let live = true;
    (async () => {
      const grants = await loadMyCapabilitiesOrThrow();
      const staff = degreeCapabilities(grants, school).includes('degree:audit');
      const [programs, ref] = await Promise.all([loadPrograms(), staff ? Promise.resolve(null) : myStudentRef(me)]);
      return { staff, programs, ref } satisfies Ready;
    })().then(
      (r) => { if (live) setReady(r); },
      () => { if (live) setReady('error'); },
    );
    return () => { live = false; };
  }, [school, me, reads]);

  if (ready === 'error') {
    return (
      <>
        <Notice alert>Could not read your school’s degree programs or which record is yours. Nothing has changed. Try again in a moment.</Notice>
        <button type="button" className="btn" onClick={() => setReads((n) => n + 1)}>Try again</button>
      </>
    );
  }
  if (ready === null) return <p role="status">Reading your school’s degree programs…</p>;
  if (!ready.staff && ready.ref === null) {
    return (
      <Notice>
        Your school has not linked your account to its academic record, so there is no record for the audit to read. The school’s registrar makes that link; ask them if it is missing.
      </Notice>
    );
  }
  return <RunAudit studentRef={ready.staff ? null : ready.ref} programs={ready.programs} writable={writable} me={me} />;
}
