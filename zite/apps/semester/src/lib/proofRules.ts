// Check the writing: deterministic checks on the student's own text. Nothing is sent anywhere; no model.
// Spelling here covers a list of common misspellings only; the editor also turns on the browser's own spellcheck.
export type Kind = 'spelling' | 'grammar' | 'style' | 'punctuation' | 'quote';
export type Issue = { kind: Kind; start: number; end: number; text: string; message: string; suggestion?: string };

const MISSPELLED: Record<string, string> = {
  accomodate: 'accommodate', acheive: 'achieve', accross: 'across', agressive: 'aggressive', apparant: 'apparent', arguement: 'argument',
  basicly: 'basically', begining: 'beginning', beleive: 'believe', buisness: 'business', calender: 'calendar', catagory: 'category',
  commited: 'committed', concious: 'conscious', definately: 'definitely', dependant: 'dependent', desparate: 'desperate', dilemna: 'dilemma',
  dissapoint: 'disappoint', embarass: 'embarrass', enviroment: 'environment', existance: 'existence', experiance: 'experience', familar: 'familiar',
  finaly: 'finally', foriegn: 'foreign', fourty: 'forty', freind: 'friend', goverment: 'government', gaurd: 'guard', happend: 'happened',
  harrass: 'harass', heirarchy: 'hierarchy', humourous: 'humorous', idependent: 'independent', immediatly: 'immediately', independant: 'independent',
  knowlege: 'knowledge', liason: 'liaison', libary: 'library', lisence: 'license', maintainance: 'maintenance', millenium: 'millennium',
  mischevious: 'mischievous', neccessary: 'necessary', necesary: 'necessary', noticable: 'noticeable', occassion: 'occasion', occured: 'occurred',
  occurence: 'occurrence', ocurred: 'occurred', paralel: 'parallel', parliment: 'parliament', persue: 'pursue', posession: 'possession',
  prefered: 'preferred', privelege: 'privilege', probaly: 'probably', publically: 'publicly', recieve: 'receive', recieved: 'received',
  reccomend: 'recommend', recomend: 'recommend', refered: 'referred', relevent: 'relevant', religous: 'religious', remeber: 'remember',
  repitition: 'repetition', resistence: 'resistance', responsability: 'responsibility', rythm: 'rhythm', seperate: 'separate', sieze: 'seize',
  similiar: 'similar', sincerly: 'sincerely', speach: 'speech', succesful: 'successful', successfull: 'successful', supercede: 'supersede',
  suprise: 'surprise', tendancy: 'tendency', therefor: 'therefore', threshhold: 'threshold', tommorow: 'tomorrow', tounge: 'tongue',
  truely: 'truly', untill: 'until', usefull: 'useful', vaccuum: 'vacuum', wierd: 'weird', wich: 'which', writting: 'writing', alot: 'a lot',
  analize: 'analyze', arguemnt: 'argument', comparitive: 'comparative', consensus: 'consensus', concensus: 'consensus', critisism: 'criticism',
  developement: 'development', econimic: 'economic', effeciency: 'efficiency', equiptment: 'equipment', explaination: 'explanation',
  hypocracy: 'hypocrisy', inflaton: 'inflation', intrest: 'interest', judgement: 'judgment', longitudenal: 'longitudinal', marketting: 'marketing',
  methology: 'methodology', occuring: 'occurring', percieve: 'perceive', phenomenom: 'phenomenon', politican: 'politician', sentance: 'sentence',
  significent: 'significant', statisical: 'statistical', strategical: 'strategic', theoritical: 'theoretical', transfered: 'transferred',
};
const NOT_WORDS: [RegExp, string, string][] = [
  [/\b(could|should|would|must|might) of\b/gi, '$1 have', 'Use “have” after could/should/would.'],
  [/\birregardless\b/gi, 'regardless', '“Irregardless” is nonstandard in academic writing.'],
  [/\bfor all intensive purposes\b/gi, 'for all intents and purposes', 'Common mishearing.'],
  [/\bcase and point\b/gi, 'case in point', 'Common mishearing.'],
  [/\bi\b(?=[\s,.;:!?'’])/g, 'I', 'Capitalise “I”.'],
  [/\ba(?=\s+[aeiou]\w)/gi, 'an', '“an” before a vowel sound (check: “a university” is right).'],
];
const WORDY: [string, string][] = [
  ['in order to', 'to'], ['due to the fact that', 'because'], ['at this point in time', 'now'], ['in spite of the fact that', 'although'],
  ['for the purpose of', 'to'], ['in the event that', 'if'], ['has the ability to', 'can'], ['is able to', 'can'], ['a large number of', 'many'],
  ['the fact that', '(often removable)'], ['it is important to note that', '(cut, or say why)'], ['in today\'s society', '(be specific)'],
  ['each and every', 'each'], ['first and foremost', 'first'], ['basically', '(cut)'], ['very unique', 'unique'], ['in conclusion', '(often unnecessary)'],
];
const BE = '(?:am|is|are|was|were|be|been|being)';
const IRREG = 'built|done|given|known|made|seen|shown|taken|written|found|held|left|lost|paid|sent|told|thought|brought|bought|caught|chosen|driven|eaten|forgotten|hidden|ridden|spoken|stolen|won|run|set|put|cut';

export function sentences(text: string): { start: number; end: number; text: string }[] {
  const out: { start: number; end: number; text: string }[] = [];
  const re = /[^.!?\n]+(?:[.!?]+["”’)]*|\n|$)/g; let m: RegExpExecArray | null;
  while ((m = re.exec(text))) { if (!m[0].trim()) { if (m[0] === '') re.lastIndex++; continue; } const lead = m[0].length - m[0].trimStart().length; out.push({ start: m.index + lead, end: m.index + m[0].trimEnd().length, text: m[0].trim() }); if (re.lastIndex === m.index) re.lastIndex++; }
  return out;
}
export const wordsOf = (s: string) => s.match(/[A-Za-zÀ-ɏ]+(?:['’][A-Za-z]+)?|\d+(?:[.,]\d+)*/g) ?? [];
export function syllables(w: string): number {
  const x = w.toLowerCase().replace(/[^a-z]/g, ''); if (!x) return 0; if (x.length <= 3) return 1;
  const v = x.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '').match(/[aeiouy]{1,2}/g);
  return Math.max(1, v ? v.length : 1);
}
/** Flesch–Kincaid grade level; null when there is too little text to say. */
export function grade(text: string): number | null {
  const ss = sentences(text).filter((s) => wordsOf(s.text).length); const ws = ss.flatMap((s) => wordsOf(s.text));
  if (ws.length < 30) return null;
  const syl = ws.reduce((t, w) => t + syllables(w), 0);
  return Math.round((0.39 * (ws.length / ss.length) + 11.8 * (syl / ws.length) - 15.59) * 10) / 10;
}

export function check(text: string): Issue[] {
  const out: Issue[] = [];
  const add = (kind: Kind, start: number, len: number, message: string, suggestion?: string) => out.push({ kind, start, end: start + len, text: text.slice(start, start + len), message, suggestion });
  let m: RegExpExecArray | null;
  const wre = /[A-Za-z]+/g;
  while ((m = wre.exec(text))) { const fix = MISSPELLED[m[0].toLowerCase()]; if (fix && fix !== m[0].toLowerCase()) add('spelling', m.index, m[0].length, 'Common misspelling.', /^[A-Z]/.test(m[0]) ? fix[0].toUpperCase() + fix.slice(1) : fix); }
  const rep = /\b([A-Za-z]+)\s+\1\b/gi;
  while ((m = rep.exec(text))) { if (!/^(had|that|is)$/i.test(m[1])) add('grammar', m.index, m[0].length, 'Repeated word.', m[1]); }
  for (const [re, fix, why] of NOT_WORDS) { const r = new RegExp(re.source, re.flags); while ((m = r.exec(text))) { if (fix === 'an' && /^a\s+(uni|use|usu|one|eu|ur)/i.test(text.slice(m.index, m.index + 8))) continue; add('grammar', m.index, m[0].length, why, fix.includes('$') ? m[0].replace(new RegExp(re.source, re.flags.replace('g', '')), fix) : fix); } }
  for (const [phrase, fix] of WORDY) { const r = new RegExp(`\\b${phrase.replace(/'/g, "['’]")}\\b`, 'gi'); while ((m = r.exec(text))) add('style', m.index, m[0].length, 'Wordy phrase.', fix); }
  const pas = new RegExp(`\\b${BE}\\s+(?:\\w+ly\\s+)?(\\w+ed|${IRREG})\\b(?:\\s+by\\b)?`, 'gi');
  while ((m = pas.exec(text))) { if (/\bby\b/i.test(m[0]) || !/^(?:tired|interested|excited|concerned|involved|based|located|used|supposed|related|married|prepared|pleased|surprised)$/i.test(m[1])) add('style', m.index, m[0].length, 'Possible passive voice — fine in methods sections; check who is doing the action.'); }
  for (const s of sentences(text)) {
    const n = wordsOf(s.text).length;
    if (n > 35) add('style', s.start, s.end - s.start, `Long sentence (${n} words). Consider splitting it.`);
    const first = /[A-Za-z]/.exec(s.text);
    if (first && /[a-z]/.test(first[0]) && first.index === 0 && !/^(e\.g|i\.e|etc|vs|cf)\b/.test(s.text)) add('grammar', s.start, 1, 'Sentence starts with a lower-case letter.', first[0].toUpperCase());
  }
  const sp = /[^\S\n]{2,}(?=\S)/g; while ((m = sp.exec(text))) if (m.index > 0 && text[m.index - 1] !== '\n') add('punctuation', m.index, m[0].length, 'Extra space.', ' ');
  const bp = /[^\S\n]+([,.;:!?])(?=\s|$|[A-Za-z])/g; while ((m = bp.exec(text))) add('punctuation', m.index, m[0].length, 'Space before punctuation.', m[1]);
  const ap = /([,;:])(?=[A-Za-z])/g; while ((m = ap.exec(text))) if (!/\d/.test(text[m.index - 1] ?? '') && !/https?$/.test(text.slice(Math.max(0, m.index - 5), m.index))) add('punctuation', m.index, 1, 'Add a space after punctuation.', `${m[1]} `);
  const pairs: [string, string, string][] = [['(', ')', 'parenthesis'], ['“', '”', 'quotation mark'], ['[', ']', 'bracket']];
  for (const [o, c, name] of pairs) { const a = text.split(o).length - 1; const b = text.split(c).length - 1; if (a !== b) { const at = a > b ? text.lastIndexOf(o) : text.lastIndexOf(c); add('punctuation', Math.max(0, at), 1, `Unmatched ${name}.`); } }
  if ((text.match(/"/g) ?? []).length % 2) { const at = text.lastIndexOf('"'); add('punctuation', at, 1, 'Unmatched quotation mark.'); }
  return out.sort((p, q) => p.start - q.start || p.end - q.end).filter((x, i, a) => !a.slice(0, i).some((y) => y.kind === x.kind && y.start === x.start && y.end === x.end));
}

// ---------- quotations ----------
export type Quote = { start: number; end: number; text: string; citation: string | null };
export type QuoteResult = Quote & { found: 'exact' | 'close' | 'missing' | 'no-source'; closest?: string; cited: 'in-sources' | 'not-in-sources' | 'none' };
const norm = (s: string) => s.toLowerCase().replace(/[‘’`]/g, "'").replace(/[“”]/g, '"').replace(/[^\p{L}\p{N}'\s]/gu, ' ').replace(/\s+/g, ' ').trim();

/** Quotations of 4+ words in "…" or “…”, with a parenthetical (Author, Year) or [n] citation if one follows within 80 characters. */
export function quotes(text: string): Quote[] {
  const out: Quote[] = []; const re = /“([^”]{3,})”|"([^"]{3,})"/g; let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const q = (m[1] ?? m[2])!; if (wordsOf(q).length < 4) continue;
    const after = text.slice(re.lastIndex, re.lastIndex + 80);
    const c = /^[^.!?]*?(\(([^()]*\b\d{4}[a-z]?\b[^()]*)\)|\[(\d+(?:[,–-]\s*\d+)*)\])/.exec(after);
    out.push({ start: m.index, end: re.lastIndex, text: q, citation: c ? (c[2] ?? c[3])! : null });
  }
  return out;
}
/** Is the quote word-for-word in the source text? "..." / "…" in the quote may stand for skipped words. */
export function findQuote(q: string, source: string): { found: 'exact' | 'close' | 'missing'; closest?: string } {
  const src = norm(source);
  const parts = q.split(/\s*(?:\.\.\.|…)\s*/).map(norm).filter(Boolean);
  if (parts.length && (() => { let at = 0; for (const p of parts) { const i = src.indexOf(p, at); if (i < 0) return false; at = i + p.length; } return true; })()) return { found: 'exact' };
  const qw = norm(q.replace(/\.\.\.|…/g, ' ')).split(' '); const sw = src.split(' ');
  if (!qw.length || sw.length < qw.length) return { found: 'missing' };
  let best = 0; let bestAt = 0;
  for (let i = 0; i + qw.length <= sw.length; i++) {
    let same = 0; const win = new Map<string, number>();
    for (let k = 0; k < qw.length; k++) win.set(sw[i + k], (win.get(sw[i + k]) ?? 0) + 1);
    for (const w of qw) { const n = win.get(w) ?? 0; if (n > 0) { same++; win.set(w, n - 1); } }
    if (same > best) { best = same; bestAt = i; }
  }
  return best / qw.length >= 0.8 ? { found: 'close', closest: sw.slice(bestAt, bestAt + qw.length).join(' ') } : { found: 'missing' };
}
/** (Akerlof, 1970) or (Smith & Jones 2019, p. 4) → is that surname + year among the student's Sources? */
export function citedInSources(citation: string, sources: { authors: string[]; year: string }[]): boolean {
  const year = /\b(\d{4})[a-z]?\b/.exec(citation)?.[1]; if (!year) return false;
  const names = citation.replace(/\b\d{4}[a-z]?\b.*$/, '').split(/,|&|\band\b|et al\.?/).map((n) => n.trim().toLowerCase()).filter((n) => /[a-z]/.test(n));
  if (!names.length) return false;
  return sources.some((s) => s.year.startsWith(year) && names.every((n) => s.authors.some((a) => a.toLowerCase().split(/[\s,]+/).includes(n.split(/\s+/).pop()!))));
}
export function checkQuotes(text: string, sourceText: string, sources: { authors: string[]; year: string }[]): QuoteResult[] {
  return quotes(text).map((q) => {
    const f = sourceText.trim() ? findQuote(q.text, sourceText) : { found: 'no-source' as const };
    const cited = q.citation === null ? 'none' : /^\d/.test(q.citation) ? 'in-sources' : citedInSources(q.citation, sources) ? 'in-sources' : 'not-in-sources';
    return { ...q, ...f, cited } as QuoteResult;
  });
}
