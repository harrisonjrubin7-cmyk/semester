import { describe, expect, it } from 'vitest';
import { blankDeclaration, declarationGaps, declarationText } from './disclosure';

describe('AI-use declaration', () => {
  it('lists what is missing, including the attestation', () => {
    const gaps = declarationGaps(blankDeclaration());
    expect(gaps.join(' ')).toMatch(/tool/);
    expect(gaps.join(' ')).toMatch(/attestation/);
  });

  it('names the kind of material, never its contents', () => {
    const d = { ...blankDeclaration('Essay 1', 'ENGL 1100'), tool: 'Claude', dates: 'Sep 20', uses: ['outline-feedback' as const], outputUsed: 'Outline only', sourcesChecked: 'All four readings', attested: true, inputTier: 'T2' as const };
    expect(declarationGaps(d)).toEqual([]);
    const text = declarationText(d);
    expect(text).toContain('Your own academic work');
    expect(text).toContain('Outline feedback');
    expect(text).toMatch(/Attestation: I am responsible/);
  });
});
