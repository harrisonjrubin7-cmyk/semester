import { useCallback, useEffect, useId, useState } from 'react';
import { useStore } from '../state/store';
import { Page } from '../components/Page';
import { Notice, SectionLabel } from '../components/ui';
import { Row, Stack, Sub } from '../components/academic/Form';
import { FieldMessage, useFieldErrors } from '../components/FieldMessage';
import { NotSigned } from '../components/transcripts/NotSigned';
import { IssuedList } from '../components/transcripts/IssuedList';
import { IssueForm, ReleaseForm } from '../components/transcripts/StaffForms';
import { CheckForm } from '../components/transcripts/CheckForm';
import { loadMyCapabilitiesOrThrow } from '../lib/capabilities';
import { useTranscriptAccess, modeSentence } from '../lib/transcripts/access';
import { loadDisclosures, loadTranscripts, myStudentRef, transcriptCapabilities } from '../lib/transcripts/client';
import type { Disclosure, Transcript, TranscriptCapability } from '../lib/transcripts/model';
import { studentRefProblem } from '../lib/transcripts/views';

/**
 * The transcripts your school has issued from its academic record, who they were
 * released to, and a way to check one you were given.
 *
 * `lib/transcripts/` and `20260930260000_transcripts.sql` built it: a registrar
 * issues a transcript for one student reference as of a date, the database keeps
 * the text and a SHA-256 of it, and every release is one line in a log nobody
 * can edit. It is a Core module (D-151): it shows only at a school that has
 * switched `records` to Core, read the way the database reads it
 * (`lib/modulemode.ts`). At every other school it says, in one sentence, that
 * the school's transcripts are still issued from its own system, and stops. A
 * check is the one thing offered everywhere, because it answers about any
 * school's transcript and needs only an account.
 *
 * It is not signed, and says so above everything else. A hash shows the text
 * was not changed after it was issued; it does not show who issued it. Signing
 * needs a key custody decision the owner has not made.
 *
 * Who sees what comes from the caller's own school grants. An account holding
 * `transcript:issue` types a student reference, issues, and logs releases; one
 * holding `transcript:read` (a dean) reads; anybody else reads only the record
 * the school linked to their account, and is told plainly if it has linked none.
 */

export const BLURB =
  'The transcripts your school has issued from its academic record, who they were released to, and a way to check one you were given. Not signed.';

export function Transcripts() {
  const access = useTranscriptAccess();
  const { dispatch } = useStore();
  const toGrades = () => dispatch({ type: 'go', screen: 'courses' });

  if (access.status === 'loading') {
    return (
      <Page blurb={BLURB}>
        <p role="status">Checking how your school runs its records…</p>
      </Page>
    );
  }
  if (access.status === 'off') {
    return (
      <Page blurb={BLURB}>
        <Notice>Issued transcripts need an account, and this build is not connected to one.</Notice>
      </Page>
    );
  }
  if (access.status === 'signed_out' || access.status === 'no_school') {
    return (
      <Page blurb={BLURB}>
        <Notice>
          {access.status === 'signed_out'
            ? 'Sign in with your school account to see the transcripts your school has issued. They are read from your school’s record, so Semester needs to know who you are first.'
            : 'Your account has no school yet, so there are no school transcripts to show. Claim your school from the Me tab.'}
        </Notice>
      </Page>
    );
  }
  if (access.status === 'error') {
    return (
      <Page blurb={BLURB}>
        <Notice alert>{access.message} Nothing has changed.</Notice>
        <button type="button" className="btn" onClick={access.retry}>
          Try again
        </button>
      </Page>
    );
  }
  const said = modeSentence(access.mode);
  if (access.mode.mode !== 'core' && !access.mode.frozen) {
    return (
      <Page blurb={BLURB}>
        <NotSigned />
        <Notice>{said}</Notice>
        <button type="button" className="btn" onClick={toGrades}>
          Open your courses
        </button>
        <SectionLabel>Check a transcript someone gave you</SectionLabel>
        <CheckForm />
      </Page>
    );
  }
  return (
    <Page blurb={BLURB}>
      <NotSigned />
      {said && <Notice alert={access.mode.source === 'kill-switch'}>{said}</Notice>}
      <Loaded school={access.school} me={access.userId} writable={said === null} />
      <SectionLabel>Check a transcript someone gave you</SectionLabel>
      <CheckForm />
    </Page>
  );
}

interface Ready {
  caps: TranscriptCapability[];
  ref: string | null;
}

function Loaded({ school, me, writable }: { school: string; me: string; writable: boolean }) {
  const [ready, setReady] = useState<Ready | null | 'error'>(null);
  const [reads, setReads] = useState(0);

  useEffect(() => {
    let live = true;
    (async () => {
      const caps = transcriptCapabilities(await loadMyCapabilitiesOrThrow(), school);
      const ref = caps.length > 0 ? null : await myStudentRef(me);
      return { caps, ref } satisfies Ready;
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
        <Notice alert>Could not read what you may see at your school, or which record is yours. Nothing has changed. Try again in a moment.</Notice>
        <button type="button" className="btn" onClick={() => setReads((n) => n + 1)}>
          Try again
        </button>
      </>
    );
  }
  if (ready === null) return <p role="status">Reading your school’s transcripts…</p>;
  if (ready.caps.length === 0) {
    if (ready.ref === null) {
      return (
        <Notice>
          Your school has not linked your account to its academic record, so there is no record to show transcripts of. The school’s registrar makes that link; ask them if it is missing.
        </Notice>
      );
    }
    return <Own />;
  }
  return <ForStaff canIssue={ready.caps.includes('transcript:issue')} writable={writable} />;
}

/** The two reads a list is made of. Used from event handlers and one effect. */
async function readFor(ref: string | null): Promise<{ transcripts: Transcript[]; disclosures: Disclosure[] }> {
  const [transcripts, disclosures] = await Promise.all([loadTranscripts(ref), loadDisclosures(ref)]);
  return { transcripts, disclosures };
}

/** A student's own transcripts and the releases of their own record. The database says which are theirs. */
function Own() {
  const [kept, setKept] = useState<{ transcripts: Transcript[]; disclosures: Disclosure[] } | null | string>(null);
  useEffect(() => {
    let live = true;
    readFor(null).then(
      (r) => {
        if (live) setKept(r);
      },
      (e: unknown) => {
        if (live) setKept(e instanceof Error ? e.message : 'Could not load your transcripts.');
      },
    );
    return () => {
      live = false;
    };
  }, []);
  if (kept === null) return <p role="status">Loading your transcripts…</p>;
  if (typeof kept === 'string') return <Notice alert>{kept} Nothing has changed.</Notice>;
  return <IssuedList transcripts={kept.transcripts} disclosures={kept.disclosures} who="yours" />;
}

/** Staff: issue, log releases, and read what was issued for a student reference they type. */
function ForStaff({ canIssue, writable }: { canIssue: boolean; writable: boolean }) {
  const fields = useFieldErrors(['ref'] as const);
  const refHint = useId();
  const [ref, setRef] = useState('');
  const [shownFor, setShownFor] = useState<string | null>(null);
  const [kept, setKept] = useState<{ transcripts: Transcript[]; disclosures: Disclosure[] } | null | string>(null);

  // `again` re-reads what is already on screen without blanking it, so the
  // answer a form just gave is not unmounted with the list it sat under.
  const show = useCallback(async (forRef: string, again = false) => {
    setShownFor(forRef);
    if (!again) setKept(null);
    try {
      setKept(await readFor(forRef));
    } catch (e) {
      setKept(e instanceof Error ? e.message : 'Could not load the transcripts.');
    }
  }, []);

  const ask = async () => {
    const forRef = ref.trim();
    if (!fields.check({ ref: studentRefProblem(forRef) ?? '' })) return;
    await show(forRef);
  };

  const refProps = fields.control('ref', refHint);
  return (
    <>
      {canIssue && <IssueForm writable={writable} onIssued={(forRef) => { setRef(forRef); void show(forRef); }} />}
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void ask();
        }}
      >
        <Stack label="Show what was issued for a student">
          <div>
            <label htmlFor={refProps.id}>Student reference to look up</label>
            <input
              {...refProps}
              aria-label="Student reference to look up"
              className="input"
              autoComplete="off"
              value={ref}
              onChange={(e) => {
                setRef(e.target.value);
                fields.clear('ref');
              }}
            />
            <Sub>
              <span id={refHint}>As your school writes it, such as S100.</span>
            </Sub>
            <FieldMessage {...fields.message('ref')} />
          </div>
          <Row>
            <button type="submit" className="btn">
              Show what was issued
            </button>
          </Row>
        </Stack>
      </form>
      {kept === null && shownFor !== null && <p role="status">Loading…</p>}
      {typeof kept === 'string' && <Notice alert>{kept} Nothing has changed.</Notice>}
      {kept !== null && typeof kept === 'object' && (
        <>
          <IssuedList transcripts={kept.transcripts} disclosures={kept.disclosures} who="theirs" />
          {canIssue && shownFor !== null && (
            <ReleaseForm transcripts={kept.transcripts} writable={writable} onLogged={() => void show(shownFor, true)} />
          )}
        </>
      )}
    </>
  );
}
