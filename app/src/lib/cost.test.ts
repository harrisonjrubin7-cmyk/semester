import { describe, expect, it } from 'vitest';
import {
  KINDS,
  forCourse,
  forTerm,
  kindOf,
  lastTime,
  line,
  money,
  readMoney,
  terms,
  todo,
  total,
  type Cost,
} from './cost';

const cost = (over: Partial<Cost> = {}): Cost => ({
  id: 'c1',
  courseId: 'econ',
  what: 'Mankiw, Principles of Macroeconomics',
  kind: 'book',
  cents: 6499,
  rented: false,
  backCents: 0,
  term: '2026FA',
  at: 1,
  ...over,
});

describe('reading an amount somebody typed', () => {
  it('takes the forms people write', () => {
    expect(readMoney('$64.99')).toBe(6499);
    expect(readMoney('64.99')).toBe(6499);
    expect(readMoney('65')).toBe(6500);
    expect(readMoney('1,240')).toBe(124000);
    expect(readMoney(' 12.5 ')).toBe(1250);
  });

  it('refuses rather than guessing at zero', () => {
    // A field that silently becomes zero is a field that wrecks a total.
    expect(readMoney('about sixty')).toBeNull();
    expect(readMoney('')).toBeNull();
    expect(readMoney('64.999')).toBeNull();
    expect(readMoney('-5')).toBeNull();
    expect(readMoney('1e9')).toBeNull();
  });

  it('refuses an amount nobody paid for a textbook', () => {
    expect(readMoney('999999')).toBeNull();
  });
});

describe('writing one back', () => {
  it('pads the cents', () => {
    expect(money(6499)).toBe('$64.99');
    expect(money(6500)).toBe('$65.00');
    expect(money(605)).toBe('$6.05');
    expect(money(0)).toBe('$0.00');
  });

  it('survives a round trip', () => {
    for (const text of ['$64.99', '65', '0.05', '1,240']) {
      const cents = readMoney(text);
      expect(readMoney(money(cents as number))).toBe(cents);
    }
  });

  it('holds cents as integers, so a total does not drift', () => {
    // 19.99 + 0.1 is not 20.09 in binary floating point, and a total out by a
    // cent for no visible reason costs the credibility of every other number.
    const t = total([cost({ cents: 1999 }), cost({ id: 'c2', cents: 10 })]);
    expect(t.spent).toBe(2009);
    expect(money(t.spent)).toBe('$20.09');
  });
});

describe('the total', () => {
  it('adds up what was spent', () => {
    expect(total([cost(), cost({ id: 'c2', cents: 3000 })]).spent).toBe(9499);
  });

  it('takes off what came back', () => {
    const t = total([cost({ cents: 6499, backCents: 2000 })]);
    expect(t.back).toBe(2000);
    expect(t.net).toBe(4499);
  });

  it('says nothing when there is nothing', () => {
    expect(line(total([]))).toBe('Nothing recorded for this term yet.');
  });

  it('states the gross where nothing has come back', () => {
    expect(line(total([cost()]))).toBe('$64.99 across 1 thing.');
  });

  it('states both halves once something has', () => {
    expect(line(total([cost({ backCents: 2000 })]))).toBe('$44.99 net — $64.99 out, $20.00 back.');
  });
});

describe('what is left to do about it', () => {
  it('names books that could still be sold', () => {
    const t = total([cost(), cost({ id: 'c2', cents: 3000 })]);
    expect(todo(t)).toBe('2 books to sell back, $94.99 of them at cover.');
  });

  it('leaves out one already sold', () => {
    expect(todo(total([cost({ backCents: 2000 })]))).toBe('');
  });

  it('leaves out a thing that cannot be sold', () => {
    expect(todo(total([cost({ kind: 'access' })]))).toBe('');
    expect(todo(total([cost({ kind: 'fee' })]))).toBe('');
  });

  it('names rentals separately, because they go back rather than being sold', () => {
    const t = total([cost({ rented: true })]);
    expect(todo(t)).toBe('1 rental to return.');
  });

  it('says nothing when there is nothing to do', () => {
    expect(todo(total([]))).toBe('');
  });
});

describe('the kinds', () => {
  it('knows which can be sold back', () => {
    expect(kindOf('book').resellable).toBe(true);
    expect(kindOf('access').resellable).toBe(false);
  });

  it('falls back rather than breaking on one it does not know', () => {
    expect(kindOf('mystery').id).toBe('other');
  });

  it('gives each a distinct id', () => {
    expect(new Set(KINDS.map((k) => k.id)).size).toBe(KINDS.length);
  });
});

describe('slicing it', () => {
  const all = [
    cost({ id: 'a', term: '2026FA', courseId: 'econ' }),
    cost({ id: 'b', term: '2026FA', courseId: 'psci' }),
    cost({ id: 'c', term: '2027SP', courseId: 'econ' }),
  ];

  it('takes one term', () => {
    expect(forTerm(all, '2026FA').map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('takes one course', () => {
    expect(forCourse(all, 'econ').map((c) => c.id)).toEqual(['a', 'c']);
  });

  it('lists the terms newest first', () => {
    expect(terms(all)).toEqual(['2027SP', '2026FA']);
  });
});

describe('what the same course cost last time', () => {
  const codeOf = (id: string) => (id.startsWith('econ') ? 'ECON 1020' : 'PSCI 1104');

  it('matches on the code, not the id', () => {
    // A course id is a slug of its code, so the same course next year is a
    // different row with the same name.
    const all = [
      cost({ id: 'a', term: '2025FA', courseId: 'econ-old', cents: 8000 }),
      cost({ id: 'b', term: '2026FA', courseId: 'econ', cents: 6499 }),
    ];
    expect(lastTime(all, codeOf, 'econ', '2026FA')).toEqual({ term: '2025FA', cents: 8000 });
  });

  it('adds up everything from that term', () => {
    const all = [
      cost({ id: 'a', term: '2025FA', courseId: 'econ-old', cents: 8000 }),
      cost({ id: 'b', term: '2025FA', courseId: 'econ-old', cents: 1500, kind: 'access' }),
    ];
    expect(lastTime(all, codeOf, 'econ', '2026FA')?.cents).toBe(9500);
  });

  it('gives nothing rather than a guess when there is no earlier term', () => {
    expect(lastTime([cost()], codeOf, 'econ', '2026FA')).toBeNull();
  });

  it('does not compare against a different course', () => {
    const all = [cost({ id: 'a', term: '2025FA', courseId: 'psci', cents: 8000 })];
    expect(lastTime(all, codeOf, 'econ', '2026FA')).toBeNull();
  });
});
