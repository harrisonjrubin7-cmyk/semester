import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/*
 * The screens where a student decides something on a figure say where the
 * figure came from, in the one trust vocabulary.
 *
 * Constitution §7 and §11: Registration, the degree and grades come first,
 * because a withdrawal date, a GPA projection or "what I need on the final"
 * is exactly what somebody acts on. Each draws `SourceBadge` with the labels
 * below, and none of them draws the status chips' second vocabulary for the
 * same fact ("Yours", "Needs confirmation").
 */
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

const EXPECTED: Record<string, string[]> = {
  'screens/Degree.tsx': ['student_entered', 'estimated'],
  'screens/Grades.tsx': ['student_entered', 'estimated'],
  'screens/Registrar.tsx': ['student_entered'],
};

describe('decision screens carry the trust badge', () => {
  for (const [file, labels] of Object.entries(EXPECTED)) {
    it(`${file} says ${labels.join(' and ')}`, () => {
      const source = read(`./${file}`);
      for (const label of labels) {
        expect(source, `${file} lost its ${label} badge`).toContain(`<SourceBadge label="${label}"`);
      }
      expect(source, `${file} names provenance with StatusChip`).not.toMatch(/<StatusChip status="(yours|needs-confirmation)"/);
    });
  }
});
