// Calendar connector (ing-001). Pure: reads an institution's .ics export and finds each term's five academic-calendar dates.
// (The SIS connector is the existing roster gateway, rosterImport.ts / rgw-001; this file does not duplicate it.)

/** Minimal iCalendar reader: unfolds lines and returns SUMMARY and DTSTART (date or date-time, UTC or floating) per VEVENT. */
export function parseIcs(text: string): { summary: string; start: string }[] {
  const lines = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
  const out: { summary: string; start: string }[] = []; let cur: { summary?: string; start?: string } | null = null;
  for (const l of lines) {
    if (l === 'BEGIN:VEVENT') cur = {};
    else if (l === 'END:VEVENT') { if (cur?.summary && cur.start) out.push({ summary: cur.summary, start: cur.start }); cur = null; }
    else if (cur) {
      const m = l.match(/^([A-Z-]+)(;[^:]*)?:(.*)$/); if (!m) continue;
      if (m[1] === 'SUMMARY') cur.summary = m[3].replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/gi, ' ').trim();
      if (m[1] === 'DTSTART') { const d = m[3].match(/^(\d{4})(\d{2})(\d{2})/); if (d) cur.start = `${d[1]}-${d[2]}-${d[3]}`; }
    }
  }
  return out;
}

export const TERM_KEYS = ['regOpens', 'regCloses', 'addDropEnds', 'classesStart', 'classesEnd'] as const;
const PATTERNS: [typeof TERM_KEYS[number], RegExp][] = [
  ['regOpens', /registration (opens|begins)/i], ['regCloses', /registration (closes|ends)/i],
  ['addDropEnds', /(add[\s/-]*drop (ends|deadline)|last day to add)/i],
  ['classesStart', /(classes (begin|start)|first day of classes)/i], ['classesEnd', /(classes end|last day of classes)/i],
];

/** Groups events by the term label they name (e.g. "Spring 2027") and finds the five dates the academic calendar needs. */
export function termDates(events: { summary: string; start: string }[]) {
  const terms = new Map<string, Partial<Record<typeof TERM_KEYS[number], string>>>();
  const unused: string[] = [];
  for (const e of events) {
    const t = e.summary.match(/\b(Spring|Summer|Fall|Winter|Autumn)\s+(\d{4})\b/i);
    const k = PATTERNS.find(([, re]) => re.test(e.summary));
    if (!t || !k) { unused.push(e.summary); continue; }
    const label = `${t[1][0].toUpperCase()}${t[1].slice(1).toLowerCase()} ${t[2]}`;
    const cur = terms.get(label) ?? {};
    if (!cur[k[0]]) cur[k[0]] = e.start;
    terms.set(label, cur);
  }
  return {
    terms: [...terms.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([term, d]) => ({ term, dates: d, missing: TERM_KEYS.filter((k) => !d[k]) })),
    unused,
  };
}
