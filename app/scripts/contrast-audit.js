/*
 * The in-page half of `contrast-sweep.mjs`.
 *
 * Read as text and handed to `page.evaluate`, so it is an expression rather
 * than a module: no imports, and everything it needs is defined here. Returns
 * `{ rows, measured, skipped, gradient }` — the counts matter as much as the
 * rows, because a pass that measured nothing is not a pass that found nothing.
 */
(() => {
  const parse = (s) => {
    if (!s || s === 'transparent') return null;
    if (s.startsWith('color(')) { const m = s.match(/[\d.]+/g).map(Number); return {r:m[0],g:m[1],b:m[2],a:m[3] === undefined ? 1 : m[3]}; }
    const m = s.match(/[\d.]+/g); if (!m) return null;
    return { r:+m[0]/255, g:+m[1]/255, b:+m[2]/255, a: m[3] === undefined ? 1 : +m[3] };
  };
  const over = (fg, bg) => ({ r: fg.r*fg.a + bg.r*(1-fg.a), g: fg.g*fg.a + bg.g*(1-fg.a), b: fg.b*fg.a + bg.b*(1-fg.a), a: 1 });
  const lum = (c) => { const f = v => v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4);
    return 0.2126*f(c.r) + 0.7152*f(c.g) + 0.0722*f(c.b); };
  const ratio = (a, b) => { const la = lum(a), lb = lum(b);
    return (Math.max(la,lb)+0.05) / (Math.min(la,lb)+0.05); };
  const rgbStr = (c) => 'rgb(' + Math.round(c.r*255) + ',' + Math.round(c.g*255) + ',' + Math.round(c.b*255) + ')';

  /*
   * The surface actually behind the text.
   *
   * Layers are collected outward to the first opaque one and composited back
   * inward. Compositing on the way out is wrong: `over` returns alpha 1, so
   * the first translucent layer would be mistaken for the ground.
   *
   * This is the part that catches what a palette audit cannot. Two rules that
   * each paint `--app-accent-wash` — one on a row, one on a tag inside it —
   * are both correct alone and compound here, and the compounded surface is
   * not any token, so nothing that compares tokens to tokens can see it.
   *
   * Returns null when a gradient or image is painted anywhere above the first
   * opaque colour: `backgroundColor` reads transparent for those, so the walk
   * would sail past a painted surface and report a ratio against something
   * that is not on screen. Unknown beats wrong.
   */
  const groundOf = (el) => {
    const layers = [];
    let node = el, opaque = null;
    while (node) {
      const cs = getComputedStyle(node);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
      const bg = parse(cs.backgroundColor);
      if (bg && bg.a > 0) {
        if (bg.a >= 1) { opaque = bg; break; }
        layers.push(bg);
      }
      node = node.parentElement;
    }
    let base = opaque || {r:1,g:1,b:1,a:1};
    for (let i = layers.length - 1; i >= 0; i -= 1) base = over(layers[i], base);
    return base;
  };

  const out = [];
  const seen = new Set();
  let measured = 0, skipped = 0, gradient = 0, invisible = 0;
  /*
   * `document.body`, and it has to be.
   *
   * An earlier version walked one shell's own container, which exists under
   * one navigation out of several. Pointed at any other it matched nothing
   * and printed a confident zero. The root has to mean the same thing in
   * every navigation, and only the body does.
   *
   * `window.__sweepRoot` narrows it to one element and its descendants, which
   * the hover and focus passes use: those force a state on a single element,
   * so re-walking the page would re-report every resting finding once per
   * forced state. The ground is still resolved by walking *up* from each
   * element, so a narrowed root never changes what a surface is — only which
   * elements are asked about.
   */
  const rootEl = window.__sweepRoot ? document.querySelector(window.__sweepRoot) : document.body;
  if (!rootEl) return { rows: [], measured: 0, skipped: 0, gradient: 0, invisible: 0, missingRoot: true };
  const within = [rootEl, ...rootEl.querySelectorAll('*')];
  for (const el of within) {
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
    // WCAG 1.4.3 exempts inactive controls, and a disabled button's ground
    // comes from the user agent rather than from this app's stylesheets.
    if (el.disabled || el.closest('[disabled],fieldset:disabled')) { skipped += 1; continue; }
    const box = el.getBoundingClientRect();
    if (box.width < 2 || box.height < 2) continue;

    // A glyph painted by a clipped background has `color: transparent` by
    // design — its colour is the background, not the `color` property.
    if ((cs.webkitBackgroundClip || cs.backgroundClip) === 'text') continue;
    const ownText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    const ph = el.tagName === 'INPUT' ? el.getAttribute('placeholder') : null;
    if (!ownText && !ph) continue;

    const ground = groundOf(el);
    if (!ground) { gradient += 1; continue; }

    /*
     * Text with no ink in it.
     *
     * `color: transparent` paints nothing, so there is no pair here and
     * nothing that can fail — the ratio against any ground is 1.00:1, which
     * is the worst number this file can print, for a run nobody can see.
     *
     * The case it was written for: `screens/Ahead.tsx` held one on purpose — a
     * `·` keeping the width of the column that carries a day's due-count dot,
     * so rows did not shift sideways as days gained and lost one. The first
     * sweep that ever opened that screen reported it on all thirteen grounds
     * at both widths: 26 of that run's 88 findings, every one the same
     * invisible spacer, every one an instruction to go and fix something that
     * was working.
     *
     * That screen has since merged into Today's tabs and the spacer went with
     * it, so the rule now guards a recurrence rather than a live case — which
     * is worth saying plainly rather than leaving a citation that resolves to
     * nothing. The rule is not about that one `·`: a width held by invisible
     * text is an ordinary thing to write, and the next one would be scored
     * 1.00:1 on every ground exactly as this one was.
     *
     * The `background-clip: text` case above is the same idea a step earlier:
     * a glyph whose colour is its background rather than its `color`. Counted
     * rather than dropped, for the reason the other counts here exist — a
     * pass that looked away should say so.
     */
    const ink = ownText ? parse(cs.color) : null;
    if (ownText && !ph && ink && ink.a === 0) { invisible += 1; continue; }

    measured += 1;
    const size = parseFloat(cs.fontSize);
    const bold = (+cs.fontWeight || 400) >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    const need = large ? 3 : 4.5;

    const check = (colourStr, kind, sample) => {
      const c = parse(colourStr); if (!c) return;
      // The same rule as above, for the placeholder path, which reaches here
      // without passing the element-level test.
      if (c.a === 0) { invisible += 1; return; }
      const painted = c.a < 1 ? over(c, ground) : c;
      const r = ratio(painted, ground);
      if (r >= need) return;
      const cls = (typeof el.className === 'string' ? el.className : '') || el.tagName;
      const key = cls + '|' + kind + '|' + colourStr;
      if (seen.has(key)) return; seen.add(key);
      out.push({ kind, cls: cls.slice(0,70), text: (sample || '').trim().slice(0,40),
                 colour: colourStr, groundColour: rgbStr(ground),
                 ratio: Math.round(r*100)/100, need });
    };
    if (ownText) check(cs.color, 'text', el.textContent);
    if (ph) check(getComputedStyle(el, '::placeholder').color, 'placeholder', ph);
  }
  return { rows: out, measured, skipped, gradient, invisible };
})()
