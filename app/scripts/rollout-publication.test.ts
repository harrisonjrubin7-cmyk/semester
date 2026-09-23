import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const fallback = resolve(process.cwd(), '../../../outputs/semester-institutional-rollout');
const supplied = process.argv.find((argument) => argument.endsWith('semester-institutional-rollout'));
const artifacts = supplied ? resolve(supplied) : fallback;
const repo = resolve(process.cwd(), '..');
const manifest = JSON.parse(readFileSync(resolve(repo, 'docs/institutional-rollout/publication-manifest.json'), 'utf8'));
const validationPath = resolve(artifacts, 'publication-validation.json');
const publicationSuite = spawnSync('pdftotext', ['-v']).error ? describe.skip : describe;

function sha(path: string) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

publicationSuite('institutional rollout publication', () => {
  it('contains the master PDF and all 17 editable documents with manifest hashes', () => {
    expect(existsSync(validationPath)).toBe(true);
    const validation = JSON.parse(readFileSync(validationPath, 'utf8'));
    expect(validation.visualInspection).toBe('passed');
    expect(validation.artifactCount).toBe(18);
    expect(manifest.publishedArtifacts).toHaveLength(18);

    for (const entry of manifest.documents) {
      const path = resolve(artifacts, entry.outputFilename.replace(/\.md$/, '.docx'));
      expect(existsSync(path), path).toBe(true);
    }
    for (const entry of manifest.publishedArtifacts) {
      const path = resolve(artifacts, entry.filename);
      expect(existsSync(path), path).toBe(true);
      expect(sha(path)).toBe(entry.sha256);
    }
  });

  it('reopens a nonblank PDF with at least 17 top-level sections and every capability ID', () => {
    const pdf = resolve(artifacts, 'Semester-Institutional-Rollout-Master.pdf');
    const info = execFileSync('pdfinfo', [pdf], { encoding: 'utf8' });
    const pages = Number(/^Pages:\s+(\d+)/m.exec(info)?.[1]);
    expect(pages).toBeGreaterThanOrEqual(17);

    const text = execFileSync('pdftotext', [pdf, '-'], { encoding: 'utf8', maxBuffer: 20_000_000 });
    for (let index = 1; index <= 60; index += 1) {
      expect(text).toContain(`CAP-${String(index).padStart(3, '0')}`);
    }
    for (const marker of ['Table of Contents', 'Traceability Appendix', 'Verification Appendix', 'Decisions Risks and External Blockers']) {
      expect(text).toContain(marker);
    }
    expect((text.match(/DOCUMENT \d+ OF 17/g) ?? []).length).toBeGreaterThanOrEqual(17);

    for (let page = 1; page <= pages; page += 1) {
      const pageText = execFileSync('pdftotext', ['-f', String(page), '-l', String(page), pdf, '-'], { encoding: 'utf8' });
      expect(pageText.replace(/\s+/g, '').length, `blank PDF page ${page}`).toBeGreaterThan(20);
    }
  });

  it('preserves document structure, table headers, links, page fields and appendix labels', () => {
    const masterDoc = resolve(artifacts, 'master-specification.docx');
    const xml = execFileSync('unzip', ['-p', masterDoc, 'word/document.xml'], { encoding: 'utf8', maxBuffer: 20_000_000 });
    const footer = execFileSync('unzip', ['-p', masterDoc, 'word/footer1.xml'], { encoding: 'utf8' });
    const rels = execFileSync('unzip', ['-p', masterDoc, 'word/_rels/document.xml.rels'], { encoding: 'utf8' });
    expect(xml).toContain('w:pStyle w:val="Title"');
    expect(xml).toContain('w:pStyle w:val="Heading1"');
    expect(xml).toContain('w:tblHeader');
    expect(footer).toContain('PAGE');
    expect(rels).toContain('hyperlink');

    const validation = JSON.parse(readFileSync(validationPath, 'utf8'));
    expect(validation).toMatchObject({
      pageCount: expect.any(Number),
      docxCount: 17,
      blankPages: [],
      capabilityIds: 60,
    });
    expect(validation.artifacts.map((item: { filename: string }) => basename(item.filename))).toHaveLength(18);
  });
});
