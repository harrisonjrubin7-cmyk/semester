import { describe, expect, it } from 'vitest';
import { EMPTY_EVIDENCE } from './career-evidence';
import { walletExport, walletItems } from './credential-wallet';

describe('credential wallet', () => {
  it('includes only student-confirmed skills and preserves authority', () => {
    const evidence = {
      ...EMPTY_EVIDENCE,
      decisions: {
        writing: { status: 'confirmed' as const, name: 'Writing', at: 10 },
        research: { status: 'rejected' as const, name: 'Research', at: 11 },
      },
    };
    const claims = [
      { id: 'w', skill: 'Writing', level: 'emerging' as const, verification: 'student-confirmed' as const, freshness: 'current' as const, evidence: [{ sourceId: 'c1', sourceType: 'course' as const, label: 'ENG 101' }] },
      { id: 'r', skill: 'Research', level: 'emerging' as const, verification: 'suggested' as const, freshness: 'current' as const, evidence: [{ sourceId: 'c2', sourceType: 'course' as const, label: 'SOC 201' }] },
    ];
    const items = walletItems(claims, evidence);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ title: 'Writing', authority: 'Student confirmed', evidence: ['ENG 101'] });
  });

  it('exports only selected items with an unambiguous not-official notice', () => {
    const item = { id: 'skill:writing', kind: 'skill' as const, title: 'Writing', authority: 'Student confirmed' as const, evidence: ['ENG 101'], updatedAt: 10 };
    const out = walletExport([item], [item.id], '2026-10-01T12:00:00.000Z');
    expect(out.items).toEqual([item]);
    expect(out.officialTranscript).toBe(false);
    expect(out.notice).toContain('Not an official transcript');
  });
});
