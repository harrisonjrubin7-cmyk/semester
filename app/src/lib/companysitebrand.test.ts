import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BARS, slabPath } from '../components/mark.data';

const root = join(import.meta.dirname, '../../..');
const site = readFileSync(join(root, 'company-site/index.html'), 'utf8');
const styles = readFileSync(join(root, 'company-site/site.css'), 'utf8');
const surface = `${site}\n${styles}`;

describe('the company site and application share one identity', () => {
  it('draws every public logo from the application silhouette, including the favicon', () => {
    for (const bar of BARS) expect(site.split(`d="${slabPath(bar)}"`).length - 1).toBe(4);
    expect(site.includes('viewBox="0 0 26 26"')).toBe(false);
    expect(site.includes('href="/icon.svg"')).toBe(true);
    expect(readFileSync(join(root, 'company-site/icon.svg'), 'utf8'))
      .toBe(readFileSync(join(root, 'app/public/icon.svg'), 'utf8'));
  });

  it('loads the shipped brand stylesheet from the public document head', () => {
    const head = site.slice(0, site.indexOf('</head>'));
    const stylesheetLink = /<link\b(?=[^>]*\brel="stylesheet")(?=[^>]*\bhref="\/site\.css")[^>]*>/;
    expect(stylesheetLink.test(head)).toBe(true);
    // Control: CSS on disk must not clear the guard if the page stops loading it.
    expect(stylesheetLink.test(head.replace('href="/site.css"', 'href="/missing.css"'))).toBe(false);
  });

  it('uses the application typography and restrained material palette', () => {
    for (const token of ["--serif:'Cinzel'", "--sans:'Barlow'", '--brass:#d8c79a']) {
      expect(styles.includes(token)).toBe(true);
    }
    for (const oldTreatment of ['fonts.googleapis.com', '--gold-metal:linear-gradient', 'rotateY(-6deg)', 'TODAY  /  ONE CLEAR NEXT STEP']) {
      expect(surface.includes(oldTreatment)).toBe(false);
    }
  });

  it('shares the same semantic brand vocabulary across both product surfaces', () => {
    const tokens = readFileSync(join(root, 'app/src/styles/tokens.css'), 'utf8');
    for (const name of ['--brand-canvas', '--brand-surface', '--brand-ink', '--brand-muted', '--brand-accent', '--brand-focus']) {
      expect(tokens.includes(name), `application is missing ${name}`).toBe(true);
      expect(styles.includes(name), `company site is missing ${name}`).toBe(true);
    }
  });

  it('keeps product proof in a dedicated hero column, not beside its actions', () => {
    const product = site.slice(site.indexOf('data-page="product"'), site.indexOf('<!-- ================= STUDENTS'));
    expect(product.includes('class="wrap product-hero-grid"')).toBe(true);
    expect(product.includes('data-product-preview')).toBe(true);
    expect(product.includes('Public fictional-data demo')).toBe(true);
    // Control: the existing conversion and authoritative-system boundary stay visible.
    expect(product.includes('Explore a sample university')).toBe(true);
    expect(product.includes('It does not make official academic decisions with AI.')).toBe(true);
  });

  it('fits the 90-day status strip without widening the page on a small phone', () => {
    const bars = styles.match(/\.st-bars\{([^}]+)\}/)?.[1] ?? '';
    const bar = styles.match(/\.st-bar\{([^}]+)\}/)?.[1] ?? '';
    expect(bars.includes('grid-template-columns:repeat(90,minmax(0,1fr))')).toBe(true);
    expect(bars.includes('gap:1px')).toBe(true);
    expect(bar.includes('min-width:0')).toBe(true);
  });

  it('keeps selected navigation and tabs distinct beyond a subtle surface fill', () => {
    const nav = [...styles.matchAll(/\.nav-main a\[aria-current="page"\]\{([^}]+)\}/g)].at(-1)?.[1] ?? '';
    const tabs = [...styles.matchAll(/\.tabs button\[aria-selected="true"\]\{([^}]+)\}/g)].at(-1)?.[1] ?? '';
    for (const selected of [nav, tabs]) {
      expect(selected.includes('box-shadow:inset 0 -2px 0 var(--brass)')).toBe(true);
    }
  });

  it('ships the application typefaces locally and permits them in the company-site policy', () => {
    expect(site.includes('href="/typefaces.css"')).toBe(true);
    expect(readFileSync(join(root, 'company-site/typefaces.css'), 'utf8'))
      .toBe(readFileSync(join(root, 'app/src/styles/typefaces.css'), 'utf8'));
    const fonts = readdirSync(join(root, 'app/src/styles/fonts')).filter(name => /\.woff2$/.test(name));
    expect(fonts.length).toBeGreaterThan(0);
    for (const font of fonts) {
      expect(readFileSync(join(root, 'company-site/fonts', font)).equals(readFileSync(join(root, 'app/src/styles/fonts', font)))).toBe(true);
    }
    // Preserve the full canonical license text; normalize only inherited
    // trailing whitespace so the new asset passes the repository's diff check.
    const license = (location: string) => readFileSync(join(root, location, 'OFL.txt'), 'utf8').replace(/[ \t]+$/gm, '');
    expect(license('company-site/fonts')).toBe(license('app/src/styles/fonts'));
    const config = JSON.parse(readFileSync(join(root, 'company-site/vercel.json'), 'utf8'));
    const policy = config.headers.flatMap((rule: { headers: { key: string; value: string }[] }) => rule.headers)
      .find((header: { key: string }) => header.key === 'Content-Security-Policy')?.value ?? '';
    expect(policy.includes("font-src 'self';")).toBe(true);
    expect(policy.includes('fonts.gstatic.com')).toBe(false);
  });

  it('hides only the compact header wordmark, preserving the named footer link', () => {
    expect(styles.includes('@media (max-width:420px){header.nav .brand-word{display:none}')).toBe(true);
    expect(styles.includes('@media (max-width:420px){.brand-word{display:none}')).toBe(false);
  });

  it('keeps the compact navigation targets at least 44 pixels', () => {
    expect(styles.includes('.brand{min-width:44px;min-height:44px}')).toBe(true);
    expect(styles.includes('.nav-right .btn{min-width:44px}')).toBe(true);
  });

  it('reserves display type for titles rather than long reading passages', () => {
    expect(styles.includes('.letter p,.quote-box p,.big-quote,.pull p{font-family:var(--sans);font-weight:400;line-height:1.65}')).toBe(true);
    expect(styles.includes('.letter p{font-size:18px}')).toBe(true);
  });
});
