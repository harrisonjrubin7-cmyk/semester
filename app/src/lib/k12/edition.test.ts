import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CHANNELS, MODULES, MOTION, PILOT, SEGMENTS, mayTakeDistrictData } from './edition';
import { districtReady } from './requirements';
import { PILOT_WEEKS } from '../gtm/pilot';

const root = join(import.meta.dirname, '../../../..');

describe('the K–12 edition', () => {
  it('configures the ten modules the playbook names, each on a module that exists', () => {
    expect(MODULES.map((m) => m.module)).toEqual([
      'My Path', 'Registration planning', 'Study Studio', 'Career Hub', 'Campus Hub',
      'Community', 'Supporter view', 'Institution console', 'AI', 'Passport',
    ]);
    for (const m of MODULES) {
      expect(existsSync(join(root, m.base.path)), `${m.module} rests on ${m.base.path}`).toBe(true);
      expect(m.needs.length, `${m.module} says what the configuration still needs`).toBeGreaterThan(20);
    }
  });

  it('never offers a segment whose students are mostly under the minimum age', () => {
    for (const s of SEGMENTS) expect(s.segment).not.toMatch(/elementary|middle school|primary/i);
  });

  it('runs its pilot for the 26 weeks every pilot runs, for students 13 and over only', () => {
    expect(PILOT.weeks).toBe(PILOT_WEEKS);
    expect(PILOT.cohort).toMatch(/13 or over/);
    expect(PILOT.excludes).toContain('Any student under 13');
    expect(PILOT.excludes).toContain('Messaging, matching or discovery between students');
  });

  it('keeps Community off for minors, as the database does', () => {
    expect(MODULES.find((m) => m.module === 'Community')?.needs).toMatch(/Off for every minor today/);
  });

  it('takes a district’s data only when the baseline says so', () => {
    expect(mayTakeDistrictData()).toBe(districtReady().ready);
    expect(mayTakeDistrictData()).toBe(false);
  });

  it('names the motion and the channels', () => {
    expect(MOTION[0]).toMatch(/Free student and counselor tools/);
    expect(MOTION.at(-1)).toMatch(/district-wide/);
    expect(CHANNELS.length).toBeGreaterThan(3);
  });
});
