import { describe, expect, it } from 'vitest';
import { DATA_CLASSES, dataClasses } from '@semester/offline-sync';
import { OFFICIAL_PREFIXES } from './classes';

describe('the offline policy table, against the app', () => {
  // This lives here, not in packages/offline-sync, because a package imports none of the app (importboundaries).
  it('treats every class the app already calls official as never-queued', () => {
    // The app's own list of official write names must not drift away from the package's table.
    const official = dataClasses.filter((c) => OFFICIAL_PREFIXES.some((p) => c.startsWith(p)));
    expect(official.length).toBeGreaterThan(0);
    for (const c of official) expect(DATA_CLASSES[c].write, c).toBe('never-queued');
  });
});
