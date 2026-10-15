// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { AGENTS, agentAllows, agentInstruction, isSemesterAgent } from '../../../packages/institution/src/agents';
import { parseIntelligenceGatewayRequest } from '../../../packages/institution/src/intelligence';
import { keepTurns, liveNow, newThread, openThread, resetLive, setLive } from '../ai/live';
import { load } from '../lib/threads';

beforeEach(() => { localStorage.clear(); resetLive(); });

describe('four roles through one gateway', () => {
  it('rejects unknown roles and newly invented tools', () => {
    expect(isSemesterAgent('registrar')).toBe(false);
    expect(isSemesterAgent('__proto__')).toBe(false);
    for (const agent of Object.keys(AGENTS) as Array<keyof typeof AGENTS>) {
      expect(agentAllows(agent, 'new_unreviewed_tool')).toBe(false);
      expect(agentAllows(agent, 'read_grades')).toBe(false);
      expect(agentAllows(agent, 'read_attendance')).toBe(false);
      expect(agentAllows(agent, 'open_screen')).toBe(true);
    }
    expect(agentAllows('assistant', 'add_task')).toBe(true);
    expect(agentAllows('tutor', 'add_task')).toBe(false);
    expect(agentAllows('course-guide', 'make_document')).toBe(false);
  });

  it('keeps each role’s authority and human handoff in its instruction', () => {
    expect(agentInstruction('advisor')).toContain('Never certify degree progress');
    expect(agentInstruction('tutor')).toContain('Never complete active restricted graded work');
    expect(agentInstruction('course-guide')).toContain('never the instructor');
    expect(agentInstruction('assistant')).toContain('student-reviewed proposal');
  });

  it('validates the wire role rather than trusting an arbitrary string', () => {
    const request = { version: 1, clientState: 'preview', tenantId: 'a', personId: 'b', question: 'Help', mode: 'hint', category: 'study', sourceIds: [], evidenceIds: [], proposedActions: [] };
    expect(parseIntelligenceGatewayRequest({ ...request, agent: 'tutor', courseId: 'econ' })).toMatchObject({ agent: 'tutor', courseId: 'econ' });
    expect(() => parseIntelligenceGatewayRequest({ ...request, agent: 'admin' })).toThrow('Invalid Semester agent');
    expect(() => parseIntelligenceGatewayRequest({ ...request, courseId: '' })).toThrow('Invalid course scope');
  });

  it('restores a conversation’s role and does not carry its turns into another role', () => {
    setLive('agent', 'tutor');
    keepTurns([{ role: 'user', content: 'Help with elasticity' }]);
    const tutorThread = liveNow().openId;
    newThread();
    setLive('agent', 'advisor');
    expect(liveNow().turns).toEqual([]);
    keepTurns([{ role: 'user', content: 'Prepare my advisor agenda' }]);
    expect(load().threads.find((thread) => thread.id === tutorThread)?.agent).toBe('tutor');
    openThread(tutorThread);
    expect(liveNow().agent).toBe('tutor');
    expect(liveNow().turns[0].content).toBe('Help with elasticity');
    resetLive();
    expect(liveNow().agent).toBe('tutor');
  });
});
