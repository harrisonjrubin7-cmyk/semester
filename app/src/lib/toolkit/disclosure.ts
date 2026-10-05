import { tierName, type Tier } from './classification';
import { usageLabel, type Use } from './policy';

/**
 * The AI-use declaration a student attaches to their own work.
 *
 * It is written by the student, stored on their device, and leaves only when
 * they copy or download it. It is never read by anything that scores,
 * ranks, flags or profiles — there is no such reader in Semester, and this
 * module exports nothing one could use to become one: no counts across
 * declarations, no history, only the text of the one being written.
 *
 * The input's data class goes in by *name* ("Your own academic work"), never
 * by content. A declaration that quoted what was pasted would carry the very
 * material the classification gate exists to keep in place.
 */

export interface Declaration {
  assignment: string;
  course: string;
  tool: string;
  version: string;
  dates: string;
  uses: Use[];
  purpose: string;
  inputTier: Tier;
  interaction: string;
  outputUsed: string;
  sourcesChecked: string;
  verified: string;
  edits: string;
  limitations: string;
  attested: boolean;
}

export const blankDeclaration = (assignment = '', course = ''): Declaration => ({
  assignment,
  course,
  tool: '',
  version: '',
  dates: '',
  uses: [],
  purpose: '',
  inputTier: 'T2',
  interaction: '',
  outputUsed: '',
  sourcesChecked: '',
  verified: '',
  edits: '',
  limitations: '',
  attested: false,
});

export function declarationGaps(d: Declaration): string[] {
  const out: string[] = [];
  if (!d.tool.trim()) out.push('Name the AI tool you used.');
  if (!d.dates.trim()) out.push('Say when you used it.');
  if (!d.uses.length && !d.purpose.trim()) out.push('Say what you used it for.');
  if (!d.outputUsed.trim()) out.push('Say which parts of your work used its output — or “none”.');
  if (!d.sourcesChecked.trim()) out.push('Say which sources you checked its output against — or “none”.');
  if (!d.attested) out.push('Confirm the attestation.');
  return out;
}

export const ATTESTATION =
  'I am responsible for this work. I checked AI-assisted content against the original sources, verified any calculations or code I relied on, and used AI only as this course’s policy permits.';

export function declarationText(d: Declaration): string {
  const line = (label: string, value: string) => (value.trim() ? `${label}: ${value.trim()}` : `${label}: —`);
  return [
    'AI-USE DECLARATION',
    line('Assignment', d.assignment),
    line('Course', d.course),
    line('Tool', [d.tool, d.version].filter((x) => x.trim()).join(' ')),
    line('Dates used', d.dates),
    line('Used for', [...d.uses.map(usageLabel), d.purpose].filter((x) => x.trim()).join('; ')),
    line('Kind of material given to it', tierName(d.inputTier)),
    line('How it was used', d.interaction),
    line('Output used in', d.outputUsed),
    line('Sources checked', d.sourcesChecked),
    line('Calculations, code or tests verified', d.verified),
    line('My edits', d.edits),
    line('Limitations noted', d.limitations),
    '',
    d.attested ? `Attestation: ${ATTESTATION}` : 'Attestation: not yet confirmed',
  ].join('\n');
}
