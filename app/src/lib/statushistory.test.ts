import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  COMPONENTS,
  COMPONENT_IDS,
  DAYS,
  FUNCTION_ANSWERS,
  barState,
  emptyHistory,
  incidentDays,
  incidentFeed,
  incidentProblems,
  probeAll,
  prune,
  record,
  summarise,
  type History,
  type Incident,
  type IncidentFile,
} from '../../scripts/status-history.mjs';

/**
 * The status history: what the hourly check writes down and what the pages and
 * the feed say about it.
 *
 * The rules are the point. A day nobody checked is "no data yet", never up; an
 * hour the scheduler skipped records nothing; uptime is a fraction of the
 * checks that were made and is null when there were none. Each is shown a case
 * that would break it before the real one is trusted.
 */

const root = join(import.meta.dirname, '../../..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const NOW = new Date('2026-10-05T12:30:00Z');
const APP = 'https://example.github.io/semester';
const CONFIG = { app: APP, supabase: 'https://x.supabase.co', key: 'k' };

const all = (v: boolean) => Object.fromEntries(COMPONENT_IDS.map((id) => [id, v]));

describe('a day’s bar', () => {
  it('is up only when every check passed, down only when none did, and no data when nobody looked', () => {
    expect(barState(24, 24)).toBe('up');
    expect(barState(23, 24)).toBe('partial');
    expect(barState(0, 24)).toBe('down');
    expect(barState(0, 0)).toBe('nodata');
    expect(barState(undefined, undefined)).toBe('nodata');
  });

  it('is never up for a day with no checks, however the numbers are missing', () => {
    // The control: 0 === 0 is the trap. A day with 0 of 0 checks would read as every check passing.
    expect(0 === 0).toBe(true);
    for (const [ok, total] of [[0, 0], [undefined, 0], [undefined, undefined], [5, 0]] as const) expect(barState(ok, total)).toBe('nodata');
  });
});

describe('recording', () => {
  it('starts history at the first check, and adds up the checks within a day', () => {
    let h = emptyHistory();
    expect(h.since).toBeNull();
    h = record(h, { ...all(true), sync: false }, '2026-10-05T01:17:00Z');
    h = record(h, all(true), '2026-10-05T02:17:00Z');
    expect(h.since).toBe('2026-10-05T01:17:00.000Z');
    expect(h.days['2026-10-05'].sync).toEqual({ ok: 1, total: 2 });
    expect(h.days['2026-10-05'].app).toEqual({ ok: 2, total: 2 });
  });

  it('records nothing for an hour that was not checked, and for a component not probed', () => {
    let h = record(emptyHistory(), all(true), '2026-10-05T01:17:00Z');
    h = record(h, { app: true }, '2026-10-05T03:17:00Z');
    expect(h.days['2026-10-05'].app).toEqual({ ok: 2, total: 2 });
    expect(h.days['2026-10-05'].signin).toEqual({ ok: 1, total: 1 });
    expect(Object.keys(h.days)).toEqual(['2026-10-05']); // no day appears for a skipped one
  });

  it('does not change the history it was given', () => {
    const before = emptyHistory();
    record(before, all(true), NOW);
    expect(before).toEqual(emptyHistory());
  });

  it('keeps 90 days and drops the rest', () => {
    const h: History = { version: 1, since: '2026-01-01T00:00:00Z', days: { '2026-07-08': { app: { ok: 1, total: 1 } }, '2026-07-07': { app: { ok: 1, total: 1 } } } };
    // NOW is 2026-10-05: the 90th day back, counting today, is 2026-07-08.
    expect(Object.keys(prune(h, NOW).days)).toEqual(['2026-07-08']);
  });
});

describe('the 90-day summary', () => {
  it('has 90 bars per component ending today, and no data before recording began', () => {
    const h = record(emptyHistory(), all(true), '2026-10-05T01:00:00Z');
    const s = summarise(h, NOW);
    expect(Object.keys(s)).toEqual(COMPONENT_IDS);
    for (const id of COMPONENT_IDS) {
      const { bars } = s[id];
      expect(bars).toHaveLength(DAYS);
      expect(bars[DAYS - 1]).toMatchObject({ day: '2026-10-05', state: 'up' });
      expect(bars.slice(0, DAYS - 1).every((b) => b.state === 'nodata')).toBe(true);
      expect(s[id].daysWithData).toBe(1);
    }
  });

  it('says nothing about uptime until something was checked', () => {
    const s = summarise(emptyHistory(), NOW);
    for (const id of COMPONENT_IDS) {
      expect(s[id].percent).toBeNull();
      expect(s[id].bars.every((b) => b.state === 'nodata')).toBe(true);
    }
  });

  it('works the uptime out from the checks made: 24/24, 23/24 and 0/24 is 47 of 72, 65.28%', () => {
    const h: History = {
      version: 1,
      since: '2026-10-03T00:00:00Z',
      days: {
        '2026-10-03': { app: { ok: 24, total: 24 } },
        '2026-10-04': { app: { ok: 23, total: 24 } },
        '2026-10-05': { app: { ok: 0, total: 24 } },
      },
    };
    const app = summarise(h, NOW).app;
    expect(app.ok).toBe(47);
    expect(app.total).toBe(72);
    expect(app.percent).toBe(65.28);
    expect(app.daysWithData).toBe(3);
    expect(app.bars.slice(-3).map((b) => b.state)).toEqual(['up', 'partial', 'down']);
    // The control: a summary that averaged the three days’ own percentages would say 65.28 only by luck.
    expect(Math.round(((100 + 95.83 + 0) / 3) * 100) / 100).toBe(65.28);
  });

  it('weights by checks, not by days: a day of one failed check does not outweigh a full day', () => {
    const h: History = { version: 1, since: 'x', days: { '2026-10-04': { app: { ok: 24, total: 24 } }, '2026-10-05': { app: { ok: 0, total: 1 } } } };
    expect(summarise(h, NOW).app.percent).toBe(96);
  });
});

describe('the probes', () => {
  const fake = (respond: (url: string, init: RequestInit) => number | Error) => {
    const calls: { url: string; method: string; origin?: string }[] = [];
    const f = (async (url: string, init: RequestInit = {}) => {
      const headers = (init.headers ?? {}) as Record<string, string>;
      calls.push({ url, method: init.method ?? 'GET', origin: headers.origin });
      const r = respond(url, init);
      if (r instanceof Error) throw r;
      return { status: r, ok: r >= 200 && r < 300 };
    }) as unknown as typeof fetch;
    return { f, calls };
  };

  it('finds everything up when everything answers', async () => {
    const { f } = fake(() => 200);
    expect(await probeAll(CONFIG, f)).toEqual(all(true));
  });

  it('asks each function only for a preflight, with the app’s origin, and never calls it', async () => {
    const { f, calls } = fake(() => 204);
    await probeAll(CONFIG, f);
    const fns = calls.filter((c) => c.url.includes('/functions/v1/'));
    expect(fns.map((c) => c.url.split('/functions/v1/')[1]).sort()).toEqual(['billing-checkout', 'claude']);
    for (const c of fns) {
      expect(c.method).toBe('OPTIONS');
      expect(c.origin).toBe('https://example.github.io');
    }
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('marks only the component that failed, and tries the rest whatever it did', async () => {
    const { f } = fake((url) => (url.includes('/auth/v1/health') ? 503 : 200));
    expect(await probeAll(CONFIG, f)).toEqual({ ...all(true), signin: false });
    const thrown = fake((url) => (url.includes('/rest/v1/') ? new Error('network') : 200));
    expect(await probeAll(CONFIG, thrown.f)).toEqual({ ...all(true), sync: false });
  });

  it('counts a function as running on 200, 204 or 403, and as gone on 404 or a server error', async () => {
    expect([...FUNCTION_ANSWERS].sort()).toEqual([200, 204, 403]);
    for (const [status, up] of [[200, true], [204, true], [403, true], [404, false], [500, false], [502, false]] as const) {
      const { f } = fake((url) => (url.includes('/functions/v1/claude') ? status : 200));
      expect((await probeAll(CONFIG, f)).ai, String(status)).toBe(up);
    }
  });

  it('does not follow a redirect into calling the app up', async () => {
    const { f } = fake((url) => (url.startsWith(APP) ? 301 : 200));
    expect((await probeAll(CONFIG, f)).app).toBe(false);
  });
});

// ── incidents ───────────────────────────────────────────────────────────────

const incident = (over: Partial<Incident> = {}): Incident => ({
  id: 'sync-outage',
  title: 'Saved work was not syncing',
  components: ['sync'],
  impact: 'partial',
  started: '2026-10-05T22:30:00Z',
  resolved: '2026-10-06T01:10:00Z',
  updates: [
    { at: '2026-10-05T22:40:00Z', status: 'investigating', body: 'Sync is failing for some accounts.' },
    { at: '2026-10-06T01:10:00Z', status: 'resolved', body: 'The database recovered & sync caught up.' },
  ],
  ...over,
});
const file = (incidents: Incident[]): IncidentFile => ({ updated: '2026-10-06T01:10:00Z', incidents });

describe('the incident file', () => {
  it('passes a sound one, and an empty one', () => {
    expect(incidentProblems(file([incident()]))).toEqual([]);
    expect(incidentProblems(file([]))).toEqual([]);
  });

  it('catches what makes an incident untrustworthy', () => {
    const p = (over: Partial<Incident>) => incidentProblems(file([incident(over)])).join(' | ');
    expect(p({ id: 'Not A Slug' })).toContain('is not a slug');
    expect(p({ components: ['nope'] })).toContain('not a component');
    expect(p({ components: [] })).toContain('names no component');
    expect(p({ impact: 'bad' as never })).toContain('impact');
    expect(p({ started: 'yesterday' })).toContain('no start time');
    expect(p({ resolved: '2026-10-05T00:00:00Z' })).toContain('resolved before it started');
    expect(p({ updates: [] })).toContain('no updates');
    expect(p({ updates: [{ at: '2026-10-06T01:10:00Z', status: 'resolved', body: 'x' }, { at: '2026-10-05T22:40:00Z', status: 'investigating', body: 'y' }] })).toContain('out of order');
    expect(p({ resolved: null })).toContain('says resolved but has no resolved time');
    expect(p({ updates: [{ at: '2026-10-05T22:40:00Z', status: 'investigating', body: 'x' }] })).toContain('is resolved but its last update is investigating');
    expect(incidentProblems(file([incident(), incident()])).join()).toContain('appears twice');
    expect(incidentProblems({ updated: '2026-10-01T00:00:00Z', incidents: [incident()] }).join()).toContain('earlier than the newest update');
    expect(incidentProblems({})).toEqual(['The file has no incidents list.']);
  });

  it('is on every day an incident touched, including across midnight and while still open', () => {
    expect(incidentDays(incident())).toEqual(['2026-10-05', '2026-10-06']);
    expect(incidentDays(incident({ started: '2026-10-05T10:00:00Z', resolved: '2026-10-05T11:00:00Z' }))).toEqual(['2026-10-05']);
    expect(incidentDays(incident({ resolved: null }), '2026-10-07T09:00:00Z')).toEqual(['2026-10-05', '2026-10-06', '2026-10-07']);
  });

  it('is the file the page and the feed read', () => {
    const live = JSON.parse(read('app/public/status-incidents.json'));
    expect(incidentProblems(live)).toEqual([]);
  });
});

describe('the feed', () => {
  const where = { site: 'https://example.test/status.html', feedUrl: 'https://example.test/status-feed.xml' };

  it('is one entry per incident, newest first, with everything escaped', () => {
    const older = incident({ id: 'older', title: 'Older & <odd>', started: '2026-09-01T00:00:00Z', resolved: '2026-09-01T02:00:00Z', updates: [{ at: '2026-09-01T02:00:00Z', status: 'resolved', body: 'fixed' }] });
    const xml = incidentFeed(file([older, incident()]), where);
    expect(xml.startsWith('<?xml version="1.0" encoding="utf-8"?>')).toBe(true);
    expect(xml.match(/<entry>/g)).toHaveLength(2);
    expect(xml.indexOf('sync-outage')).toBeLessThan(xml.indexOf('older'));
    expect(xml).toContain('Older &amp; &lt;odd&gt; (resolved)');
    expect(xml).toContain('The database recovered &amp; sync caught up.');
    expect(xml).not.toContain('<odd>');
    expect(xml).toContain('<updated>2026-10-06T01:10:00Z</updated>');
  });

  it('is the same every time for the same file', () => {
    expect(incidentFeed(file([incident()]), where)).toBe(incidentFeed(file([incident()]), where));
  });

  it('is what public/status-feed.xml says', () => {
    const live = JSON.parse(read('app/public/status-incidents.json'));
    const rendered = incidentFeed(live, {
      site: 'https://harrisonjrubin7-cmyk.github.io/semester/status.html',
      feedUrl: 'https://harrisonjrubin7-cmyk.github.io/semester/status-feed.xml',
    });
    if (process.env.REGISTERS === 'write') writeFileSync(join(root, 'app/public/status-feed.xml'), rendered);
    expect(read('app/public/status-feed.xml')).toBe(rendered);
  });
});

// ── the pages and the workflow, held to the module ──────────────────────────

/** The `barState` a page carries, lifted out of it and run. */
function pageBarState(html: string): (ok?: number, total?: number) => string {
  const m = /function barState\(ok, ?total\) ?\{[\s\S]*?\}\s*\n/.exec(html);
  if (!m) throw new Error('the page has no barState');
  return new Function(`${m[0]}; return barState;`)() as (ok?: number, total?: number) => string;
}

const CASES: [number | undefined, number | undefined][] = [[24, 24], [23, 24], [0, 24], [0, 0], [undefined, undefined], [undefined, 0], [1, 1], [0, 1], [5, 0]];

describe('the pages', () => {
  const app = read('app/public/status.html');
  const site = `${read('company-site/index.html')}\n${read('company-site/site.js')}`;

  it('both draw a day the way the module does, including a day nobody checked', () => {
    for (const html of [app, site]) {
      const draw = pageBarState(html);
      for (const [ok, total] of CASES) expect(draw(ok, total), `${ok}/${total}`).toBe(barState(ok, total));
    }
  });

  it('can tell a page that draws an unchecked day as up', () => {
    const broken = pageBarState(app.replace("if (!total || total <= 0) return 'nodata';", ''));
    expect(broken(0, 0)).toBe('up'); // the trap the real one avoids
    expect(pageBarState(app)(0, 0)).toBe('nodata');
  });

  it('both list the components the module records, in its order and words', () => {
    const appRows = [...app.matchAll(/\{ id: '([a-z]+)', name: '([^']+)' \}/g)].map((m) => [m[1], m[2]]);
    expect(appRows).toEqual(COMPONENTS.map((c) => [c.id, c.name]));
    const siteRows = [...site.matchAll(/\["([a-z]+)","([^"]+)"\]/g)].map((m) => [m[1], m[2]]).filter(([id]) => COMPONENT_IDS.includes(id));
    expect(siteRows).toEqual(COMPONENTS.map((c) => [c.id, c.name]));
  });

  it('both read the file the workflow writes, from the branch it writes it to', () => {
    const url = 'https://raw.githubusercontent.com/harrisonjrubin7-cmyk/semester/status-data/status-history.json';
    expect(app).toContain(`HISTORY_URL = '${url}'`);
    expect(site).toContain(`HISTORY_URL="${url}"`);
    const wf = read('.github/workflows/production-smoke.yml');
    expect(wf).toContain('status-history.json');
    expect(wf).toContain('refs/heads/status-data');
  });

  it('the company site is allowed to fetch it, and both say what the bars are not', () => {
    expect(read('company-site/vercel.json')).toContain('https://raw.githubusercontent.com');
    for (const html of [app, site]) {
      expect(html).toContain('No data yet');
      expect(html).toContain('no model is called and no payment is attempted');
    }
  });

  it('both keep the feed within reach', () => {
    expect(app).toContain('href="./status-feed.xml"');
    expect(site).toContain('status-feed.xml');
    expect(site).not.toContain('RSS and webhook feeds are planned');
  });
});

describe('the workflow', () => {
  const wf = read('.github/workflows/production-smoke.yml');
  const job = (name: string) => {
    const start = wf.indexOf(`\n  ${name}:\n`);
    const rest = wf.slice(start + 1);
    const next = rest.slice(1).search(/\n  [a-z]+:\n/);
    return next === -1 ? rest : rest.slice(0, next + 1);
  };

  it('gives write access to the job that records, and to no other', () => {
    expect(wf).toMatch(/^permissions:\n {2}contents: read/m);
    expect(job('record')).toContain('contents: write');
    expect(job('public')).not.toContain('write');
    expect(job('institutional')).not.toContain('write');
  });

  it('writes only the status-data branch, never main, and never drops a queued hour', () => {
    const r = job('record');
    expect(r).toContain('git push origin HEAD:refs/heads/status-data');
    expect(r).not.toMatch(/push origin (HEAD:)?(refs\/heads\/)?main/);
    expect(r).toContain('cancel-in-progress: false');
    expect(r).toContain('status-record.mjs');
  });
});
