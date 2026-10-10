import { useEffect, useId, useMemo, useState } from 'react';
import { EmptyState, Notice, SectionLabel } from '../ui';
import { ErrorState, LoadingState, PermissionNotice } from '../unity/States';
import {
  loadOperationsWorkItem,
  loadOperationsWorkItems,
  transitionOperationsWorkItem,
  type OperationsWorkItem,
  type OperationsWorkItemAction,
  type OperationsWorkItemEnvelope,
  type OperationsWorkItemTransition,
} from '../../lib/console/client';
import { Fields, WriteNotice, inScope, matches, said, when, type ViewProps } from './Fields';

const RESPONSIVE_COLUMNS = 'repeat(auto-fit, minmax(min(100%, 19rem), 1fr))';

interface OperationsInboxProps extends ViewProps {
  readList?: (mine?: boolean) => Promise<OperationsWorkItemEnvelope<OperationsWorkItem[]>>;
  readDetail?: (itemId: string) => Promise<OperationsWorkItemEnvelope<OperationsWorkItem>>;
  transition?: (input: OperationsWorkItemTransition) => Promise<OperationsWorkItemEnvelope<OperationsWorkItem>>;
}

const denied = (value: string) => /required|permission|denied|not authorized|unavailable in this grant scope/i.test(value);
const conflict = (value: string) => /changed|conflict|40001|authoritative version/i.test(value);

export function OperationsInbox({
  env,
  scope,
  filter,
  onStatus,
  privileged,
  readList = loadOperationsWorkItems,
  readDetail = loadOperationsWorkItem,
  transition = transitionOperationsWorkItem,
}: OperationsInboxProps) {
  const detailId = useId();
  const [mine, setMine] = useState(false);
  const [list, setList] = useState<OperationsWorkItemEnvelope<OperationsWorkItem[]> | null>(null);
  const [listError, setListError] = useState('');
  const [selected, setSelected] = useState('');
  const [detail, setDetail] = useState<OperationsWorkItemEnvelope<OperationsWorkItem> | null>(null);
  const [detailError, setDetailError] = useState('');
  const [mutationError, setMutationError] = useState('');
  const [busyAction, setBusyAction] = useState<OperationsWorkItemAction | null>(null);
  const [reason, setReason] = useState('');
  const [resolutionCode, setResolutionCode] = useState('');
  const [resolutionSummary, setResolutionSummary] = useState('');
  const [receiptRef, setReceiptRef] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    setList(null);
    setListError('');
    readList(mine).then(
      (next) => { if (live) setList(next); },
      (caught: unknown) => {
        if (!live) return;
        const detail = said(caught, 'Could not load the operations inbox.');
        setListError(detail);
        onStatus(detail);
      },
    );
    return () => { live = false; };
  }, [mine, onStatus, readList, reload]);

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      setDetailError('');
      return;
    }
    let live = true;
    setDetail(null);
    setDetailError('');
    setMutationError('');
    readDetail(selected).then(
      (next) => { if (live) setDetail(next); },
      (caught: unknown) => {
        if (!live) return;
        const message = said(caught, 'The work item is unavailable in this grant scope.');
        setDetailError(message);
        onStatus(message);
      },
    );
    return () => { live = false; };
  }, [onStatus, readDetail, selected, reload]);

  const visible = useMemo(() => (list?.data ?? []).filter((item) =>
    inScope(scope, item.tenantId)
    && matches(filter, item.tenantId, item.kind, item.subject.type, item.subject.id, item.purpose, item.priority, item.state),
  ), [filter, list, scope]);

  useEffect(() => {
    if (list && selected && !visible.some((item) => item.id === selected)) {
      setSelected('');
      setDetail(null);
      setDetailError('');
      setMutationError('');
    }
  }, [list, selected, visible]);

  const refresh = () => {
    setMutationError('');
    setReload((value) => value + 1);
  };

  const run = (action: OperationsWorkItemAction, fields: Partial<OperationsWorkItemTransition> = {}) => {
    if (!detail) return;
    privileged(async () => {
      setBusyAction(action);
      setMutationError('');
      try {
        const next = await transition({
          itemId: detail.data.id,
          action,
          version: detail.data.version,
          ...fields,
        });
        setDetail(next);
        setReload((value) => value + 1);
        setReason('');
        setResolutionCode('');
        setResolutionSummary('');
        setReceiptRef('');
        onStatus('The authoritative work item was updated.');
      } catch (caught) {
        const message = said(caught, 'The work-item transition was not recorded.');
        setMutationError(message);
        onStatus(message);
      } finally {
        setBusyAction(null);
      }
    });
  };

  const item = detail?.data;

  return (
    <section aria-labelledby={`${detailId}-title`} style={{ display: 'grid', gap: 'var(--sp-4)' }}>
      <div>
        <SectionLabel aside={list ? `${visible.length} shown` : undefined}>Operations inbox</SectionLabel>
        <h2 id={`${detailId}-title`} style={{ marginBlock: 'var(--sp-2)' }}>Shared work items</h2>
        <p style={{ marginBlock: 0, color: 'var(--app-dim)' }}>
          Authoritative tenant-scoped work. The database derives every visible item and every allowed transition from your current grants.
        </p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
        <button
          type="button"
          className={mine ? 'btn btn-secondary' : 'btn btn-primary'}
          aria-pressed={!mine}
          onClick={() => { setMine(false); setSelected(''); }}
        >
          All visible work
        </button>
        <button
          type="button"
          className={mine ? 'btn btn-primary' : 'btn btn-secondary'}
          aria-pressed={mine}
          onClick={() => { setMine(true); setSelected(''); }}
        >
          My work
        </button>
        <button type="button" className="btn btn-secondary" onClick={refresh}>
          Refresh authoritative data
        </button>
      </div>

      {!list && !listError && <LoadingState what={mine ? 'your assigned work items' : 'the operations inbox'} />}

      {listError && denied(listError) && (
        <PermissionNotice
          changed="Operations inbox unavailable"
          why="The database did not confirm both console access and an exact-school capability. No work items are shown."
          control={{ label: 'Check access again', run: refresh }}
        />
      )}

      {listError && !denied(listError) && (
        <ErrorState
          title="Operations inbox could not be loaded"
          body="No cached or illustrative work items are shown."
          recover={{ label: 'Try again', run: refresh }}
        />
      )}

      {list && list.warnings.map((warning) => <Notice key={warning}>{warning}</Notice>)}

      {list && visible.length === 0 && (
        <EmptyState
          inline
          title={mine ? 'No work is assigned to you.' : 'No work items are available in this grant scope.'}
          body="No example, cached, or cross-tenant records are shown."
          action={{ label: 'Read again', onClick: refresh }}
        />
      )}

      {list && visible.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: RESPONSIVE_COLUMNS, gap: 'var(--sp-3)', alignItems: 'start' }}>
          <section aria-label="Work-item list" style={{ display: 'grid', gap: 'var(--sp-2)' }}>
            {visible.map((row) => (
              <button
                key={row.id}
                type="button"
                className="btn btn-secondary"
                aria-current={selected === row.id ? 'true' : undefined}
                aria-controls={detailId}
                onClick={() => setSelected(row.id)}
                style={{ display: 'grid', gap: 'var(--sp-1)', textAlign: 'start', justifyItems: 'stretch', whiteSpace: 'normal' }}
              >
                <strong>{row.purpose}</strong>
                <span>{row.tenantId} · {row.priority} · {row.state} · v{row.version}</span>
              </button>
            ))}
          </section>

          <section id={detailId} aria-label="Work-item detail" className="portal-panel" style={{ display: 'grid', gap: 'var(--sp-4)', minWidth: 0 }}>
            {!selected && <p role="status">Choose a work item to read its authoritative detail and history.</p>}
            {selected && !detail && !detailError && <LoadingState what="the selected work item" />}

            {detailError && denied(detailError) && (
              <PermissionNotice
                changed="Work item unavailable"
                why="The item does not exist in this grant scope, or the current grant no longer permits it. Those cases are intentionally indistinguishable."
                control={{ label: 'Reload the inbox', run: refresh }}
              />
            )}

            {detailError && !denied(detailError) && (
              <ErrorState
                title="Work-item detail could not be loaded"
                body="No stale detail is shown."
                recover={{ label: 'Try again', run: refresh }}
              />
            )}

            {item && (
              <>
                <div>
                  <strong>{item.purpose}</strong>
                  <p style={{ marginBottom: 0, color: 'var(--app-dim)' }}>{item.kind}</p>
                </div>
                <Fields
                  label={`Authoritative work-item fields for ${item.id}`}
                  items={[
                    { field: 'Tenant', value: item.tenantId },
                    { field: 'Subject', value: `${item.subject.type} · ${item.subject.id}` },
                    { field: 'Source', value: item.sourceRef },
                    { field: 'Priority', value: item.priority },
                    { field: 'State', value: item.state },
                    { field: 'Version', value: item.version },
                    { field: 'Assigned to me', value: item.assignedToMe ? 'yes' : 'no' },
                    { field: 'Updated', value: when(item.updatedAt, 'unknown') },
                    { field: 'Authority', value: `${detail.authority} · generated ${when(detail.generatedAt, 'unknown')}` },
                    { field: 'Request', value: detail.requestId },
                  ]}
                />

                {item.resolution && (
                  <Fields
                    label="Resolution receipt"
                    items={[
                      { field: 'Code', value: item.resolution.code },
                      { field: 'Summary', value: item.resolution.summary },
                      { field: 'Receipt', value: item.resolution.receiptRef },
                    ]}
                  />
                )}

                {mutationError && (
                  <Notice alert>
                    {conflict(mutationError)
                      ? 'This work item changed. Reload the authoritative version before trying again.'
                      : mutationError}
                  </Notice>
                )}
                {mutationError && conflict(mutationError) && (
                  <div role="status" aria-label="An authoritative reload action is available.">
                    <button type="button" className="btn btn-primary" onClick={refresh}>Reload authoritative version</button>
                  </div>
                )}

                {item.allowedActions.includes('claim') && (
                  <div style={{ display: 'grid', gap: 'var(--sp-2)' }}>
                    <WriteNotice env={env} />
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busyAction !== null}
                      onClick={() => run('claim')}
                    >
                      {busyAction === 'claim' ? 'Claiming…' : 'Claim work item'}
                    </button>
                  </div>
                )}

                {item.allowedActions.includes('resolve') && (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      run('resolve', { resolutionCode, resolutionSummary, receiptRef });
                    }}
                    style={{ display: 'grid', gap: 'var(--sp-3)' }}
                  >
                    <label>Resolution code<input className="input" required maxLength={80} value={resolutionCode} onChange={(event) => setResolutionCode(event.target.value)} /></label>
                    <label>Resolution summary<textarea className="input" required maxLength={500} value={resolutionSummary} onChange={(event) => setResolutionSummary(event.target.value)} /></label>
                    <label>Receipt reference<input className="input" required maxLength={300} value={receiptRef} onChange={(event) => setReceiptRef(event.target.value)} /></label>
                    <WriteNotice env={env} />
                    <button type="submit" className="btn btn-primary" disabled={busyAction !== null}>
                      {busyAction === 'resolve' ? 'Resolving…' : 'Resolve work item'}
                    </button>
                  </form>
                )}

                {item.allowedActions.includes('reopen') && (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      run('reopen', { reason });
                    }}
                    style={{ display: 'grid', gap: 'var(--sp-3)' }}
                  >
                    <label>Reason for reopening<textarea className="input" required maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
                    <WriteNotice env={env} />
                    <button type="submit" className="btn btn-primary" disabled={busyAction !== null}>
                      {busyAction === 'reopen' ? 'Reopening…' : 'Reopen work item'}
                    </button>
                  </form>
                )}

                <section aria-label="Immutable work-item history" style={{ display: 'grid', gap: 'var(--sp-2)' }}>
                  <SectionLabel aside={`${item.history.length} receipt(s)`}>History</SectionLabel>
                  {item.history.length === 0
                    ? <p role="status">No lifecycle receipts were returned.</p>
                    : (
                        <ol style={{ display: 'grid', gap: 'var(--sp-2)', paddingInlineStart: 'var(--sp-5)', marginBlock: 0 }}>
                          {item.history.map((event) => (
                            <li key={`${event.version}:${event.action}`}>
                              <strong>v{event.version} · {event.action}</strong> · {when(event.occurredAt, 'unknown')}
                              {event.byMe ? ' · by me' : ''}
                              {event.reason ? ` · ${event.reason}` : ''}
                              {event.resolution ? ` · ${event.resolution.code} · ${event.resolution.receiptRef}` : ''}
                            </li>
                          ))}
                        </ol>
                      )}
                </section>
              </>
            )}
          </section>
        </div>
      )}
    </section>
  );
}

