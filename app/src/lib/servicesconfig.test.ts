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
