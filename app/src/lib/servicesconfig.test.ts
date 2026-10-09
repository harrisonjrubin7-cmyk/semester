import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The root `vercel.json` serves three services from one project. Vercel reads
 * a service's headers, function limits and rewrites from that service's entry
 * in the root file, not from the `vercel.json` inside its folder: when the
 * project's Root Directory moved from `app` to the repository root, the app
 * stopped sending its CSP, Permissions-Policy, nosniff and referrer headers on
 * the canonical alias, and nothing failed.
 *
 * The folder files stay because other tests and tools read them
 * (`hostheaders.test.ts`, `cspheader.ts`). So there are two copies of one list,
 * and this test is what keeps them one.
 */
const repo = join(__dirname, '..', '..', '..');
const read = (path: string) => JSON.parse(readFileSync(join(repo, path), 'utf8'));

const root = read('vercel.json');
const app = read('app/vercel.json');
const company = read('company-site/vercel.json');

describe('root vercel.json services carry what each folder file says', () => {
  it('routes both API prefixes to an explicit Node service before the app catch-all', () => {
    expect(root.services.api.root).toBe('app');
    expect(root.services.api.entrypoint).toBe('server/institution/vercel-service.ts');
    expect(root.services.api.installCommand).toBe('npm install --no-save typescript@6.0.3');
    expect(root.services.api.headers).toEqual(app.headers);
    expect(root.services.api.functions).toEqual({
      'server/institution/vercel-service.ts': { maxDuration: 30 },
    });
    expect(root.rewrites.slice(1, 3)).toEqual([
      { source: '/api/institution/(.*)', destination: { service: 'api' } },
      { source: '/api/productivity/(.*)', destination: { service: 'api' } },
    ]);
    expect(root.rewrites[0]).toEqual({
      source: '/(.*)',
      has: [{ type: 'host', value: '(www\\.)?semester\\.website' }],
      destination: { service: 'company-site' },
    });
    expect(root.rewrites.slice(3, 5)).toEqual([
      { source: '/lab', destination: { service: 'workflow-lab' } },
      { source: '/lab/(.*)', destination: { service: 'workflow-lab' } },
    ]);
    expect(root.rewrites.at(-1)).toEqual({ source: '/(.*)', destination: { service: 'app' } });
  });

  it('app: headers and function limits', () => {
    expect(root.services.app.headers).toEqual(app.headers);
    expect(root.services.app.functions).toEqual(app.functions);
  });

  it('company-site: headers and rewrites', () => {
    expect(root.services['company-site'].headers).toEqual(company.headers);
    expect(root.services['company-site'].rewrites).toEqual(company.rewrites);
  });

  it('the app still sends a Content-Security-Policy', () => {
    const keys = root.services.app.headers.flatMap((rule: { headers: { key: string }[] }) =>
      rule.headers.map((h) => h.key),
    );
    expect(keys).toContain('Content-Security-Policy');
  });
});
