import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '..', '..', '..');
const config = JSON.parse(readFileSync(join(repo, 'vercel.json'), 'utf8')) as {
  redirects?: Array<{ source: string; destination: string; permanent: boolean }>;
  rewrites: Array<{ source: string; has?: unknown[]; destination: { service: string; path?: string } }>;
};

function serviceFor(path: string, host = 'www.semesterintel.tech'): string {
  if (path === '/app' && !/semester\.website$/i.test(host)) {
    return config.redirects?.find((rule) => rule.source === path)?.destination ?? '';
  }
  for (const rule of config.rewrites) {
    if (rule.has && !/semester\.website$/i.test(host)) continue;
    const pattern = rule.source.startsWith('^')
      ? new RegExp(rule.source)
      : new RegExp(`^${rule.source.replace('/(.*)', '(?:/.*)?').replace('(.*)', '.*')}import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '..', '..', '..');
const config = JSON.parse(readFileSync(join(repo, 'vercel.json'), 'utf8')) as {
  redirects?: Array<{ source: string; destination: string; permanent: boolean }>;
  rewrites: Array<{ source: string; has?: unknown[]; destination: { service: string; path?: string } }>;
};

function serviceFor(path: string, host = 'www.semesterintel.tech'): string {
  if (path === '/app' && !/semester\.website$/i.test(host)) {
    return config.redirects?.find((rule) => rule.source === path)?.destination ?? '';
  }
  for (const rule of config.rewrites) {
    if (rule.has && !/semester\.website$/i.test(host)) continue;
);
    if (pattern.test(path)) return rule.destination.service;
  }
  return '';
}

describe('unified Semester host routing', () => {
  it.each([
    ['/', 'company-site'],
    ['/pricing', 'company-site'],
    ['/app', 'app'],
    ['/app/', 'app'],
    ['/app/index.html', 'app'],
    ['/api/institution/health', 'api'],
    ['/api/productivity/health', 'api'],
    ['/lab', 'workflow-lab'],
    ['/lab/auth/sign-in', 'workflow-lab'],
  ])('routes %s to %s', (path, target) => {
    expect(serviceFor(path)).toBe(target);
  });

  it('keeps the separate company domain on the company service at every path', () => {
    for (const path of ['/', '/app', '/app/', '/api/institution/health', '/lab']) {
      expect(serviceFor(path, 'www.semester.website')).toBe('company-site');
    }
  });

  it('builds and registers the application under /app/', () => {
    const main = readFileSync(join(repo, 'app/src/main.tsx'), 'utf8');
    const manifest = JSON.parse(readFileSync(join(repo, 'app/public/manifest.webmanifest'), 'utf8'));
    expect(main).toContain('`${base}sw.js`');
    expect(main).toContain('{ scope: base }');
    expect(manifest.start_url).toBe('./');
    expect(manifest.scope).toBe('./');
    expect(manifest.id).toBe('./');
  });
});
