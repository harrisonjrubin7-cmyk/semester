import { useEffect, useRef, useState } from 'react';
import { ConfirmDialog } from '../ConfirmDialog';
import { ActionPreview } from '../unity/ActionPreview';
import { ErrorState, LoadingState, SuccessState } from '../unity/States';
import { EmptyState, Notice, SectionLabel } from '../ui';
import type {
  CompanyAccount,
  ProcurementDetail,
  ProcurementGrantDetail,
  ProcurementRequest,
  WithdrawalOutcome,
} from '../../lib/company/procurement';
import { COMPANY_PAGE_SIZE } from '../../lib/company/procurement';

export interface ProcurementAccessApi {
  loadAccounts: (page?: number) => Promise<CompanyAccount[]>;
  loadRequests: (accountId: string, page?: number) => Promise<ProcurementRequest[]>;
  loadDetail: (accountId: string, requestId: string) => Promise<ProcurementDetail>;
  verifySubject: (subject: string) => Promise<string>;
  withdraw: (grantId: string, reason: string, subject: string) => Promise<WithdrawalOutcome>;
}

interface Preview {
  subject: string;
  accountId: string;
  requestId: string;
  grantId: string;
}

function said(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function date(value: string | null): string {
  if (!value) return 'unknown';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'unknown';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(parsed);
}

function moment(value: string | null): string {
  if (!value) return 'unknown';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'unknown';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(parsed) + ' UTC';
}

function grantLabel(grant: ProcurementGrantDetail): string {
  return `${grant.id} · granted ${moment(grant.grantedAt)} · expires ${moment(grant.expiresAt)}`;
}

export function ProcurementAccess({
  subject,
  online,
  api,
}: {
  subject: string;
  online: boolean;
  api: ProcurementAccessApi;
}) {
  const generation = useRef(0);
  const pending = useRef(false);
  const [reloadAccounts, setReloadAccounts] = useState(0);
  const [reloadRequests, setReloadRequests] = useState(0);
  const [reloadDetail, setReloadDetail] = useState(0);
  const [accountPage, setAccountPage] = useState(0);
  const [requestPage, setRequestPage] = useState(0);
  const [accounts, setAccounts] = useState<{ subject: string; page: number; rows: CompanyAccount[] } | null>(null);
  const [accountError, setAccountError] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('');
  const [requests, setRequests] = useState<{ key: string; page: number; rows: ProcurementRequest[] } | null>(null);
  const [requestError, setRequestError] = useState('');
  const [selectedRequest, setSelectedRequest] = useState('');
  const [detail, setDetail] = useState<{ key: string; value: ProcurementDetail } | null>(null);
  const [detailError, setDetailError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [withdrawGrant, setWithdrawGrant] = useState('');
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [actionNotice, setActionNotice] = useState<WithdrawalOutcome | null>(null);
  const [actionError, setActionError] = useState('');
  const [needsRefresh, setNeedsRefresh] = useState('');

  const accountRows = accounts?.subject === subject && accounts.page === accountPage ? accounts.rows : null;
  const requestKey = `${subject}:${selectedAccount}`;
  const requestRows = requests?.key === requestKey && requests.page === requestPage ? requests.rows : null;

  useEffect(() => { setAccountPage(0); }, [subject]);
  const detailKey = `${subject}:${selectedAccount}:${selectedRequest}`;
  const currentDetail = detail?.key === detailKey ? detail.value : null;
  const currentAccount = accountRows?.find((item) => item.id === selectedAccount) ?? null;
  const currentRequest = requestRows?.find((item) => item.id === selectedRequest) ?? null;

  useEffect(() => {
    const ticket = ++generation.current;
    pending.current = false;
    setAccountError('');
    setSelectedAccount('');
    setSelectedRequest('');
    setRequests(null);
    setDetail(null);
    setPreview(null);
    setWithdrawOpen(false);
    setActionNotice(null);
    setActionError('');
    setNeedsRefresh('');
    void api.loadAccounts(accountPage).then(
      (rows) => {
        if (generation.current !== ticket) return;
        setAccounts({ subject, page: accountPage, rows });
        setSelectedAccount(rows[0]?.id ?? '');
        setCheckedAt(new Date());
      },
      (error: unknown) => {
        if (generation.current !== ticket) return;
        setAccounts({ subject, page: accountPage, rows: [] });
        setAccountError(said(error, 'Could not load company accounts.'));
      },
    );
    return () => { if (generation.current === ticket) generation.current += 1; };
  }, [accountPage, api, reloadAccounts, subject]);

  useEffect(() => {
    if (!selectedAccount || accounts?.subject !== subject) return;
    const key = `${subject}:${selectedAccount}`;
    const ticket = generation.current;
    setRequestError('');
    setRequests(null);
    setSelectedRequest('');
    setDetail(null);
    setPreview(null);
    setWithdrawOpen(false);
    void api.loadRequests(selectedAccount, requestPage).then(
      (rows) => {
        if (generation.current !== ticket || key !== `${subject}:${selectedAccount}`) return;
        setRequests({ key, page: requestPage, rows });
        setSelectedRequest(rows[0]?.id ?? '');
        setCheckedAt(new Date());
      },
      (error: unknown) => {
        if (generation.current !== ticket) return;
        setRequests({ key, page: requestPage, rows: [] });
        setRequestError(said(error, 'Could not load procurement requests.'));
      },
    );
  }, [accounts, api, reloadRequests, requestPage, selectedAccount, subject]);

  useEffect(() => {
    if (!selectedAccount || !selectedRequest || requests?.key !== requestKey) return;
    const key = `${subject}:${selectedAccount}:${selectedRequest}`;
    const ticket = generation.current;
    setDetailError('');
    if (reloadDetail > 0) setRefreshing(true);
    else setDetail(null);
    setPreview(null);
    setWithdrawOpen(false);
    setActionNotice(null);
    setActionError('');
    void api.loadDetail(selectedAccount, selectedRequest).then(
      (value) => {
        if (generation.current !== ticket || key !== `${subject}:${selectedAccount}:${selectedRequest}`) return;
        setDetail({ key, value });
        setWithdrawGrant((was) => value.grants.some((grant) => grant.id === was && !grant.revokedAt)
          ? was
          : (value.grants.find((grant) => !grant.revokedAt)?.id ?? ''));
        setRefreshing(false);
        setNeedsRefresh('');
        setCheckedAt(new Date());
      },
      (error: unknown) => {
        if (generation.current !== ticket) return;
        setDetailError(said(error, 'Could not load request details.'));
        setRefreshing(false);
      },
    );
  }, [api, reloadDetail, requestKey, requests, selectedAccount, selectedRequest, subject]);

  const chooseAccount = (id: string) => {
    setSelectedAccount(id);
    setSelectedRequest('');
    setRequests(null);
    setDetail(null);
    setPreview(null);
    setReason('');
    setRequestPage(0);
  };
  const chooseRequest = (id: string) => {
    setSelectedRequest(id);
    setDetail(null);
    setPreview(null);
    setReason('');
  };

  const chosenGrant = currentDetail?.grants.find((grant) => grant.id === withdrawGrant) ?? null;
  const previewIsCurrent = preview
    && preview.subject === subject
    && preview.accountId === selectedAccount
    && preview.requestId === selectedRequest
    && preview.grantId === withdrawGrant;

  const runWithdrawal = async () => {
    if (!previewIsCurrent || !chosenGrant || !currentAccount || !currentRequest || !online || pending.current) return;
    const ticket = generation.current;
    const trimmed = reason.trim();
    pending.current = true;
    setPreview(null);
    setActionPending(true);
    setActionNotice(null);
    setActionError('');
    try {
      await api.verifySubject(subject);
      if (generation.current !== ticket) return;
      const outcome = await api.withdraw(chosenGrant.id, trimmed, subject);
      if (generation.current !== ticket) return;
      setActionNotice(outcome);
      if (outcome.kind === 'confirmed') {
        setDetail((was) => was?.key === detailKey ? {
          key: was.key,
          value: {
            ...was.value,
            grants: was.value.grants.map((item) => item.id === outcome.grant.id ? { ...item, ...outcome.grant } : item),
          },
        } : was);
        setWithdrawGrant('');
        setWithdrawOpen(false);
        setReason('');
      } else {
        setNeedsRefresh(chosenGrant.id);
      }
    } catch (error) {
      if (generation.current === ticket) setActionError(said(error, 'Access withdrawal did not start.'));
    } finally {
      pending.current = false;
      if (generation.current === ticket) setActionPending(false);
    }
  };

  if (accountRows === null) return <LoadingState what="Company permissions and accounts" />;
  if (accountError) {
    return <ErrorState title="Company requests could not be loaded" body={accountError} recover={{ label: 'Try again', run: () => setReloadAccounts((value) => value + 1) }} />;
  }
  if (accountRows.length === 0) {
    return <EmptyState title="No company accounts are visible" body="The authorized account read succeeded and returned no accounts." />;
  }

  return (
    <div className="company-procurement">
      {!online && <Notice alert>You are offline. Company records may be stale; withdrawals are unavailable and nothing is queued.</Notice>}
      <div role="status" aria-live="polite" className="nums">
        {refreshing ? 'Refreshing the selected grant…' : checkedAt ? `Checked now · ${moment(checkedAt.toISOString())}` : ''}
      </div>

      <SectionLabel>Accounts</SectionLabel>
      <div className="segmented" aria-label="Company accounts">
        {accountRows.map((item) => (
          <button key={item.id} type="button" className="btn segmented-option" aria-pressed={item.id === selectedAccount} onClick={() => chooseAccount(item.id)}>
            {item.name}
          </button>
        ))}
      </div>
      <nav aria-label="Company account pages">
        <button type="button" className="btn" disabled={accountPage === 0} onClick={() => setAccountPage((page) => Math.max(0, page - 1))}>Previous accounts</button>
        <button type="button" className="btn" disabled={accountRows.length < COMPANY_PAGE_SIZE} onClick={() => setAccountPage((page) => page + 1)}>Next accounts</button>
      </nav>

      {currentAccount && (
        <section aria-labelledby="company-account-heading">
          <h2 id="company-account-heading">{currentAccount.name}</h2>
          <dl className="action-preview-facts">
            <dt>Account reference</dt><dd>{currentAccount.publicId}</dd>
            <dt>Account owner</dt><dd>{currentAccount.ownerId ?? 'Unknown'}</dd>
            <dt>Server record updated</dt><dd>{moment(currentAccount.updatedAt)}</dd>
          </dl>
        </section>
      )}

      <SectionLabel>Procurement requests</SectionLabel>
      {requestRows === null ? <LoadingState what="procurement requests" /> : requestError ? (
        <ErrorState title="Procurement requests could not be loaded" body={requestError} recover={{ label: 'Try again', run: () => setReloadRequests((value) => value + 1) }} />
      ) : requestRows.length === 0 ? (
        <EmptyState inline title="No procurement requests" body="The authorized request read succeeded and returned no rows for this account." />
      ) : (
        <div className="segmented" aria-label="Procurement requests">
          {requestRows.map((item) => (
            <button key={item.id} type="button" className="btn segmented-option" aria-pressed={item.id === selectedRequest} onClick={() => chooseRequest(item.id)}>
              {item.requesterName} · {date(item.requestedAt)}
            </button>
          ))}
        </div>
      )}
      {requestRows && requestRows.length > 0 && (
        <nav aria-label="Procurement request pages">
          <button type="button" className="btn" disabled={requestPage === 0} onClick={() => setRequestPage((page) => Math.max(0, page - 1))}>Previous requests</button>
          <button type="button" className="btn" disabled={requestRows.length < COMPANY_PAGE_SIZE} onClick={() => setRequestPage((page) => page + 1)}>Next requests</button>
        </nav>
      )}

      {selectedRequest && (currentDetail === null ? (
        detailError ? <ErrorState title="Request detail could not be loaded" body={detailError} recover={{ label: 'Try again', run: () => setReloadDetail((value) => value + 1) }} /> : <LoadingState what="request and access grants" />
      ) : (
        <section aria-labelledby="procurement-request-heading">
          {detailError && <Notice alert>Refresh failed: {detailError}. The previously checked detail remains visible.</Notice>}
          <h2 id="procurement-request-heading">Request detail</h2>
          <dl className="action-preview-facts">
            <dt>Reviewer</dt><dd>{currentDetail.request.requesterName} · {currentDetail.request.requesterRole.replaceAll('_', ' ')}</dd>
            <dt>Recipient</dt><dd>{currentDetail.request.requesterEmail}</dd>
            <dt>Request</dt><dd>{currentDetail.request.reason || 'Unknown'}</dd>
            <dt>Requested</dt><dd>{moment(currentDetail.request.requestedAt)}</dd>
            <dt>Server record updated</dt><dd>{moment(currentDetail.request.updatedAt)}</dd>
          </dl>

          {currentDetail.grants.length === 0 ? <EmptyState inline title="No access grants" body="This request has no visible access grant." /> : currentDetail.grants.map((grant) => (
            <section key={grant.id} aria-labelledby={`grant-${grant.id}`}>
              <h3 id={`grant-${grant.id}`}>Grant {grant.id}</h3>
              <p>{grantLabel(grant)}</p>
              <p className="nums">Packet commit {grant.packetCommit}</p>
              {grant.revokedAt ? <Notice>Withdrawn {moment(grant.revokedAt)} by {grant.revokedBy ?? 'unknown actor'} · {grant.revokeReason ?? 'reason unknown'}</Notice> : null}
              <h4>Pinned document versions</h4>
              {grant.items.length === 0 ? <p>None visible.</p> : (
                <ul>
                  {grant.items.map((item) => (
                    <li key={item.versionId}>
                      <strong>{item.title}</strong> · Version {item.version} · {item.tier.toUpperCase()} · Published {date(item.publishedOn)} · Review due {date(item.reviewOn)} · {item.sourceCommit ? `Source commit ${item.sourceCommit}` : 'Source commit unknown'}
                    </li>
                  ))}
                </ul>
              )}
              <h4>Access history</h4>
              <p>Each row means room authorization succeeded. It does not prove a download, reading, or acceptance.</p>
              {grant.accesses.length === 0 ? <p>No authorized room opens are recorded.</p> : (
                <ul>{grant.accesses.map((access) => <li key={access.id}>Room authorization succeeded · {moment(access.accessedAt)} · {access.versionId ? `document version ${access.versionId}` : 'room list'}</li>)}</ul>
              )}
            </section>
          ))}

          {currentDetail.grants.some((grant) => !grant.revokedAt) && (
            <section aria-labelledby="withdraw-access-heading">
              <h3 id="withdraw-access-heading">Withdraw access</h3>
              {!withdrawOpen ? (
                <button type="button" className="btn btn-primary" disabled={!online || actionPending || !!needsRefresh} onClick={() => setWithdrawOpen(true)}>
                  Withdraw access
                </button>
              ) : (
                <>
                  <label htmlFor="company-withdraw-grant">Grant</label>
                  <select id="company-withdraw-grant" className="input" value={withdrawGrant} onChange={(event) => { setWithdrawGrant(event.target.value); setActionNotice(null); setActionError(''); }}>
                    {currentDetail.grants.filter((grant) => !grant.revokedAt).map((grant) => <option key={grant.id} value={grant.id}>{grantLabel(grant)}</option>)}
                  </select>
                  <label htmlFor="company-withdraw-reason">Reason</label>
                  <textarea
                    id="company-withdraw-reason"
                    className="input"
                    value={reason}
                    maxLength={500}
                    aria-describedby="company-withdraw-reason-hint"
                    onChange={(event) => { setReason(event.target.value); setActionNotice(null); setActionError(''); }}
                  />
                  <p id="company-withdraw-reason-hint">Required. The server stores this reason with the actor and time.</p>
                  <button
                    type="button"
                    className="btn"
                    disabled={!online || actionPending || !!needsRefresh || !chosenGrant || reason.trim().length < 1 || reason.trim().length > 500}
                    onClick={() => chosenGrant && setPreview({ subject, accountId: selectedAccount, requestId: selectedRequest, grantId: chosenGrant.id })}
                  >
                    Review withdrawal
                  </button>
                  <button type="button" className="btn" disabled={actionPending} onClick={() => { setWithdrawOpen(false); setPreview(null); setReason(''); }}>
                    Cancel withdrawal
                  </button>
                </>
              )}
            </section>
          )}

          {actionPending && <Notice>Withdrawal pending. The grant will be read back before an outcome is shown.</Notice>}
          {actionError && <Notice alert>{actionError}</Notice>}
          {actionNotice?.kind === 'confirmed' && (
            <SuccessState
              title="Access withdrawn"
              body={`${actionNotice.concurrent ? 'Another operator completed this withdrawal. ' : ''}Stored ${moment(actionNotice.grant.revokedAt)} by ${actionNotice.grant.revokedBy ?? 'unknown actor'} · ${actionNotice.grant.revokeReason ?? 'reason unknown'}. New room opens are refused. A signed URL already issued can remain usable for up to 60 seconds; downloaded bytes cannot be recalled.`}
            />
          )}
          {actionNotice?.kind === 'unknown' && (
            <Notice alert>
              Withdrawal outcome unknown. {actionNotice.visibilityLost ? 'Grant visibility was lost, so no retry is safe.' : 'The grant still appeared live at readback.'} Refresh this exact grant before trying again.
            </Notice>
          )}
          {needsRefresh && (
            <button type="button" className="btn" onClick={() => setReloadDetail((value) => value + 1)}>Refresh grant</button>
          )}
        </section>
      ))}

      {previewIsCurrent && chosenGrant && currentAccount && currentRequest && (
        <ConfirmDialog
          title="Withdraw procurement-room access?"
          confirmLabel="Withdraw access"
          onCancel={() => setPreview(null)}
          onConfirm={() => void runWithdrawal()}
          preview={(
            <ActionPreview
              subject={`${currentAccount.name} · grant ${chosenGrant.id}`}
              says={<>Prevents new room opens for {currentRequest.requesterName} ({currentRequest.requesterEmail}).</>}
              exactly={(
                <>
                  <p>Reason: {reason.trim()}</p>
                  <p>Expires: {moment(chosenGrant.expiresAt)}</p>
                  <ul>{chosenGrant.items.map((item) => <li key={item.versionId}>{item.title} · version {item.version}</li>)}</ul>
                </>
              )}
              doesNotChange="The request, pinned versions, access history, or any already downloaded bytes. An already issued signed URL may work for up to 60 seconds."
              recovery={{ kind: 'none', how: 'A new grant would require a separate approved issuance workflow, which this screen does not provide.' }}
              whoCanHelp="The Semester account team."
            />
          )}
        />
      )}
    </div>
  );
}
