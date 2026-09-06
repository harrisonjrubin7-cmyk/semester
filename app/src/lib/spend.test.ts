import { describe, expect, it } from 'vitest';
import { costOf, line, money, priced, tokens, total, type Spent, type Usage } from './spend';

/**
 * A meter about somebody's own money.
 *
 * Two properties matter more than the arithmetic. It must never invent a
 * price for a model it has no rate for — a made-up number on a screen about
 * money is worse than a blank. And it must stay silent where nothing was
 * measured, because a meter reading zero when it simply did not count is a
 * lie that costs more than the missing number.
 */

const use = (over: Partial<Usage> = {}): Usage => ({
  input: 0,
  output: 0,
  cacheWrite: 0,
  cacheRead: 0,
  ...over,
});

describe('what a reply cost', () => {
  it('prices input and output at the model’s own rates', () => {
    // Opus 5: $5 in, $25 out per million.
    expect(costOf(use({ input: 1_000_000 }), 'claude-opus-5')).toBeCloseTo(5);
    expect(costOf(use({ output: 1_000_000 }), 'claude-opus-5')).toBeCloseTo(25);
    expect(costOf(use({ input: 1_000_000 }), 'claude-haiku-4-5')).toBeCloseTo(1);
  });

  it('charges more to write the cache and far less to read it', () => {
    // The whole reason the app caches a course guide: the second question
    // about a course costs a tenth of the first on its input side.
    const write = costOf(use({ cacheWrite: 1_000_000 }), 'claude-opus-5');
    const read = costOf(use({ cacheRead: 1_000_000 }), 'claude-opus-5');
    const plain = costOf(use({ input: 1_000_000 }), 'claude-opus-5');
    expect(write).toBeGreaterThan(plain);
    expect(read).toBeLessThan(plain / 5);
  });

  it('returns nothing for a model it has no rate for', () => {
    // Rather than the nearest one. A price invented from a neighbour is a
    // number that looks measured and is not.
    expect(costOf(use({ input: 1_000_000 }), 'gpt-5')).toBe(0);
    expect(priced('gpt-5')).toBe(false);
    expect(priced('claude-opus-5')).toBe(true);
  });
});

describe('adding it up', () => {
  const row = (model: string, u: Partial<Usage>): Spent => ({
    at: 0,
    model,
    from: 'ask',
    use: use(u),
  });

  it('counts every kind of token, not just the billed-at-full ones', () => {
    const t = total([row('claude-opus-5', { input: 100, output: 50, cacheRead: 4000 })]);
    expect(t.tokens).toBe(4150);
    expect(t.asks).toBe(1);
  });

  it('says how many replies it could not price, so the total is honest', () => {
    /*
     * The failure this avoids: an OpenAI answer and a Claude answer in one
     * conversation, and a total that silently covers only one of them. The
     * number is still shown — it is right for what it covers — with a count
     * of what it does not.
     */
    const t = total([
      row('claude-opus-5', { input: 1000, output: 100 }),
      row('gpt-5', { input: 1000, output: 100 }),
    ]);
    expect(t.asks).toBe(2);
    expect(t.unpriced).toBe(1);
    expect(t.dollars).toBeGreaterThan(0);
  });
});

describe('saying it', () => {
  it('counts in cents at the scale a question actually costs', () => {
    // A question costs between a twentieth of a cent and a few cents. "$0.00"
    // for every one of them is a meter that tells you nothing.
    expect(money(0.0004)).toBe('0.04¢');
    expect(money(0.021)).toBe('2.1¢');
    expect(money(3.5)).toBe('$3.50');
    expect(money(0)).toBe('0¢');
  });

  it('rounds tokens to something a person can hold in their head', () => {
    expect(tokens(940)).toBe('940');
    expect(tokens(4150)).toBe('4.2k');
    expect(tokens(45_000)).toBe('45k');
    expect(tokens(2_400_000)).toBe('2.4M');
  });

  it('says nothing at all when nothing was measured', () => {
    /*
     * Not "$0.00". A proxy that strips the usage block, the OpenAI route, an
     * answer that came from the app itself with no request behind it — all of
     * those measure nothing, and a zero would be read as "this was free".
     */
    expect(line([])).toBe('');
  });

  it('says how much came from the cache, when any did', () => {
    const said = line([
      { at: 0, model: 'claude-opus-5', from: 'ask', use: use({ input: 200, output: 300, cacheRead: 4000 }) },
    ]);
    expect(said).toContain('1 answer');
    expect(said).toContain('from cache');
    expect(said).toContain('¢');
  });
});
