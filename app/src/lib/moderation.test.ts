import { describe, expect, it } from 'vitest';
import {
  REPORT_STATUSES,
  ageLine,
  counts,
  isKnownStatus,
  nextFor,
  queueLine,
  queueOrder,
  readReport,
  repeats,
  shortId,
  statusLabel,
  unfinished,
  type Report,
} from './moderation';

const NOW = Date.parse('2026-09-21T12:00:00Z');
const DAY = 86_400_000;

const when = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString();

const report = (over: Partial<Report> = {}): Report => ({
  id: 'r1',
  reporter: 'aaaaaaaa-1111-4111-8111-111111111111',
  message_id: 'm1',
  about: 'bbbbbbbb-2222-4222-8222-222222222222',
  reason: 'Told me to kill myself in the ECON room.',
  copy: 'the message, as it was',
  created_at: when(1),
  status: 'open',
  ...over,
});

describe('the four the database allows', () => {
  it('is exactly the four the check constraint names', () => {
    // `20260921214500_report_status.sql`:
    //   check (status in ('open', 'under_review', 'resolved', 'dismissed'))
    // A fifth here that the column refuses is a button that fails on press.
    expect(REPORT_STATUSES).toEqual(['open', 'under_review', 'resolved', 'dismissed']);
  });

  it('offers the other three as the transitions', () => {
    for (const s of REPORT_STATUSES) {
      const next = nextFor(s);
      expect(next).not.toContain(s);
      expect(next).toHaveLength(3);
    }
  });

  it('gives every one a label that is not its stored spelling', () => {
    expect(statusLabel('under_review')).toBe('Under review');
    for (const s of REPORT_STATUSES) expect(statusLabel(s)).not.toMatch(/_/);
  });
});

/*
 * The case that decides the shape of the whole module. `status` is typed
 * `string` rather than the union so that a value a later migration allows and
 * this build has never heard of is *shown*, not dropped and not read as
 * something else. A queue that hides a row it does not understand is the fault
 * the queue exists to fix.
 */
describe('a status this build does not know', () => {
  const odd = report({ status: 'escalated' });

  it('is not mistaken for one that is known', () => {
    expect(isKnownStatus('escalated')).toBe(false);
    expect(isKnownStatus('open')).toBe(true);
  });

  it('is shown as it is stored rather than renamed', () => {
    expect(statusLabel('escalated')).toBe('escalated');
  });

  it('is counted as waiting, not as dealt with', () => {
    // The dangerous direction: reading an unrecognised word as finished would
    // drop a live report out of the number somebody opened this to find.
    expect(unfinished(odd)).toBe(true);
    expect(queueLine([odd])).toBe('1 report is waiting.');
  });

  it('offers all four, because moving it somewhere known is what is left', () => {
    expect(nextFor('escalated')).toEqual(REPORT_STATUSES);
  });

  it('survives being read off the wire', () => {
    const read = readReport({ ...odd });
    expect(read?.status).toBe('escalated');
  });
});

describe('the order the queue is read in', () => {
  const rows = [
    report({ id: 'old-open', created_at: when(30), status: 'open' }),
    report({ id: 'new-resolved', created_at: when(0), status: 'resolved' }),
    report({ id: 'new-open', created_at: when(1), status: 'open' }),
    report({ id: 'old-dismissed', created_at: when(40), status: 'dismissed' }),
  ];

  it('puts what is unfinished first, newest first inside that', () => {
    expect(queueOrder(rows).map((r) => r.id)).toEqual([
      'new-open',
      'old-open',
      'new-resolved',
      'old-dismissed',
    ]);
  });

  it('does not disturb the array it was given', () => {
    const before = rows.map((r) => r.id);
    queueOrder(rows);
    expect(rows.map((r) => r.id)).toEqual(before);
  });

  it('keeps every row', () => {
    // The control. Sorting is where rows go missing, and a queue that loses
    // one is the thing this screen exists to stop.
    expect(queueOrder(rows)).toHaveLength(rows.length);
  });
});

describe('the sentence over the list', () => {
  it('never says the queue is empty without saying the other reason it could be', () => {
    /*
     * The one sentence in this module that could do real harm. An empty answer
     * means either an empty queue or an account the policy does not answer —
     * `public.app_admins` has no select policy, so the device cannot tell
     * which — and "there are no reports" told to somebody who simply cannot
     * read them is a sentence they would repeat to a third party.
     */
    const line = queueLine([]);
    expect(line).toMatch(/administrator/i);
    expect(line).toMatch(/look the same|either/i);
  });

  it('leads with what is waiting', () => {
    const rows = [report({ id: 'a' }), report({ id: 'b', status: 'resolved' })];
    expect(queueLine(rows)).toBe('1 report is waiting. 1 dealt with.');
  });

  it('says so when there is nothing left to do', () => {
    expect(queueLine([report({ status: 'resolved' })])).toBe(
      'Nothing waiting. 1 report has been dealt with.',
    );
  });

  it('counts each status, starting every known one at zero', () => {
    const c = counts([report({ status: 'open' }), report({ status: 'open' })]);
    expect(c.open).toBe(2);
    for (const s of REPORT_STATUSES) expect(c[s]).toBeGreaterThanOrEqual(0);
    expect(c.resolved).toBe(0);
  });
});

describe('an account more than one person has reported', () => {
  const them = 'cccccccc-3333-4333-8333-333333333333';
  const rows = [
    report({ id: '1', about: them, reporter: 'p1' }),
    report({ id: '2', about: them, reporter: 'p2' }),
    report({ id: '3', about: 'someone-else', reporter: 'p1' }),
  ];

  it('is the one thing a queue can say that a single report cannot', () => {
    expect(repeats(rows)).toEqual([{ about: them, reporters: 2, reports: 2 }]);
  });

  it('counts people rather than rows', () => {
    /*
     * Ten reports from one account about somebody they are arguing with is not
     * a pattern, and counting rows would put it at the top of the list — which
     * is the shape of a moderation tool that can be aimed at somebody.
     */
    const oneAngryPerson = [
      report({ id: '1', about: them, reporter: 'p1' }),
      report({ id: '2', about: them, reporter: 'p1' }),
      report({ id: '3', about: them, reporter: 'p1' }),
    ];
    expect(repeats(oneAngryPerson)).toEqual([]);
  });

  it('says nothing when there is no pattern', () => {
    // The control: a probe that finds a pattern in every queue is a probe that
    // finds nothing.
    expect(repeats([report({ id: '1' }), report({ id: '2', about: 'other' })])).toEqual([]);
    expect(repeats([])).toEqual([]);
  });

  it('ignores reports about an account that is already gone', () => {
    expect(repeats([report({ id: '1', about: null }), report({ id: '2', about: null })])).toEqual(
      [],
    );
  });
});

describe('what a row says about people', () => {
  it('shortens an account id and never claims it is a name', () => {
    expect(shortId('bbbbbbbb-2222-4222-8222-222222222222')).toBe('bbbbbbbb');
  });

  it('says so when the account is gone rather than printing nothing', () => {
    expect(shortId(null)).toBe('a deleted account');
  });
});

describe('how long ago it was filed', () => {
  it('reads the way somebody would say it', () => {
    expect(ageLine(when(0), NOW)).toBe('Today');
    expect(ageLine(when(1), NOW)).toBe('Yesterday');
    expect(ageLine(when(3), NOW)).toBe('3 days ago');
    expect(ageLine(when(9), NOW)).toBe('Last week');
    expect(ageLine(when(30), NOW)).toBe('4 weeks ago');
  });

  it('says nothing rather than something wrong about a date it cannot read', () => {
    expect(ageLine('', NOW)).toBe('');
    expect(ageLine('not a date', NOW)).toBe('');
  });
});

describe('reading a row off the wire', () => {
  it('keeps everything the screen draws', () => {
    const read = readReport(report());
    expect(read?.reason).toBe('Told me to kill myself in the ECON room.');
    expect(read?.copy).toBe('the message, as it was');
  });

  it('survives a message or an account that has since been deleted', () => {
    // Both columns are `on delete set null`, so this is the ordinary state of
    // an old report rather than a corrupt row, and dropping it would delete
    // the record of the thing that happened.
    const read = readReport({ ...report(), message_id: null, about: null });
    expect(read).not.toBeNull();
    expect(read?.about).toBeNull();
  });

  it('refuses a row with no complaint in it', () => {
    expect(readReport({ id: 'x' })).toBeNull();
    expect(readReport(null)).toBeNull();
    expect(readReport('a report')).toBeNull();
  });
});
