import { describe, expect, it } from 'vitest';
import { resolve, type PolicyNode } from './hierarchy';

const system: PolicyNode = {
  id: 'sys', level: 'system', systemId: 'sys',
  features: { 'module.integration_dashboard': 'production', 'ops.external_ai_generation': 'preview' },
  retentionDays: 365, brand: { name: 'State University System', accent: '#003366' },
};
const campus: PolicyNode = { id: 'north', level: 'campus', systemId: 'sys', parentId: 'sys', brand: { name: 'North Campus' } };
const law: PolicyNode = { id: 'law', level: 'school', systemId: 'sys', parentId: 'north', aiAllowed: false, retentionDays: 180 };
const course: PolicyNode = {
  id: 'torts', level: 'course', systemId: 'sys', parentId: 'law', aiAllowed: true,
  features: { 'ops.external_ai_generation': 'production', 'module.nope': 'production' }, retentionDays: 400,
};

describe('multi-campus policy inheritance', () => {
  it('lets a child narrow and never widen', () => {
    const r = resolve([system, campus, law, course], 'torts');
    if (!r.ok) throw new Error(r.error);
    expect(r.policy.features['ops.external_ai_generation']).toBe('preview');
    expect(r.policy.features['module.nope']).toBe('off');
    expect(r.policy.aiAllowed).toBe(false);
    expect(r.policy.retentionDays).toBe(180);
    expect(r.policy.clamped.length).toBe(4);
  });

  it('inherits brand from the nearest level that sets it', () => {
    const r = resolve([system, campus, law], 'law');
    if (!r.ok) throw new Error(r.error);
    expect(r.policy.brand).toEqual({ name: 'North Campus', accent: '#003366' });
  });

  it('holds class routes to the platform floor even when a child asks for more', () => {
    const loose: PolicyNode = { ...campus, classRoutes: { T3: { consumer_ai: true } } };
    const r = resolve([system, loose], 'north');
    if (!r.ok) throw new Error(r.error);
    expect(r.policy.classRoutes.T3.consumer_ai).toBe(false);
    expect(r.policy.clamped).toContain('north: T3 → consumer_ai asked open, held closed');
  });

  it('isolates systems: a campus cannot inherit from another system', () => {
    const stray: PolicyNode = { ...campus, id: 'stray', systemId: 'other' };
    const r = resolve([system, stray], 'stray');
    expect(r.ok).toBe(false);
  });

  it('refuses a root that is not a system, a level out of order, and a cycle', () => {
    expect(resolve([campus], 'north').ok).toBe(false);
    expect(resolve([system, { ...course, parentId: 'sys' }, { ...law, parentId: 'torts' }], 'law').ok).toBe(false);
    expect(resolve([{ ...system, parentId: 'north' }, campus], 'north').ok).toBe(false);
  });
});
