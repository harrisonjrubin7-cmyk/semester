import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COUNCIL, SEATS } from '../launchreadiness';
import { STATUSES } from '../communitiesregister';
import { OWNER_ROLES, PRODUCT_AREAS, ownerships, vacantOwnerships } from './operatingmodel';

const root = join(import.meta.dirname, '../../../..');
const isTest = (p: string) => /\.test\.tsx?$/.test(p) || /^supabase\/[^/]+\.check\.sql$/.test(p);
const isDoc = (p: string) => /\.(md|pdf|json)$/.test(p);

describe('the operating model', () => {
  it('has the brief’s ten product areas, once each, in its order', () => {
    expect(PRODUCT_AREAS.map((a) => a.area)).toEqual([
      'Student Experience',
      'Academic & Learning Experience',
      'Campus & Community Experience',
      'Career & Opportunity Experience',
      'Institution Operations',
      'Trust, Privacy & Security',
      'Integrations & Data',
      'AI & Automation',
      'Customer Success',
      'Growth & Community',
    ]);
    expect(new Set(PRODUCT_AREAS.map((a) => a.id)).size).toBe(PRODUCT_AREAS.length);
  });

  it('fills every field the brief asks each area to define', () => {
    for (const a of PRODUCT_AREAS) {
      for (const f of [a.primaryUser, a.problem, a.successMetric, a.fallback, a.next]) expect(f.trim().length, a.id).toBeGreaterThan(15);
      for (const r of OWNER_ROLES) expect(a.owners[r], `${a.id} ${r}`).toBeTruthy();
      expect(STATUSES, a.id).toContain(a.maturity);
    }
  });

  it('names only council seats as owners, never a person or a team', () => {
    for (const o of ownerships()) expect(SEATS, `${o.area} ${o.role}`).toContain(o.seat);
  });

  it('depends only on areas that exist, and never on itself', () => {
    const ids = new Set(PRODUCT_AREAS.map((a) => a.id));
    for (const a of PRODUCT_AREAS) for (const d of a.dependsOn) {
      expect(ids.has(d), `${a.id} → ${d}`).toBe(true);
      expect(d).not.toBe(a.id);
    }
  });

  it('never measures success in time spent, clicks or page views', () => {
    for (const a of PRODUCT_AREAS) expect(a.successMetric, a.id).not.toMatch(/time (spent )?in the app|session (time|length)|page ?views|clicks/i);
  });

  it('cites only files that exist, and holds the maturity to the kind of file it cites', () => {
    expect(existsSync(join(root, 'docs/no-such-operating-model.md'))).toBe(false);
    for (const a of PRODUCT_AREAS) {
      const paths = a.evidence.map((e) => e.path);
      for (const p of paths) expect(existsSync(join(root, p)), `${a.id} cites ${p}`).toBe(true);
      if (a.maturity === 'tested') expect(paths.some(isTest), `${a.id} is tested and cites no test`).toBe(true);
      if (a.maturity === 'building') expect(paths.some((p) => !isDoc(p)), `${a.id} is building and cites no code`).toBe(true);
      if (a.maturity === 'designed') expect(paths.some(isDoc), `${a.id} is designed and cites no document`).toBe(true);
    }
  });

  it('counts the ownerships that rest on a vacant seat, and the count moves with the council', () => {
    const held = (s: string) => COUNCIL.find((c) => c.seat === s)?.holder != null;
    const vacant = vacantOwnerships(held);
    expect(ownerships()).toHaveLength(PRODUCT_AREAS.length * OWNER_ROLES.length);
    // The control: with every seat held, nothing is vacant; with none held, everything is.
    expect(vacantOwnerships(() => true)).toHaveLength(0);
    expect(vacantOwnerships(() => false)).toHaveLength(ownerships().length);
    expect(vacant.length).toBeGreaterThan(0);
    for (const o of vacant) expect(held(o.seat)).toBe(false);
  });
});
