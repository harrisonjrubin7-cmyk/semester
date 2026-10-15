/** Role validation without loading the conversation prompts or tool policy. */
export const AGENT_IDS = ['assistant', 'advisor', 'tutor', 'course-guide'] as const;
export type SemesterAgent = typeof AGENT_IDS[number];

export function isSemesterAgent(value: unknown): value is SemesterAgent {
  return typeof value === 'string' && (AGENT_IDS as readonly string[]).includes(value);
}
