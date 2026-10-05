import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { Page } from '../components/Page';
import { Notice, TabList } from '../components/ui';
import { cloudConfigured } from '../lib/cloud';
import { loadMyCapabilities, type Grant } from '../lib/capabilities';
import { environment } from '../lib/environment';
import {
  holdsConsole,
  loadPreferences,
  mfaFresh,
  mfaLevel,
  openSupportGrants,
  savePreference,
  sessionExpiry,
  type MfaLevel,
  type SupportGrant,
} from '../lib/console/client';
import { MfaStep } from '../components/MfaStep';
import { ContextBar } from '../components/console/ContextBar';
import { Approvals } from '../components/console/Approvals';
import { BreakGlass } from '../components/console/BreakGlass';
import { Audit } from '../components/console/Audit';
import { Customers } from '../components/console/Customers';
import { Figures } from '../components/console/Figures';
import { StandardsCrosswalk } from '../components/console/StandardsCrosswalk';
import { Evidence } from '../components/console/Evidence';
import { Views, readViews, type SavedView } from '../components/console/Views';
import { CommandCenter } from '../components/console/CommandCenter';
import { SupportQueue } from '../components/console/SupportQueue';
import { TenantOperations } from '../components/console/TenantOperations';
import { PrivacyRequests } from '../components/console/PrivacyRequests';
import { IntegrationHealth } from '../components/console/IntegrationHealth';
import { ReleaseIncidents } from '../components/console/ReleaseIncidents';
import { said, when } from '../components/console/Fields';
import {
  isConsoleWorkspaceId,
  visibleConsoleWorkspaces,
  type ConsoleWorkspaceId,
} from '../lib/console/workspaces';

/**
 * The operations console.
 *
 * A production tool, and the gate is the first thing about it: with no
 * account service, no account, or no `console:operate` grant at platform
 * scope, it shows one sentence and stops. There is no demo of it, no preview
 * role and no view-as — the context bar at the top is the real environment,
 * the real identity, the real grants, and how fresh the second factor is.
 *
 * Everything it does is done by the database under its own rules
 * (`lib/ops/console.ts` is the policy; migrations A and B hold it): the UI
 * state here decides what to *offer*, never what is allowed. The MFA step is
 * put in front of a decision or an action when the session is not fresh,
 * because the server will refuse it otherwise and an operator should be told
 * before typing, not after.
 *
 * What the operator keeps — saved views and the last-open tab — lives in
 * `operator_preference` on the server. Nothing console-related is written to
 * browser storage; `console.test.tsx` asserts it.
 */

const FinancialModel = lazy(() => import('../finance/FinancialModel').then((m) => ({ default: m.FinancialModel })));

const BLURB = 'Live operational exceptions, approvals, break-glass, the audit chain, customers, figures and evidence — for operators holding console:operate.';

/** Preference keys, under `operator_preference`. */
const PREF_TAB = 'console.tab';
const PREF_VIEWS = 'console.views';

/**
 * The caller's grants: `null` until read, so "no grant" is never shown while
 * reading, and not read at all when there is nothing to read them from.
 */
function useGrants(enabled: boolean): Grant[] | null {
  const [grants, setGrants] = useState<Grant[] | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    loadMyCapabilities().then(
      (g) => { if (live) setGrants(g); },
      () => { if (live) setGrants([]); },
    );
    return () => { live = false; };
  }, [enabled]);
  return grants;
}

export function Console() {
  const { account } = useStore();
  const grants = useGrants(cloudConfigured && account !== null);
  if (!cloudConfigured || !account) {
    return (
      <Page blurb={BLURB}>
        <Notice>Sign in with an operator account to open the operations console. There is no demo of it: without the account service there is nothing to operate.</Notice>
      </Page>
    );
  }
  if (grants === null) {
    return (
      <Page blurb={BLURB}>
        <p role="status">Reading your grants…</p>
      </Page>
    );
  }
  if (!holdsConsole(grants)) {
    return (
      <Page blurb={BLURB}>
        <Notice>This account holds no console:operate grant at platform scope, so there is nothing to show. Grants come from role_grants, not from a setting.</Notice>
      </Page>
    );
  }
  return <Operations operator={account.email} grants={grants} />;
}

function Operations({ operator, grants }: { operator: string; grants: Grant[] }) {
  const env = environment();
  const workspaces = useMemo(() => visibleConsoleWorkspaces(grants), [grants]);
  const [tab, setTab] = useState<ConsoleWorkspaceId>('command');
  const [filter, setFilter] = useState('');
  const [scope, setScope] = useState('All');
  const [views, setViews] = useState<SavedView[]>([]);
  const [mfa, setMfa] = useState<MfaLevel | null | string>(null);
  const [session, setSession] = useState<Date | null | string>(null);
  const [support, setSupport] = useState<SupportGrant[] | null | string>(null);
  const [status, setStatus] = useState('');
  const [gate, setGate] = useState<{ run: () => Promise<void> } | null>(null);
  const [gateRunning, setGateRunning] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const onStatus = useCallback((s: string) => setStatus(s), []);

  const readMfa = useCallback(async () => {
    try {
      setMfa(await mfaLevel());
    } catch (e) {
      setMfa(said(e, 'Could not read'));
    }
    setNow(new Date());
  }, []);

  // The context bar and the preferences: account-backed, read once at open.
  useEffect(() => {
    let live = true;
    mfaLevel().then(
      (level) => {
        if (!live) return;
        setMfa(level);
        setNow(new Date());
      },
      (e: unknown) => { if (live) setMfa(said(e, 'Could not read')); },
    );
    sessionExpiry().then(
      (at) => { if (live) setSession(at ?? 'No session'); },
      (e: unknown) => { if (live) setSession(said(e, 'Could not read')); },
    );
    openSupportGrants().then(
      (g) => { if (live) setSupport(g); },
      (e: unknown) => { if (live) setSupport(said(e, 'Could not read')); },
    );
    loadPreferences().then(
      (p) => {
        if (!live) return;
        if (isConsoleWorkspaceId(p[PREF_TAB], workspaces)) setTab(p[PREF_TAB]);
        setViews(readViews(p[PREF_VIEWS]));
      },
      (e: unknown) => { if (live) setStatus(said(e, 'Could not load your preferences.')); },
    );
    const tick = setInterval(() => { if (live) setNow(new Date()); }, 60_000);
    return () => {
      live = false;
      clearInterval(tick);
    };
  }, [workspaces]);

  const choose = (next: ConsoleWorkspaceId) => {
    setTab(next);
    savePreference(PREF_TAB, next).catch((e: unknown) => setStatus(said(e, 'The last-open tab was not saved.')));
  };

  const keepViews = (next: SavedView[], done: string) => {
    setViews(next);
    savePreference(PREF_VIEWS, next).then(
      () => setStatus(done),
      (e: unknown) => setStatus(said(e, 'The views were not saved.')),
    );
  };

  /** A privileged write: straight through when the second factor is fresh, otherwise behind the step. */
  const privileged = useCallback(
    (run: () => Promise<void>) => {
      const fresh = mfa !== null && typeof mfa !== 'string' && mfaFresh(mfa, new Date());
      if (fresh) {
        run().catch((e: unknown) => setStatus(said(e, 'The change was not recorded.')));
        return;
      }
      setGate({ run });
    },
    [mfa],
  );

  const verified = () => {
    const pending = gate;
    if (!pending) return;
    setGateRunning(true);
    void readMfa()
      .then(() => pending.run())
      .catch((e: unknown) => setStatus(said(e, 'The change was not recorded.')))
      .finally(() => {
        setGate(null);
        setGateRunning(false);
      });
  };

  const sessionEnds = session instanceof Date ? `At session end, ${when(session.toISOString())}` : 'At session end';
  const viewProps = { env, scope, filter, onStatus, privileged };

  return (
    <Page blurb={BLURB}>
      <ContextBar context={{ env, scope, operator, grants, mfa, session, support, now }} />
      {status && (
        <p role="status" style={{ marginBlock: 0, marginBottom: 'var(--sp-4)' }}>
          {status}
        </p>
      )}
      {gate && (gateRunning
        ? <p role="status">Finishing the verified change…</p>
        : <MfaStep onVerified={verified} onCancel={() => setGate(null)} />)}
      <div
        data-console-content
        inert={gate ? true : undefined}
        aria-hidden={gate ? true : undefined}
      >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)', alignItems: 'end', marginBottom: 'var(--sp-4)' }}>
        <label style={{ display: 'grid', gap: 'var(--sp-2)', flex: 1 }}>
          Filter this view
          <input className="input" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </label>
        {scope !== 'All' && (
          <button type="button" className="btn" onClick={() => setScope('All')}>
            Show all tenants
          </button>
        )}
      </div>
      <TabList label="Console views" className="portal-tabs" value={tab} onChange={choose} tabs={workspaces} />
      <div style={{ marginTop: 'var(--sp-5)' }}>
        {tab === 'command' && <CommandCenter {...viewProps} />}
        {tab === 'support' && <SupportQueue {...viewProps} />}
        {tab === 'approvals' && <Approvals {...viewProps} />}
        {tab === 'breakglass' && <BreakGlass {...viewProps} />}
        {tab === 'audit' && <Audit {...viewProps} />}
        {tab === 'tenant-operations' && <TenantOperations {...viewProps} now={now} />}
        {tab === 'privacy' && <PrivacyRequests {...viewProps} />}
        {tab === 'integration-health' && <IntegrationHealth {...viewProps} />}
        {tab === 'release-incidents' && <ReleaseIncidents {...viewProps} />}
        {tab === 'customers' && <Customers {...viewProps} sessionEnds={sessionEnds} onFocus={setScope} />}
        {tab === 'figures' && <Figures {...viewProps} />}
        {tab === 'finance' && (
          <Suspense fallback={<p role="status">Loading the finance model…</p>}>
            <FinancialModel />
          </Suspense>
        )}
        {tab === 'evidence' && <><Evidence {...viewProps} /><StandardsCrosswalk /></>}
        {tab === 'views' && (
          <Views
            views={views}
            currentTab={tab}
            currentFilter={filter}
            onSave={(v) => keepViews([...views.filter((x) => x.name !== v.name), v], `Saved the view “${v.name}”.`)}
            onApply={(v) => {
              setFilter(v.filter);
              if (isConsoleWorkspaceId(v.tab, workspaces)) choose(v.tab);
            }}
            onDelete={(name) => keepViews(views.filter((x) => x.name !== name), `Deleted the view “${name}”.`)}
          />
        )}
      </div>
      </div>
    </Page>
  );
}
