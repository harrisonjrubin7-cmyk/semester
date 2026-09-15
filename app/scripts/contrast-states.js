/*
 * Which rules change text or surface colour when hovered or focused.
 *
 * Read from `document.styleSheets` — the browser's own parse — rather than by
 * matching the stylesheet text. A previous attempt at reading CSS with regular
 * expressions split selectors inside `:is()` and mistook comments for rules;
 * the parse that the page already has is free and correct.
 *
 * Returns, for each rule that sets `color` or a background under one of these
 * states, a pair of selectors:
 *
 *   host     the element the pseudo-class attaches to — what has to be
 *            hovered or focused for the rule to apply
 *   measure  the element the rule actually paints, which for something like
 *            `.row:hover .label` is not the same element at all
 *
 * Getting that distinction wrong would force `:hover` onto the label and then
 * wonder why nothing changed.
 */
(() => {
  const STATES = ['hover', 'focus-visible', 'focus'];
  const out = [];
  const seen = new Set();

  const collect = (rules) => {
    for (const rule of rules) {
      /*
       * Recurse, but do not skip the rule itself.
       *
       * `if (rule.cssRules) { ...; continue; }` reads as "this is a group rule
       * like @media" and is wrong: CSS nesting gave every style rule a
       * `cssRules` list too, and an empty CSSRuleList is truthy. That one
       * `continue` skipped every style rule in the app and the discovery
       * returned nothing at all, which looks exactly like a page with no
       * hover rules on it.
       */
      if (rule.cssRules && rule.cssRules.length) collect(rule.cssRules);
      if (!rule.selectorText || !rule.style) continue;
      const st = rule.style;
      const paints = st.color || st.background || st.backgroundColor;
      if (!paints) continue;
      for (const part of splitSelectors(rule.selectorText)) {
        for (const state of STATES) {
          const at = part.indexOf(':' + state);
          if (at < 0) continue;
          // Everything up to the end of the compound the pseudo sits on.
          const host = stripStates(part.slice(0, at)).trim();
          const measure = stripStates(part).trim();
          if (!host || !measure) continue;
          const key = state + '|' + host + '|' + measure;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({ state, host, measure });
        }
      }
    }
  };

  // Paren-aware, so a comma inside :is(a, b) does not split the selector.
  function splitSelectors(text) {
    const parts = [];
    let depth = 0, cur = '';
    for (const ch of text) {
      if (ch === '(') depth += 1;
      if (ch === ')') depth -= 1;
      if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
      cur += ch;
    }
    if (cur.trim()) parts.push(cur);
    return parts;
  }

  const stripStates = (s) => s.replace(/:(hover|focus-visible|focus|active)\b/g, '');

  for (const sheet of document.styleSheets) {
    let rules;
    // A cross-origin sheet throws on access; there should be none, but a
    // thrown SecurityError here would take the whole sweep down.
    try { rules = sheet.cssRules; } catch { continue; }
    if (rules) collect(rules);
  }
  return out;
})()
