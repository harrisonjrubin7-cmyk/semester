import { test, eq } from './harness';
import { funnel, attribution, cohorts, Lead } from '../src/lib/marketingReports';

const L = (key: string, createdAt: string, status: string, campaign: string | null = null, source: string | null = null): Lead => ({ key, kind: 'Demo request', createdAt, status, source, campaign });
const leads = [
  L('a', '2026-09-03', 'New', 'c12', 'linkedin'), L('a', '2026-10-02', 'Qualified', 'c12', 'linkedin'),
  L('b', '2026-09-20', 'Contacted', 'c12', 'linkedin'),
  L('c', '2026-10-05', 'Closed', null, null),
  L('d', '2026-10-09', 'New', 'c13', 'newsletter'),
];

test('each person counts once in the funnel, at their best stage; Closed counts as contacted, not qualified', () =>
  eq(funnel(leads), [{ stage: 'New', people: 4, ofPrevious: null }, { stage: 'Contacted', people: 3, ofPrevious: 75 }, { stage: 'Qualified', people: 1, ofPrevious: 33.3 }]));
test('attribution groups by campaign and source tag, with untagged kept visible', () =>
  eq(attribution(leads), [
    { campaign: 'c12', source: 'linkedin', people: 2, qualified: 1, rate: 50 },
    { campaign: '(untagged)', source: '(untagged)', people: 1, qualified: 0, rate: 0 },
    { campaign: 'c13', source: 'newsletter', people: 1, qualified: 0, rate: 0 },
  ]));
test('cohorts use the month of each person\'s first request and count qualified so far', () =>
  eq(cohorts(leads), [{ month: '2026-09', people: 2, qualified: 1, rate: 50 }, { month: '2026-10', people: 2, qualified: 0, rate: 0 }]));
test('empty input gives empty reports and no division by zero', () => eq([funnel([]).map((s) => s.people), attribution([]), cohorts([])], [[0, 0, 0], [], []]));
test('reports carry no contact keys or addresses', () => eq(JSON.stringify([funnel(leads), attribution(leads), cohorts(leads)]).includes('"a"'), false));
