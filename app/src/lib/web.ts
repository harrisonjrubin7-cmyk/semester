/**
 * The website that ships beside the app.
 *
 * Three pages — the front door, the term, and the study side — built
 * separately and dropped into `public/web/`, so Vite copies them through
 * verbatim and they land at `<base>/web/` on the same origin as the app.
 *
 * ## Why the same origin matters, and why these are plain links
 *
 * Same origin means the same `localStorage` and the same Supabase session.
 * Signing in on one signs you in on the other, and neither has to hand
 * anything to the other to make that true. So the pathway between them is
 * genuinely just a link: there is no token to pass, no state to serialise,
 * nothing that can be out of date by the time it arrives.
 *
 * That is also why the address is derived rather than written down. The app
 * already knows where it is served from — `lib/asset.ts` puts the deployment's
 * base in front of a path — so this works at `/` in development, at
 * `/semester/` on Pages, and at whatever path a fork is deployed under,
 * without anybody editing a constant. A hardcoded
 * `https://…github.io/semester/web/` would be right for exactly one
 * deployment, and silently wrong for every other.
 *
 * ## The other direction
 *
 * The website links back to the app from its front door. `app.html` and
 * `study.html` did not, and those files are generated bundles that must not be
 * hand-edited, so the return link is appended to the built copies instead —
 * see `lib/webback.ts` and SETUP.md § Deploying.
 */

import { asset } from './asset';

export interface WebPage {
  id: 'front' | 'term' | 'study';
  label: string;
  blurb: string;
  /** Relative to the site root. `asset` puts the deployment's base in front. */
  file: string;
}

export const WEB_PAGES: WebPage[] = [
  {
    id: 'front',
    label: 'The front door',
    blurb: 'What Semester is, and the way in. Links back here.',
    file: 'web/index.html',
  },
  {
    id: 'term',
    label: 'Your term',
    blurb: 'Courses, deadlines and Connect, laid out for a keyboard.',
    file: 'web/app.html',
  },
  {
    id: 'study',
    label: 'The study side',
    blurb: 'The guides and the audio, on a screen big enough to read them.',
    file: 'web/study.html',
  },
];

/** The address of one of the website's pages, under this deployment's base. */
export function webUrl(id: WebPage['id']): string {
  const page = WEB_PAGES.find((p) => p.id === id) ?? WEB_PAGES[0];
  return asset(page.file);
}
