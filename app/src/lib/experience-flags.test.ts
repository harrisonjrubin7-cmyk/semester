import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MODULE_FLAG_ENV, MODULE_FLAG_NAMES, experienceFlags, moduleFlags, moduleOn } from './experience-flags';

describe('experience feature states', () => {
  it('ships the canonical five-destination navigation and keeps an explicit rollback', () => {
    expect(experienceFlags({}).journeyNavigation).toBe('production');
    expect(experienceFlags({ VITE_JOURNEY_NAVIGATION: 'off' }).journeyNavigation).toBe('off');
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
    expect(experienceFlags({}).supportEmailNotices).toBe('off');
    expect(experienceFlags({ VITE_SUPPORT_EMAIL_NOTICES: 'true' }).supportEmailNotices).toBe('production');
    expect(experienceFlags({ VITE_SUPPORT_EMAIL_NOTICES: 'production' }).supportEmailNotices).toBe('off');
    expect(experienceFlags({ VITE_SUPPORT_EMAIL_NOTICES: 'TRUE' }).supportEmailNotices).toBe('off');
  });
});

describe('feature-expansion module flags', () => {
  it('has the eighteen names — the fifteen modules, Phase E’s crunch_week_forecast, Course Studio and the task sync engine — each read from its own VITE_ variable', () => {
    const flags = moduleFlags({});
    expect(Object.keys(flags)).toEqual([...MODULE_FLAG_NAMES]);
    // Fifteen from the feature expansion (D-012, D-013), crunch_week_forecast, and Course Studio (D-100 F6).
    expect(MODULE_FLAG_NAMES).toHaveLength(18);
    expect(moduleFlags({ VITE_OFFLINE_ENGINE_TASKS: 'preview' }).offline_engine_tasks).toBe('preview');
    expect(moduleFlags({ VITE_CRUNCH_WEEK_FORECAST: 'preview' }).crunch_week_forecast).toBe('preview');
    expect(moduleFlags({ VITE_COURSE_STUDIO: 'preview' }).course_studio).toBe('preview');
    expect(moduleFlags({ VITE_TODAY_ACTION_CENTER: 'preview' }).today_action_center).toBe('preview');
    expect(moduleFlags({ VITE_TRUST_CENTER: 'production' }).trust_center).toBe('production');
  });

  it('ships the shared Action Center while keeping expansion modules gated', () => {
    for (const env of [{}, { VITE_INSTITUTIONAL_PREVIEW: 'true' }]) {
      const flags = moduleFlags(env);
      expect(flags.today_action_center).toBe('production');
      for (const name of MODULE_FLAG_NAMES.filter((name) => name !== 'today_action_center')) {
        expect(flags[name]).toBe('off');
      }
    }
    expect(moduleFlags({ VITE_TODAY_ACTION_CENTER: 'off' }).today_action_center).toBe('off');
  });

  it('refuses a value that is not a feature state', () => {
    expect(moduleFlags({ VITE_OFFLINE_MODE: 'yes' }).offline_mode).toBe('off');
    expect(moduleOn('off')).toBe(false);
    expect(moduleOn('sandbox')).toBe(true);
  });
});

describe('a module flag is registered everywhere an operator looks for it', () => {
  /*
   * A variable the deploy does not pass is a setting the deployed app does not have (`deploy.test.ts` makes the
   * same point for the build inputs in general). A module flag is named in four places besides the code that
   * reads it, and none of the four was held to the list: a flag could be added to `MODULE_FLAG_ENV` and quietly
   * never reach a deployed build, or reach it undocumented. This holds them to it, for all of them at once.
   */
  const root = join(process.cwd(), '..');
  const pages = readFileSync(join(root, '.github', 'workflows', 'pages.yml'), 'utf8');
  const names = pages.slice(pages.indexOf('names="'), pages.indexOf('carried=""'));
  const example = readFileSync(join(root, 'app', '.env.example'), 'utf8');
  const secrets = readFileSync(join(root, 'SECRETS.md'), 'utf8');

  it('finds the list it is checking, so a moved marker cannot turn this into a pass', () => {
    expect(names).toContain('VITE_SUPABASE_URL');
    expect(Object.values(MODULE_FLAG_ENV).length).toBeGreaterThanOrEqual(18);
  });

  for (const [flag, env] of Object.entries(MODULE_FLAG_ENV)) {
    it(`${flag}: ${env} is passed by the Pages workflow, reported in its diagnostics, shown in .env.example and listed in SECRETS.md`, () => {
      expect(pages, 'workflow env').toMatch(new RegExp(`^\\s+${env}: \\$\\{\\{ vars\\.${env} \\|\\| secrets\\.${env} \\}\\}`, 'm'));
      expect(names, 'workflow diagnostics list').toMatch(new RegExp(`\\b${env}\\b`));
      expect(example, '.env.example').toMatch(new RegExp(`^${env}=`, 'm'));
      expect(secrets, 'SECRETS.md').toContain('`' + env + '`');
    });
  }
});
