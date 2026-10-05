import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REQUIRED_PUBLICATION_SLUGS, validateManifest } from './rollout-artifacts.mjs';

const repo = resolve(process.cwd(), '..');
const manifestPath = resolve(repo, 'docs/institutional-rollout/publication-manifest.json');

describe('institutional rollout publication artifacts', () => {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

  it('has exactly the approved 17 publication records with complete metadata', () => {
    expect(manifest.documents.map((entry: { slug: string }) => entry.slug)).toEqual(
      REQUIRED_PUBLICATION_SLUGS,
    );
    expect(() => validateManifest(manifest)).not.toThrow();
    for (const entry of manifest.documents) {
      expect(entry).toMatchObject({
        owner: expect.any(String),
        verificationDate: '2026-09-23',
        generationStatus: 'generated',
      });
      expect(entry.title.length).toBeGreaterThan(4);
      expect(entry.sourceSections.length).toBeGreaterThan(0);
      expect(entry.outputFilename).toBe(`${entry.slug}.md`);
      expect(entry.sha256).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it('lists nine ordered execution packets with every required instruction section', () => {
    expect(manifest.executionPackets).toHaveLength(9);
    expect(manifest.executionPackets.map((entry: { outputFilename: string }) => entry.outputFilename)).toEqual([
      '00-baseline-foundation.md',
      '01-identity-tenancy-authorization.md',
      '02-canonical-academic-data.md',
      '03-capture-planning-provenance.md',
      '04-study-creation-ai.md',
      '05-campus-career-messaging.md',
      '06-integrations-operations.md',
      '07-security-accessibility-quality.md',
      '08-institutional-rollout.md',
    ]);
    const headings = [
      'Objective', 'Outcomes', 'Requirement IDs', 'Dependencies', 'Repository areas',
      'Security, privacy and accessibility constraints', 'Tests-first steps',
      'Verification commands', 'Migration and rollback', 'Definition of complete',
      'Evidence return format', 'Stop conditions',
    ];
    for (const entry of manifest.executionPackets) {
      const text = readFileSync(resolve(repo, 'docs/institutional-rollout/generated/claude-code', entry.outputFilename), 'utf8');
      for (const heading of headings) expect(text).toContain(`## ${heading}`);
    }
  });

  it('matches every generated hash and contains no placeholders', () => {
    const entries = [...manifest.documents, ...manifest.executionPackets];
    for (const entry of entries) {
      const folder = manifest.documents.includes(entry) ? 'publication' : 'claude-code';
      const text = readFileSync(resolve(repo, 'docs/institutional-rollout/generated', folder, entry.outputFilename), 'utf8');
      expect(createHash('sha256').update(text).digest('hex')).toBe(entry.sha256);
      expect(text).not.toMatch(/\b(TBD|TODO|TK)\b|coming soon|implement later/i);
    }
  });

  it('rejects a manifest missing one required publication', () => {
    const mutated = { ...manifest, documents: manifest.documents.slice(1) };
    expect(() => validateManifest(mutated)).toThrow(/required publication slugs/i);
  });
});
