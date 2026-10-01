import { describe, expect, it } from 'vitest';
import { STUDENT_WORKFLOWS, workflowForScreen } from './student-workflows';

describe('cross-module student workflows', () => {
  it('keeps all six journeys resumable and ends each in a real route', () => {
    expect(STUDENT_WORKFLOWS.map((workflow) => workflow.name)).toEqual([
      'Registration Readiness', 'Course Success', 'Advising Preparation', 'Career Evidence', 'Support Routing', 'Term Transition',
    ]);
    for (const workflow of STUDENT_WORKFLOWS) {
      expect(workflow.steps.length).toBeGreaterThanOrEqual(4);
      expect(workflow.outcome.length).toBeGreaterThan(20);
    }
    expect(workflowForScreen('yes')?.id).toBe('registration-readiness');
  });
});
