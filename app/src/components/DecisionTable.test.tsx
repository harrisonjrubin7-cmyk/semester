import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NOT_KNOWN, ROWS, compareOptions } from '../lib/decision-compare';
import { DecisionTable } from './DecisionTable';

const NOW = new Date(2026, 9, 7, 10, 0);
const comparison = () =>
  compareOptions(
    'tutoring',
    [
      { id: 'a', label: 'Campus tutoring', cost: { money: 'Free', hoursPerWeek: 2 } },
      { id: 'b', label: 'Private tutor' },
    ],
    NOW,
  );

describe('DecisionTable', () => {
  const html = renderToStaticMarkup(<DecisionTable comparison={comparison()} />);

  it('draws one column per option and one row per question, with header scopes', () => {
    expect((html.match(/<th scope="col"/g) ?? []).length).toBe(3);
    expect((html.match(/<th scope="row"/g) ?? []).length).toBe(ROWS.length);
    expect(html).toContain('<caption>Getting tutoring</caption>');
    expect(html.indexOf('Campus tutoring')).toBeLessThan(html.indexOf('Private tutor'));
    expect(html).toContain('Money: Free');
  });

  it('writes Not known in the same plain cell as any fact', () => {
    expect(html).toContain(`<td><p>${NOT_KNOWN}</p></td>`);
    expect(html).toContain('<td><p>Money: Free</p><p>Time: about 2 hours a week</p></td>');
  });

  it('has no winner, rank, score or highlight anywhere', () => {
    expect(html).not.toMatch(/winner|best|recommend|rank|score|highlight|selected/i);
    expect(html.match(/class="[^"]*"/g)).toEqual(['class="today-why"']);
    expect(html).toContain('does not say which option is better');
    expect(html).toContain('Official next step');
  });
});
