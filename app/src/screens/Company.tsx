import { useEffect, useState } from 'react';
import { Page } from '../components/Page';
import { ProcurementAccess, type ProcurementAccessApi } from '../components/company/ProcurementAccess';
import { ErrorState, LoadingState, PermissionNotice } from '../components/unity/States';
import { SectionLabel } from '../components/ui';
import { loadMyCapabilitiesOrThrow } from '../lib/capabilities';
import { cloud, cloudConfigured } from '../lib/cloud';
import {
  holdsCompanyAccess,
  loadCompanyAccounts,
  loadProcurementDetail,
  loadProcurementRequests,
  requireCompanySubject,
  withdrawWithReadback,
} from '../lib/company/procurement';
import { useOnline } from '../lib/offline-mode';
import { useStore } from '../state/store';

const PROCUREMENT_API: ProcurementAccessApi = {
  loadAccounts: (page) => loadCompanyAccounts(page),
  loadRequests: (accountId, page) => loadProcurementRequests(accountId, page),
  loadDetail: loadProcurementDetail,
  verifySubject: requireCompanySubject,
  withdraw: (grantId, reason, subject) => withdrawWithReadback(grantId, reason, subject),
};

type Gate =
  | { kind: 'checking' }
  | { kind: 'allowed'; subject: string }
  | { kind: 'denied' }
  | { kind: 'error'; message: string };

export const COMPANY_BLURB = 'Review institutional procurement requests, their pinned trust-room evidence, and existing access grants.';

export function Company() {
  const { account } = useStore();
  const online = useOnline();
  const [revision, setRevision] = useState(0);
  const [gate, setGate] = useState<Gate>({ kind: 'checking' });

  useEffect(() => {
    if (!account || !cloudConfigured) return;
    let live = true;
    let unsubscribe = () => {};
    void cloud().then((db) => {
      if (!live) return;
      const watched = db.auth.onAuthStateChange(() => {
        if (!live) return;
        setGate({ kind: 'checking' });
        setRevision((value) => value + 1);
      });
      unsubscribe = () => watched.data.subscription.unsubscribe();
    }, () => {});
    return () => { live = false; unsubscribe(); };
  }, [account]);

  useEffect(() => {
    if (!account || !cloudConfigured) return;
    let live = true;
    setGate({ kind: 'checking' });
    void (async () => {
      const db = await cloud();
      const { data, error } = await db.auth.getUser();
      if (error || !data.user?.id) throw new Error('Your signed-in account could not be verified. Check the connection and try again.');
      if (data.user.id !== account.id) throw new Error('The signed-in account changed. Company data was cleared; check access again.');
      const grants = await loadMyCapabilitiesOrThrow(account.id);
      if (!live) return;
      setGate(holdsCompanyAccess(grants) ? { kind: 'allowed', subject: data.user.id } : { kind: 'denied' });
    })().catch((error: unknown) => {
      if (live) setGate({ kind: 'error', message: error instanceof Error ? error.message : 'Company permissions could not be checked.' });
    });
    return () => { live = false; };
  }, [account, revision]);

  if (!cloudConfigured) {
    return (
      <Page blurb={COMPANY_BLURB}>
        <ErrorState
          title="Company is disconnected"
          body="This build has no authenticated account service, so no company records can be read and no action can be taken."
          recover={{ label: 'Check again', run: () => setRevision((value) => value + 1) }}
        />
      </Page>
    );
  }
  if (!account) {
    return (
      <Page blurb={COMPANY_BLURB}>
        <PermissionNotice changed="Sign in to open Company" why="Company records require a current authenticated account and an exact platform account-team grant." />
      </Page>
    );
  }

  return (
    <Page blurb={COMPANY_BLURB}>
      <SectionLabel>Procurement access</SectionLabel>
      {gate.kind === 'checking' && <LoadingState what="your Company permissions" />}
      {gate.kind === 'denied' && (
        <PermissionNotice
          changed="Company access is not granted"
          why="This workspace requires account:manage at platform scope. School-scoped grants, Console access, and Trust publishing do not qualify."
        />
      )}
      {gate.kind === 'error' && (
        <ErrorState title="Your signed-in account could not be verified" body={gate.message} recover={{ label: 'Check again', run: () => setRevision((value) => value + 1) }} />
      )}
      {gate.kind === 'allowed' && gate.subject !== account.id && <LoadingState what="your Company permissions" />}
      {gate.kind === 'allowed' && gate.subject === account.id && (
        <ProcurementAccess key={`${gate.subject}:${revision}`} subject={gate.subject} online={online} api={PROCUREMENT_API} />
      )}
    </Page>
  );
}
