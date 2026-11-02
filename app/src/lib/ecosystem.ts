import capabilitiesSource from '../data/ecosystem/capabilities.json';
import screensSource from '../data/ecosystem/screens.json';

/**
 * The October design handoff, normalized as a read-only product contract.
 *
 * These rows are useful because they keep every proposed workspace, route and
 * capability in one inspectable place. They are not runtime evidence. In
 * particular, the status fields in the supplied capability registry describe
 * the archive's own baseline and must never be promoted into a deployment or
 * activation claim.
 */

export type EcosystemEnvironment = 'personal' | 'institution' | 'company';

export interface EcosystemScreen {
  ws: string;
  wsLabel: string;
  key: string;
  label: string;
  route: string;
  component: string;
  file: string;
  navFile: string;
  stream: string;
}

export interface EcosystemCapability {
  id: string;
  ws: string;
  area: string;
  routes: readonly string[];
  actors: readonly string[];
  perms: readonly string[];
  design: string;
  status: {
    designed: boolean;
    data: boolean;
    dataPartial: boolean;
    backend: boolean | null;
    implemented: boolean;
    tested: boolean;
    deployed: boolean;
  };
}

interface ScreenRegistry {
  generated: string;
  workspaces: Record<string, string>;
  routes: EcosystemScreen[];
}

interface CapabilityRegistry {
  generated: string;
  source: string;
  count: number;
  capabilities: EcosystemCapability[];
}

const screenRegistry = screensSource as ScreenRegistry;
const capabilityRegistry = capabilitiesSource as CapabilityRegistry;

export const ECOSYSTEM_GENERATED_AT = screenRegistry.generated;
export const ECOSYSTEM_SCREENS = screenRegistry.routes as readonly EcosystemScreen[];
export const ECOSYSTEM_CAPABILITIES = capabilityRegistry.capabilities as readonly EcosystemCapability[];
export const ECOSYSTEM_WORKSPACES = Object.entries(screenRegistry.workspaces).map(([id, label]) => ({ id, label }));

const PERSONAL_WORKSPACES = new Set(['public', 'applicant', 'student', 'family', 'alumni', 'social', 'studio']);
const COMPANY_WORKSPACES = new Set(['company', 'operations', 'os', 'executive']);

export function ecosystemEnvironment(workspace: string): EcosystemEnvironment {
  if (PERSONAL_WORKSPACES.has(workspace)) return 'personal';
  if (COMPANY_WORKSPACES.has(workspace)) return 'company';
  return 'institution';
}

export function ecosystemSummary() {
  return {
    workspaces: ECOSYSTEM_WORKSPACES.length,
    screens: ECOSYSTEM_SCREENS.length,
    capabilities: ECOSYSTEM_CAPABILITIES.length,
    environments: {
      personal: ECOSYSTEM_WORKSPACES.filter((workspace) => ecosystemEnvironment(workspace.id) === 'personal').length,
      institution: ECOSYSTEM_WORKSPACES.filter((workspace) => ecosystemEnvironment(workspace.id) === 'institution').length,
      company: ECOSYSTEM_WORKSPACES.filter((workspace) => ecosystemEnvironment(workspace.id) === 'company').length,
    },
  };
}

export function workspaceScreenCount(workspace: string): number {
  return ECOSYSTEM_SCREENS.filter((screen) => screen.ws === workspace).length;
}

export function capabilityDomainCounts(): readonly { id: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const capability of ECOSYSTEM_CAPABILITIES) {
    counts.set(capability.ws, (counts.get(capability.ws) ?? 0) + 1);
  }
  return [...counts].map(([id, count]) => ({ id, count })).sort((a, b) => a.id.localeCompare(b.id));
}

export function validateEcosystemRegistry(): string[] {
  const problems: string[] = [];
  const workspaceIds = new Set(ECOSYSTEM_WORKSPACES.map((workspace) => workspace.id));
  const routes = new Set<string>();
  const capabilityIds = new Set<string>();

  if (capabilityRegistry.count !== ECOSYSTEM_CAPABILITIES.length) {
    problems.push(`capability count says ${capabilityRegistry.count}, registry contains ${ECOSYSTEM_CAPABILITIES.length}`);
  }

  for (const screen of ECOSYSTEM_SCREENS) {
    if (!workspaceIds.has(screen.ws)) problems.push(`${screen.route}: unknown workspace ${screen.ws}`);
    if (routes.has(screen.route)) problems.push(`${screen.route}: duplicate route`);
    routes.add(screen.route);
    if (!screen.route.startsWith(`#/${screen.ws}/`)) problems.push(`${screen.route}: route does not match workspace ${screen.ws}`);
    if (!screen.label.trim()) problems.push(`${screen.route}: missing label`);
  }

  for (const capability of ECOSYSTEM_CAPABILITIES) {
    if (capabilityIds.has(capability.id)) problems.push(`${capability.id}: duplicate capability`);
    capabilityIds.add(capability.id);
    if (!capability.area.trim()) problems.push(`${capability.id}: missing area`);
  }

  return problems;
}

