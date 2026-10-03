/*
 * Repeatable local lab check for the production build's critical journeys.
 * Bundle budgets answer how much ships; this answers how the browser paints it.
 * The thresholds follow the Core Web Vitals "good" LCP/CLS boundaries, with
 * an explicit FCP and main-thread blocking guard so a fast shell cannot hide a
 * page that becomes usable late.
 */
const BASE = process.env.PERF_URL || 'http://127.0.0.1:4173/semester/';
const CHROME = process.env.SWEEP_CHROMIUM || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ROUTES = (process.env.PERF_ROUTES || 'home,work,degree').split(',').map((value) => value.trim()).filter(Boolean);
const RUNS = Number(process.env.PERF_RUNS || 3);

let chromium;
try {
  const from = process.env.SWEEP_PLAYWRIGHT;
  if (from) {
    const { createRequire } = await import('node:module');
    ({ chromium } = createRequire(import.meta.url)(from));
  } else {
    ({ chromium } = await import('playwright'));
  }
} catch (error) {
  console.error(`Playwright is required for the performance smoke: ${String(error).slice(0, 200)}`);
  process.exit(2);
}

const profiles = [
  { id: 'phone', viewport: { width: 390, height: 844 } },
  { id: 'desktop', viewport: { width: 1280, height: 900 } },
];
const thresholds = { lcp: 2500, cls: 0.1, fcp: 1800, blocking: 200 };
const percentile = (values, fraction) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1] ?? 0;
const rounded = (value, places = 0) => Number(value.toFixed(places));

const executablePath = CHROME || undefined;
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const rows = [];
try {
  for (const profile of profiles) {
    for (const route of ROUTES) {
      const samples = [];
      for (let run = 0; run < RUNS; run += 1) {
        const context = await browser.newContext({ viewport: profile.viewport, serviceWorkers: 'block' });
        const page = await context.newPage();
        await page.addInitScript(() => {
          window.__semesterVitals = { lcp: 0, cls: 0, blocking: 0 };
          new PerformanceObserver((list) => {
            const last = list.getEntries().at(-1);
            if (last) window.__semesterVitals.lcp = last.startTime;
          }).observe({ type: 'largest-contentful-paint', buffered: true });
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (!entry.hadRecentInput) window.__semesterVitals.cls += entry.value;
            }
          }).observe({ type: 'layout-shift', buffered: true });
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) window.__semesterVitals.blocking += Math.max(0, entry.duration - 50);
          }).observe({ type: 'longtask', buffered: true });
        });
        const failures = [];
        page.on('pageerror', (error) => failures.push(`page error: ${error.message}`));
        page.on('requestfailed', (request) => failures.push(`request failed: ${request.url()} (${request.failure()?.errorText ?? 'unknown'})`));
        const response = await page.goto(`${BASE}#/${route}`, { waitUntil: 'networkidle', timeout: 30_000 });
        if (!response?.ok()) throw new Error(`${profile.id}/${route}: document returned ${response?.status() ?? 'no response'}`);
        await page.locator('h1').first().waitFor({ state: 'visible', timeout: 15_000 });
        await page.waitForTimeout(1000);
        if (failures.length) throw new Error(`${profile.id}/${route}: ${failures.join('; ')}`);
        const sample = await page.evaluate(() => {
          const paint = performance.getEntriesByType('paint');
          const fcp = paint.find((entry) => entry.name === 'first-contentful-paint')?.startTime ?? 0;
          const navigation = performance.getEntriesByType('navigation')[0];
          return {
            fcp,
            lcp: window.__semesterVitals?.lcp ?? 0,
            cls: window.__semesterVitals?.cls ?? 0,
            blocking: window.__semesterVitals?.blocking ?? 0,
            load: navigation?.loadEventEnd ?? 0,
          };
        });
        samples.push(sample);
        await context.close();
      }
      const row = {
        profile: profile.id,
        route,
        fcp: percentile(samples.map((sample) => sample.fcp), 0.75),
        lcp: percentile(samples.map((sample) => sample.lcp), 0.75),
        cls: percentile(samples.map((sample) => sample.cls), 0.75),
        blocking: percentile(samples.map((sample) => sample.blocking), 0.75),
        load: percentile(samples.map((sample) => sample.load), 0.75),
      };
      rows.push(row);
      console.log(`${profile.id.padEnd(7)} ${route.padEnd(8)} p75 FCP ${rounded(row.fcp)}ms · LCP ${rounded(row.lcp)}ms · CLS ${rounded(row.cls, 3)} · blocking ${rounded(row.blocking)}ms · load ${rounded(row.load)}ms`);
    }
  }
} finally {
  await browser.close();
}

const failures = rows.flatMap((row) => [
  row.fcp > thresholds.fcp ? `${row.profile}/${row.route}: FCP ${rounded(row.fcp)}ms > ${thresholds.fcp}ms` : null,
  row.lcp === 0 || row.lcp > thresholds.lcp ? `${row.profile}/${row.route}: LCP ${rounded(row.lcp)}ms outside 1–${thresholds.lcp}ms` : null,
  row.cls > thresholds.cls ? `${row.profile}/${row.route}: CLS ${rounded(row.cls, 3)} > ${thresholds.cls}` : null,
  row.blocking > thresholds.blocking ? `${row.profile}/${row.route}: blocking ${rounded(row.blocking)}ms > ${thresholds.blocking}ms` : null,
].filter(Boolean));

console.log(`\n${rows.length} route/profile checks · ${RUNS} cold runs each`);
if (failures.length) {
  console.error(`FAIL\n${failures.join('\n')}`);
  process.exit(1);
}
console.log('PASS: every p75 lab measurement is within the performance guardrails.');
