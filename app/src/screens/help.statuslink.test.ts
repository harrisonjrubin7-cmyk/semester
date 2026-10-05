import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The status page is only useful if a student can find it. It lived at
 * /status.html with nothing in the app pointing at it (SRE-010, STU-012), and
 * #922 put the link in Help. Nothing held it there: a rewrite of Help's
 * header could drop it and every test would stay green. This does.
 *
 * The href must carry the base — `/status.html` is a 404 on the Pages subpath.
 */
const root = join(__dirname, '..', '..');
const help = readFileSync(join(root, 'src', 'screens', 'Help.tsx'), 'utf8');

describe('Help links the status page', () => {
  it('with the deploy base in front of it', () => {
    expect(help).toMatch(/href=\{`\$\{import\.meta\.env\.BASE_URL\}status\.html`\}|href=\{asset\('status\.html'\)\}/);
  });

  it('and the page it points at exists', () => {
    expect(existsSync(join(root, 'public', 'status.html'))).toBe(true);
  });
});
