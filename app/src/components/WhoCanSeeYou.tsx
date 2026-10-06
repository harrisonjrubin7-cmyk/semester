import { useCallback, useEffect, useState } from 'react';
import { SectionLabel } from './ui';
import { ErrorState, LoadingState } from './unity/States';
import { dateFormatter } from '../lib/locale';
import { KIND_WORDS, loadAccessOverview, type AccessOverview } from '../lib/access-overview';
import type { Account } from '../lib/cloud';

type Load = { status: 'loading' } | { status: 'ready'; overview: AccessOverview } | { status: 'error' };

const LINE = { fontSize: 'var(--type-sm-plus)', lineHeight: 'var(--leading-relaxed)', textWrap: 'pretty' } as const;

const ends = (value: string) => dateFormatter({ dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

/**
 * Everyone who can see something of yours right now, one list, and where to end each.
 *
 * It reads and never changes anything: each door is closed on the screen that
 * opened it, and this says which one. A kind that could not be read is named as
 * unknown rather than left out, because an empty list that is really a failed
 * one tells a student nobody can see them.
 *
 * Signed out there is nothing to read, and the panel says so instead of
 * disappearing.
 */
export function WhoCanSeeYou({
  account,
  now = Date.now,
  read = loadAccessOverview,
}: {
  account: Account | null;
  now?: () => number;
  /** The read, handed in so a test does not need a network. */
  read?: (studentId: string, now: number) => Promise<AccessOverview>;
}) {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const id = account?.id ?? null;

  useEffect(() => {
    if (!id) return;
    let live = true;
    read(id, now())
      .then((overview) => live && setLoad({ status: 'ready', overview }))
      .catch(() => live && setLoad({ status: 'error' }));
    return () => {
      live = false;
    };
  }, [id, attempt, now, read]);

  const retry = useCallback(() => {
    setLoad({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  return (
    <section aria-labelledby="who-can-see-heading">
      <SectionLabel style={{ marginTop: 'calc(22px * var(--density, 1))', marginInline: '0', marginBottom: 'calc(5px * var(--density, 1))' }}>
        <span id="who-can-see-heading">Who can see your things</span>
      </SectionLabel>
      <p style={{ ...LINE, color: 'var(--app-dim)', marginBlock: '0 var(--sp-5)' }}>
        Everything you have opened to someone else and not yet closed. To end one, use the screen named under it.
      </p>

      {!id ? (
        <p role="status" style={{ ...LINE, margin: 0 }}>
          Sign in to see who has access.
        </p>
      ) : null}

      {id && load.status === 'loading' ? <LoadingState what="who can see your things" bars={[62, 62, 62]} /> : null}

      {id && load.status === 'error' ? (
        <ErrorState
          title="Could not check who has access"
          body="We could not read your sharing. That does not mean nobody has access, and nothing has changed. Try again."
          recover={{ label: 'Try again', run: retry }}
        />
      ) : null}

      {id && load.status === 'ready' ? (
        <>
          {load.overview.failed.length > 0 ? (
            <p role="alert" style={{ ...LINE, marginBlock: '0 var(--sp-5)' }}>
              <strong>Could not check:</strong> {load.overview.failed.map((k) => KIND_WORDS[k].label.toLowerCase()).join(', ')}. These
              may still be open.{' '}
              <button type="button" className="btn btn-ghost" onClick={retry}>
                Try again
              </button>
            </p>
          ) : null}
          {load.overview.entries.length === 0 && load.overview.failed.length === 0 ? (
            <p role="status" style={{ ...LINE, margin: 0 }}>
              Nobody can see anything of yours through sharing right now.
            </p>
          ) : null}
          {load.overview.entries.length > 0 ? (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {load.overview.entries.map((e) => (
                <li key={`${e.kind}:${e.id}`} style={{ paddingBlock: 'var(--sp-5)', borderBottom: '1px solid var(--app-line-soft)' }}>
                  <strong style={{ fontSize: 'var(--type-base-plus)' }}>{KIND_WORDS[e.kind].label}</strong>
                  <p style={{ ...LINE, marginBlock: 'var(--sp-4) var(--sp-2)' }}>{e.what}</p>
                  <p style={{ ...LINE, color: 'var(--app-dim)', margin: 0 }}>
                    {e.endsAt ? `Ends ${ends(e.endsAt)}.` : 'No end date.'} End it in {KIND_WORDS[e.kind].where}.
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
