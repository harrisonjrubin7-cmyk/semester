// Course accessibility review (Semester Faculty "course accessibility review"; S-60 §5). Pure checks over the text an
// instructor publishes: syllabus, materials, assignment descriptions and assessment questions. Unit-tested in
// tests/a11yContent.test.ts. Errors block publishing an assessment; warnings are shown in the review. These are
// heuristics over plain text and markdown: they do not replace a human review of linked files and media.
export type Level = 'error' | 'warning' | 'info';
export type Issue = { level: Level; rule: string; where: string; message: string };

const VAGUE = /\[(\s*(click here|here|link|this|read more|more|this link)\s*)\]\(/i;
const IMG_NO_ALT = /!\[\s*\]\(/;
const MD_LINK = /\[[^\]]*\]\([^)]*\)/g;
const BARE_URL = /(^|\s)https?:\/\/\S+/;
const COLOUR_ONLY = /\b(in|the|marked|highlighted|shown in|coloured|colored) (red|green|blue|yellow|orange|purple|pink)\b/i;
const MEDIA = /(youtube\.com|youtu\.be|vimeo\.com|\.mp4\b|\.mov\b|\.mp3\b)/i;
const CAPTIONS = /\b(caption|captions|captioned|transcript|subtitles)\b/i;

export function checkText(text: string, where: string, opts: { allowBareUrl?: boolean } = {}): Issue[] {
  const out: Issue[] = [];
  if (!text?.trim()) return out;
  if (IMG_NO_ALT.test(text)) out.push({ level: 'error', rule: 'image-alt', where, message: 'An image has no alt text. Describe what it shows inside the brackets: ![description](…).' });
  if (VAGUE.test(text)) out.push({ level: 'warning', rule: 'link-text', where, message: 'A link says “click here” or similar. Name where it goes instead.' });
  if (!opts.allowBareUrl && BARE_URL.test(text.replace(MD_LINK, ''))) out.push({ level: 'warning', rule: 'bare-url', where, message: 'A bare web address is read aloud character by character. Use a descriptive link: [Reading list](https://…).' });
  const levels = text.split('\n').map((l) => l.match(/^(#{1,6})\s/)?.[1].length).filter((n): n is number => !!n);
  if (levels.some((l, i) => i > 0 && l > levels[i - 1] + 1) || (levels.length > 0 && levels[0] > 2)) out.push({ level: 'warning', rule: 'heading-order', where, message: 'Headings skip a level. Go from # to ## to ###, without jumps.' });
  if (/\b([A-Z]{3,}\s+){3,}[A-Z]{3,}\b/.test(text)) out.push({ level: 'warning', rule: 'all-caps', where, message: 'Long runs of capital letters are hard to read and may be spelled out by screen readers. Use bold or a heading.' });
  if (COLOUR_ONLY.test(text)) out.push({ level: 'warning', rule: 'colour-only', where, message: 'Instructions refer to a colour. Add a word or symbol so they work without seeing colour.' });
  if (MEDIA.test(text) && !CAPTIONS.test(text)) out.push({ level: 'warning', rule: 'media-captions', where, message: 'Video or audio is linked without mentioning captions or a transcript. Provide one.' });
  if (text.split(/\n\s*\n/).some((p) => p.length > 1200)) out.push({ level: 'info', rule: 'long-paragraph', where, message: 'A paragraph is over 1,200 characters. Break it up or add headings.' });
  return out;
}

export function checkQuestions(qs: { prompt: string; options: string[] }[], where: string): Issue[] {
  const out: Issue[] = [];
  qs.forEach((q, i) => {
    const w = `${where}, question ${i + 1}`;
    out.push(...checkText(q.prompt, w));
    q.options.forEach((o, k) => { if (IMG_NO_ALT.test(o)) out.push({ level: 'error', rule: 'image-alt', where: `${w}, option ${k + 1}`, message: 'An answer option is an image with no alt text.' }); });
    const norm = q.options.map((o) => o.trim().toLowerCase());
    if (new Set(norm).size !== norm.length) out.push({ level: 'warning', rule: 'duplicate-option', where: w, message: 'Two answer options read the same to a screen reader.' });
  });
  return out;
}

export const summary = (issues: Issue[]) => ({ errors: issues.filter((i) => i.level === 'error').length, warnings: issues.filter((i) => i.level === 'warning').length, info: issues.filter((i) => i.level === 'info').length });
