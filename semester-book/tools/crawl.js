// Crawl a page: screenshot its first state, then click every distinct clickable it shows (BFS, in place),
// screenshotting each new state. Usage: node crawl.js <jobs.json> <outdir> <tools_dir>
const {chromium} = require('playwright');
const fs = require('fs'), crypto = require('crypto');
const [JOBS, OUT, T] = process.argv.slice(2);
const jobs = JSON.parse(fs.readFileSync(JOBS, 'utf8'));
const lib = n => fs.readFileSync(T + '/node_modules/' + n);
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch({executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'});
  const results = fs.existsSync(OUT + '/index-' + require('path').basename(JOBS)) ? JSON.parse(fs.readFileSync(OUT + '/index-' + require('path').basename(JOBS), 'utf8')) : {};
  for (const job of jobs) {
    if (results[job.id] && results[job.id].done) continue;
    const ctx = await b.newContext({deviceScaleFactor: job.scale || 1.25, viewport: {width: job.w || 1440, height: job.h || 900}});
    await ctx.route(/unpkg\.com|jsdelivr\.net|cdnjs/, r => {
      const u = r.request().url();
      const mm = u.match(/(?:unpkg\.com|npm)\/(@?[^@\/]+(?:\/[^@\/]+)?)@[^\/]+\/(.+)$/);
      const p = mm ? T + '/node_modules/' + mm[1] + '/' + mm[2] : null;
      if (p && fs.existsSync(p)) return r.fulfill({body: fs.readFileSync(p), contentType: p.endsWith('.css') ? 'text/css' : p.endsWith('.json') ? 'application/json' : 'text/javascript', headers: {'access-control-allow-origin': '*'}});
      return r.abort();
    });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    const shots = [];
    const seen = new Set();
    const snap = async (label) => {
      const txt = await page.evaluate(() => document.body ? document.body.innerText : '');
      const h = crypto.createHash('md5').update(txt.replace(/\d{1,2}:\d{2}(:\d{2})?/g, '')).digest('hex');
      if (seen.has(h) || txt.trim().length < 5) return false;
      seen.add(h);
      const full = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight));
      const vh = page.viewportSize().height;
      const file = `${job.id}-${String(shots.length).padStart(3, '0')}.jpg`;
      await page.screenshot({path: OUT + '/' + file, type: 'jpeg', quality: 78,
        fullPage: full > vh && full < (job.maxH || 6000), animations: 'disabled'});
      shots.push({file, label, title: await page.title()});
      return true;
    };
    try {
      await page.goto(job.url, {waitUntil: 'networkidle', timeout: 45000});
    } catch (e) { errs.push('goto ' + e.message); }
    await sleep(job.settle || 1500);
    await page.evaluate(() => document.fonts && document.fonts.ready);
    if (job.mode === 'slides') {
      for (let i = 0; i < job.count; i++) {
        await sleep(500);
        await snap('Slide ' + (i + 1));
        await page.keyboard.press('ArrowRight');
      }
    } else {
      try { await snap('Start'); } catch (e) { errs.push('start '+e.message); }
      if (job.mode !== 'single') {
        const CANDS = () => page.evaluate(() => {
          const out = [];
          for (const el of document.querySelectorAll('body *')) {
            const cs = getComputedStyle(el);
            if (cs.cursor !== 'pointer' && !el.matches('button,[role=tab],[role=button],a[href^="#"]')) continue;
            if (el.parentElement && getComputedStyle(el.parentElement).cursor === 'pointer' && !el.matches('button,a')) continue;
            if (el.closest('input,textarea,select,label')) continue;
            const r = el.getBoundingClientRect();
            if (!r.width || !r.height || cs.visibility === 'hidden') continue;
            const t = ((el.getAttribute('aria-label') || '') + '|' + (el.innerText || '').trim().split('\n')[0]).slice(0, 80);
            if (t === '|') continue;
            out.push(t);
          }
          return [...new Set(out)];
        });
        const CLICK = (key) => page.evaluate((key) => {
          for (const el of document.querySelectorAll('body *')) {
            const t = ((el.getAttribute('aria-label') || '') + '|' + (el.innerText || '').trim().split('\n')[0]).slice(0, 80);
            if (t === key) { el.scrollIntoView({block: 'center'}); el.click(); return true; }
          }
          return false;
        }, key);
        const BAD = /sign out|log out|delete|remove|reset|close|cancel|dismiss|^\|?[×✕x]$/i;
        const startUrl = page.url();
        const queued = new Set();
        const queue = [];
        for (const c of await CANDS()) if (!BAD.test(c)) { queued.add(c); queue.push([c]); }
        let budget = job.cap || 60, steps = 0;
        while (queue.length && budget > 0 && steps < (job.cap || 60) * 4) {
          steps++;
          const path = queue.shift();
          try {
          try { await page.goto(startUrl, {waitUntil: 'networkidle', timeout: 30000}); } catch (e) {}
          await sleep(job.settle || 1500);
          let ok = true;
          for (const k of path) { if (!(await CLICK(k))) { ok = false; break; } await sleep(job.wait || 450); }
          if (!ok || page.url().split('#')[0] !== startUrl.split('#')[0]) continue;
          await page.evaluate(() => window.scrollTo(0, 0));
          const label = path.map(k => k.replace(/^\|/, '').replace(/\|.*$/, '')).join(' › ');
          if (await snap(label)) {
            budget--;
            if (path.length < (job.depth || 2))
              for (const c of await CANDS()) if (!queued.has(c) && !BAD.test(c)) { queued.add(c); queue.push([...path, c]); }
          }
          } catch (e) { errs.push('step '+e.message); }
        }
      }
    }
    results[job.id] = {done: true, title: job.title, group: job.group, shots, errs: errs.slice(0, 3)};
    fs.writeFileSync(OUT + '/index-' + require('path').basename(JOBS), JSON.stringify(results, null, 1));
    console.log(job.id, shots.length, errs.length ? 'ERR ' + errs[0].slice(0, 100) : '');
    await ctx.close();
  }
  await b.close();
})();
