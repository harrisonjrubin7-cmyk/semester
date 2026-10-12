import { describe, expect, it } from 'vitest';
import { governanceFor } from '../screen-governance';
import { rootOf, screenName } from '../nav';
import { fromHash } from '../route';

describe('the restricted Company route', () => {
  it('opens the canonical screen without pretending subpath ids are supported', () => {
    expect(fromHash('#/company')).toEqual({ screen: 'company', id: '' });
    expect(fromHash('#/company/account/account-1')).toEqual({ screen: 'company', id: '' });
  });

  it('is named and governed as an internal Semester operator workspace', () => {
    expect(screenName('company')).toBe('Company');
    expect(rootOf('company')).toBe('me');
    const governance = governanceFor('company');
    expect(governance.maturity).toBe('internal');
    expect(governance.primaryUser).toBe('semester-operator');
    expect(governance.permissionModel).toContain('capability');
  });
});
