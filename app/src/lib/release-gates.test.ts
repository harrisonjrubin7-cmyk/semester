import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const releaseGates = readFileSync(
  join(import.meta.dirname, '../../../docs/RELEASE-GATES.md'),
  'utf8',
);

describe('release-gate evidence stays internally consistent', () => {
  it('describes the hosted offboarding rehearsal without claiming no rehearsal happened', () => {
    const g3 = releaseGates.match(/### G3[^]*?(?=\n### G4)/)?.[0];
    expect(g3).toBeDefined();

    const status = g3?.match(/^\| \*\*Status\*\* \|.*$/m)?.[0];
    expect(status).toContain('rehearsed once on a hosted preview by the author');
    expect(status).toContain('second-person and production rehearsals remain outstanding');
    expect(status).not.toMatch(/; not rehearsed;/);
  });
});
