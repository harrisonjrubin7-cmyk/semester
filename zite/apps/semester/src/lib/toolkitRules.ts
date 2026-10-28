// Toolkit: the subject workbench. Pure, deterministic: tool catalog, the 9 intents and 33 subjects mapped to tools, structured
// templates (case analysis, research studio, data studio, assignment workspace, rubric self-check) and the arithmetic behind them.
// Nothing here calls a model, and the rubric self-check never predicts a grade.

export type ToolKey = 'case' | 'research' | 'data' | 'assignment' | 'rubric' | 'sheet' | 'diagram' | 'guide' | 'paper' | 'sources' | 'write' | 'proof' | 'deck' | 'group';
export type Tool = { key: ToolKey; name: string; blurb: string; where: 'toolkit' | 'semester'; route: string | null };

export const TOOLS: Tool[] = [
  { key: 'case', name: 'Case analysis template', blurb: 'Facts, stakeholders, framework, alternatives, recommendation', where: 'toolkit', route: '/learn/toolkit/case' },
  { key: 'research', name: 'Research Studio', blurb: 'Question, search plan, screening, evidence matrix, citation audit', where: 'toolkit', route: '/learn/toolkit/research' },
  { key: 'data', name: 'Data Studio', blurb: 'Dictionary, cleaning log, describe, chart with a table alternative, bounded conclusions', where: 'toolkit', route: '/learn/toolkit/data' },
  { key: 'assignment', name: 'Assignment workspace', blurb: 'Stages, deliverables, rubric self-check and submission checklist', where: 'toolkit', route: '/learn/toolkit/assignment' },
  { key: 'rubric', name: 'Rubric self-check', blurb: 'A rubric criterion turned into a checklist — never a grade prediction', where: 'toolkit', route: '/learn/toolkit/rubric' },
  { key: 'sheet', name: 'Spreadsheet', blurb: 'A grid out as Excel or CSV', where: 'semester', route: '/learn/sheet' },
  { key: 'diagram', name: 'Diagram builder', blurb: 'Flows, timelines and matrices from a description', where: 'semester', route: '/learn/diagram' },
  { key: 'guide', name: 'Study guide from sources', blurb: 'Guides built only from material you select', where: 'semester', route: '/learn/guides' },
  { key: 'paper', name: 'Practice paper', blurb: 'A timed paper marked against a key', where: 'semester', route: '/learn/paper' },
  { key: 'sources', name: 'Sources', blurb: 'Your readings with what each is for, out as BibTeX', where: 'semester', route: '/learn/sources' },
  { key: 'write', name: 'Write a document', blurb: 'Memo, report or handout out as a Word file', where: 'semester', route: '/learn/write' },
  { key: 'proof', name: 'Check the writing', blurb: 'Grammar read back, quotations checked against the reading', where: 'semester', route: '/learn/proof' },
  { key: 'deck', name: 'Make a deck', blurb: 'A real PowerPoint file', where: 'semester', route: '/learn/deck' },
  { key: 'group', name: 'Group work', blurb: 'Who has which part, and whether it lands', where: 'semester', route: '/campus/groupwork' },
];

export const INTENTS: { name: string; tools: ToolKey[] }[] = [
  { name: 'Study for an exam', tools: ['guide', 'paper', 'rubric'] },
  { name: 'Complete an assignment', tools: ['assignment', 'rubric', 'write', 'proof'] },
  { name: 'Analyze data', tools: ['data', 'sheet', 'diagram'] },
  { name: 'Write a paper', tools: ['research', 'sources', 'write', 'proof', 'rubric'] },
  { name: 'Build or code', tools: ['assignment', 'diagram', 'group'] },
  { name: 'Run a lab', tools: ['data', 'sheet', 'write', 'assignment'] },
  { name: 'Do research', tools: ['research', 'sources', 'data'] },
  { name: 'Create a presentation', tools: ['deck', 'diagram', 'group'] },
  { name: 'Prepare for office hours', tools: ['guide', 'assignment', 'rubric'] },
];

const EVERY: ToolKey[] = ['assignment', 'rubric', 'sources', 'write', 'proof'];
export const SUBJECTS: { group: string; name: string; tools: ToolKey[] }[] = [
  ...['Mathematics', 'Statistics', 'Biology', 'Chemistry', 'Physics', 'Computer science', 'Data science', 'Engineering'].map((name) => ({ group: 'STEM', name,
    tools: ['paper', 'guide', ...(['Statistics', 'Data science', 'Biology', 'Chemistry', 'Physics', 'Engineering'].includes(name) ? ['data', 'sheet'] as ToolKey[] : []), 'diagram'] as ToolKey[] })),
  ...['English and writing', 'History', 'Philosophy', 'Languages', 'Religious studies'].map((name) => ({ group: 'Humanities & languages', name, tools: ['research', 'sources', 'write', 'proof', 'guide'] as ToolKey[] })),
  ...['Psychology', 'Sociology', 'Political science', 'Economics', 'Anthropology', 'Business and management', 'Finance and accounting', 'Education', 'Communication', 'Public policy', 'Legal studies', 'Criminal justice'].map((name) => ({
    group: 'Social sciences & business', name, tools: [...(['Business and management', 'Public policy', 'Legal studies', 'Criminal justice', 'Education'].includes(name) ? ['case'] as ToolKey[] : []), 'research', 'data', 'sheet', 'deck'] as ToolKey[] })),
  ...['Art and design', 'Music', 'Theatre, film and media'].map((name) => ({ group: 'Arts & media', name, tools: ['research', 'sources', 'deck', 'group'] as ToolKey[] })),
  ...['Nursing', 'Public health', 'Kinesiology and nutrition'].map((name) => ({ group: 'Health & clinical', name, tools: ['case', 'research', 'data', 'guide', 'paper'] as ToolKey[] })),
  { group: 'Field & environment', name: 'Environmental and earth science', tools: ['data', 'sheet', 'research', 'diagram'] },
];
export const EVERY_SUBJECT = EVERY;

// ---- Templates: each kind is a list of sections; a section is text, a list, or a table with named columns. ----
export type Section = { key: string; label: string; type: 'text' | 'list' | 'table'; columns?: string[]; hint: string };
export const TEMPLATES: Record<'case' | 'research' | 'data' | 'assignment', Section[]> = {
  case: [
    { key: 'facts', label: 'Facts', type: 'list', hint: 'What is known, without judgement' },
    { key: 'stakeholders', label: 'Stakeholders', type: 'table', columns: ['Who', 'What they want', 'What they stand to lose'], hint: 'Everyone affected' },
    { key: 'framework', label: 'Framework', type: 'text', hint: 'The model or principle you are applying, and why it fits' },
    { key: 'alternatives', label: 'Alternatives', type: 'table', columns: ['Option', 'For', 'Against'], hint: 'At least two real options' },
    { key: 'recommendation', label: 'Recommendation', type: 'text', hint: 'Which option, why, and what would change your mind' },
  ],
  research: [
    { key: 'question', label: 'Question', type: 'text', hint: 'One answerable question' },
    { key: 'plan', label: 'Search plan', type: 'table', columns: ['Where', 'Search terms', 'Date range'], hint: 'Databases and the exact terms' },
    { key: 'screening', label: 'Screening', type: 'table', columns: ['Include if', 'Exclude if'], hint: 'Rules decided before you read' },
    { key: 'matrix', label: 'Evidence matrix', type: 'table', columns: ['Source', 'Claim', 'Evidence', 'Strength'], hint: 'One row per source' },
    { key: 'audit', label: 'Citation audit', type: 'table', columns: ['Your sentence', 'Source', 'Exact quotation or page', 'Checked'], hint: 'Every cited claim traced to its source' },
  ],
  data: [
    { key: 'dictionary', label: 'Data dictionary', type: 'table', columns: ['Variable', 'Type', 'Meaning', 'Units'], hint: 'Every column named and explained' },
    { key: 'cleaning', label: 'Cleaning log', type: 'table', columns: ['Step', 'Why', 'Rows affected'], hint: 'Every change to the raw data' },
    { key: 'csv', label: 'Data (CSV)', type: 'text', hint: 'Paste CSV with a header row; Describe and Chart use it' },
    { key: 'conclusions', label: 'Bounded conclusions', type: 'table', columns: ['Conclusion', 'Limit'], hint: 'Each claim with what it does not show' },
  ],
  assignment: [
    { key: 'brief', label: 'The brief', type: 'text', hint: 'The assignment in your own words' },
    { key: 'stages', label: 'Stages', type: 'table', columns: ['Stage', 'Due', 'Done'], hint: 'Work backwards from the deadline' },
    { key: 'deliverables', label: 'Deliverables', type: 'list', hint: 'Exactly what gets handed in' },
    { key: 'checklist', label: 'Submission checklist', type: 'list', hint: 'Format, length, citations, file name, where it is submitted' },
  ],
};

export type Doc = Record<string, string | string[] | string[][]>;
export function emptyDoc(kind: keyof typeof TEMPLATES): Doc {
  return Object.fromEntries(TEMPLATES[kind].map((s) => [s.key, s.type === 'text' ? '' : s.type === 'list' ? [] : [Array(s.columns!.length).fill('')]]));
}
/** How complete a template is: sections with any content, of all sections. */
export function completeness(kind: keyof typeof TEMPLATES, d: Doc): { done: number; total: number } {
  const secs = TEMPLATES[kind];
  const filled = (v: Doc[string] | undefined) => (typeof v === 'string' ? v.trim().length > 0 : Array.isArray(v) && v.some((x) => (Array.isArray(x) ? x.some((c) => String(c).trim()) : String(x).trim())));
  return { done: secs.filter((s) => filled(d[s.key])).length, total: secs.length };
}

// ---- Rubric self-check: a criterion becomes a checklist of questions about your own work. Never a grade. ----
export function rubricChecklist(criterion: string): string[] {
  const parts = criterion.replace(/\s+/g, ' ').split(/(?<=[.;])\s+|\s*;\s*|\s*•\s*|\n/).map((s) => s.replace(/[.;]+$/, '').trim()).filter((s) => s.length > 3);
  return parts.map((p) => `Does my work ${/^(demonstrates?|shows?|uses?|includes?|provides?|explains?|cites?|applies|presents?|addresses|identif(y|ies)|support|analy[sz]es?)\b/i.test(p) ? p.charAt(0).toLowerCase() + p.slice(1) : `meet this: ${p.charAt(0).toLowerCase() + p.slice(1)}`}?`);
}

// ---- Data Studio: CSV parsing and description. ----
export function parseCsv(text: string): { header: string[]; rows: string[][] } {
  const lines: string[][] = [];
  let row: string[] = [], cur = '', q = false;
  const s = text.replace(/\r/g, '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) { if (ch === '"' && s[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; continue; }
    if (ch === '"') q = true; else if (ch === ',') { row.push(cur); cur = ''; } else if (ch === '\n') { row.push(cur); lines.push(row); row = []; cur = ''; } else cur += ch;
  }
  if (cur || row.length) { row.push(cur); lines.push(row); }
  const nonEmpty = lines.filter((r) => r.some((c) => c.trim()));
  return { header: (nonEmpty[0] ?? []).map((h) => h.trim()), rows: nonEmpty.slice(1) };
}

export type ColumnStats = { column: string; numeric: boolean; n: number; missing: number; mean?: number; median?: number; sd?: number; min?: number; max?: number; top?: { value: string; count: number }[] };
const round = (x: number) => Math.round(x * 1000) / 1000;
export function describe(text: string): ColumnStats[] {
  const { header, rows } = parseCsv(text);
  return header.map((column, j) => {
    const vals = rows.map((r) => (r[j] ?? '').trim());
    const present = vals.filter((v) => v !== '');
    const nums = present.map(Number);
    const numeric = present.length > 0 && nums.every((x) => Number.isFinite(x));
    if (!numeric) {
      const counts = new Map<string, number>();
      for (const v of present) counts.set(v, (counts.get(v) ?? 0) + 1);
      return { column, numeric, n: present.length, missing: vals.length - present.length, top: [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5).map(([value, count]) => ({ value, count })) };
    }
    const sorted = [...nums].sort((a, b) => a - b);
    const n = nums.length;
    const mean = nums.reduce((a, b) => a + b, 0) / n;
    const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
    const sd = n > 1 ? Math.sqrt(nums.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
    return { column, numeric, n, missing: vals.length - n, mean: round(mean), median: round(median), sd: round(sd), min: sorted[0], max: sorted[n - 1] };
  });
}
