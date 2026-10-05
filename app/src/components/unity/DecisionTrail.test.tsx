import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DecisionTrail } from './DecisionTrail';
import { STUDENT_WORKFLOWS } from '../../lib/student-workflows';

describe('decision trail', () => {
  it('names the current step without treating navigation as completion', () => {
    const html = renderToStaticMarkup(<DecisionTrail workflow={STUDENT_WORKFLOWS[0]} current="calendar" onOpen={() => {}} />);
    expect(html).toContain('aria-current="step"');
    expect(html).toContain('Check the schedule');
    expect(html).toContain('Current');
    expect(html).toContain('Needs review');
    expect(html).not.toContain('Completed');
    expect(html).toContain('Prepare registration');
  });
  it('shows explicit blocked and completed evidence when supplied', () => {
    const html = renderToStaticMarkup(<DecisionTrail workflow={STUDENT_WORKFLOWS[0]} current="calendar" states={{degree: 'Completed', yes: 'Blocked'}} onOpen={() => {}} />);
    expect(html).toContain('Completed');
    expect(html).toContain('Blocked');
    expect(html).toContain('disabled=""');
  });
});
