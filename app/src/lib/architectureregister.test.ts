import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ROWS, renderRegister, sectionsCovered } from './architectureregister';

/**
 * Holds the architecture traceability register to the same rule as the other
 * registers: every cited file exists, and each column cites the kind of file
 * it claims — `designed` a document, `implemented` code or a migration,
 * `tested` a test or check. Every row names what is still open, and every
 * section of the brief and every mainframe layer A–I has at least one row.
 *
 * `docs/ARCHITECTURE-TRACEABILITY-REGISTER.md` is rendered from the rows; run
 * `npm run registers` from app/ to rewrite it. The last test fails while stale.
 */

const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const DOC = join(REPO, 'docs/ARCHITECTURE-TRACEABILITY-REGISTER.md');

const exists = (path: string) => existsSync(join(REPO, path));
const isDirectory = (path: string) => exists(path) && statSync(join(REPO, path)).isDirectory();
const isDocument = (path: string) => path.endsWith('.md') || isDirectory(path);
const isTest = (path: string) => /\.test\.tsx?$/.test(path) || /\.check\.sql$/.test(path);

const cited = ROWS.flatMap((row) => [...row.designed, ...row.implemented, ...row.tested]);

describe('architecture traceability register', () => {
  it('cites only files that exist', () => {
    const missing = cited.filter((path) => !exists(path));
    expect(missing).toEqual([]);
  });

  it('cites documents under `designed`', () => {
    const notDocuments = ROWS.flatMap((row) => row.designed).filter((path) => !isDocument(path));
    expect(notDocuments).toEqual([]);
  });

  it('cites code or migrations under `implemented`, never a document or a test', () => {
    const wrongKind = ROWS.flatMap((row) => row.implemented).filter(
      (path) => path.endsWith('.md') || isTest(path),
    );
    expect(wrongKind).toEqual([]);
  });

  it('cites tests or checks under `tested`', () => {
    const notTests = ROWS.flatMap((row) => row.tested).filter((path) => !isTest(path));
    expect(notTests).toEqual([]);
  });

  it('gives every row an id that is unique and an open note that is not empty', () => {
    const ids = ROWS.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const row of ROWS) {
      expect(row.open.trim(), row.id).not.toBe('');
    }
  });

  it('covers every section of the brief', () => {
    const covered = sectionsCovered();
    const missing = Array.from({ length: 13 }, (_, i) => i + 1).filter((n) => !covered.has(n));
    expect(missing).toEqual([]);
  });

  it('covers every mainframe layer A–I', () => {
    const layers = new Set<string>(ROWS.map((row) => row.layer));
    const missing = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].filter((l) => !layers.has(l));
    expect(missing).toEqual([]);
  });

  it('keeps the rendered register in step with its rows', () => {
    if (process.env.REGISTERS === 'write') writeFileSync(DOC, renderRegister());
    expect(readFileSync(DOC, 'utf8')).toBe(renderRegister());
  });
});
