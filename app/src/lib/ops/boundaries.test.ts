import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BOUNDARIES, DB_DRIVERS, FACE_LIBRARIES, SCREEN_CAPTURE_ALLOWED } from './boundaries';
import { cell, controlLine, link, renderedFrom, table } from './render';
import { written } from './decisionlog';

/**
 * The strategic boundaries, and the mechanical half of holding them.
 *
 * A boundary that says it is held by a test is held by *this* test, so the
 * checks below are the ones the data promises: no service-role credential in
 * anything a browser loads, no face library, screen capture only where the
 * page allows it, and no database driver or connection string that would let
 * a school’s system of record be wired in directly. Each has a control — a
 * fixture the check must catch — because a scan that finds nothing is also
 * what a scan that looks for the wrong thing finds.
 *
 * `ops/strategic-boundaries/README.md` is rendered from the data; `npm run
 * registers` from app/ rewrites it, and the last test fails while it is stale.
 */

const root = join(import.meta.dirname, '../../../..');
const app = join(root, 'app');
const at = (p: string) => join(root, p);
const read = (p: string) => readFileSync(at(p), 'utf8');
const DOC = 'ops/strategic-boundaries/README.md';

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (name === 'node_modules' || name === 'dist' || name === 'dist-site') continue;
    if (statSync(path).isDirectory()) files(path, out);
    else if (/\.(ts|tsx|js|mjs|html|css|json)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

/**
 * What a browser can load: the app source, its public folder and its entry
 * page. The one file left out is the data module that *defines* the patterns
 * below, which necessarily spells them; it is scanned by reading, above.
 */
const PATTERNS = join(app, 'src/lib/ops/boundaries.ts');
const BROWSER = [...files(join(app, 'src')), ...files(join(app, 'public')), join(app, 'index.html')].filter((f) => f !== PATTERNS);
/** Everything that runs anywhere, for the driver and connection-string scans. */
const EVERYWHERE = [...BROWSER, ...files(join(app, 'server')), ...files(join(root, 'packages')), ...files(join(root, 'supabase'))];
const rel = (f: string) => relative(app, f).split('\\').join('/');

const MANIFESTS = ['app/package.json', 'packages/contract/package.json', 'packages/institution/package.json', 'pipeline/package.json', 'video/package.json'];
const dependencies = (manifest: string): string[] => {
  const json = JSON.parse(read(manifest)) as Record<string, Record<string, string> | undefined>;
  return Object.keys({ ...json.dependencies, ...json.devDependencies, ...json.optionalDependencies, ...json.peerDependencies });
};

const SERVICE_ROLE = /SUPABASE_SERVICE_ROLE|service_role_key|\bservice_role\b/i;
const CONNECTION_STRING = /\b(postgres(ql)?|mysql|oracle|mssql|jdbc:[a-z]+):\/\//i;
const PROCTORING_FEATURE = /proctor(ing|ed)?\s*(mode|session|exam|feature|camera|lockdown)/i;

describe('the strategic boundaries', () => {
  describe('their shape', () => {
    it('are the twelve lines of the brief, each held by something that exists', () => {
      expect(BOUNDARIES).toHaveLength(12);
      expect(new Set(BOUNDARIES.map((b) => b.id)).size).toBe(12);
      for (const b of BOUNDARIES) {
        expect(b.holders.length, `${b.id} has no holder`).toBeGreaterThan(0);
        for (const h of b.holders) expect(existsSync(at(h.path)), `${b.id} cites ${h.path}, which is missing`).toBe(true);
      }
    });

    it('call a line mechanical only when this test is among its holders', () => {
      for (const b of BOUNDARIES) {
        const byTest = b.holders.some((h) => /\.test\.tsx?$/.test(h.path) || /\.check\.sql$/.test(h.path));
        expect(byTest, `${b.id} is ${b.held}`).toBe(b.held === 'mechanical');
      }
    });

    it('cite decisions that are written down', () => {
      for (const b of BOUNDARIES) {
        for (const d of b.decisions) {
          if (d.startsWith('ADR-')) expect(readdirSync(at('docs/architecture')).some((f) => f.startsWith(`${d.slice(4)}-`)), `${b.id} cites ${d}`).toBe(true);
          else expect(written(root, d), `${b.id} cites ${d}`).toBe(true);
        }
      }
    });
  });

  describe('no service-role credentials in browsers', () => {
    it('would catch one', () => {
      expect(SERVICE_ROLE.test("createClient(url, import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY)")).toBe(true);
      expect(SERVICE_ROLE.test("Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')")).toBe(true);
      expect(SERVICE_ROLE.test('role_grants are written by the service key')).toBe(false);
      expect(SERVICE_ROLE.test('Service-role worker enforcing tenant scope')).toBe(false); // prose about the role is not the credential
    });

    it('finds none in anything a browser loads', () => {
      const found = BROWSER.filter((f) => SERVICE_ROLE.test(readFileSync(f, 'utf8'))).map(rel);
      expect(found).toEqual([]);
    });

    it('is not undone by a build-time variable', () => {
      const vite = BROWSER.flatMap((f) => readFileSync(f, 'utf8').match(/VITE_[A-Z0-9_]+/g) ?? []);
      expect([...new Set(vite)].filter((v) => /SERVICE|SECRET|PRIVATE_KEY/.test(v))).toEqual([]);
    });
  });

  describe('no emotion or facial analysis', () => {
    it('would catch a face library', () => {
      expect(FACE_LIBRARIES.test('face-api.js')).toBe(true);
      expect(FACE_LIBRARIES.test('@tensorflow-models/face-landmarks-detection')).toBe(true);
      expect(FACE_LIBRARIES.test('pdfjs-dist')).toBe(false);
    });

    it('depends on none, in any package', () => {
      for (const m of MANIFESTS) expect(dependencies(m).filter((d) => FACE_LIBRARIES.test(d)), m).toEqual([]);
    });

    it('names no face detector in the source', () => {
      // API and library names, not prose: a register that says "no emotion recognition" is keeping the line, not crossing it.
      const found = BROWSER.filter((f) => /FaceDetector|face-api|faceapi|detectFaces|FaceLandmarker|FaceMesh/.test(readFileSync(f, 'utf8'))).map(rel);
      expect(found).toEqual([]);
    });
  });

  describe('no unapproved proctoring or surveillance', () => {
    it('captures a screen only where the page allows it', () => {
      const found = BROWSER.filter((f) => /getDisplayMedia/.test(readFileSync(f, 'utf8'))).map(rel).sort();
      expect(found).toEqual([...SCREEN_CAPTURE_ALLOWED].sort());
    });

    it('would catch a proctoring feature by name', () => {
      expect(PROCTORING_FEATURE.test('start proctoring session')).toBe(true);
      expect(PROCTORING_FEATURE.test('Confirm exam and proctoring arrangements for each course')).toBe(false);
    });

    it('has no proctoring feature', () => {
      const found = BROWSER.filter((f) => PROCTORING_FEATURE.test(readFileSync(f, 'utf8'))).map(rel);
      expect(found).toEqual([]);
    });
  });

  describe('no direct SIS production database connection', () => {
    it('would catch a driver and a connection string', () => {
      expect(DB_DRIVERS).toContain('pg');
      expect(CONNECTION_STRING.test("const url = 'postgresql://sis_ro:pw@sis.university.edu:5432/banner'")).toBe(true);
      expect(CONNECTION_STRING.test('https://example.supabase.co/rest/v1/')).toBe(false);
    });

    it('depends on no relational database driver, in any package', () => {
      for (const m of MANIFESTS) expect(dependencies(m).filter((d) => DB_DRIVERS.includes(d)), m).toEqual([]);
    });

    it('carries no database connection string anywhere that runs', () => {
      const found = EVERYWHERE.filter((f) => CONNECTION_STRING.test(readFileSync(f, 'utf8'))).map((f) => relative(root, f));
      expect(found).toEqual([]);
    });
  });

  it(`is what ${DOC} says`, () => {
    const rendered = render();
    if (process.env.REGISTERS === 'write') writeFileSync(at(DOC), rendered);
    expect(read(DOC), `${DOC} is stale; run \`npm run registers\` from app/`).toBe(rendered);
  });
});

// ── rendering ──────────────────────────────────────────────────────────────

function render(): string {
  const ref = (p: string) => `[\`${p}\`](${link(DOC, p)})`;
  const mechanical = BOUNDARIES.filter((b) => b.held === 'mechanical').length;
  const out: string[] = [
    '# Strategic boundaries',
    '',
    renderedFrom('app/src/lib/ops/boundaries.ts', 'boundaries.test.ts'),
    '',
    controlLine(DOC),
    '',
    'What Semester does not build, whoever asks and however good the deal. These',
    'are the company-level lines; the product-level anti-patterns (no custom',
    'button, no unexplained score) are [`docs/DO-NOT-BUILD.md`](../../docs/DO-NOT-BUILD.md).',
    'Together they protect focus, ethics, privacy, legal position and brand trust,',
    'and they are the first thing to read before answering a request that begins',
    '"could Semester also…".',
    '',
    `Each line says how it is held. ${mechanical} of the ${BOUNDARIES.length} are held by a test that`,
    'fails the build; the rest by a decision or a document plus review, and the',
    'line says which. A boundary held only by review is one somebody can talk',
    'themselves out of, so the ones that can be mechanical are.',
    '',
    'Changing a line is a decision, made in a pull request that edits',
    '`app/src/lib/ops/boundaries.ts`, says why, and records a `D-nnn` in',
    '[`docs/DECISION-LOG.md`](../../docs/DECISION-LOG.md). This page is rendered',
    'from that data, so a boundary cannot be relaxed without the page changing in',
    'the same diff.',
    '',
    '## The lines',
    '',
    ...table(
      ['#', 'Boundary', 'Held', 'Held by', 'Decisions'],
      BOUNDARIES.map((b, i) => [
        String(i + 1),
        `**${cell(b.rule)}**`,
        b.held,
        b.holders.map((h) => ref(h.path)).join('<br>'),
        b.decisions.length ? b.decisions.map((d) => `\`${d}\``).join(', ') : '—',
      ]),
    ),
    '',
    '## What each protects, and what holds it',
    '',
  ];
  BOUNDARIES.forEach((b, i) => {
    out.push(`### ${i + 1}. ${b.rule}`, '', b.protects, '');
    for (const h of b.holders) out.push(`- ${ref(h.path)} — ${h.how}.`);
    if (b.note) out.push('', `*Not a crossing:* ${b.note}`);
    out.push('');
  });
  out.push(
    '## The mechanical checks',
    '',
    '`boundaries.test.ts` scans the tree on every change:',
    '',
    '- **Service role.** No file under `app/src`, `app/public` or `app/index.html`',
    '  names the service role, and no `VITE_` variable carries `SERVICE`, `SECRET`',
    '  or `PRIVATE_KEY`.',
    '- **Faces.** No package manifest depends on a face, emotion or affect',
    '  library, and no source names a face detector.',
    '- **Screen capture.** `getDisplayMedia` appears only in:',
    '',
    '```capture',
    ...SCREEN_CAPTURE_ALLOWED,
    '```',
    '',
    '- **Databases.** No manifest depends on a relational driver',
    `  (${DB_DRIVERS.map((d) => `\`${d}\``).join(', ')}), and nothing that runs carries a`,
    '  database connection string.',
    '',
    'Each check is shown a fixture it must catch before it is trusted to find',
    'nothing, because a scan that finds nothing is also what a scan looking for',
    'the wrong thing finds.',
    '',
  );
  return out.join('\n');
}
