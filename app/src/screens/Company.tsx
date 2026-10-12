import { useCallback, useEffect, useMemo, useState } from 'react';
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

type Gate =
  | { kind: 'checking' }
  | { kind: 'allowed'; subject: string }
  | { kind: 'denied' }
  | { kind: 'error'; message: string };

export const COMPANY_BLURB = 'Review institutional procurement requests, their pinned trust-room evidence, and existing access grants.';

async function requireExactCompanyAccess(subject: string): Promise<string> {
  await requireCompanySubject(subject);
  const grants = await loadMyCapabilitiesOrThrow(subject);
  if (!holdsCompanyAccess(grants)) throw new Error('Company access is no longer granted.');
  return subject;
}

export function Company() {
  const { account } = useStore();
  const online = useOnline();
  const [revision, setRevision] = useState(0);
  const [gate, setGate] = useState<Gate>({ kind: 'checking' });
  const authorizationLost = useCallback(() => setGate({ kind: 'denied' }), []);
  const procurementApi = useMemo<ProcurementAccessApi>(() => ({
    loadAccounts: async (page) => {
      await requireExactCompanyAccess(account?.id ?? '');
      return loadCompanyAccounts(page);
    },
    loadRequests: async (accountId, page) => {
      await requireExactCompanyAccess(account?.id ?? '');
      return loadProcurementRequests(accountId, page);
    },
    loadDetail: async (accountId, requestId) => {
      await requireExactCompanyAccess(account?.id ?? '');
      return loadProcurementDetail(accountId, requestId);
    },
    verifySubject: requireExactCompanyAccess,
    withdraw: (grantId, reason, subject) => withdrawWithReadback(grantId, reason, subject),
  }), [account?.id]);

  useEffect(() => {
    if (!account || !cloudConfigured) return;
    const recheck = () => {
      setGate({ kind: 'checking' });
      setRevision((value) => value + 1);
    };
    const visible = () => { if (document.visibilityState === 'visible') recheck(); };
    window.addEventListener('focus', recheck);
    window.addEventListener('online', recheck);
    document.addEventListener('visibilitychange', visible);
    return () => {
      window.removeEventListener('focus', recheck);
      window.removeEventListener('online', recheck);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [account]);

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
      const subject = await requireExactCompanyAccess(account.id);
      if (!live) return;
      setGate({ kind: 'allowed', subject });
    })().catch((error: unknown) => {
      if (!live) return;
      if (error instanceof Error && error.message === 'Company access is no longer granted.') setGate({ kind: 'denied' });
      else setGate({ kind: 'error', message: error instanceof Error ? error.message : 'Company permissions could not be checked.' });
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
        <ProcurementAccess
          key={`${gate.subject}:${revision}`}
          subject={gate.subject}
          online={online}
          api={procurementApi}
          onAuthorizationLost={authorizationLost}
        />
      )}
    </Page>
  );
}
