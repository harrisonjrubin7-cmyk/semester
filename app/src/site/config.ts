/**
 * Where the public site points.
 *
 * The site is prerendered to static HTML at real paths (DECISION-LOG D-011).
 * Where it is served, and where the app sits beside it, are deployment
 * decisions that need the owner's approval — so both are settings, not
 * constants. The defaults point at the app as it is live today.
 */
export interface SiteConfig {
  /** Absolute URL of the app, ending in `/`. Sign-in and sign-up hand off here. */
  appUrl: string;
  /** Path the site is served under, starting and ending with `/`. */
  base: string;
  /** Origin for canonical and social links, without a trailing slash. Empty to omit them. */
  origin: string;
  /**
   * The commit and the day this build was made, for the product-quality page.
   * Optional: a build that is not stamped says so rather than showing a date
   * it made up.
   */
  build?: { commit: string; at: string };
}

export const DEFAULT_SITE: SiteConfig = {
  appUrl: 'https://harrisonjrubin7-cmyk.github.io/semester/',
  base: '/',
  origin: '',
};

/** The contact address the brief names for general, partnership and team mail. */
export const CONTACT_EMAIL = 'harrisonjrubin7@gmail.com';

export const PROMISE = 'College is complicated. Your path shouldn’t be.';
