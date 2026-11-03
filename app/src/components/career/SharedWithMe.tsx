import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../../state/store';
import { cloudConfigured } from '../../lib/cloud';
import { EmptyState, Notice, SectionLabel } from '../ui';
import { ErrorState, LoadingState } from '../unity/States';
import { Row, Sub } from '../academic/Form';
import { formatDate, formatDateTime } from '../../lib/locale';
import { shortHash } from '../../lib/gradebook/submissions';
import { ObjectsError } from '../../lib/workspace/objects';
import { employerScopes, readEvidence, sharedWithMe, type EvidenceContent, type SharedWithMe as Share } from '../../lib/workspace/evidence';
import { ReadOnlyText } from '../workspace/shared';

/**
 * An employer's side of D-1670: what students have shared with this account,
 * read-only, in Career › Employers.
 *
 * Shown only to an account holding a live employer role (`employerScopes`).
 * That check decides what to offer and nothing more: the server re-checks the
 * role on every listing and every read, audits each one, and answers an ended,
 * withdrawn or unknown item the same way — "no such evidence here" — which
 * this screen says as "no longer shared with you". There are no grades here
 * in any form, because the server never sends any.
 */
export function SharedWithMe() {
  const { account } = useStore();
  const me = account?.id ?? '';
  const [scopes, setScopes] = useState<string[] | null>(null);

  useEffect(() => {
    if (!cloudConfigured || !me) return;
    let live = true;
    employerScopes().then((s) => { if (live) setScopes(s); });
    return () => { live = false; };
  }, [me]);

  if (!cloudConfigured || !me || !scopes || scopes.length === 0) return null;
  return <Shares scopes={scopes} />;
}

function Shares({ scopes }: { scopes: string[] }) {
  const [loaded, setLoaded] = useState<Share[] | null | Error>(null);
  const [reading, setReading] = useState<{ share: Share; item: string; got: EvidenceContent | null | Error } | null>(null);
  const head = useRef<HTMLHeadingElement>(null);

  const load = useCallback(() => {
    sharedWithMe().then(setLoaded, (e: unknown) => setLoaded(e instanceof Error ? e : new Error('Could not load what was shared with you.')));
  }, []);
  useEffect(load, [load]);

  useEffect(() => {
    if (reading?.got && !(reading.got instanceof Error)) head.current?.focus();
  }, [reading]);

  const open = (share: Share, item: string) => {
    setReading({ share, item, got: null });
    readEvidence(share.grant, item).then(
      (got) => setReading({ share, item, got }),
      (e: unknown) => setReading({ share, item, got: e instanceof Error ? e : new Error('Could not open it.') }),
    );
  };

  const title = <SectionLabel aside={`For ${scopes.join(', ')}`}>Shared with you</SectionLabel>;

  if (reading) {
    const back = (
      <button type="button" className="bare link-quiet tap-y" onClick={() => setReading(null)}>
        ← Everything shared with you
      </button>
    );
    const { got } = reading;
    if (got === null) {
      return (
        <>
          {title}
          {back}
          <LoadingState what="this piece of evidence" bars={[40, 200]} />
        </>
      );
    }
    if (got instanceof Error) {
      const gone = got instanceof ObjectsError && got.kind === 'refused';
      return (
        <>
          {title}
          {back}
          <ErrorState
            title={gone ? 'This is no longer shared with you' : 'It did not open'}
            body={
              gone
                ? 'A share ends on its date, when the student ends it or withdraws the item, or when this account stops acting for the employer.'
                : got.message
            }
            recover={{ label: 'Back to everything shared with you', run: () => { setReading(null); setLoaded(null); load(); } }}
          />
        </>
      );
    }
    return (
      <>
        {title}
        {back}
        <h3 ref={head} tabIndex={-1} style={{ overflowWrap: 'anywhere', marginBlock: 'var(--sp-4)' }}>
          {got.label}
        </h3>
        <Notice>
          Read only, shared by {reading.share.sharedAs} until {formatDate(new Date(reading.share.expiresAt))}. “{got.title}”, version {got.versionNumber}, saved{' '}
          {formatDateTime(new Date(got.savedAt))} — fingerprint {shortHash(got.sha256)}. This exact version does not change. Each time you open it, it is
          recorded.
        </Notice>
        <ReadOnlyText body={got.body} label={got.label} />
      </>
    );
  }

  if (loaded === null) {
    return (
      <>
        {title}
        <LoadingState what="what students shared with you" bars={[40, 96]} />
      </>
    );
  }
  if (loaded instanceof ObjectsError && loaded.kind === 'not-set-up') {
    return (
      <>
        {title}
        <Notice>Sharing evidence with employers is not set up on this Semester service yet, so nothing can be shared with you here.</Notice>
      </>
    );
  }
  if (loaded instanceof Error) {
    return (
      <>
        {title}
        <ErrorState title="What was shared with you did not load" body={loaded.message} recover={{ label: 'Load again', run: () => { setLoaded(null); load(); } }} />
      </>
    );
  }
  if (loaded.length === 0) {
    return (
      <>
        {title}
        <EmptyState
          inline
          title="Nothing is shared with you now"
          body="A student shares evidence with this account from their own Semester. Each share ends on its date, or sooner if the student ends it."
        />
      </>
    );
  }

  return (
    <>
      {title}
      <Sub>Read only. Each list and each item you open is recorded, and the students see who can read their evidence and until when.</Sub>
      <ul aria-label="Shares with you" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {loaded.map((s) => (
          <li key={s.grant} style={{ display: 'grid', gap: 'var(--sp-3)', paddingBlock: 'var(--sp-5)', borderBottom: '1px solid var(--app-line-soft)' }}>
            <h3 style={{ margin: 0, overflowWrap: 'anywhere' }}>{s.sharedAs}</h3>
            <Sub>
              <span style={{ overflowWrap: 'anywhere' }}>For {s.employerScope}: “{s.purpose}”.</span> Shared {formatDate(new Date(s.grantedAt))}, until{' '}
              {formatDate(new Date(s.expiresAt))}.
            </Sub>
            {s.evidence.length === 0 ? (
              <Sub>The student has withdrawn everything in this share.</Sub>
            ) : (
              <Row>
                {s.evidence.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    className="btn"
                    style={{ minHeight: 'var(--target-primary)', overflowWrap: 'anywhere', textAlign: 'start' }}
                    aria-label={`Read ${e.label}, ${e.title} version ${e.versionNumber}`}
                    onClick={() => open(s, e.id)}
                  >
                    {e.label}
                  </button>
                ))}
              </Row>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
