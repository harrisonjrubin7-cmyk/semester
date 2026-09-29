import { describe, expect, it } from 'vitest';
import { FUNNELS, NEVER_IN_MARKETING, PILLARS, PLATFORMS, PRINCIPLE } from './social';
import { ROUTES } from '../../site/render';
import { screenName } from '../nav';
import { ROOTS } from '../../state/shape';

/**
 * The social plan is held to the tree: every funnel step that names a page
 * names a route the site builds, every step that names a screen names one the
 * app has, and every funnel ends somewhere a student does something.
 */
describe('the social media ecosystem', () => {
  const paths = new Set(ROUTES.map((r) => r.path));

  it('starts from the principle and the marketing boundary', () => {
    expect(PRINCIPLE).toMatch(/top of the funnel/);
    expect(NEVER_IN_MARKETING).toMatch(/written permission/);
  });

  it('has ten pillars and seven platforms, each with a purpose', () => {
    expect(PILLARS).toHaveLength(10);
    expect(new Set(PILLARS.map((p) => p.id)).size).toBe(10);
    for (const p of PILLARS) expect(p.example.length, p.id).toBeGreaterThan(10);
    expect(PLATFORMS).toHaveLength(7);
    expect(PLATFORMS.map((p) => p.platform)).toContain('In-app community');
  });

  it('leads every post to a page that exists, a screen that exists, and an action', () => {
    for (const f of FUNNELS) {
      expect(f.steps[0].kind, f.id).toBe('social');
      expect(f.steps.length, f.id).toBeGreaterThanOrEqual(4);
      expect(f.steps[f.steps.length - 1].kind, f.id).not.toBe('social');
      for (const s of f.steps) {
        if (s.kind === 'site' || s.kind === 'account') expect(paths.has(s.path), `${f.id}: ${s.path}`).toBe(true);
        if (s.kind === 'app') expect(screenName(s.screen as never), `${f.id}: ${s.screen}`).not.toBe(s.screen);
      }
    }
  });

  it('ends the student funnels in the app, and the institution funnel with a person', () => {
    const last = (id: string) => FUNNELS.find((f) => f.id === id)!.steps.at(-1)!;
    expect(last('registration').kind).toBe('app');
    expect(last('study').kind).toBe('app');
    expect(last('institutions')).toMatchObject({ kind: 'site', path: '/contact/' });
    expect(ROOTS).toContain('study');
  });
});
