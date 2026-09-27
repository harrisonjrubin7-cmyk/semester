import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DATA_CLASSES, DESTINATIONS, PLATFORM_ROUTES, routeAllowed, tighten } from './classification';

describe('data classification', () => {
  it('never sends T3 or above to a consumer model', () => {
    for (const c of ['T3', 'T4', 'T5', 'T6'] as const) expect(routeAllowed(c, 'consumer_ai')).toBe(false);
  });

  it('hard-blocks T4–T6 from AI, Community and connectors', () => {
    for (const c of ['T4', 'T5', 'T6'] as const) {
      for (const d of DESTINATIONS) expect(routeAllowed(c, d), `${c} → ${d}`).toBe(false);
    }
  });

  it('keeps T2 student work and T3 records out of Community and external connectors', () => {
    for (const c of ['T2', 'T3'] as const) {
      expect(routeAllowed(c, 'community')).toBe(false);
      expect(routeAllowed(c, 'external_connector')).toBe(false);
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
