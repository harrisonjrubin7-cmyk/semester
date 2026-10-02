import { describe, expect, it } from 'vitest';
import { publicReleaseManifest } from '../../release-manifest.ts';
import { validateProductionRelease } from '../../scripts/public-production-smoke.mjs';

const SHA = '36aefe99840dd9aa424c1f7872f23c64e227aaf8';
type Manifest = ReturnType<typeof publicReleaseManifest>;
type ReleaseOverride = Partial<Omit<Manifest, 'source' | 'features' | 'controls'>> & {
  source?: Partial<Manifest['source']>;
  features?: Partial<Manifest['features']>;
  controls?: Partial<Manifest['controls']>;
};

describe('the public release manifest', () => {
  it('reports the shipped production configuration as states and booleans', () => {
    expect(publicReleaseManifest({
      MODE: 'production',
      SEMESTER_RELEASE_SHA: SHA,
      VITE_BUILD_ID: 'release-42',
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_KEY: 'publishable-key',
      VITE_HUMAN_HELP: 'production',
      VITE_PRIVATE_BETA: 'off',
      VITE_READ_ONLY: 'false',
      VITE_UNIVERSITY_GATEWAY_URL: 'https://gateway.example.edu',
    })).toMatchObject({
      schemaVersion: 1,
      source: { sha: SHA, buildId: 'release-42' },
      environment: 'Production',
      features: { humanHelp: 'production', privateBeta: 'off' },
      controls: { readOnly: false, accountService: true, institutionalPreview: false },
      services: { universityGateway: true },
    });
  });

  it('identifies a demo and proves its blank account pair is off', () => {
    expect(publicReleaseManifest({
      MODE: 'production',
      VITE_INSTITUTIONAL_PREVIEW: 'true',
      VITE_SUPABASE_URL: '',
      VITE_SUPABASE_KEY: '',
    })).toMatchObject({
      environment: 'Demo',
      controls: { accountService: false, institutionalPreview: true },
    });
  });

  it('never emits configured values, URLs, credentials or their lengths', () => {
    const secrets = {
      VITE_SUPABASE_URL: 'https://private-project.supabase.co',
      VITE_SUPABASE_KEY: 'publishable-but-do-not-repeat',
      VITE_TURN_URL: 'turns:relay.example.edu:5349',
      VITE_TURN_USER: 'relay-user',
      VITE_TURN_PASS: 'relay-password',
      VITE_CLAUDE_PROXY: 'https://assistant-proxy.example.edu',
    };
    const text = JSON.stringify(publicReleaseManifest({ MODE: 'production', ...secrets }));
    for (const value of Object.values(secrets)) expect(text).not.toContain(value);
    expect(text).not.toMatch(/supabase\.co|relay-user|relay-password|assistant-proxy/);
    expect(JSON.parse(text)).toMatchObject({
      controls: { accountService: true },
      services: { assistantProxy: true, callsRelay: true },
    });
  });

  it('does not accept an ambiguous source identity', () => {
    expect(publicReleaseManifest({ MODE: 'production', SEMESTER_RELEASE_SHA: 'main', VITE_BUILD_ID: '../../bad' }).source)
      .toEqual({ sha: 'unknown', buildId: 'unknown' });
  });

  it('lets the production monitor prove the exact generally available release', () => {
    const manifest = publicReleaseManifest({
      MODE: 'production',
      SEMESTER_RELEASE_SHA: SHA,
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_KEY: 'publishable-key',
      VITE_PRIVATE_BETA: 'off',
      VITE_READ_ONLY: 'false',
    });
    expect(validateProductionRelease(manifest, SHA)).toBe(SHA);
  });

  it.each<[string, ReleaseOverride, string]>([
    ['an unknown source', { source: { sha: 'unknown' } }, 'source SHA is missing or ambiguous'],
    ['a stale source', { source: { sha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' } }, 'source SHA does not match'],
    ['a beta build', { features: { privateBeta: 'preview' } }, 'private beta is not off'],
    ['a demo build', { environment: 'Demo', controls: { institutionalPreview: true } }, 'environment is not Production'],
    ['a signed-out build', { controls: { accountService: false } }, 'account service is not enabled'],
    ['a maintenance build', { controls: { readOnly: true } }, 'read-only mode is enabled'],
  ])('refuses %s', (_label, override, reason) => {
    const manifest = publicReleaseManifest({
      MODE: 'production',
      SEMESTER_RELEASE_SHA: SHA,
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_KEY: 'publishable-key',
      VITE_PRIVATE_BETA: 'off',
      VITE_READ_ONLY: 'false',
    });
    expect(() => validateProductionRelease({
      ...manifest,
      ...override,
      source: { ...manifest.source, ...override.source },
      features: { ...manifest.features, ...override.features },
      controls: { ...manifest.controls, ...override.controls },
    }, SHA)).toThrow(reason);
  });

  it('rejects an ambiguous expected revision before comparing it', () => {
    const manifest = publicReleaseManifest({ MODE: 'production', SEMESTER_RELEASE_SHA: SHA });
    expect(() => validateProductionRelease(manifest, 'main')).toThrow('Expected release SHA');
  });
});
