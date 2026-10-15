import { renderToStaticMarkup } from 'react-dom/server';
import { tokensFor } from '../lib/look';
import { STORIES } from './stories';

/**
 * The gallery as static HTML pages: every story, under each ground.
 *
 * Pure: the stylesheet text is passed in, so this runs under the node test, in
 * `scripts/gallery-shots.mjs` (through Vite's SSR loader) and nowhere needs a
 * file system of its own. The real `tokensFor` writes the variables onto
 * `<html>`, not `<body>`, because `styles/tokens.css` resolves its semantic
 * aliases at `:root`.
 */
export const GALLERY_GROUNDS = ['ink', 'parchment', 'fog'] as const;

export interface GalleryPage {
  name: string;
  ground: string;
  html: string;
}

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export function galleryPages(css: string): GalleryPage[] {
  return GALLERY_GROUNDS.map((ground) => {
    const vars = Object.entries(tokensFor({ ground }, false))
      .map(([k, v]) => `${k}:${v}`)
      .join(';');
    const body = STORIES.map(
      (s) =>
        `<section data-story="${s.id}"><h2>${escape(s.title)}</h2>${renderToStaticMarkup(<>{s.render()}</>)}</section>`,
    ).join('');
    return {
      name: `gallery-${ground}`,
      ground,
      html:
        `<!doctype html><html lang="en" style="${escape(vars)}"><head><meta charset="utf-8">` +
        `<meta name="viewport" content="width=device-width,initial-scale=1"><title>Gallery · ${ground}</title>` +
        `<style>${css}</style>` +
        `<style>body{margin:0;padding:24px;background:var(--app-bg);color:var(--app-fg);font-family:system-ui,sans-serif;line-height:1.5}` +
        `section{padding:18px 0;border-bottom:1px solid var(--app-line)}h2{font-size:13px;font-weight:600;color:var(--app-dim);margin:0 0 12px;text-transform:uppercase;letter-spacing:.08em}</style>` +
        `</head><body>${body}</body></html>`,
    };
  });
}
