import { describe, expect, it } from 'vitest';
import {
  QUIET_DAYS,
  ahead,
  asItems,
  counts,
  daysInStage,
  line,
  missed,
  moveTo,
  newApplication,
  order,
  quiet,
  readApplications,
  safeUrl,
  standing,
  standingOn,
  summary,
  title,
  type Application,
} from './apply';

const NOW = new Date(2026, 8, 4, 9, 0);
const AT = NOW.getTime();
const day = (n: number) => {
  const d = new Date(2026, 8, 4 + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const app = (patch: Partial<Application> = {}, at = AT) => newApplication(patch, at);

describe('what one is called', () => {
  it('joins the role and the place', () => {
    expect(title(app({ role: 'Summer Analyst', org: 'Brookings' }))).toBe(
      'Summer Analyst at Brookings',
    );
  });

  it('uses whichever half was filled in', () => {
    expect(title(app({ org: 'Brookings' }))).toBe('Brookings');
    expect(title(app({ role: 'RA' }))).toBe('RA');
    expect(title(app({}))).toBe('Untitled application');
  });
});

describe('stages record what happened', () => {
  it('logs a move rather than overwriting it', () => {
    const a = moveTo(app({ org: 'X' }), 'sent', AT + 86_400_000);
    expect(a.stage).toBe('sent');
    expect(a.moves.map((m) => m.stage)).toEqual(['found', 'sent']);
  });

  it('does not fake activity when the stage has not changed', () => {
    const a = app({ stage: 'sent' });
    expect(moveTo(a, 'sent', AT + 999_999)).toBe(a);
  });

  it('counts days from the last move, not from when it was added', () => {
    const a = moveTo(app({}), 'sent', AT + 10 * 86_400_000);
    expect(daysInStage(a, new Date(AT + 13 * 86_400_000))).toBe(3);
  });
});

describe('silence, which is a number and not a feeling', () => {
  it('is raised on something sent and not moved since', () => {
    const a = moveTo(app({}), 'sent', AT);
    expect(quiet(a, new Date(AT + (QUIET_DAYS + 1) * 86_400_000))).toBe(true);
    expect(quiet(a, new Date(AT + 3 * 86_400_000))).toBe(false);
  });

  it('is not raised on one still being written', () => {
    // That is not quiet, it is unfinished, and a nudge is not what it needs.
    const a = moveTo(app({}), 'writing', AT);
    expect(quiet(a, new Date(AT + 90 * 86_400_000))).toBe(false);
  });
});

describe('what stands on a day', () => {
  it('carries both kinds of date, because they are different obligations', () => {
    const a = app({ org: 'Brookings', role: 'RA', due: day(10), next: 'Ask Dr. Stromme', nextBy: day(2) });
    const out = standing([a], NOW);
    expect(out.map((s) => s.what)).toEqual(['next', 'due']);
    expect(out[0].says).toBe('Ask Dr. Stromme — RA at Brookings');
    expect(out[1].says).toBe('RA at Brookings closes');
  });

  it('says nothing about a closed one', () => {
    expect(standing([app({ due: day(3), stage: 'closed' })], NOW)).toEqual([]);
  });

  it('says nothing about a next step with a date but no action', () => {
    expect(standing([app({ nextBy: day(3) })], NOW)).toEqual([]);
  });

  it('ignores a rolling application with no date', () => {
    expect(standing([app({ rolling: true })], NOW)).toEqual([]);
  });

  it('lands on the right day', () => {
    const a = app({ due: day(3), org: 'X' });
    expect(standingOn([a], NOW, new Date(2026, 8, 7))).toHaveLength(1);
    expect(standingOn([a], NOW, new Date(2026, 8, 8))).toEqual([]);
  });

  it('separates what is ahead from what has gone by', () => {
    const apps = [app({ due: day(2), org: 'A' }), app({ due: day(-2), org: 'B' })];
    expect(ahead(apps, NOW, 7).map((s) => s.application.org)).toEqual(['A']);
    expect(missed(apps, NOW).map((s) => s.application.org)).toEqual(['B']);
  });

  it('is sorted soonest first', () => {
    const apps = [app({ due: day(9), org: 'Late' }), app({ due: day(1), org: 'Soon' })];
    expect(standing(apps, NOW)[0].application.org).toBe('Soon');
  });
});

describe('the headline', () => {
  it('counts and never grades', () => {
    const apps = [
      moveTo(app({}), 'sent', AT),
      moveTo(app({}), 'sent', AT),
      moveTo(app({}), 'talking', AT),
    ];
    const said = summary(apps, NOW);
    expect(said).toBe('2 sent, 1 talking.');
    for (const word of ['well', 'strong', 'good', 'chance', 'likely']) {
      expect(said.toLowerCase()).not.toContain(word);
    }
  });

  it('says how many have gone quiet', () => {
    const a = moveTo(app({}), 'sent', AT);
    expect(summary([a], new Date(AT + 40 * 86_400_000))).toContain('1 sent over 21 days ago');
  });

  it('distinguishes nothing tracked from nothing open', () => {
    expect(summary([], NOW)).toBe('Nothing tracked yet.');
    expect(summary([app({ stage: 'closed' })], NOW)).toBe('Nothing open. 1 closed out.');
  });

  it('counts by stage', () => {
    const c = counts([app({ stage: 'sent' }), app({ stage: 'sent' }), app({ stage: 'offer' })]);
    expect(c.sent).toBe(2);
    expect(c.offer).toBe(1);
    expect(c.found).toBe(0);
  });
});

describe('the line under a row', () => {
  it('says when it closes', () => {
    expect(line(app({ due: day(5) }), NOW)).toContain('closes in 5 days');
    expect(line(app({ due: day(0) }), NOW)).toContain('closes today');
  });

  it('says rolling rather than inventing a date', () => {
    expect(line(app({ rolling: true }), NOW)).toContain('rolling');
  });

  it('names the commonest reason an application stalls', () => {
    expect(line(app({ stage: 'sent' }), NOW)).toContain('no next step set');
    expect(line(app({ stage: 'sent', next: 'Follow up' }), NOW)).not.toContain('no next step');
  });

  it('says nothing about a next step on a closed one', () => {
    expect(line(app({ stage: 'closed' }), NOW)).not.toContain('no next step');
  });
});

describe('the order they are listed in', () => {
  it('puts an offer above everything, and a dated deadline above an undated one', () => {
    const offer = app({ org: 'Offer', stage: 'offer' }, AT - 5000);
    const dated = app({ org: 'Dated', due: day(9) }, AT - 4000);
    const undated = app({ org: 'Undated', rolling: true }, AT - 3000);
    const closed = app({ org: 'Closed', stage: 'closed' }, AT - 2000);
    const out = order([closed, undated, dated, offer], NOW);
    expect(out.map((a) => a.org)).toEqual(['Offer', 'Dated', 'Undated', 'Closed']);
  });

  it('puts the nearer deadline first', () => {
    const late = app({ org: 'Late', due: day(20) });
    const soon = app({ org: 'Soon', due: day(2) });
    expect(order([late, soon], NOW).map((a) => a.org)).toEqual(['Soon', 'Late']);
  });
});

describe('a pasted link', () => {
  it('takes one without a scheme, which is how they are copied', () => {
    expect(safeUrl('careers.example.com/x')).toBe('https://careers.example.com/x');
  });

  it('refuses anything that is not a page', () => {
    expect(safeUrl('javascript:alert(1)')).toBe('');
    expect(safeUrl('')).toBe('');
  });
});

describe('reading a stored list', () => {
  it('survives an unknown stage or kind', () => {
    const [a] = readApplications([{ ...app({}), stage: 'promising', kind: 'vibes' }]);
    expect(a.stage).toBe('found');
    expect(a.kind).toBe('other');
  });

  it('gives an application with no history one, rather than reporting zero days', () => {
    // No `moves` reads as "just moved", which is the opposite of the truth for
    // something added in September and untouched since.
    const [a] = readApplications([{ ...app({}, AT), moves: undefined }]);
    expect(a.moves).toEqual([{ stage: 'found', at: AT }]);
    expect(daysInStage(a, new Date(AT + 30 * 86_400_000))).toBe(30);
  });

  it('takes anything that is not a list as nothing', () => {
    expect(readApplications(null)).toEqual([]);
    expect(readApplications('x')).toEqual([]);
  });
});

describe('the same shape as coursework', () => {
  it('hands a dated application to the day arithmetic', () => {
    const a = app({ org: 'Brookings', role: 'RA', due: day(5) });
    const [item] = asItems([a], NOW);
    expect(item.daysAway).toBe(5);
    expect(item.date.getDate()).toBe(9);
    expect(item.title).toBe('RA at Brookings closes');
  });

  it('claims no course, so it cannot leak into one', () => {
    expect(asItems([app({ org: 'X', due: day(2) })], NOW)[0].c).toBe('');
  });

  it('states no hour, rather than inventing a midnight it was never part of', () => {
    const [item] = asItems([app({ org: 'X', due: day(2) })], NOW);
    expect(item.dueTime).toBe('');
    expect(item.dueAt).toBe(24 * 60);
  });

  it('carries no weight, so nothing can read it as an exam', () => {
    expect(asItems([app({ org: 'X', due: day(2) })], NOW)[0].weight).toBe('');
  });

  it('leaves out a closed one and a rolling one with no date', () => {
    const apps = [app({ stage: 'closed', due: day(2) }), app({ rolling: true })];
    expect(asItems(apps, NOW)).toEqual([]);
  });
});
