import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validatePassport } from './passport';

const DIR = new URL('../../../../registry/passports/', import.meta.url);
const files = readdirSync(DIR).filter((f) => f.endsWith('.json'));
const load = (file: string) => JSON.parse(readFileSync(new URL(file, DIR), 'utf8'));
const base = () => load('WF-READINESS-001.json');

describe('component passports on disk', () => {
  it('has at least one passport, so the check below is not vacuous', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s is complete and named after its id', (file) => {
    const doc = load(file);
    expect(validatePassport(doc)).toEqual([]);
    expect(file).toBe(`${doc.passport.identity.id}.json`);
  });
});

describe('passport rules reject what they should', () => {
  it('accepts the on-disk example as the control', () => {
    expect(validatePassport(base())).toEqual([]);
  });

  it.each<[string, (d: any) => void, string]>([
    ['a missing section', (d) => delete d.passport.control_plane, 'control_plane'],
    ['an unknown type', (d) => (d.passport.identity.type = 'spreadsheet'), 'identity.type'],
    ['a malformed id', (d) => (d.passport.identity.id = 'readiness workflow'), 'identity.id'],
    ['no prohibited uses', (d) => (d.passport.boundaries.prohibited_uses = []), 'boundaries.prohibited_uses'],
    ['no policy attached', (d) => (d.passport.control_plane.policy_ids = []), 'control_plane.policy_ids'],
    ['a policy reference with another prefix', (d) => (d.passport.control_plane.policy_ids = ['WF-READINESS-001']), 'control_plane.policy_ids[0]'],
    ['evidence with a lowercase id', (d) => (d.passport.control_plane.required_evidence = ['evd-rls-001']), 'control_plane.required_evidence[0]'],
    ['a release gate that is a policy id', (d) => (d.passport.control_plane.release_gate = 'POL-READINESS-001'), 'control_plane.release_gate'],
    ['a test suite with no id', (d) => (d.passport.quality.test_suites = ['readiness suite']), 'quality.test_suites[0]'],
    ['an objective with another prefix', (d) => (d.passport.quality.service_objectives = ['TST-READINESS-001']), 'quality.service_objectives[0]'],
    ['no release gate', (d) => (d.passport.control_plane.release_gate = ' '), 'control_plane.release_gate'],
    ['no accessibility requirement', (d) => (d.passport.quality.accessibility_requirements = []), 'quality.accessibility_requirements'],
    ['a negative maturity level', (d) => (d.passport.lifecycle.maturity_level = -1), 'lifecycle.maturity_level'],
    [
      'an active status with no dates',
      (d) => (d.passport.lifecycle.current_status = 'verified_not_activated'),
      'lifecycle.created_at',
    ],
    [
      'an active status with a placeholder review date',
      (d) => {
        d.passport.lifecycle.current_status = 'active';
        d.passport.lifecycle.created_at = '2026-10-01';
      },
      'lifecycle.last_reviewed_at',
    ],
  ])('flags %s', (_name, mutate, path) => {
    const doc = base();
    mutate(doc);
    expect(validatePassport(doc).map((p) => p.path)).toContain(path);
  });

  it('allows an active passport once both dates are real', () => {
    const doc = base();
    doc.passport.lifecycle = { ...doc.passport.lifecycle, current_status: 'active', created_at: '2026-10-01', last_reviewed_at: '2026-10-13' };
    expect(validatePassport(doc)).toEqual([]);
  });

  it('rejects a non-object', () => {
    expect(validatePassport('WF-READINESS-001')).toHaveLength(1);
  });
});
