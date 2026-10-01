import { useEffect, useId, useState } from 'react';
import { Page } from '../components/Page';
import { EmptyState, Notice, SectionLabel } from '../components/ui';
import { Row, Sub } from '../components/academic/Form';
import { FieldMessage, useFieldErrors } from '../components/FieldMessage';
import { AwardFile } from '../components/aid/AwardFile';
import { RecordAward } from '../components/aid/RecordAward';
import { StudentAid } from '../components/aid/StudentAid';
import { loadMyCapabilitiesOrThrow } from '../lib/capabilities';
import { modeSentence, useCoreModuleAccess } from '../lib/admissions/access';
import { aidCapabilities, loadAwards, myStudentRef } from '../lib/aid/client';
import type { AidCapability, Award } from '../lib/aid/model';
import { awardLine, studentRefProblem } from '../lib/aid/views';

/**
 * Financial-aid records: the awards a school has recorded, their history, and
 * what has been disbursed.
 *
 * `lib/aid/` and `20260930270000_admissions_aid.sql` built it. It is a Core
 * module (D-151): it shows only at a school that has switched `financial_aid` to
 * Core, read the way the database reads it (`lib/modulemode.ts`). At every other
 * school it says, in one sentence, that the school's aid records are still in
 * its own system, and stops.
 *
 * It records; it determines nothing. There is no needs analysis, no packaging,
 * no federal form and no payment: a person at the school records an award and
 * what was paid out, a second person approves a large one, and a disbursement
 * may name the student-account aid credit it matches. A member of aid staff
 * (`aid:read`) types a student reference and reads that student's awards; a
 * student reads only their own, through the link the school made on the academic
 * record, and nothing about an applicant.
 */

export const BLURB = 'Your school’s own record of aid awards and what has been paid out against them. It records what the school decided; it decides nothing, and no money moves here.';

export function Aid() {
  const access = useCoreModuleAccess('financial_aid');

  if (access.status === 'loading') return <Page blurb={BLURB}><p role="status">Checking how your school runs financial-aid records…</p></Page>;
  if (access.status === 'off') {
    return (
      <Page blurb={BLURB}>
        <Notice>Aid records need an account, and this build is not connected to one.</Notice>
      </Page>
    );
  }
  if (access.status === 'signed_out' || access.status === 'no_school') {
    return (
      <Page blurb={BLURB}>
        <Notice>
          {access.status === 'signed_out'
            ? 'Sign in with your school account to see your aid awards.'
            : 'Your account has no school yet, so there are no aid records to show. Claim your school from the Me tab.'}
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
  const said = modeSentence(access.mode, 'Aid records');
  if (access.mode.mode !== 'core' && !access.mode.frozen) {
    return (
      <Page blurb={BLURB}>
        <Notice>{said}</Notice>
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
  caps: AidCapability[];
  ref: string | null;
}

function Loaded({ school, me, writable }: { school: string; me: string; writable: boolean }) {
  const [ready, setReady] = useState<Ready | null | 'error'>(null);
  const [reads, setReads] = useState(0);

  useEffect(() => {
    let live = true;
    (async () => {
      const caps = aidCapabilities(await loadMyCapabilitiesOrThrow(), school);
      const staff = caps.includes('aid:read');
      return { staff, caps, ref: staff ? null : await myStudentRef(me) } satisfies Ready;
    })().then(
      (r) => {
        if (live) setReady(r);
      },
      () => {
        if (live) setReady('error');
      },
    );
    return () => {
      live = false;
    };
  }, [school, me, reads]);

  if (ready === 'error') {
    return (
      <>
        <Notice alert>Could not read your aid records or which record is yours. Nothing has changed. Try again in a moment.</Notice>
        <button type="button" className="btn" onClick={() => setReads((n) => n + 1)}>Try again</button>
      </>
    );
  }
  if (ready === null) return <p role="status">Reading your aid records…</p>;
  if (!ready.staff && ready.ref === null) {
    return (
      <Notice>
        Your school has not linked your account to its academic record, so there is no aid record for you here. The school’s registrar makes that link; ask them if it is missing.
      </Notice>
    );
  }
  return ready.staff ? <Staff caps={ready.caps} writable={writable} me={me} /> : <StudentAid studentRef={ready.ref ?? ''} />;
}

function Staff({ caps, writable, me }: { caps: AidCapability[]; writable: boolean; me: string }) {
  const fields = useFieldErrors(['ref'] as const);
  const hint = useId();
  const [ref, setRef] = useState('');
  const [looking, setLooking] = useState<string | null>(null);
  const [awards, setAwards] = useState<Award[] | null | string>(null);
  const [shown, setShown] = useState<string | null>(null);

  const show = async (forRef: string, keep = false) => {
    if (!keep) {
      setAwards(null);
      setShown(null);
    }
    try {
      setAwards(await loadAwards(forRef));
      setLooking(forRef);
    } catch (e) {
      setAwards(e instanceof Error ? e.message : 'Could not load the awards.');
    }
  };
  const submit = () => {
    const t = ref.trim();
    if (!fields.check({ ref: studentRefProblem(t) ?? '' })) return;
    void show(t);
  };
  const refProps = fields.control('ref', hint);
  const chosen = Array.isArray(awards) ? awards.find((a) => a.id === shown) ?? null : null;

  return (
    <>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label htmlFor={refProps.id}>Student reference</label>
        <input
          {...refProps}
          aria-label="Student reference"
          className="input"
          autoComplete="off"
          value={ref}
          onChange={(e) => {
            setRef(e.target.value);
            fields.clear('ref');
          }}
        />
        <Sub>
          <span id={hint}>The identifier your school’s academic record uses for the student, such as S100.</span>
        </Sub>
        <FieldMessage {...fields.message('ref')} />
        <Row>
          <button type="submit" className="btn btn-primary">Show this student’s awards</button>
        </Row>
      </form>

      {typeof awards === 'string' && <Notice alert>{awards} Nothing has changed.</Notice>}
      {looking !== null && Array.isArray(awards) && (
        <>
          <SectionLabel>Awards for {looking}</SectionLabel>
          {awards.length === 0 && <EmptyState inline title="No award is recorded" body="No award is recorded for that reference, or you cannot read the ones that are." />}
          <ul aria-label="Awards" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {awards.map((a) => (
              <li key={a.id} style={{ paddingBlock: 'var(--sp-3)', borderBottom: '1px solid var(--app-line-soft)' }}>
                <button type="button" className="btn" aria-pressed={a.id === shown} onClick={() => setShown(a.id === shown ? null : a.id)}>
                  {a.id === shown ? 'Hide' : 'Open'} {a.fundName}
                </button>{' '}
                {awardLine(a)}
              </li>
            ))}
          </ul>
          {caps.includes('aid:record') && <RecordAward studentRef={looking} writable={writable} onDone={() => void show(looking, true)} />}
        </>
      )}
      {chosen && <AwardFile key={chosen.id} award={chosen} caps={caps} writable={writable} me={me} onChanged={() => looking && void show(looking, true)} />}
    </>
  );
}
