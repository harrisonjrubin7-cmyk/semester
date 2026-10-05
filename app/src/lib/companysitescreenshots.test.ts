// @vitest-environment jsdom
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const companyRoot = join(import.meta.dirname, '../../../company-site');
const site = readFileSync(join(companyRoot, 'index.html'), 'utf8');
const script = readFileSync(join(companyRoot, 'site.js'), 'utf8');
const page = new DOMParser().parseFromString(site, 'text/html');
const walkthroughScreens = ['search', 'today', 'courses', 'calendar', 'path', 'discover'] as const;
const requiredCaptures = walkthroughScreens.flatMap(screen => [`${screen}-desktop.jpg`, `${screen}-mobile.jpg`]);
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
  captureDateLabel: string;
  appSourceCommit: string;
  appDeploymentCommit: string;
  appDeploymentRun: string;
  deploymentVerification: {
    expectedFixPresent: string;
    supersededRuleAbsent: string;
    serviceWorkerState: string;
  };
  captureMode: string;
  sampleData: boolean;
  theme: string | Record<string, unknown>;
  nav: string | Record<string, unknown>;
  images: Capture[];
};
type WalkthroughStep = {
  id: string;
  title: string;
  description: string;
  desktop: string;
  mobile: string;
  alt: string;
  route: string;
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

function walkthrough(): WalkthroughStep[] {
  const data = page.querySelector<HTMLScriptElement>('#xp-walkthrough-data');
  expect(data, 'The walkthrough needs a machine-readable capture sequence').not.toBeNull();
  return JSON.parse(data!.textContent ?? '[]') as WalkthroughStep[];
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
  const markupReferences = captures.flatMap(element => [
    ...(element.getAttribute('src') ? [element.getAttribute('src')!] : []),
    ...(element.getAttribute('srcset')?.split(',').map(candidate => candidate.trim().split(/\s+/)[0]) ?? []),
  ]);
  return [...markupReferences, ...walkthrough().flatMap(step => [step.desktop, step.mobile])];
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
    const displayedCaptureDate = manifest().captureDateLabel.replace(/ \([^)]*\)$/, '');
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
      expect(/(?:illustrative(?: demo)?|sample|fictional|demo)[ -]data/i.test(caption)).toBe(true);
      expect(caption).toContain(`Captured ${displayedCaptureDate}`);
    }
  });

  it('names the Today mobile hero accurately and keeps full-size links responsive', () => {
    const hero = page.querySelector<HTMLImageElement>('[data-page="home"] .hero img[src="/screenshots/today-mobile.jpg"]');
    expect(hero?.getAttribute('alt')).toMatch(/Semester Today mobile/i);
    expect(hero?.getAttribute('alt')).not.toMatch(/Semester Home mobile/i);

    const links = [...page.querySelectorAll<HTMLAnchorElement>('a[data-responsive-capture-link]')];
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link.dataset.desktop).toBe('/screenshots/today-desktop.jpg');
      expect(link.dataset.mobile).toBe('/screenshots/today-mobile.jpg');
    }
    expect(script).toContain('responsiveCaptureLinks');
    expect(script).toContain('xpMobile.addEventListener("change",responsiveCaptureLinks)');
  });

  it('reserves the matching desktop and phone proportions instead of stretching either capture', () => {
    const responsive = [...page.querySelectorAll<HTMLPictureElement>('picture[data-capture-pair]')];
    expect(responsive.length).toBeGreaterThanOrEqual(4);
    for (const picture of responsive) {
      const source = picture.querySelector('source[media][srcset]');
      const image = picture.querySelector('img[src]');
      expect(source).not.toBeNull();
      expect(image).not.toBeNull();
      expect({ width: source?.getAttribute('width'), height: source?.getAttribute('height') })
        .toEqual({ width: '390', height: '845' });
      expect({ width: image?.getAttribute('width'), height: image?.getAttribute('height') })
        .toEqual({ width: '1440', height: '900' });
      expect(jpegDimensions(readFileSync(capturePath(source!.getAttribute('srcset')!))))
        .toEqual({ width: 390, height: 845 });
      expect(jpegDimensions(readFileSync(capturePath(image!.getAttribute('src')!))))
        .toEqual({ width: 1440, height: 900 });
    }
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
    expect(proof.captureDateLabel).toBe('Oct 3, 2026 (America/Chicago)');
    expect(proof.appSourceCommit).toMatch(/^[a-f0-9]{40}$/);
    expect(proof.appSourceCommit).toBe('a1504691a60af3499803d0e9fd38fa1cb4ea7ec9');
    expect(proof.appDeploymentCommit).toBe(proof.appSourceCommit);
    expect(proof.appDeploymentRun).toBe('https://github.com/harrisonjrubin7-cmyk/semester/actions/runs/37114132948');
    expect(proof.deploymentVerification.expectedFixPresent).toMatch(/min-height:\s*44px/);
    expect(proof.deploymentVerification.supersededRuleAbsent).toMatch(/min-height:\s*0/);
    expect(proof.deploymentVerification.serviceWorkerState).toMatch(/brand-new browser profile/i);
    expect(proof.captureMode).toBe('isolated-demo');
    expect(proof.sampleData).toBe(true);
    expect(proof.theme).toMatchObject({ surface: 'Current production dark interface' });
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

  it('uses current application captures for every step of the 90-second walkthrough', () => {
    const experience = page.querySelector('[data-page="experience"]');
    expect(experience?.querySelector('#xp-mock')).toBeNull();
    expect(experience?.querySelector('.persona')).toBeNull();
    expect(experience?.querySelector('picture#xp-picture[data-capture-pair]')).not.toBeNull();
    expect(experience?.querySelector('#xp-shot')).not.toBeNull();
    expect(experience?.querySelector('#xp-caption')).not.toBeNull();
    expect(experience?.querySelector('#xp-live')).not.toBeNull();
    for (const control of ['xp-prev', 'xp-next', 'xp-restart']) {
      expect(experience?.querySelector(`#${control}`)).not.toBeNull();
    }

    const steps = walkthrough();
    expect(steps.map(step => step.id)).toEqual(walkthroughScreens);
    expect(new Set(steps.flatMap(step => [step.desktop, step.mobile])).size).toBe(12);
    for (const step of steps) {
      expect(step.title.trim().split(/\s+/).length).toBeGreaterThanOrEqual(2);
      expect(step.description.trim().split(/\s+/).length).toBeGreaterThanOrEqual(6);
      expect(step.alt).toMatch(/Semester/i);
      expect(step.route).toMatch(/^https:\/\/harrisonjrubin7-cmyk\.github\.io\/semester\/demo\/#\/[a-z]+$/);
      expect(step.desktop).toBe(`/screenshots/${step.id}-desktop.jpg`);
      expect(step.mobile).toBe(`/screenshots/${step.id}-mobile.jpg`);
      expect(existsSync(capturePath(step.desktop))).toBe(true);
      expect(existsSync(capturePath(step.mobile))).toBe(true);
    }

    expect(steps[0]).toMatchObject({ id: 'search', title: expect.stringMatching(/search/i) });
    expect(`${steps[0].description} ${steps[0].alt}`).toMatch(/Discover/i);
    expect(`${steps[0].title} ${steps[0].description} ${steps[0].alt}`).not.toMatch(/course progress|academic progress|Home showing/i);
    expect(steps[3]).toMatchObject({ id: 'calendar', title: expect.stringMatching(/month/i) });
    expect(`${steps[3].description} ${steps[3].alt}`).toMatch(/month/i);
    expect(`${steps[3].title} ${steps[3].alt}`).not.toMatch(/week|weekly/i);

    expect(experience?.textContent).toContain('public fictional-data demo');
    expect(experience?.textContent).toContain('Captured Oct 3, 2026');
    expect(experience?.querySelector('#xp-step-details')?.getAttribute('aria-live')).toBe('polite');
    expect(experience?.querySelector('#xp-step-details')?.getAttribute('aria-atomic')).toBe('true');
    expect(script).toContain('document.getElementById("xp-full").href=xpMobile.matches?st.mobile:st.desktop');
    expect(script).toContain('xpMobile.addEventListener("change",xpRender)');
  });

  it('keeps unbuilt concept examples clearly separate from current app proof', () => {
    expect(page.querySelector('[data-page="membership"]')?.textContent).toContain('nothing here is charged or cancelled');
    expect(page.querySelector('[data-page="credential-wallet"]')?.textContent).toContain('Illustrative concept · not built');
  });
});
