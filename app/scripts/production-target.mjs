export const PAGES_PRODUCTION_ORIGIN = 'https://harrisonjrubin7-cmyk.github.io/semester';

export function resolveProductionTarget(kind, configuredUrl = '') {
  if (kind === 'pages') {
    return {
      kind,
      app: PAGES_PRODUCTION_ORIGIN,
      label: 'GitHub Pages availability monitor',
      evidence: 'availability-monitor',
      provesRelease: false,
    };
  }
  if (kind !== 'vercel' || !configuredUrl.trim()) {
    throw new Error('Vercel production monitoring requires an explicit HTTPS origin.');
  }
  let url;
  try {
    url = new URL(configuredUrl);
  } catch {
    throw new Error('Vercel production monitoring requires an explicit HTTPS origin.');
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error('Vercel production monitoring requires an explicit HTTPS origin.');
  }
  return {
    kind,
    app: url.origin,
    label: 'Vercel production availability monitor',
    evidence: 'availability-monitor',
    provesRelease: false,
  };
}
