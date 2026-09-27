/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOTS } from './state/shape';
import { NOTIF_DEFS } from './data/misc';
import { TIER } from './lib/notify';

/**
 * The mechanical half of `docs/DO-NOT-BUILD.md`.
 *
 * That page lists what may not enter the product. The rules that can be
 * checked by reading code are checked here, and the lists they check against
 * are read *from the page* — so relaxing one means editing the page in the
 * same diff, where a reviewer sees it, rather than quietly in a feature.
 */

const APP = join(__dirname, '..');
const PAGE = readFileSync(join(APP, '..', 'docs', 'DO-NOT-BUILD.md'), 'utf8');

/** The body of the page's fenced block tagged `name`. */
function block(name: string): string {
  const m = PAGE.match(new RegExp('```' + name + '\\n([\\s\\S]*?)```'));
  if (!m) throw new Error(`DO-NOT-BUILD.md has no \`\`\`${name} block`);
  return m[1].trim();
}

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files(path, out);
    else if (/\.(ts|tsx|js|mjs|html)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

const SOURCE = [...files(join(APP, 'src')), ...files(join(APP, 'public')), join(APP, 'index.html')];

describe('rule 1: the top-level navigation is the approved one', () => {
  it('matches the roots written on the page, in order', () => {
    expect(ROOTS.join(', ')).toBe(block('roots'));
  });
});

describe('rule 4: every notification has an owner, a switch, a tier and a cap', () => {
  it('gives every switchable rule a tier', () => {
    for (const d of NOTIF_DEFS) expect(TIER[d.k], d.k).toBeDefined();
  });

  it('creates notifications only in the allow-listed files', () => {
    const allowed = block('notifiers').split('\n').map((l) => l.trim()).filter(Boolean);
    const found = SOURCE.filter((f) => /new Notification\(|showNotification\(/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(APP, f).split('\\').join('/'))
      .sort();
    expect(found).toEqual([...allowed].sort());
  });
});

describe('rule 10: no advertising or tracking SDK', () => {
  it('loads none of the common ad or tracking hosts', () => {
    const hosts = /googletagmanager|google-analytics\.com|doubleclick|googlesyndication|connect\.facebook\.net|\bfbq\(|hotjar|segment\.io|mixpanel/;
    const found = SOURCE.filter((f) => hosts.test(readFileSync(f, 'utf8'))).map((f) => relative(APP, f));
    expect(found).toEqual([]);
  });
});
