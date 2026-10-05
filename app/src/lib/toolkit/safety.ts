import { BOUNDARIES, type Boundary } from './catalog';

/**
 * Which professional boundary a student's stated topic runs into, so the
 * toolkit can say so up front.
 *
 * This is a notice, not a filter. The toolkit in this slice generates
 * nothing — every workspace is the student's own writing — so there is no
 * output for a keyword list to block, and a keyword list would be a poor
 * guard over one anyway. What it can usefully do is tell a nursing student
 * typing "dosage for my patient" that the tools here are simulation only,
 * before they spend an evening in them. Any later phase that adds generation
 * needs a real policy layer on the server, not this.
 *
 * `assessment` is the one boundary that is about integrity rather than
 * safety: "answers to the take-home" is redirected to the policy card and its
 * alternatives (`policy.ts` → `redirect`).
 */

const PATTERNS: readonly [Boundary | 'assessment', RegExp][] = [
  ['science', /\b(pathogen|virulen\w*|gain[- ]of[- ]function|toxin synthesis|weaponi[sz]\w*|enhance (a )?virus)\b/i],
  ['clinical', /\b(my patient|diagnos\w*|what dose should|prescri\w*|treat my|medical records?|patient (health )?information|patient chart)\b/i],
  ['legal', /\b(my (case|lawsuit|lease|landlord|contract)|should i sue|legal advice)\b/i],
  ['finance', /\b(should i (buy|sell|invest)|which stock|my portfolio|my (401k|roth|ira))\b/i],
  ['cyber', /\b(hack (into|the)|steal (passwords?|credentials?)|bypass (the )?(school|login|proctor\w*)|malware|keylogger|phishing kit)\b/i],
  ['location', /\b(exact (location|coordinates|address)|track (my|a) (classmate|friend|student))\b/i],
  ['assessment', /\b(answers? (to|for) (the|my) (take[- ]home|exam|quiz|test|midterm|final)|do my (homework|assignment|exam)|write my (essay|paper))\b/i],
];

export type Notice = { boundary: Boundary | 'assessment'; text: string };

export function boundaryNotice(topic: string): Notice | null {
  for (const [boundary, re] of PATTERNS)
    if (re.test(topic))
      return {
        boundary,
        text:
          boundary === 'assessment'
            ? 'Semester will not produce answers for an assessment. It can help you plan the work, practise on similar problems, and prepare questions for your instructor.'
            : BOUNDARIES[boundary],
      };
  return null;
}
