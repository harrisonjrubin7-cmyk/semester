import { useEffect, useState } from 'react';
import { Page } from '../components/Page';
import { EmptyState, Notice, SectionLabel } from '../components/ui';
import { AddApplicant } from '../components/admissions/AddApplicant';
import { ApplicantFile } from '../components/admissions/ApplicantFile';
import { loadMyCapabilitiesOrThrow } from '../lib/capabilities';
import { modeSentence, useCoreModuleAccess } from '../lib/admissions/access';
import { admissionsCapabilities, loadApplicants, loadLinks } from '../lib/admissions/client';
import type { AdmissionsCapability, Applicant, ApplicantLink } from '../lib/admissions/model';
import { STATUS_LABEL, byCycle, linkFor, tally } from '../lib/admissions/views';
import { ADMISSION_STATUSES } from '../lib/admissions/rules';

/**
 * Your school's admissions records: who applied, what status each application
 * is in, who recorded each change and why.
 *
 * `lib/admissions/` and `20260930270000_admissions_aid.sql` built it. It is a
 * Core module (D-151): it shows only at a school that has switched `admissions`
 * to Core, read the way the database reads it (`lib/modulemode.ts`). At every
 * other school it says, in one sentence, that the school's admissions are still
 * in its own system, and stops.
 *
 * It is the school's record of what happened, and nothing more. Semester does
 * not decide an admission, score an application, rank applicants or recommend
 * anyone: the page shows no figure about an applicant, and lists them by the
 * school's own reference so that no order can read as a ranking. An applicant is
 * not a student and has no account, so nobody but the staff who hold
 * `admissions:read` sees any of it; a student, an applicant and a member of
 * faculty see one sentence.
 */

export const BLURB = 'Your school’s own record of applications: the status of each, and who recorded every change and why. Semester decides nothing about an applicant.';

export function Admissions() {
  const access = useCoreModuleAccess('admissions');

  if (access.status === 'loading') return <Page blurb={BLURB}><p role="status">Checking how your school runs admissions…</p></Page>;
  if (access.status === 'off') {
    return (
      <Page blurb={BLURB}>
        <Notice>Admissions records need an account, and this build is not connected to one.</Notice>
      </Page>
    );
  }
  if (access.status === 'signed_out' || access.status === 'no_school') {
    return (
      <Page blurb={BLURB}>
        <Notice>
          {access.status === 'signed_out'
            ? 'Sign in with your school account to see your school’s admissions records.'
            : 'Your account has no school yet, so there are no admissions records to show. Claim your school from the Me tab.'}
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
  const said = modeSentence(access.mode, 'Admissions records');
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
  caps: AdmissionsCapability[];
  applicants: Applicant[];
  links: ApplicantLink[];
}

function Loaded({ school, me, writable }: { school: string; me: string; writable: boolean }) {
  const [ready, setReady] = useState<Ready | null | 'error'>(null);
  const [reads, setReads] = useState(0);
  const [shown, setShown] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const caps = admissionsCapabilities(await loadMyCapabilitiesOrThrow(), school);
      if (!caps.includes('admissions:read')) return { caps, applicants: [], links: [] } satisfies Ready;
      const [applicants, links] = await Promise.all([loadApplicants(), loadLinks()]);
      return { caps, applicants, links } satisfies Ready;
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
  }, [school, reads]);

  if (ready === 'error') {
    return (
      <>
        <Notice alert>Could not read the applicants. Nothing has changed. Try again in a moment.</Notice>
        <button type="button" className="btn" onClick={() => setReads((n) => n + 1)}>Try again</button>
      </>
    );
  }
  if (ready === null) return <p role="status">Reading the applicants…</p>;
  if (!ready.caps.includes('admissions:read')) {
    return (
      <Notice>
        This page is for the school’s admissions staff. An applicant is not yet a student and has no account here, so nobody else, a student included, reads an applicant file.
      </Notice>
    );
  }

  const groups = byCycle(ready.applicants);
  const chosen = ready.applicants.find((a) => a.id === shown) ?? null;
  const counts = tally(ready.applicants);
  return (
    <>
      <Notice>
        This is the school’s record of what happened. A person decides every admission and records it with their reason. Semester only keeps the record: it makes no decision and shows nothing about an applicant that a person did not record.
      </Notice>
      {ready.caps.includes('admissions:record') && (
        <AddApplicant cycles={groups.map((g) => g.cycle)} writable={writable} onAdded={() => setReads((n) => n + 1)} />
      )}
      <SectionLabel>Applicants</SectionLabel>
      {ready.applicants.length === 0 ? (
        <EmptyState inline title="No applicant is recorded yet" body="Applicants the school records appear here, by cycle, in the order of the school’s own references." />
      ) : (
        <>
          <p aria-label="Applicants by status">
            {ADMISSION_STATUSES.filter((s) => counts[s] > 0).map((s) => `${STATUS_LABEL[s]}: ${counts[s]}`).join(' · ')}
          </p>
          {groups.map((g) => (
            <section key={g.cycle} aria-label={`Cycle ${g.cycle}`}>
              <SectionLabel>{g.cycle}</SectionLabel>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {g.applicants.map((a) => (
                  <li key={a.id} style={{ paddingBlock: 'var(--sp-3)', borderBottom: '1px solid var(--app-line-soft)' }}>
                    <button type="button" className="btn" aria-pressed={a.id === shown} onClick={() => setShown(a.id === shown ? null : a.id)}>
                      {a.id === shown ? 'Hide' : 'Open'} {a.applicantRef}
                    </button>{' '}
                    {a.program} · {STATUS_LABEL[a.status]}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
      {chosen && (
        <ApplicantFile
          key={chosen.id}
          applicant={chosen}
          link={linkFor(chosen.id, ready.links)}
          caps={ready.caps}
          writable={writable}
          me={me}
          onChanged={() => setReads((n) => n + 1)}
        />
      )}
    </>
  );
}
