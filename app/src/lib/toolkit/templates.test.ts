import { describe, expect, it } from 'vitest';
import { completeStage, newWorkspace, progress, readWorkspaces, submissionChecklist, TEMPLATE_IDS, TEMPLATES } from './templates';

const now = new Date('2026-09-27T12:00:00Z');

describe('assignment workspaces', () => {
  it('ships every template the brief names, each with stages', () => {
    for (const id of ['problem_set', 'essay', 'lab_report', 'research_paper', 'coding_project', 'design_project', 'case_analysis', 'presentation', 'group_project', 'exam_preparation', 'policy_memo', 'annotated_bibliography', 'technical_report'])
      expect(TEMPLATE_IDS).toContain(id);
    for (const id of TEMPLATE_IDS) expect(TEMPLATES[id].stages.length).toBeGreaterThan(3);
  });

  it('keeps stages in the brief’s order', () => {
    expect(TEMPLATES.research_paper.stages.map((s) => s.id)).toEqual(['question', 'search', 'screening', 'matrix', 'bibliography', 'outline', 'draft', 'audit']);
  });

  it('refuses to mark a stage done until the student has written their own note for it', () => {
    const ws = newWorkspace('w1', 'essay', 'Essay 1', 'ENGL 1100', now);
    const refused = completeStage(ws, 'claim');
    expect(refused.ok).toBe(false);
    const withNote = { ...ws, notes: { claim: 'Remote work lowers commuting emissions.' } };
    const done = completeStage(withNote, 'claim');
    expect(done.ok && done.workspace.done).toEqual(['claim']);
  });

  it('reports the next stage and progress', () => {
    const ws = { ...newWorkspace('w1', 'problem_set', '', '', now), done: ['concepts'] };
    expect(progress(ws)).toMatchObject({ done: 1, total: 6 });
    expect(progress(ws).next?.id).toBe('example');
  });

  it('is private and stays private through a round trip', () => {
    const ws = newWorkspace('w1', 'essay', '', '', now);
    expect(ws.visibility).toBe('private');
    const tampered = JSON.parse(JSON.stringify([{ ...ws, visibility: 'public' }]));
    expect(readWorkspaces(tampered)[0].visibility).toBe('private');
  });

  it('asks for a declaration only when the policy needs one', () => {
    expect(submissionChecklist({ disclosureNeeded: false, hasRubric: true, hasSources: false }).join()).not.toMatch(/declaration/);
    expect(submissionChecklist({ disclosureNeeded: true, hasRubric: true, hasSources: false }).join()).toMatch(/declaration/);
  });
});
