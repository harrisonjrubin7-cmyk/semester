import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DATA_CLASSES, DESTINATIONS, PLATFORM_ROUTES, routeAllowed, tighten } from './classification';
import { gate } from '../toolkit/classification';

describe('data classification', () => {
  it('never sends T3 or above to a consumer model', () => {
    for (const c of ['T3', 'T4', 'T5', 'T6'] as const) expect(routeAllowed(c, 'consumer_ai')).toBe(false);
  });

  it('hard-blocks T4–T6 from AI, Community and connectors', () => {
    for (const c of ['T4', 'T5', 'T6'] as const) {
      for (const d of DESTINATIONS) expect(routeAllowed(c, d), `${c} → ${d}`).toBe(false);
    }
  });

  it('keeps T3 records out of Community and external connectors, and T2 work out of connectors', () => {
    expect(routeAllowed('T3', 'community')).toBe(false);
    expect(routeAllowed('T3', 'external_connector')).toBe(false);
    expect(routeAllowed('T2', 'external_connector')).toBe(false);
  });

  it('leaves T0–T2 in Community to the school, course and student, as the command does', () => {
    for (const c of ['T0', 'T1', 'T2'] as const) expect(routeAllowed(c, 'community'), c).toBe(true);
    expect(routeAllowed('T2', 'community', { T2: { community: false } })).toBe(false);
  });

  /*
   * Two T0–T6 implementations exist: this one, the platform floor the database
   * also enforces, and the AI Toolkit's gate (lib/toolkit/classification.ts),
   * which answers a student about one action. The toolkit may be stricter —
   * it keeps T3 from every AI path — but it must never allow what the floor
   * forbids, or a student would be told yes by a screen and no by the server.
   */
  it('is never contradicted by a looser AI Toolkit gate', () => {
    const toDestination = { store: 'semester', ai: 'approved_ai', share: 'community', external: 'external_connector' } as const;
    for (const t of DATA_CLASSES) {
      for (const [action, dest] of Object.entries(toDestination)) {
        for (const courseAllowsAi of [true, false]) {
          const toolkit = gate(t, action as keyof typeof toDestination, courseAllowsAi);
          if (toolkit.allowed) expect(routeAllowed(t, dest), `${t} ${action} (course AI ${courseAllowsAi})`).toBe(true);
        }
      }
    }
  });

  it('lets a school be stricter and never looser', () => {
    expect(routeAllowed('T1', 'approved_ai', { T1: { approved_ai: false } })).toBe(false);
    expect(routeAllowed('T3', 'consumer_ai', { T3: { consumer_ai: true } })).toBe(false);
    expect(tighten('T1', { ...PLATFORM_ROUTES.T1, consumer_ai: true })).toMatch(/only be stricter/);
    expect(tighten('T1', { ...PLATFORM_ROUTES.T1, approved_ai: false })).toBeNull();
  });

  it('matches the platform floor the migration seeds', () => {
    const sql = readFileSync(resolve(__dirname, '../../../../supabase/migrations/20260927170000_integration_control_plane.sql'), 'utf8');
    for (const c of DATA_CLASSES) {
      const row = sql.match(new RegExp(`\\(null, '${c}', (true|false),\\s+(true|false),\\s+(true|false),\\s+(true|false),\\s+(true|false),`));
      expect(row, c).not.toBeNull();
      const [, semester, approved, consumer, connector, community] = row!;
      expect(PLATFORM_ROUTES[c], c).toEqual({
        semester: semester === 'true', approved_ai: approved === 'true', consumer_ai: consumer === 'true',
        external_connector: connector === 'true', community: community === 'true',
      });
    }
  });
});
