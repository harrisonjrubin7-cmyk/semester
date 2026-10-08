import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  COMMON_FIELDS,
  MARKETING_EVENTS,
  NO_OP_SINK,
  buildEvent,
  createTracker,
  marketing,
  type MarketingEvent,
} from './marketingevents';

/**
 * The event contract, and the promise that nothing is collected.
 * See `lib/marketingevents.ts` and docs/marketing/MARKETING_ANALYTICS_EVENT_TAXONOMY.md.
 */

const ctx = { now: 1_000, consent: 'granted' as const };

describe('buildEvent', () => {
  it('builds a browser event with its own extra field', () => {
    const r = buildEvent('marketing_cta_clicked', { cta_id: 'student_start', page_type: 'home' }, ctx);
    expect(r).toEqual({
      ok: true,
      value: { v: 1, event: 'marketing_cta_clicked', ts: 1_000, consent_state: 'granted', fields: { cta_id: 'student_start', page_type: 'home' } },
    });
  });

  it('refuses an unknown event', () => {
    expect(buildEvent('marketing_anything', {}, ctx)).toMatchObject({ ok: false, error: { kind: 'unknown_event' } });
    expect(buildEvent('toString', {}, ctx)).toMatchObject({ ok: false, error: { kind: 'unknown_event' } });
  });

  it('refuses the events the server observes', () => {
    for (const [name, spec] of Object.entries(MARKETING_EVENTS)) {
      if (spec.origin !== 'server') continue;
      expect(buildEvent(name, {}, ctx), name).toMatchObject({ ok: false, error: { kind: 'server_only' } });
    }
  });

  it('refuses a field the event does not allow, rather than dropping it', () => {
    expect(buildEvent('marketing_pricing_viewed', { cta_id: 'x' }, ctx)).toEqual({
      ok: false,
      error: { kind: 'unknown_fields', fields: ['cta_id'] },
    });
    for (const never of ['email', 'name', 'user_id', 'tenant_id', 'anon_id', 'ip', 'message', 'grade']) {
      expect(buildEvent('marketing_page_viewed', { [never]: 'x' }, ctx), never).toMatchObject({ ok: false });
    }
  });

  it('refuses a value that is an address, a URL, a path or prose', () => {
    for (const bad of ['a@b.edu', 'https://x.test/?t=1', '/trust/security', '../x', 'two words', '<b>', '', 'x'.repeat(101)]) {
      expect(buildEvent('marketing_cta_clicked', { cta_id: bad }, ctx), JSON.stringify(bad)).toMatchObject({
        ok: false,
        error: { kind: 'unsafe_value', field: 'cta_id' },
      });
    }
  });

  it('takes a referrer as a host only', () => {
    expect(buildEvent('marketing_page_viewed', { referrer: 'www.google.com' }, ctx).ok).toBe(true);
    expect(buildEvent('marketing_page_viewed', { referrer: 'www.google.com/search?q=semester' }, ctx).ok).toBe(false);
  });

  it('lists every event of the taxonomy and no other', () => {
    const doc = readFileSync(
      join(__dirname, '..', '..', '..', 'docs', 'marketing', 'MARKETING_ANALYTICS_EVENT_TAXONOMY.md'),
      'utf8',
    );
    const named = new Set<string>();
    for (const line of doc.split('\n')) {
      if (!line.startsWith('| `marketing_')) continue;
      const cell = line.split('|')[1];
      const base = [...cell.matchAll(/`(marketing_[a-z_]+)`/g)].map((m) => m[1]);
      // "`marketing_resource_viewed` / `_downloaded`" names a second event by its suffix.
      const suffixed = [...cell.matchAll(/`(_[a-z]+)`/g)].map((m) => base[0].replace(/_[a-z]+$/, m[1]));
      for (const n of [...base, ...suffixed]) named.add(n);
    }
    expect([...named].sort()).toEqual(Object.keys(MARKETING_EVENTS).sort());
  });

  it('keeps the common fields to the taxonomy’s list', () => {
    expect([...COMMON_FIELDS].sort()).toEqual(
      ['page_slug', 'page_type', 'referrer', 'utm_campaign', 'utm_content', 'utm_medium', 'utm_source'].sort(),
    );
  });
});

describe('createTracker', () => {
  function rig(consent: 'granted' | 'denied' | 'unset') {
    const sent: MarketingEvent[] = [];
    const tracker = createTracker({ sink: { send: (e) => sent.push(e) }, consent: () => consent, now: () => 5 });
    return { sent, tracker };
  }

  it('sends nothing unless consent is granted (fail closed)', () => {
    for (const c of ['denied', 'unset'] as const) {
      const { sent, tracker } = rig(c);
      expect(tracker.track('marketing_page_viewed')).toEqual({ sent: false, reason: 'consent' });
      expect(sent, c).toEqual([]);
    }
  });

  it('sends once consent is granted', () => {
    const { sent, tracker } = rig('granted');
    expect(tracker.track('marketing_pricing_viewed', { page_type: 'pricing' })).toEqual({ sent: true });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ event: 'marketing_pricing_viewed', ts: 5, consent_state: 'granted' });
  });

  it('reports a refusal to a caller that may be tracked, and sends nothing', () => {
    const { sent, tracker } = rig('granted');
    expect(tracker.track('marketing_page_viewed', { email: 'a@b.edu' })).toMatchObject({ sent: false, reason: 'refused' });
    expect(sent).toEqual([]);
  });

  it('does not build an event for a caller that has not consented', () => {
    // A bad value is not even looked at before consent: nothing about the visitor is processed.
    const { tracker } = rig('unset');
    expect(tracker.track('marketing_page_viewed', { email: 'a@b.edu' })).toEqual({ sent: false, reason: 'consent' });
  });
});

describe('nothing is collected', () => {
  it('the tracker the app has never sends, whatever it is asked', () => {
    expect(marketing.track('marketing_page_viewed')).toEqual({ sent: false, reason: 'consent' });
    expect(NO_OP_SINK.send({ v: 1, event: 'marketing_page_viewed', ts: 0, consent_state: 'granted', fields: {} })).toBeUndefined();
  });

  it('the module reaches no network, storage or cookie', () => {
    const source = readFileSync(join(__dirname, 'marketingevents.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    for (const reach of ['fetch(', 'sendBeacon', 'XMLHttpRequest', 'WebSocket', 'localStorage', 'sessionStorage', 'indexedDB', 'document.cookie', 'navigator.']) {
      expect(source.includes(reach), reach).toBe(false);
    }
  });

  it('control: the source scan does see a reach when there is one', () => {
    const planted = 'export const x = () => fetch("https://t.example/");';
    expect(planted.includes('fetch(')).toBe(true);
  });

  it('nothing else in the app builds a tracker over a real sink', () => {
    // Collection is a decision (D-4); wiring one in must be a deliberate change to this test.
    const src = join(__dirname, '..');
    const hits = (readdirSync(src, { recursive: true }) as string[])
      .filter((f) => /\.tsx?$/.test(f))
      .filter((f) => readFileSync(join(src, f), 'utf8').includes('createTracker'))
      .map((f) => `src/${f}`)
      .sort();
    expect(hits).toEqual(['src/lib/marketingevents.test.ts', 'src/lib/marketingevents.ts']);
  });
});
