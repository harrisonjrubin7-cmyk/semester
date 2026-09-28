import { describe, expect, it } from 'vitest';
import { MODULE_FLAG_NAMES, experienceFlags, moduleFlags, moduleOn } from './experience-flags';

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

  it('never lets an institutional preview send a real support ticket', () => {
    expect(experienceFlags({ VITE_INSTITUTIONAL_PREVIEW: 'true' }).supportTickets).toBe('off');
    expect(experienceFlags({ VITE_SUPPORT_TICKETS: 'sandbox' }).supportTickets).toBe('sandbox');
  });
});

describe('feature-expansion module flags', () => {
  it('has the seventeen names — the fifteen modules, Phase E’s crunch_week_forecast and Course Studio — each read from its own VITE_ variable', () => {
    const flags = moduleFlags({});
    expect(Object.keys(flags)).toEqual([...MODULE_FLAG_NAMES]);
    // Fifteen from the feature expansion (D-012, D-013), crunch_week_forecast, and Course Studio (D-100 F6).
    expect(MODULE_FLAG_NAMES).toHaveLength(17);
    expect(moduleFlags({ VITE_CRUNCH_WEEK_FORECAST: 'preview' }).crunch_week_forecast).toBe('preview');
    expect(moduleFlags({ VITE_COURSE_STUDIO: 'preview' }).course_studio).toBe('preview');
    expect(moduleFlags({ VITE_TODAY_ACTION_CENTER: 'preview' }).today_action_center).toBe('preview');
    expect(moduleFlags({ VITE_TRUST_CENTER: 'production' }).trust_center).toBe('production');
  });

  it('keeps every module off by default, including in an institutional preview', () => {
    for (const env of [{}, { VITE_INSTITUTIONAL_PREVIEW: 'true' }]) {
      const flags = moduleFlags(env);
      for (const name of MODULE_FLAG_NAMES) expect(flags[name]).toBe('off');
    }
  });

  it('refuses a value that is not a feature state', () => {
    expect(moduleFlags({ VITE_OFFLINE_MODE: 'yes' }).offline_mode).toBe('off');
    expect(moduleOn('off')).toBe(false);
    expect(moduleOn('sandbox')).toBe(true);
  });
});
