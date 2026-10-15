import { describe, expect, it } from 'vitest';
import {
  ECOSYSTEM_CAPABILITIES,
  ECOSYSTEM_SCREENS,
  ECOSYSTEM_WORKSPACES,
  capabilityDomainCounts,
  ecosystemSummary,
  validateEcosystemRegistry,
} from './ecosystem';

describe('connected ecosystem handoff registry', () => {
  it('keeps the complete supplied workspace, screen and capability populations', () => {
    expect(ECOSYSTEM_WORKSPACES).toHaveLength(26);
    expect(ECOSYSTEM_SCREENS).toHaveLength(281);
    expect(ECOSYSTEM_CAPABILITIES).toHaveLength(122);
    expect(ecosystemSummary()).toMatchObject({ workspaces: 26, screens: 281, capabilities: 122 });
  });

  it('has unique, workspace-bound routes and capability ids', () => {
    expect(validateEcosystemRegistry()).toEqual([]);
  });

  it('does not discard any supplied capability domain', () => {
    expect(capabilityDomainCounts()).toEqual([
      { id: 'acct', count: 4 },
      { id: 'company', count: 25 },
      { id: 'dev', count: 3 },
      { id: 'edu', count: 26 },
      { id: 'inst', count: 21 },
      { id: 'ops', count: 20 },
      { id: 'public', count: 10 },
      { id: 'shared', count: 13 },
    ]);
  });
});

