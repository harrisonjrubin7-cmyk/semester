import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runPublicProductionSmoke } from './public-production-smoke.mjs';
import { PAGES_PRODUCTION_ORIGIN, resolveProductionTarget } from './production-target.mjs';

const originalTarget = process.env.SEMESTER_PUBLIC_APP_TARGET;
const originalUrl = process.env.SEMESTER_PUBLIC_APP_URL;

afterEach(() => {
  if (originalTarget === undefined) delete process.env.SEMESTER_PUBLIC_APP_TARGET;
  else process.env.SEMESTER_PUBLIC_APP_TARGET = originalTarget;
  if (originalUrl === undefined) delete process.env.SEMESTER_PUBLIC_APP_URL;
  else process.env.SEMESTER_PUBLIC_APP_URL = originalUrl;
  vi.unstubAllGlobals();
});

describe('the explicit production smoke target', () => {
  it('keeps public Vercel configuration independent from institutional activation', () => {
    const workflow = readFileSync(
      new URL('../../.github/workflows/production-smoke.yml', import.meta.url),
      'utf8',
    );
    const publicJob = workflow.match(/\n  public:\n([\s\S]*?)\n  pages:/)?.[1] ?? '';
    const institutionalJob = workflow.match(/\n  institutional:\n([\s\S]*?)\n  record:/)?.[1] ?? '';

    expect(publicJob).toContain(
      'SEMESTER_PUBLIC_APP_URL: ${{ vars.SEMESTER_PUBLIC_APP_URL }}',
    );
    expect(publicJob).not.toContain('SEMESTER_PRODUCTION_APP_URL');
    expect(institutionalJob).toContain(
      'APP_URL: ${{ vars.SEMESTER_PRODUCTION_APP_URL }}',
    );
    expect(institutionalJob).toContain(
      'GATEWAY_URL: ${{ vars.SEMESTER_PRODUCTION_GATEWAY_URL }}',
    );
    expect(institutionalJob).toContain(
      'Set both SEMESTER_PRODUCTION_APP_URL and SEMESTER_PRODUCTION_GATEWAY_URL',
    );
  });

  it('rejects an empty Vercel target before any fetch', async () => {
    process.env.SEMESTER_PUBLIC_APP_TARGET = 'vercel';
    delete process.env.SEMESTER_PUBLIC_APP_URL;
    const fetch = vi.fn(() => {
      throw new Error('fetch must not run without an explicit Vercel target');
    });
    vi.stubGlobal('fetch', fetch);

    await expect(runPublicProductionSmoke()).rejects.toThrow(
      'Vercel production monitoring requires an explicit HTTPS origin.',
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects unsafe or non-origin Vercel URLs', () => {
    for (const value of [
      'http://semesterintel.tech',
      'https://user:secret@semesterintel.tech',
      'https://semesterintel.tech/app',
      'https://semesterintel.tech/?preview=true',
      'not a URL',
    ]) {
      expect(() => resolveProductionTarget('vercel', value), value).toThrow(
        'Vercel production monitoring requires an explicit HTTPS origin.',
      );
    }
  });

  it('keeps Pages explicit and labels both checks as availability monitors, not release proof', () => {
    expect(resolveProductionTarget('pages')).toEqual({
      kind: 'pages',
      app: PAGES_PRODUCTION_ORIGIN,
      label: 'GitHub Pages availability monitor',
      evidence: 'availability-monitor',
      provesRelease: false,
    });
    expect(resolveProductionTarget('vercel', 'https://semesterintel.tech')).toEqual({
      kind: 'vercel',
      app: 'https://semesterintel.tech',
      label: 'Vercel production availability monitor',
      evidence: 'availability-monitor',
      provesRelease: false,
    });
  });
});
