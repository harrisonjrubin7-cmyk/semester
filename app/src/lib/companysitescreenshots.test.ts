// @vitest-environment jsdom
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const companyRoot = join(import.meta.dirname, '../../../company-site');
const site = readFileSync(join(companyRoot, 'index.html'), 'utf8');
const page = new DOMParser().parseFromString(site, 'text/html');
const requiredCaptures = ['today-desktop.jpg', 'today-mobile.jpg', 'courses-mobile.jpg'];
const captureImages = () => [...page.querySelectorAll('img')]
  .filter(image => image.getAttribute('src')?.includes('screenshots/'));

type Capture = {
  path: string;
  screen: string;
  width: number;
  height: number;
  sha256: string;
};
type Manifest = {
  capturedAt: string;
  appSourceCommit: string;
  appDeploymentCommit: string;
  captureMode: string;
  sampleData: boolean;
  theme: string | Record<string, unknown>;
  nav: string | Record<string, unknown>;
  images: Capture[];
};

function manifest(): Manifest {
  const path = join(companyRoot, 'screenshots/manifest.json');
  expect(existsSync(path), 'Captured application images need a provenance manifest').toBe(true);
  return JSON.parse(readFileSync(path, 'utf8')) as Manifest;
}

function capturePath(path: string): string {
  expect(path).toMatch(/^\/?screenshots\/[a-z0-9-]+\.jpg$/);
  return join(companyRoot, path.replace(/^\//, ''));
}

// Read the dimensions from the shipped JPEG, not a hard-coded viewport request:
// display scaling can make a real capture differ by a pixel from that request.
function jpegDimensions(bytes: Buffer): { width: number; height: number } {
  if (bytes.readUInt16BE(0) !== 0xffd8) throw new Error('Capture is not a JPEG');
  const frameMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset++] !== 0xff) throw new Error('Invalid JPEG marker');
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) throw new Error('Invalid JPEG segment');
    if (frameMarkers.has(marker)) {
      return { height: bytes.readUInt16BE(offset + 3), width: bytes.readUInt16BE(offset + 5) };
    }
    offset += length;
  }
  throw new Error('JPEG capture has no dimensions');
}

function sourceReferences(): string[] {
  const captures = [...page.querySelectorAll('img, source')].filter(element =>
    [element.getAttribute('src'), element.getAttribute('srcset')].some(value => value?.includes('screenshots/')),
  );
  return captures.flatMap(element => [
    ...(element.getAttribute('src') ? [element.getAttribute('src')!] : []),
    ...(element.getAttribute('srcset')?.split(',').map(candidate => candidate.trim().split(/\s+/)[0]) ?? []),
  ]);
}

describe('the company site shows captured current application screens', () => {
  it('removes every old embedded raster product screenshot', () => {
    // Boolean assertions avoid dumping a megabyte of base64 when this regresses.
    expect(/src\s*=\s*["']data:image\/(?:jpe?g|png)/i.test(site)).toBe(false);
    expect(site.includes("A clear day. Rare.")).toBe(false);
  });

  it('replaces the Product hero illustration with an actual captured image', () => {
    const product = page.querySelector('[data-page="product"]');
    const preview = product?.querySelector('[data-product-preview]');
    expect(preview, 'Keep the dedicated Product hero proof area').not.toBeNull();
    expect(preview?.querySelector('img[src*="screenshots/"]')).not.toBeNull();
    expect(preview?.querySelector('.preview-body')).toBeNull();
    expect(/screenshot|capture/i.test(preview?.getAttribute('aria-label') ?? '')).toBe(true);
  });

  it('ships all captured image references from root-relative URLs that work on deep routes', () => {
    const sources = sourceReferences();
    expect(sources.length).toBeGreaterThanOrEqual(4);
    for (const source of sources) {
      expect(source).toMatch(/^\/screenshots\/[a-z0-9-]+\.jpg$/);
      expect(existsSync(capturePath(source)), `Missing shipped image: ${source}`).toBe(true);
      expect(new URL(source, 'https://www.semester.website/solutions/students').pathname).toBe(source);
    }
    for (const required of requiredCaptures) expect(sources).toContain(`/screenshots/${required}`);
  });

  it('describes the captured screens and reserves their real intrinsic image dimensions', () => {
    const images = captureImages();
    expect(images.length).toBeGreaterThanOrEqual(4);
    for (const image of images) {
      const alt = image.getAttribute('alt')?.trim() ?? '';
      expect(alt.split(/\s+/).length, 'A screenshot needs a useful description, not just "Screenshot"').toBeGreaterThanOrEqual(4);
      expect(/Semester/i.test(alt)).toBe(true);
      expect(image.getAttribute('width')).toMatch(/^[1-9]\d*$/);
      expect(image.getAttribute('height')).toMatch(/^[1-9]\d*$/);
      const bytes = readFileSync(capturePath(image.getAttribute('src')!));
      expect({ width: Number(image.getAttribute('width')), height: Number(image.getAttribute('height')) })
        .toEqual(jpegDimensions(bytes));
      const caption = image.closest('figure')?.textContent ?? image.parentElement?.textContent ?? '';
      expect(/(?:illustrative(?: demo)?|sample|fictional|demo) data/i.test(caption)).toBe(true);
    }
  });

  it('offers real desktop and phone sources for the Today screenshot rather than a stretched phone', () => {
    const responsive = [...page.querySelectorAll('picture')].some(picture => {
      const references = [...picture.querySelectorAll('source, img')]
        .flatMap(element => [element.getAttribute('src') ?? '', element.getAttribute('srcset') ?? '']).join(' ');
      return references.includes('/screenshots/today-desktop.jpg')
        && references.includes('/screenshots/today-mobile.jpg')
        && Boolean(picture.querySelector('source[media][srcset]'));
    });
    expect(responsive).toBe(true);
  });

  it('loads hero proof immediately while keeping below-the-fold captures deferred', () => {
    for (const name of ['home', 'students', 'product']) {
      const hero = page.querySelector(`[data-page="${name}"] :is(.hero,.page-hero) img[src*="screenshots/"]`);
      expect(hero, `Missing captured hero on ${name}`).not.toBeNull();
      expect(hero?.getAttribute('loading')).toBe('eager');
    }
    // Control: the course proof and secondary Today examples remain deferred.
    expect(page.querySelector('[data-page="product"] .blk img[src*="screenshots/"]')?.getAttribute('loading')).toBe('lazy');
  });

  it('records the exact capture time, application versions, demo isolation, and appearance', () => {
    const proof = manifest();
    expect(proof.capturedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/);
    expect(Number.isFinite(Date.parse(proof.capturedAt))).toBe(true);
    expect(proof.appSourceCommit).toMatch(/^[a-f0-9]{40}$/);
    expect(proof.appDeploymentCommit).toMatch(/^[a-f0-9]{40}$/);
    expect(proof.captureMode).toBe('isolated-demo');
    expect(proof.sampleData).toBe(true);
    for (const appearance of [proof.theme, proof.nav]) {
      expect(appearance).toBeTruthy();
      expect(typeof appearance === 'string' ? appearance.trim().length : Object.keys(appearance).length).toBeGreaterThan(0);
    }
    expect(proof.images.length).toBeGreaterThanOrEqual(3);
  });

  it('ties every displayed capture to provenance with matching bytes and JPEG dimensions', () => {
    const proof = manifest();
    const references = new Set(sourceReferences());
    expect(references.size).toBeGreaterThanOrEqual(3);
    const paths = proof.images.map(image => `/${image.path.replace(/^\//, '')}`);
    expect(new Set(paths).size).toBe(paths.length);
    for (const source of references) expect(paths).toContain(source);
    for (const image of proof.images) {
      expect(image.screen.trim().length).toBeGreaterThan(0);
      expect(Number.isInteger(image.width) && image.width > 0).toBe(true);
      expect(Number.isInteger(image.height) && image.height > 0).toBe(true);
      expect(image.sha256).toMatch(/^[a-f0-9]{64}$/);
      const bytes = readFileSync(capturePath(image.path));
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(image.sha256);
      expect(jpegDimensions(bytes)).toEqual({ width: image.width, height: image.height });
    }
  });

  it('preserves interactive and unbuilt concept examples without mislabelling them as captures', () => {
    // These controls were never photographs: changing every .mock would erase
    // the working walkthrough and make planned concepts look implemented.
    const experience = page.querySelector('[data-page="experience"]');
    expect(experience?.querySelector('#xp-mock')).not.toBeNull();
    for (const control of ['xp-prev', 'xp-next', 'xp-restart']) {
      expect(experience?.querySelector(`#${control}`)).not.toBeNull();
    }
    expect(experience?.textContent).toContain('this guided experience does not access your records');
    expect(page.querySelector('[data-page="membership"]')?.textContent).toContain('nothing here is charged or cancelled');
    expect(page.querySelector('[data-page="credential-wallet"]')?.textContent).toContain('Illustrative concept · not built');
  });
});
