// Syllabus hub extraction (S-72 §E). Deterministic pattern matching over text the student pasted or the instructor published —
// no model, no PDF parsing. Every candidate keeps the exact source line and stays pending until the student reviews it.
// Unit-tested in tests/syllabusExtract.test.ts.
export type DateCandidate = { key: string; line: number; text: string; date: string; label: string };
export type WeightCandidate = { key: string; line: number; text: string; name: string; weight: number };

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n: number) => String(n).padStart(2, '0');
const valid = (y: number, m: number, d: number) => { const t = new Date(Date.UTC(y, m - 1, d)); return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d; };
const tidy = (s: string) => s.replace(/\s+/g, ' ').replace(/^[\s\-–—:•*|]+|[\s\-–—:•*|]+$/g, '').trim();

/**
 * Dates written as "Oct 14", "October 14, 2026", "10/14" or "10/14/2026" or "2026-10-14". A date without a year takes
 * `year`. The label is the rest of the line. Impossible dates (Feb 30) are dropped, not corrected.
 */
export function extractDates(text: string, year: number): DateCandidate[] {
  const out: DateCandidate[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const found: { y: number; m: number; d: number; match: string }[] = [];
    for (const m of line.matchAll(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g)) found.push({ y: +m[1], m: +m[2], d: +m[3], match: m[0] });
    for (const m of line.matchAll(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/gi))
      found.push({ y: m[3] ? +m[3] : year, m: MONTHS[m[1].toLowerCase().slice(0, m[1].toLowerCase().startsWith('sept') ? 4 : 3)] ?? MONTHS[m[1].toLowerCase().slice(0, 3)], d: +m[2], match: m[0] });
    for (const m of line.matchAll(/(?<![\d/-])(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?![\d/])/g)) {
      const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : year;
      found.push({ y, m: +m[1], d: +m[2], match: m[0] });
    }
    for (const f of found) {
      if (!valid(f.y, f.m, f.d)) continue;
      const date = `${f.y}-${pad(f.m)}-${pad(f.d)}`;
      const label = tidy(line.replace(f.match, ' ')) || 'Syllabus date';
      const key = `d${i}-${date}`;
      if (!out.some((o) => o.key === key)) out.push({ key, line: i + 1, text: line, date, label: label.slice(0, 160) });
    }
  });
  return out;
}

/** Grading weights written as "Homework 20%", "Exams: 50 %", "Participation – 10 percent". */
export function extractWeights(text: string): WeightCandidate[] {
  const out: WeightCandidate[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    for (const m of line.matchAll(/([A-Za-z][A-Za-z &/()'-]{1,60}?)\s*[:\-–—]?\s*(\d{1,3}(?:\.\d+)?)\s*(?:%|percent\b)/g)) {
      const w = Number(m[2]);
      const name = tidy(m[1]);
      if (!(w > 0 && w <= 100) || name.length < 2) continue;
      out.push({ key: `w${i}-${name.toLowerCase()}`, line: i + 1, text: line, name, weight: w });
    }
  });
  return out;
}

/** Line-level comparison of two syllabus versions: what was removed and what was added. */
export function compareVersions(a: string, b: string) {
  const A = a.split(/\r?\n/).map((x) => x.trim()).filter(Boolean), B = b.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  const inA = new Set(A), inB = new Set(B);
  return { removed: A.filter((x) => !inB.has(x)), added: B.filter((x) => !inA.has(x)) };
}

/** A grading-rules proposal for the grade tracker; weights must total 100 before it can be applied. */
export function weightsProposal(accepted: { name: string; weight: number }[]) {
  const total = accepted.reduce((t, w) => t + w.weight, 0);
  return { categories: accepted.map((w, i) => ({ id: `s${i + 1}`, name: w.name, weight: w.weight })), total, applicable: Math.abs(total - 100) < 0.01 && accepted.length > 0 };
}
