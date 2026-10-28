// Structural guard (28 Oct). Zite's permissions file "defines roles. It does not enforce anything"
// (developers.zite.com/framework/permissions-file): there is no platform default-deny, so every endpoint is open unless its
// own code closes it. This test reads every endpoint in every app and requires `authenticated: true` unless the endpoint is on
// the reviewed public list below, with the reason it is safe to call signed out.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test, eq } from './harness';

export const PUBLIC: Record<string, string> = {
  'semester-site/src/api/publishedPosts.ts': 'Public website: lists posts already approved for publication',
  'semester-site/src/api/submitRequest.ts': 'Public website: write-only contact form, returns nothing back, throttled',
  'semester-site/src/api/trustCenter.ts': 'Public website: approved public Trust Center content only',
  'semester/src/api/sandboxApi.ts': 'Developer app API: authenticates by app token on every call; returns synthetic sandbox data only',
};

const APPS = resolve(process.cwd(), 'apps');
const endpoints = () => readdirSync(APPS).flatMap((a) => { const d = join(APPS, a, 'src', 'api'); return existsSync(d) ? readdirSync(d).filter((f) => f.endsWith('.ts')).map((f) => `${a}/src/api/${f}`) : []; });
const open = (src: string) => /createEndpoint\(/.test(src) && !/authenticated:\s*true/.test(src);

test('every endpoint requires sign-in unless it is on the reviewed public list', () => {
  const found = endpoints().filter((p) => open(readFileSync(join(APPS, p), 'utf8')) && !(p in PUBLIC));
  eq(found, []);
});
test('the public list has no stale entries, and each entry says why', () => {
  const all = new Set(endpoints());
  eq(Object.keys(PUBLIC).filter((p) => !all.has(p)), []);
  eq(Object.entries(PUBLIC).filter(([, why]) => why.length < 20).map(([p]) => p), []);
});
test('public endpoints never read the signed-in user (they have none)', () => {
  eq(Object.keys(PUBLIC).filter((p) => /context\.user/.test(readFileSync(join(APPS, p), 'utf8'))), []);
});
test('control: the detector flags an endpoint without authenticated: true and passes one with it', () => {
  eq(open("export default createEndpoint({ description: 'x', execute: async () => 1 })"), true);
  eq(open("export default createEndpoint({ authenticated: true, execute: async () => 1 })"), false);
  eq(endpoints().length > 100, true);
});
