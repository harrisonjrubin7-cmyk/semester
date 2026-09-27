import { describe, expect, it } from 'vitest';
import {
  completionLine,
  deskSteps,
  draftProblems,
  officeActionToAction,
  officePriority,
  readOfficeAction,
  readOfficeActions,
  whyYouSee,
  type Draft,
} from './office-actions';

/**
 * Phase J's model. The database is the authority on scope, authorization and
 * the threshold (`supabase/officeactions.check.sql`); these hold the second
 * lock and the wording: an incomplete row never reaches a student looking
 * official, a student is told why they see each action, an office action
 * joins the Action Center with its source and a confirmed hand-off, and an
 * office's completion line says nothing below ten.
 */

const NOW = Date.parse('2026-10-01T12:00:00Z');
const DAY = 86_400_000;

const row = (over: Record<string, unknown> = {}) => ({
  id: 'a1',
  office: 'financial_aid',
  office_label: 'Financial Aid',
  action_type: 'aid',
  audience_kind: 'tenant',
  target_program: null,
  target_eligibility: null,
  title: 'FAFSA verification documents are due October 15',
  why_it_matters: 'This may affect aid processing.',
  due_at: '2026-10-15T23:59:00Z',
  official_url: 'https://aid.school.edu/verification',
  source_note: 'Financial Aid verification checklist',
  updated_at: '2026-10-01T09:00:00Z',
  published_at: '2026-10-01T09:00:00Z',
  done_at: null,
  ...over,
});

describe('reading a row from the feed', () => {
  it('keeps a complete row, with its office, link, source and dates', () => {
    const a = readOfficeAction(row())!;
    expect(a).toMatchObject({
      id: 'a1',
      officeLabel: 'Financial Aid',
      url: 'https://aid.school.edu/verification',
      sourceNote: 'Financial Aid verification checklist',
      dueAt: Date.parse('2026-10-15T23:59:00Z'),
      updatedAt: Date.parse('2026-10-01T09:00:00Z'),
      doneAt: null,
    });
  });

  it.each([
    ['no office', { office: '' }],
    ['no link', { official_url: null }],
    ['an http link', { official_url: 'http://aid.school.edu' }],
    ['a javascript link', { official_url: 'javascript:alert(1)' }],
    ['no source', { source_note: ' ' }],
    ['no update time', { updated_at: null }],
    ['no reason', { why_it_matters: '' }],
    ['an unknown type', { action_type: 'grade' }],
    ['an unknown audience', { audience_kind: 'everyone' }],
    ['"at risk" wording', { title: 'Students at risk of losing aid' }],
    ['"behind" wording', { why_it_matters: 'If you are behind on forms' }],
  ])('refuses a row with %s', (_, over) => {
    expect(readOfficeAction(row(over))).toBeNull();
  });

  it('drops the bad rows and keeps the good ones', () => {
    expect(readOfficeActions([row(), row({ id: 'a2', office: null }), 'junk', null]).map((a) => a.id)).toEqual(['a1']);
    expect(readOfficeActions(null)).toEqual([]);
  });

  it('ignores an eligibility that is not on the list', () => {
    expect(readOfficeAction(row({ audience_kind: 'eligibility', target_eligibility: 'disability' }))!.eligibility).toBeNull();
  });
});

describe('why a student sees it', () => {
  it('names the audience, and says a program or eligibility was the student’s own choice', () => {
    expect(whyYouSee(readOfficeAction(row())!)).toBe('Financial Aid sent this to every student at your school.');
    expect(whyYouSee(readOfficeAction(row({ audience_kind: 'cohort' }))!)).toBe('Financial Aid sent this to a group you belong to at your school.');
    expect(whyYouSee(readOfficeAction(row({ audience_kind: 'program', target_program: 'school/applied-economics' }))!)).toBe(
      'Financial Aid sent this to students in Applied Economics. You chose that program in Semester.',
    );
    expect(whyYouSee(readOfficeAction(row({ audience_kind: 'eligibility', target_eligibility: 'aid_applicant' }))!)).toBe(
      'Financial Aid sent this to students who said “I applied for financial aid”. You chose that in Semester.',
    );
  });
});

describe('in the Action Center', () => {
  const a = readOfficeAction(row())!;
  const action = officeActionToAction(a, NOW);

  it('keeps a stable id, so the student’s snooze or dismissal stays with it', () => {
    expect(action.id).toBe('office:a1');
    expect(officeActionToAction(a, NOW + DAY).id).toBe(action.id);
  });

  it('is labelled Institution verified, with the office, source and update time', () => {
    expect(action.source).toEqual({
      label: 'institution_verified',
      system: 'Financial Aid · Financial Aid verification checklist',
      at: Date.parse('2026-10-01T09:00:00Z'),
    });
    expect(action.group).toBe('From campus offices');
  });

  it('hands off to the official page only after a confirmation', () => {
    expect(action.primary).toEqual({ label: 'Open official page', kind: 'external', target: 'https://aid.school.edu/verification', requiresConfirmation: true });
  });

  it('explains itself fully, and says what Semester cannot see', () => {
    expect(action.explanation.factors).toContain('Financial Aid sent this to every student at your school.');
    expect(action.explanation.factors).toContain('Source: Financial Aid verification checklist');
    expect(action.explanation.limitations.join(' ')).toMatch(/official page is the record/);
    expect(action.explanation.alternatives.length).toBeGreaterThan(0);
  });

  it('expires a day after its date, and has no expiry without one', () => {
    expect(action.expiresAt).toBe(Date.parse('2026-10-15T23:59:00Z') + DAY);
    expect(officeActionToAction(readOfficeAction(row({ due_at: null }))!, NOW).expiresAt).toBeNull();
  });

  it('ranks by what the office said it is and its date, nothing else', () => {
    expect(officePriority(a, NOW + 7 * DAY)).toBe('high');
    expect(officePriority(a, NOW)).toBe('normal');
    expect(officePriority(a, Date.parse('2026-09-01T00:00:00Z'))).toBe('normal');
    expect(officePriority(readOfficeAction(row({ action_type: 'resource' }))!, NOW)).toBe('low');
    expect(officePriority(readOfficeAction(row({ due_at: null }))!, NOW)).toBe('normal');
  });
});

describe('what an office sees about completion', () => {
  it('is a count at ten or more, and otherwise no number at all', () => {
    expect(completionLine(10)).toBe('10 students marked this done.');
    expect(completionLine(null)).toBe('Fewer than 10 students have marked this done, so no count is shown.');
    // A number below ten never prints, even if one arrived.
    expect(completionLine(9)).toBe(completionLine(null));
  });
});

describe('the office desk', () => {
  it('never offers approval of your own action', () => {
    expect(deskSteps('in_review', true)).not.toContain('approve');
    expect(deskSteps('in_review', false)).toContain('approve');
    expect(deskSteps('draft', true)).toEqual(['submit', 'withdraw']);
    expect(deskSteps('withdrawn', false)).toEqual([]);
  });

  const draft: Draft = {
    office: 'financial_aid', scopeKind: 'school', scopeId: 'school', type: 'aid', audience: 'tenant', target: '',
    title: 'Verification due', why: 'This may affect aid processing.', due: '2026-10-15',
    url: 'https://aid.school.edu', source: 'Financial Aid',
  };

  it('requires what the student is shown: link, source, reason', () => {
    expect(draftProblems(draft, false)).toEqual([]);
    expect(draftProblems({ ...draft, url: 'http://aid.school.edu' }, false)).toContain('Add the official page, starting https://.');
    expect(draftProblems({ ...draft, source: '' }, false)).toContain('Say where this comes from.');
    expect(draftProblems({ ...draft, why: '' }, false)).toContain('Say why it matters.');
    expect(draftProblems({ ...draft, audience: 'cohort', target: '' }, false)).toContain('Name the cohort this is for.');
    expect(draftProblems({ ...draft, audience: 'eligibility', target: 'disability' }, false)).toContain('Choose an eligibility from the list.');
    expect(draftProblems({ ...draft, title: 'Students failing to file' }, false)).toContain('Rephrase without “at risk”, “failing” or “behind”.');
  });

  it('keeps a resource-only role to resources and events', () => {
    expect(draftProblems(draft, true)).toContain('Your role can publish resources and events only.');
    expect(draftProblems({ ...draft, type: 'event' }, true)).toEqual([]);
  });
});
