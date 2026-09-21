/*
 * Every interactive element in the app, measured against the minimum a finger
 * can reliably hit.
 *
 * The completion plan's Phase 0 carries this item with a number attached: *"a
 * sampled pass on the desktop Directory screen found 93 of 166 interactive
 * elements below the 44-pixel minimum touch target, and 7 text elements below
 * 12 pixels"*, and asks to fix the Directory first and then *"run the same
 * measurement method across the rest of the app rather than assuming the
 * problem is isolated"*. This is that measurement method, written down so the
 * figure can be taken again rather than sampled once.
 *
 * The sampled figure cannot be reproduced, and that is the argument for this
 * file rather than a footnote to it. It was taken at #/directory, which is not
 * a route this app has — the address does not resolve, the screen does not
 * change, and the pass measured whichever screen was already showing. Nothing
 * in the number says so. The screens it might plausibly have meant read
 * 21 of 28 (courses), 26 of 50 (me), 16 of 22 (people) and 21 of 36
 * (the springboard) under 44px on a desktop today; none of them has 166
 * controls on it, so the figure is not a stale reading of any of them.
 *
 * A number nobody can retake goes stale without anybody noticing it has, and
 * this one went further than stale: it was never a measurement of the thing it
 * named. Every figure this prints says which screen, which tier and which
 * criterion, for that reason.
 *
 * ## Why this is a browser and not a test
 *
 * A touch target is a fact about layout, and layout is what jsdom does not do.
 * `src/a11y/labels.ts` can read the source and prove every control has a name;
 * nothing that does not paint can tell you a button came out 43 pixels tall.
 * So this drives real Chromium, exactly as `scripts/contrast-sweep.mjs` does
 * and for the same reason. Neither replaces a test; both find what a test
 * cannot see.
 *
 * ## The drawing is not the target, and the first version of this measured
 * ## the drawing
 *
 * Its first run reported 162 controls under the AA minimum on each tier, and
 * the number was wrong. It read `getBoundingClientRect`, which is the box the
 * label is painted in — and this app deliberately grows the *target* without
 * growing the *drawing*: `.tap`, `.tap-x` and `.tap-y` in `app.css` put a
 * transparent `::after` over the control reaching out to 44px, because a dense
 * design cannot make every nine-pixel caps label 44px tall and stay the same
 * screen. `styles/taps.test.ts` says the consequence in one line — *"an
 * overlay is invisible to a checker, which reads the element and is right to"*
 * — and a checker that reads the element convicts all 65 copies of the
 * sample-semester banner's two answers at 81×20 and 50×20, which are 81×44
 * and 50×44 to a finger.
 *
 * So this measures by hit test instead. From a point inside the control it
 * walks outward in each of the four directions asking `elementFromPoint` who
 * would receive the tap, and stops where the answer stops being this control.
 * That reads the overlay, because a pseudo-element answers as the element it
 * belongs to. It also reads *occlusion*, which a rect cannot: a 44px overlay
 * with a sticky header painted over its top half is a 22px target, and the
 * banner's own comment records that being the bug before its strip grew the
 * padding to give the overlay room.
 *
 * ## Which leaves the probe to be proved, because a clean reading is a claim
 * ## about it too
 *
 * A probe that answers "44" for everything would clear this app completely and
 * be worth nothing. Three controls of known size are injected into each tier
 * before the walk and measured by the same code: a 44×44 box, a 10×10 box, and
 * a 20px-tall control wearing `tap-y`. The first two say the probe can still
 * read a real size and still convict something small; the third says it sees
 * an overlay at all. If any of the three comes back wrong the run says so and
 * exits, rather than reporting a figure taken with a broken instrument.
 *
 * ## Running it
 *
 *   npm run dev                  # in another terminal; this expects :5173
 *   npm run sweep:targets
 *
 * Playwright is deliberately not a dependency of this project — see
 * `.claude/skills/run`. Install it somewhere scratch and name that copy:
 *
 *   mkdir -p /tmp/drive && cd /tmp/drive
 *   echo '{"name":"drive","private":true,"type":"module"}' > package.json
 *   PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install playwright
 *   cd - && SWEEP_PLAYWRIGHT=/tmp/drive/node_modules/playwright npm run sweep:targets
 *
 * ## What it counts, and the three ways a count like this lies
 *
 * 1. **Counting instances rather than causes.** Fifty rows of one list are one
 *    rule, and a report that lists them fifty times buries the other four
 *    faults under the loudest. Findings are grouped by what made them — the
 *    element's own class and its measured size — and the group carries how
 *    many there were. `scripts/contrast-sweep.mjs` records the opposite
 *    mistake, grouping so hard that two different elements collapsed into one
 *    and the survivor stood in for both; the size is in the key here for
 *    exactly that reason.
 * 2. **Measuring one tier.** The app draws a tab bar on a phone and a rail on
 *    a desktop, and a figure from one is not a figure about the other. Both
 *    are measured, and reported apart.
 * 3. **Counting what nobody can touch.** An element with no box, or one inside
 *    a collapsed `<details>`, is not a target a finger misses — it is not a
 *    target. `checkVisibility` decides, and a zero-sized box is skipped.
 * 4. **Measuring the paint instead of the tap.** The section above. The rect
 *    is still taken and still printed beside the hit size, because the pair is
 *    what makes an overlay legible: `81×20 → 81×44` is a control doing what
 *    this app's tap classes are for, and `81×20 → 81×20` is one that lost it.
 */
import { arrived, destinations } from './destinations.mjs';

const BASE = process.env.SWEEP_URL || 'http://localhost:5173/';
const CHROME = process.env.SWEEP_CHROMIUM || '/opt/pw-browsers/chromium';
/** Narrow the run while working on the sweep itself; unset means everything. */
const ONLY = process.env.SWEEP_SCREENS?.split(',').map((s) => s.trim()).filter(Boolean);

/*
 * The two thresholds, and why there are two.
 *
 * The completion plan asks for "WCAG-compliant minimums" and names a
 * "44-pixel minimum touch target" beside a "WCAG 2.1 AA acceptance target".
 * Those are two different criteria and only one of them is AA:
 *
 *   2.5.5 Target Size            44×44   WCAG 2.1, Level **AAA**
 *   2.5.8 Target Size (Minimum)  24×24   WCAG 2.2, Level **AA**
 *
 * So 44 is the comfortable bar and 24 is the one an AA acceptance target
 * actually sets. Both are counted and reported apart, because a run that
 * reported only the 44 figure would make the app look like it fails AA when
 * the question has not been asked — and a run that reported only 24 would
 * quietly drop the bar the plan asked to aim at.
 *
 * 2.5.8 exempts a target that is inline in a sentence, among other things.
 * Nothing here can tell an inline control from a small one, so the AA count
 * below is an upper bound on the failures rather than the failures: it is a
 * list to read, not a verdict to quote.
 */
const TARGET = 44;
const AA = 24;
const TYPE = 12;

let chromium;
try {
  const from = process.env.SWEEP_PLAYWRIGHT;
  if (from) {
    const { createRequire } = await import('node:module');
    ({ chromium } = createRequire(import.meta.url)(from));
  } else {
    ({ chromium } = await import('playwright'));
  }
} catch (e) {
  console.error(
    'playwright is not resolvable, and it is deliberately not a dependency of\n' +
      'this project. Install it in a scratch directory and name that copy:\n\n' +
      '  mkdir -p /tmp/drive && cd /tmp/drive\n' +
      "  echo '{\"name\":\"drive\",\"private\":true,\"type\":\"module\"}' > package.json\n" +
      '  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install playwright\n' +
      '  cd - && SWEEP_PLAYWRIGHT=/tmp/drive/node_modules/playwright npm run sweep:targets\n\n' +
      String(e).slice(0, 200),
  );
  process.exit(2);
}

/**
 * The screens to walk, read from the app's own registry so the list cannot
 * drift the way a hand-kept one does.
 *
 * The read moved to `scripts/destinations.mjs` when the contrast sweep needed
 * the same list: two instruments, one idea of what this app contains, and
 * `src/lib/sweepscreens.test.ts` holding both to it.
 *
 * Three destinations came back with that move, and the reason they were out is
 * worth keeping. This file used to drop anything it believed needed an id in
 * the address — `deck`, `sheet` and `write` among them — on the argument that
 * `#/course` would measure whatever was on screen before it, which is mistake
 * 3 in `contrast-sweep.mjs`'s header in another coat. The argument is right
 * and the list was wrong: opened and looked at, `#/write` draws "Write a
 * document", `#/deck` draws "Make a deck" and `#/sheet` draws "Sheet or
 * table", each with no id and each its own screen. They were three of the
 * sixty this never measured, on a guess nobody had taken. `course`, `item` and
 * `guide` are not in the registry at all, so they were never in this walk to
 * begin with.
 */
function screens() {
  const out = destinations();
  return ONLY ? out.filter((d) => ONLY.includes(d.screen)) : out;
}

/*
 * The measurement itself, as a source string both the walk and the controls
 * share — so the figure the app is judged by and the figure the probe is
 * judged by are taken by the same code rather than by two that agree today.
 */
const HITTEST = `
  const TARGET = ${TARGET};
  const AA = ${AA};
  const TYPE = ${TYPE};
  const seen = (el) => el.checkVisibility ? el.checkVisibility() : true;
  const name = (el) => {
    const cls = (el.getAttribute('class') || '').trim().split(/\\s+/)[0] || '';
    return el.tagName.toLowerCase() + (cls ? '.' + cls : '');
  };

  /*
   * Whoever would receive a tap at this point. A pseudo-element answers as the
   * element it belongs to, which is how the tap overlays become visible here,
   * and a child answers as itself, which is why a descendant counts: tapping
   * the span inside a button presses the button.
   *
   * An ancestor does not count. A point in a wrapper's padding is a tap on the
   * wrapper, and counting it would hand every control its parent's size.
   */
  /*
   * A field's label is part of its target, and leaving that out was the
   * fourth way this probe found to be wrong.
   *
   * Three checkboxes read 13×13 and 18×18 and were counted as failures. Each
   * sits inside a label whose text toggles it — the attestation on the drafting
   * screen is a whole sentence about the syllabus — so the region that accepts
   * the pointer is the row, not the box, and 2.5.8 asks about the region.
   * A label that wraps the field, or names it by 'for', counts as the field.
   */
  const labelled = (el) => {
    if (!el.matches('input, select, textarea')) return null;
    const around = el.closest('label');
    if (around) return around;
    if (!el.id) return null;
    try { return document.querySelector('label[for="' + CSS.escape(el.id) + '"]'); } catch { return null; }
  };

  const hitting = (el) => {
    const lab = labelled(el);
    return (x, y) => {
      const h = document.elementFromPoint(x, y);
      if (!h) return false;
      return h === el || el.contains(h) || (!!lab && (h === lab || lab.contains(h)));
    };
  };

  /* How far out this control still answers, in one direction. */
  const reach = (hit, cx, cy, dx, dy, cap) => {
    if (!hit(cx + dx, cy + dy)) return 0;
    if (hit(cx + dx * cap, cy + dy * cap)) return cap;
    let lo = 1;
    let hi = cap;
    while (hi - lo > 0.5) {
      const mid = (lo + hi) / 2;
      if (hit(cx + dx * mid, cy + dy * mid)) lo = mid;
      else hi = mid;
    }
    return lo;
  };

  const target = (el) => {
    /*
     * Scrolled to the middle first, always, and the two wrong versions of this
     * are both worth keeping written down.
     *
     * Measuring wherever the control happened to be called 603 of 2066
     * desktop controls unreachable, because elementFromPoint answers null
     * outside the viewport and most of an app is below the fold. Measuring
     * only the ones already inside the viewport where they sat traded that for
     * a subtler version of the same error: the links screen's EDIT buttons
     * read 0×0 because the phone's fixed tab bar paints over the bottom of the
     * first screenful, and a control under the tab bar is not an unreachable
     * control — it is one you scroll two lines to reach. Both readings were
     * the fold wearing a different hat.
     *
     * The middle is where a finger meets a control it means to press, so the
     * middle is where it is measured. What that cannot see is occlusion that
     * scrolling does not cure, which is the second pass below rather than
     * nothing.
     */
    el.scrollIntoView({ block: 'center', inline: 'center' });
    const r = el.getBoundingClientRect();
    const hit = hitting(el);
    let cx = r.left + r.width / 2;
    let cy = r.top + r.height / 2;
    if (!hit(cx, cy)) {
      /*
       * The middle answered as somebody else. That is not automatically a
       * failure — a control can be covered at its centre and perfectly
       * tappable at its edge — so the quarters are tried before it is called
       * unreachable, and only a control that answers nowhere is.
       */
      let found = null;
      for (const [fx, fy] of [[0.25, 0.5], [0.75, 0.5], [0.5, 0.25], [0.5, 0.75], [0.15, 0.5], [0.85, 0.5]]) {
        const x = r.left + r.width * fx;
        const y = r.top + r.height * fy;
        if (hit(x, y)) { found = [x, y]; break; }
      }
      if (!found) {
        /*
         * One more question before calling it unreachable, and the skip link
         * is why. It sits translated 200% above the page until something
         * focuses it, so it answers at no point on screen and reads as 57
         * copies of a blocked 123×42 — while being, for the one person it is
         * built for, a target that works exactly as intended. A control that
         * only exists when focused is measured focused.
         */
        const was = document.activeElement;
        el.focus({ preventScroll: false });
        const after = el.getBoundingClientRect();
        const back = () => { if (was && was.focus) was.focus({ preventScroll: true }); else el.blur(); };
        if (hit(after.left + after.width / 2, after.top + after.height / 2)) {
          cx = after.left + after.width / 2;
          cy = after.top + after.height / 2;
          const held = labelled(el);
          const box0 = held ? held.getBoundingClientRect() : after;
          const cap0 = Math.max(box0.width, box0.height) / 2 + 48;
          const out = {
            w: reach(hit, cx, cy, -1, 0, cap0) + reach(hit, cx, cy, 1, 0, cap0),
            h: reach(hit, cx, cy, 0, -1, cap0) + reach(hit, cx, cy, 0, 1, cap0),
            rw: after.width,
            rh: after.height,
            blocked: false,
            focused: true,
          };
          back();
          return out;
        }
        back();
        /*
         * Who took it, because not every covered control is a fault. The
         * three the map screen reports are Leaflet's own container and its
         * two zoom buttons under the panel that says "the map itself needs a
         * connection" — components/LiveMap.tsx puts it at z-index 1200
         * deliberately, over Leaflet's furniture, so nothing offers to zoom in
         * on nothing. A sweep that ran with tiles reachable would not see
         * them at all. Naming the cover is what tells the two cases apart.
         */
        const over = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        const by = over ? (over.closest('[role]') || over).getAttribute('role') : null;
        return { w: 0, h: 0, rw: r.width, rh: r.height, blocked: true, by };
      }
      cx = found[0];
      cy = found[1];
    }
    /*
     * Far enough to find a 44px overlay on the largest control worth growing,
     * and no further: an unbounded walk would run off the viewport and into
     * elementFromPoint's null, which reads the same as an edge anyway.
     *
     * Measured from whatever holds the target rather than from the control,
     * because a field's label is part of it. From the field alone this capped
     * at 57 either way, and the probe's own 18×18-in-a-120px-label control
     * came back 67 wide — the cap, reported as a measurement.
     */
    const lab = labelled(el);
    const hold = lab ? lab.getBoundingClientRect() : r;
    const cap = Math.max(hold.width, hold.height) / 2 + 48;
    return {
      w: reach(hit, cx, cy, -1, 0, cap) + reach(hit, cx, cy, 1, 0, cap),
      h: reach(hit, cx, cy, 0, -1, cap) + reach(hit, cx, cy, 0, 1, cap),
      rw: r.width,
      rh: r.height,
      blocked: false,
    };
  };
`;

/**
 * Three controls of known size, measured by the code above before the walk.
 *
 * Not decoration. The first probe written for this reported 162 AA failures a
 * tier and every one of them was the probe reading the paint; the way that was
 * caught was a control whose answer was known in advance disagreeing with it.
 * So: a box that is really 44, a box that is really 10, and a 20px control
 * wearing the overlay this app uses — which must read 44 tall and stay 60
 * wide, because `tap-y` is the axis that does not reach sideways.
 */
const CONTROLS = `(() => {
  ${HITTEST}
  const made = document.createElement('div');
  made.setAttribute('data-sweep-control', '');
  /*
   * A hundred pixels apart, and that spacing is a finding rather than a
   * default. Stacked in one column the way they were first written, the
   * tap-y probe's own overlay reached twelve pixels up over the 10×10 probe
   * and two over the 44×44 one, and the run reported 0×0 and 45×42 for boxes
   * whose sizes are in the markup above them. The instrument needs room for
   * the same reason the controls it measures do — which is the thing it is
   * here to detect.
   */
  const at = (top, html) =>
    '<div style="position:fixed;left:8px;top:' + top + 'px;z-index:2147483647">' + html + '</div>';
  made.innerHTML =
    at(120, '<button id="sweep-44" style="width:44px;height:44px;padding:0;border:0">a</button>') +
    /* Empty, and its type size zeroed: with a letter in it the 10px box read 16 tall,
       because a button hit-tests the inline content that overflows it, and the
       probe was right to say so — a control's text is part of what a finger
       lands on. Here it would be measuring the letter rather than the box the
       assertion names. */
    at(240, '<button id="sweep-10" aria-label="probe" style="width:10px;height:10px;padding:0;border:0;font-size:0;line-height:0"></button>') +
    at(360, '<button id="sweep-tap" class="tap-y" style="width:60px;height:20px;padding:0;border:0">c</button>') +
    /* The pair that pins the label rule, which is the one that turned three
       failures into none and so is the one most worth doubting. A bare 18px
       box must still read 18; the same box inside a label with a 90px line of
       text beside it must read the row. If the first grows, the rule is
       crediting controls that have no label; if the second does not, the rule
       is not working at all and three checkboxes are failures after all. */
    at(480, '<input id="sweep-box" type="checkbox" style="width:18px;height:18px;margin:0">') +
    at(600, '<label id="sweep-lab" style="display:flex;align-items:center;gap:6px;width:120px">' +
      '<input id="sweep-in" type="checkbox" style="width:18px;height:18px;margin:0;flex:none">' +
      '<span style="font-size:12px">a labelled box</span></label>');
  document.body.append(made);
  const of = (id) => {
    const t = target(document.getElementById(id));
    return { w: Math.round(t.w), h: Math.round(t.h), rw: Math.round(t.rw), rh: Math.round(t.rh) };
  };
  const out = {
    big: of('sweep-44'),
    small: of('sweep-10'),
    overlaid: of('sweep-tap'),
    bare: of('sweep-box'),
    inLabel: of('sweep-in'),
  };
  made.remove();
  return out;
})()`;

/** Was the instrument telling the truth? A tolerance of one pixel each way. */
function instrument(c) {
  const near = (got, want) => Math.abs(got - want) <= 1;
  const wrong = [];
  if (!near(c.big.w, 44) || !near(c.big.h, 44)) wrong.push(`a real 44×44 read ${c.big.w}×${c.big.h}`);
  if (!near(c.small.w, 10) || !near(c.small.h, 10)) wrong.push(`a real 10×10 read ${c.small.w}×${c.small.h}`);
  if (!near(c.overlaid.h, 44)) wrong.push(`a 20px control wearing tap-y read ${c.overlaid.h} tall, so the overlay is invisible to this probe`);
  if (!near(c.overlaid.w, 60)) wrong.push(`tap-y read ${c.overlaid.w} wide, and it must not reach sideways`);
  if (!near(c.bare.w, 18) || !near(c.bare.h, 18)) {
    wrong.push(`an 18×18 box with no label read ${c.bare.w}×${c.bare.h}, so the label rule is crediting fields that have none`);
  }
  if (c.inLabel.w < 100) {
    wrong.push(`an 18×18 box inside a 120px label read ${c.inLabel.w} wide, so the label rule is not working`);
  }
  return wrong;
}

/** What one screen measured, as groups rather than instances. See the header. */
const MEASURE = `(() => {
  ${HITTEST}
  const small = new Map();
  const under = new Map();
  const covered = new Map();
  const tiny = new Map();
  let total = 0;
  let underAA = 0;
  let inlineAA = 0;
  let blocked = 0;
  const controls = document.querySelectorAll(
    'a[href], button, input, select, textarea, [role="button"], [role="tab"], [role="link"], [role="switch"], [tabindex]:not([tabindex="-1"])',
  );

  /*
   * First, before anything scrolls: who is painted over where the screen opens.
   *
   * This is not the target-size question and is not counted as a failure — a
   * control under the tab bar scrolls out from under it. It is the other
   * question, the one the sample-semester banner's comment is about: a 44px
   * overlay with a sticky header over half of it is a 22px target, and nothing
   * about that is visible. Kept apart from the AA count on purpose, because
   * folding the two together is what made the first three versions of this
   * probe disagree with each other.
   */
  for (const el of controls) {
    if (!seen(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) continue;
    const hit = hitting(el);
    if (hit(r.left + r.width / 2, r.top + r.height / 2)) continue;
    const key = name(el) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height);
    const had = covered.get(key);
    if (had) had.n += 1;
    else covered.set(key, { n: 1, text: (el.textContent || '').trim().slice(0, 24) });
  }

  for (const el of controls) {
    if (!seen(el)) continue;
    const t = target(el);
    if (t.rw === 0 || t.rh === 0) continue;
    total += 1;
    const inline = getComputedStyle(el).display.includes('inline');
    /*
     * Size, on the control's own rectangle when something is over it.
     *
     * t.w and t.h are the *hit* size, and for a blocked control that is 0x0 by
     * construction — which then failed the AA test and put the thing in the
     * list headed "the only list that is a failure". The map screen's zoom
     * buttons are 30x30. They were being reported as under twenty-four for
     * being covered.
     *
     * 2.5.8 is about how big a target is. Occlusion is a different question
     * and this sweep already answers it separately, in the blocked count and
     * in the covered pass above — whose own comment says the two were folded
     * together in the first three versions and that keeping them apart is the
     * fix. This loop was still folding them.
     *
     * A control that is genuinely small *and* covered still fails here, on its
     * own rectangle, which is the reading that does not depend on what is
     * painted over it.
     *
     * No backticks anywhere in this comment, and that is not fussiness: this
     * block is inside the MEASURE template literal, so one would end the
     * string and the file would not parse. The first version of this had four.
     */
    const w = t.blocked ? t.rw : t.w;
    const h = t.blocked ? t.rh : t.h;
    const fails = h < AA || w < AA;
    if (fails) { if (!inline) underAA += 1; else inlineAA += 1; }
    if (t.blocked) blocked += 1;
    const key0 = name(el) + ' ' + Math.round(t.rw) + 'x' + Math.round(t.rh) +
      ' → ' + Math.round(t.w) + 'x' + Math.round(t.h) +
      (t.blocked ? ' BLOCKED' + (t.by ? ' under role=' + t.by : '') : '') +
      (t.focused ? ' (focused)' : '');
    if (fails && !inline) {
      const was = under.get(key0);
      if (was) was.n += 1;
      else under.set(key0, { n: 1, text: (el.textContent || '').trim().slice(0, 24) });
    }
    if (t.h >= TARGET && t.w >= TARGET) continue;
    /* The pair, not the hit size alone: see mistake 4 in the header. */
    const key = name(el) + ' ' + Math.round(t.rw) + 'x' + Math.round(t.rh) +
      ' → ' + Math.round(t.w) + 'x' + Math.round(t.h) + (t.blocked ? ' BLOCKED' : '') +
      (fails && !inline ? ' ⟵ under AA' : '');
    const had = small.get(key);
    if (had) had.n += 1;
    else small.set(key, { n: 1, text: (el.textContent || '').trim().slice(0, 24) });
  }
  let texts = 0;
  for (const el of document.querySelectorAll('*')) {
    if (!seen(el)) continue;
    let own = false;
    for (const node of el.childNodes) if (node.nodeType === 3 && node.textContent.trim()) own = true;
    if (!own) continue;
    texts += 1;
    const size = Number.parseFloat(getComputedStyle(el).fontSize);
    if (!size || size >= TYPE) continue;
    const key = name(el) + ' ' + size + 'px';
    const had = tiny.get(key);
    if (had) had.n += 1;
    else tiny.set(key, { n: 1, text: (el.textContent || '').trim().slice(0, 24) });
  }
  const rows = (m) => [...m.entries()].map(([k, v]) => ({ k, ...v })).sort((a, b) => b.n - a.n);
  return {
    total,
    underAA,
    inlineAA,
    blocked,
    texts,
    small: rows(small),
    under: rows(under),
    covered: rows(covered),
    tiny: rows(tiny),
    smallCount: rows(small).reduce((n, r) => n + r.n, 0),
    tinyCount: rows(tiny).reduce((n, r) => n + r.n, 0),
  };
})()`;

async function sweep(browser, label, width, height) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => {
    localStorage.setItem(
      'semester.v1',
      JSON.stringify({ schemaVersion: 6, shell: 'soft', nav: 'springboard' }),
    );
  });
  const page = await ctx.newPage();
  const broke = [];
  page.on('pageerror', (e) => broke.push(String(e)));

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2200);
  const skip = page.getByRole('button', { name: /skip/i }).first();
  if (await skip.count()) await skip.click().catch(() => {});
  await page.waitForTimeout(1000);

  const known = await page.evaluate(CONTROLS);
  const lying = instrument(known);
  console.log(
    `\n═══ ${label} — ${width}×${height} ═══\n` +
      `  the instrument: 44×44 read ${known.big.w}×${known.big.h} · ` +
      `10×10 read ${known.small.w}×${known.small.h} · ` +
      `60×20 in tap-y read ${known.overlaid.w}×${known.overlaid.h}\n` +
      `                  an 18×18 box bare read ${known.bare.w}×${known.bare.h} · ` +
      `the same box in a 120px label read ${known.inLabel.w}×${known.inLabel.h}`,
  );
  if (lying.length) {
    console.error(`\n  the probe is wrong, so no figure it takes is worth printing:`);
    for (const l of lying) console.error(`    ${l}`);
    await ctx.close();
    process.exitCode = 3;
    return null;
  }

  const causes = new Map();
  const underCauses = new Map();
  const coveredCauses = new Map();
  const tinyCauses = new Map();
  let controls = 0;
  let smalls = 0;
  let aa = 0;
  let inlineAa = 0;
  let texts = 0;
  let tinies = 0;
  let blocked = 0;
  let atRest = 0;
  const worst = [];
  /*
   * Screens the walk asked for and did not land on. Reported rather than
   * dropped: a sweep with a hole in it is a different thing from a sweep that
   * found nothing there, and only one of them is good news.
   */
  const missed = [];

  for (const { screen, label: title } of screens()) {
    await page.evaluate((s) => {
      location.hash = `#/${s}`;
    }, screen);
    await page.waitForTimeout(650);
    /*
     * That it is really on that screen, read from the heading rather than from
     * the hash this just wrote. A row filed under the wrong screen is worse
     * than a row that is missing: it sends whoever reads it to fix a control
     * on a screen that does not have one.
     */
    let seen = null;
    try {
      seen = await page.evaluate(() => ({ h1: document.querySelector('h1')?.textContent || '' }));
    } catch {
      seen = null;
    }
    if (!arrived(screen, title, seen)) {
      missed.push({ screen, saw: (seen?.h1 ?? '').trim().slice(0, 30) });
      continue;
    }
    let found;
    try {
      found = await page.evaluate(MEASURE);
    } catch {
      continue;
    }
    controls += found.total;
    smalls += found.smallCount;
    aa += found.underAA;
    inlineAa += found.inlineAA;
    texts += found.texts;
    tinies += found.tinyCount;
    blocked += found.blocked;
    atRest += found.covered.reduce((n, row) => n + row.n, 0);
    worst.push({ screen, of: found.total, small: found.smallCount, tiny: found.tinyCount });
    for (const row of found.small) causes.set(row.k, (causes.get(row.k) ?? 0) + row.n);
    for (const row of found.under) {
      /* With the screen in the key, because six failures spread over sixty
         screens are six places to go and a grouped count is none. */
      const k = `${row.k}  ${screen}${row.text ? ` "${row.text}"` : ''}`;
      underCauses.set(k, (underCauses.get(k) ?? 0) + row.n);
    }
    for (const row of found.tiny) tinyCauses.set(row.k, (tinyCauses.get(row.k) ?? 0) + row.n);
    for (const row of found.covered) {
      const k = `${row.k}  ${screen}${row.text ? ` "${row.text}"` : ''}`;
      coveredCauses.set(k, (coveredCauses.get(k) ?? 0) + row.n);
    }
  }

  const share = controls ? Math.round((smalls / controls) * 100) : 0;
  console.log(`\n  ${worst.length} of ${screens().length} destinations opened` +
    (missed.length ? `, ${missed.length} not reached: ${missed.map((m) => `${m.screen} (saw "${m.saw}")`).join(', ')}` : ''));
  console.log(`  ${smalls} of ${controls} controls under ${TARGET}px, the AAA target (${share}%)`);
  console.log(`  ${aa} of ${controls} under ${AA}px, the AA minimum — plus ${inlineAa} inline, which 2.5.8 exempts`);
  console.log(`  ${blocked} answer nowhere inside their own box, scrolled to the middle`);
  console.log(`  ${atRest} are painted over where the screen opens — a different question, and not a failure`);
  console.log(`  ${tinies} of ${texts} texts under ${TYPE}px`);

  if (underCauses.size) {
    console.log(`\n  under ${AA}px — the AA minimum, and the only list that is a failure`);
    for (const [k, n] of [...underCauses.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(n).padStart(4)} × ${k}`);
    }
  } else {
    console.log(`\n  nothing under ${AA}px.`);
  }

  if (coveredCauses.size) {
    console.log(`\n  painted over where the screen opens — scroll reaches them; read it for surprises`);
    for (const [k, n] of [...coveredCauses.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
      console.log(`  ${String(n).padStart(4)} × ${k}`);
    }
  }

  console.log(`\n  under ${TARGET}px — the AAA target, which is an aim and not a failure`);
  for (const [k, n] of [...causes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18)) {
    console.log(`  ${String(n).padStart(4)} × ${k}`);
  }
  if (tinyCauses.size) {
    console.log(`\n  type under ${TYPE}px`);
    for (const [k, n] of [...tinyCauses.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
      console.log(`  ${String(n).padStart(4)} × ${k}`);
    }
  }
  console.log(`\n  the worst screens`);
  for (const w of worst.sort((a, b) => b.small - a.small).slice(0, 8)) {
    console.log(`  ${String(w.small).padStart(4)} of ${String(w.of).padEnd(4)} ${w.screen}`);
  }
  if (broke.length) console.log(`\n  pageerrors: ${broke.slice(0, 3).join(' | ')}`);
  await ctx.close();
  return { smalls, controls, tinies, aa, blocked };
}

const browser = await chromium.launch({
  ...(CHROME ? { executablePath: CHROME } : {}),
  args: ['--no-sandbox'],
});
const phone = await sweep(browser, 'phone', 420, 900);
const desktop = await sweep(browser, 'desktop', 1280, 900);
await browser.close();

if (phone && desktop) {
  console.log(
    `\nunder ${TARGET}px (AAA): phone ${phone.smalls}/${phone.controls} · desktop ${desktop.smalls}/${desktop.controls}` +
      `\nunder ${AA}px (AA):  phone ${phone.aa}/${phone.controls} · desktop ${desktop.aa}/${desktop.controls}` +
      `\nunreachable:      phone ${phone.blocked} · desktop ${desktop.blocked}`,
  );
}
