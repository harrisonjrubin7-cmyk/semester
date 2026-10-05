import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { key, standing } from '../lib/grades';
import type { Course } from '../lib/types';
import { OutcomeScenarios } from './OutcomeScenarios';

const course = (grading: { what: string; pct: string }[]) => ({ id: 'econ', grading } as unknown as Course);
const full = course([
  { what: 'Sets', pct: '30%' },
  { what: 'Mid', pct: '30%' },
  { what: 'Final', pct: '40%' },
]);

describe('OutcomeScenarios', () => {
  it('shows each scenario and the caution', () => {
    const s = standing(full, { [key('econ', 0)]: '90', [key('econ', 1)]: '80' });
    const html = renderToStaticMarkup(<OutcomeScenarios standing={s} code="ECON 101" />);
    expect(html).toContain('remaining work averages 85%');
    expect(html).toContain('not an official course grade');
  });
  it('says why it will not compute, instead of computing', () => {
    const s = standing(course([{ what: 'A', pct: '30%' }]), { [key('econ', 0)]: '90' });
    const html = renderToStaticMarkup(<OutcomeScenarios standing={s} code="ECON 101" />);
    expect(html).toContain('do not add up to 100%');
    expect(html).not.toContain('averages');
  });
  it('renders nothing when the student has paused scenarios', () => {
    const s = standing(full, {});
    expect(renderToStaticMarkup(<OutcomeScenarios standing={s} code="X" paused />)).toBe('');
  });
});
