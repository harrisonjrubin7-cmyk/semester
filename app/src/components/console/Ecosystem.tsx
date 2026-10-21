import { useState } from 'react';
import { Notice, SectionLabel, TabList } from '../ui';
import {
  ECOSYSTEM_CAPABILITIES,
  ECOSYSTEM_GENERATED_AT,
  ECOSYSTEM_SCREENS,
  ECOSYSTEM_WORKSPACES,
  capabilityDomainCounts,
  ecosystemEnvironment,
  ecosystemSummary,
  workspaceScreenCount,
  type EcosystemEnvironment,
} from '../../lib/ecosystem';
import { matches } from './Fields';

type View = 'map' | 'workspaces' | 'capabilities';

const VIEWS: readonly { id: View; label: string }[] = [
  { id: 'map', label: 'Ecosystem map' },
  { id: 'workspaces', label: 'Workspaces' },
  { id: 'capabilities', label: 'Capabilities' },
];

const ENVIRONMENTS: readonly { id: EcosystemEnvironment; eyebrow: string; title: string }[] = [
  { id: 'personal', eyebrow: 'Plan, learn, participate', title: 'Personal Education OS' },
  { id: 'institution', eyebrow: 'Operate education and services', title: 'Institution Operating OS' },
  { id: 'company', eyebrow: 'Build, sell, deliver', title: 'Semester Company OS' },
];

const FOUNDATION = ['Identity', 'Membership', 'Policy', 'Workflows', 'Data authority', 'Consent', 'Audit', 'Events', 'AI', 'Files', 'Notifications'];
const DOMAIN_LABELS: Record<string, string> = {
  acct: 'Account', company: 'Company', dev: 'Developer', edu: 'Education', inst: 'Institution', ops: 'Operations', public: 'Public', shared: 'Shared platform',
};

export function Ecosystem({ filter }: { filter: string }) {
  const [view, setView] = useState<View>('map');
  const summary = ecosystemSummary();
  const workspaces = ECOSYSTEM_WORKSPACES.filter((workspace) => matches(filter, workspace.id, workspace.label, ecosystemEnvironment(workspace.id)));
  const capabilities = ECOSYSTEM_CAPABILITIES.filter((capability) =>
    matches(filter, capability.id, capability.ws, capability.area, capability.design, ...capability.actors, ...capability.perms, ...capability.routes),
  );

  return (
    <div style={{ display: 'grid', gap: 'var(--sp-5)' }}>
      <Notice>
        One governed platform, three operating environments. This view imports every row from the October {ECOSYSTEM_GENERATED_AT} handoff, but the handoff is specification evidence only. A row becomes live only through repository tests, deployment evidence, authorization and an explicit activation decision.
      </Notice>
      <TabList label="Connected ecosystem views" tabs={VIEWS} value={view} onChange={setView} className="portal-tabs" />

      {view === 'map' && (
        <section aria-labelledby="ecosystem-map-heading">
          <SectionLabel aside={`${summary.workspaces} workspaces · ${summary.screens} screen contracts · ${summary.capabilities} capabilities`}>
            <span id="ecosystem-map-heading">Connected ecosystem</span>
          </SectionLabel>
          <p>How people, records, decisions, money and work move through one Semester platform without collapsing personal, institutional and company authority.</p>
          <div className="cards">
            {ENVIRONMENTS.map((environment) => (
              <section className="tile" key={environment.id} aria-label={environment.title}>
                <p className="eyebrow">{environment.eyebrow}</p>
                <h3>{environment.title}</h3>
                <p>{summary.environments[environment.id]} role-aware workspaces in the supplied contract.</p>
              </section>
            ))}
          </div>
          <SectionLabel>Shared platform foundation</SectionLabel>
          <ul aria-label="Shared platform capabilities">
            {FOUNDATION.map((item) => <li key={item}>{item}</li>)}
          </ul>
          <SectionLabel>Readiness ladder</SectionLabel>
          <p>Specified → implemented → tested → deployed → authorized → enabled. Each transition needs independent evidence; deployment alone never authorizes institutional use.</p>
        </section>
      )}

      {view === 'workspaces' && (
        <section aria-labelledby="ecosystem-workspaces-heading">
          <SectionLabel aside={`${workspaces.length} shown`}>
            <span id="ecosystem-workspaces-heading">Role-aware workspaces</span>
          </SectionLabel>
          {workspaces.length === 0 ? (
            <p role="status">No workspaces match this console filter.</p>
          ) : (
            <div className="cards">
              {workspaces.map((workspace) => {
                const screens = ECOSYSTEM_SCREENS.filter((screen) => screen.ws === workspace.id);
                return (
                  <details className="tile" key={workspace.id}>
                    <summary><strong>{workspace.label}</strong> · {workspaceScreenCount(workspace.id)} screens</summary>
                    <p>{ecosystemEnvironment(workspace.id)} environment · specification routes, not production activation claims.</p>
                    <ul>
                      {screens.map((screen) => <li key={screen.route}><code>{screen.route}</code> — {screen.label}</li>)}
                    </ul>
                  </details>
                );
              })}
            </div>
          )}
        </section>
      )}

      {view === 'capabilities' && (
        <section aria-labelledby="ecosystem-capabilities-heading">
          <SectionLabel aside={`${capabilities.length} shown`}>
            <span id="ecosystem-capabilities-heading">Capability contract</span>
          </SectionLabel>
          <p>The archive baseline records design intent and proposed data/backend facts. Current implementation, test, deployment, authorization and enablement evidence remains owned by Semester’s repository-native registers.</p>
          <p>{capabilityDomainCounts().map((domain) => `${DOMAIN_LABELS[domain.id] ?? domain.id}: ${domain.count}`).join(' · ')}</p>
          {capabilities.length === 0 ? (
            <p role="status">No capabilities match this console filter.</p>
          ) : (
            <div className="cards">
              {capabilities.map((capability) => (
                <details className="tile" key={capability.id}>
                  <summary><strong>{capability.id}</strong> · {capability.area}</summary>
                  <dl>
                    <dt>Archive domain</dt><dd>{DOMAIN_LABELS[capability.ws] ?? capability.ws}</dd>
                    <dt>Actors</dt><dd>{capability.actors.join(', ') || 'None named'}</dd>
                    <dt>Permissions</dt><dd>{capability.perms.join(', ') || 'None named'}</dd>
                    <dt>Proposed routes</dt><dd>{capability.routes.join(', ') || 'None named'}</dd>
                    <dt>Design reference</dt><dd><code>{capability.design}</code></dd>
                    <dt>Runtime status</dt><dd>Use repository evidence; archive status is not promoted.</dd>
                  </dl>
                </details>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

