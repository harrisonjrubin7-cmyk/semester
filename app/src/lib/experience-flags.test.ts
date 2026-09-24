import { describe, expect, it } from 'vitest';
import { experienceFlags } from './experience-flags';

describe('experience feature states', () => {
  it('keeps every addition off unless the institutional preview or an exact feature value enables it', () => {
    expect(experienceFlags({}).journeyNavigation).toBe('off');
    expect(experienceFlags({ VITE_INSTITUTIONAL_PREVIEW: 'true' }).journeyNavigation).toBe(
      'preview',
    );
    expect(experienceFlags({ VITE_SEMESTER_INTELLIGENCE: 'sandbox' }).semesterIntelligence).toBe(
      'sandbox',
    );
    expect(experienceFlags({ VITE_SEMESTER_INTELLIGENCE: 'TRUE' }).semesterIntelligence).toBe(
      'off',
    );
  });
});
