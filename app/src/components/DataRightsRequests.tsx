import { useCallback, useEffect, useState } from 'react';
import type { Account } from '../lib/cloud';
import {
  DATA_RIGHT_COPY,
  DATA_RIGHT_KINDS,
  DATA_RIGHT_STATUS,
  fileDataRightRequest,
  isOpen,
  loadDataRightRequests,
  type DataRightKind,
  type DataRightRequest,
} from '../lib/data-rights';
import { dateFormatter } from '../lib/locale';
import { ErrorState } from './unity/States';
import { Notice, SectionLabel } from './ui';

const date = (value: string) => dateFormatter({ dateStyle: 'medium' }).format(new Date(value));

export function DataRightsRequests({ account }: { account: Account | null }) {
  const [items, setItems] = useState<DataRightRequest[]>([]);
  const [kind, setKind] = useState<DataRightKind>('correction');
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    if (!account) return;
    setBusy(true);
    try {
      setItems(await loadDataRightRequests());
      setLoadError('');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load your requests.');
    } finally {
      setBusy(false);
    }
  }, [account]);

  // This is an account-backed queue, not render-derived state.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);

  const open = items.filter(isOpen);
  const closed = items.filter((item) => !isOpen(item));

  return (
    <section aria-labelledby="data-rights-heading" style={{ marginTop: 'var(--sp-7)' }}>
      <SectionLabel>Your privacy requests</SectionLabel>
      <h2 id="data-rights-heading" style={{ fontSize: 'var(--type-xl)', marginBlock: 'var(--sp-3)' }}>
        Ask, track, and keep the answer
      </h2>
      <p style={{ color: 'var(--app-dim)', lineHeight: 'var(--leading-relaxed-plus)' }}>
        File a formal access, correction, restriction, or assisted-erasure request. Semester records
        the request and its thirty-day due date. Filing does not silently change or delete anything;
        a person reviews it, and the final status and explanation stay visible here.
      </p>

      {!account ? (
        <Notice>Sign in to file or track a request about your account. Device-only data never reached Semester’s server.</Notice>
      ) : (
        <>
          {loadError && (
            <ErrorState
              title="Could not load privacy requests"
              body={loadError}
              recover={{ label: 'Try again', run: () => void refresh() }}
              busy={busy}
            />
          )}
          {notice && <Notice>{notice}</Notice>}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setBusy(true);
              setNotice('');
              void fileDataRightRequest(kind, detail)
                .then(async ({ item, created }) => {
                  setDetail('');
                  await refresh();
                  setNotice(created
                    ? `Request received. Its current due date is ${date(item.dueAt)}.`
                    : `You already have an open ${DATA_RIGHT_COPY[item.kind].label.toLowerCase()}. No duplicate was filed.`);
                })
                .catch((error: unknown) => setNotice(error instanceof Error ? error.message : 'The request could not be filed.'))
                .finally(() => setBusy(false));
            }}
            style={{ display: 'grid', gap: 'var(--sp-4)', marginBlock: 'var(--sp-5)' }}
          >
            <label>
              Request type
              <select className="input" value={kind} onChange={(event) => setKind(event.target.value as DataRightKind)}>
                {DATA_RIGHT_KINDS.map((value) => <option key={value} value={value}>{DATA_RIGHT_COPY[value].label}</option>)}
              </select>
            </label>
            <p style={{ color: 'var(--app-dim)', margin: 0 }}>{DATA_RIGHT_COPY[kind].help}</p>
            <label>
              What should the reviewer know? <span style={{ color: 'var(--app-dim)' }}>(optional)</span>
              <textarea
                className="input"
                maxLength={1000}
                value={detail}
                onChange={(event) => setDetail(event.target.value)}
                aria-describedby="data-rights-detail-help"
              />
            </label>
            <p id="data-rights-detail-help" style={{ color: 'var(--app-dim)', margin: 0 }}>
              Do not include passwords, payment details, medical information, or another person’s records. {detail.length}/1,000 characters.
            </p>
            <button className="btn btn-primary btn-block" disabled={busy}>
              {busy ? 'Working…' : 'File this request'}
            </button>
          </form>

          {open.length === 0 && !busy && !loadError && <p role="status">You have no open privacy requests.</p>}
          {open.length > 0 && <SectionLabel aside={`${open.length}`}>Open requests</SectionLabel>}
          {open.map((item) => (
            <article key={item.id} className="portal-panel" style={{ marginBlock: 'var(--sp-4)' }}>
              <strong>{DATA_RIGHT_COPY[item.kind].label}</strong>
              <p>{DATA_RIGHT_STATUS[item.status]} · received {date(item.receivedAt)} · due {date(item.dueAt)}</p>
              {item.detail && <p style={{ color: 'var(--app-dim)' }}>Your note: {item.detail}</p>}
            </article>
          ))}

          {closed.length > 0 && (
            <details style={{ marginTop: 'var(--sp-5)' }}>
              <summary>Completed and refused requests · {closed.length}</summary>
              {closed.map((item) => (
                <article key={item.id} style={{ marginBlock: 'var(--sp-4)' }}>
                  <strong>{DATA_RIGHT_COPY[item.kind].label}</strong>
                  <p>{DATA_RIGHT_STATUS[item.status]}{item.resolvedAt ? ` · ${date(item.resolvedAt)}` : ''}</p>
                  {item.resolution && <p>{item.resolution}</p>}
                </article>
              ))}
            </details>
          )}
        </>
      )}
    </section>
  );
}
