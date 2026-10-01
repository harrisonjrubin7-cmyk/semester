/**
 * QTI 3 import and export for the question kinds the server holds
 * (`20261001030000_assessments.sql`): a choice, a set of choices, true or
 * false, a number, a short text and an essay.
 *
 * `docs/QTI-3-ASSESSMENT-AND-MIGRATION.md` is the design; this is the part that
 * is built. Every interaction it does not understand is *omitted with a
 * warning that names it*, never guessed at: a migration that quietly turned a
 * matching question into something else would be worse than one that said so.
 * Nothing is sent anywhere here; the caller shows the warnings and chooses.
 */

export type ItemKind = 'multiple_choice' | 'multiple_response' | 'true_false' | 'numeric' | 'short_answer' | 'essay';

export interface QtiItem {
  kind: ItemKind;
  stem: string;
  options: { id: string; text: string }[];
  /** The server's key shape for the kind. */
  key: Record<string, unknown>;
  points: number;
}

export interface Imported {
  items: QtiItem[];
  warnings: string[];
}

const NS = 'http://www.imsglobal.org/xsd/imsqtiasi_v3p0';
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const SAFE_ID = /[^A-Za-z0-9_-]/g;

/** One assessmentItem document per item. */
export function exportItem(item: QtiItem, n: number): { name: string; xml: string } {
  const id = `item-${n}`;
  const head = `<?xml version="1.0" encoding="UTF-8"?>\n<qti-assessment-item xmlns="${NS}" identifier="${id}" title="${esc(item.stem.slice(0, 60))}" adaptive="false" time-dependent="false">\n`;
  let decl = '';
  let body = '';
  const points = `  <qti-outcome-declaration identifier="MAXSCORE" cardinality="single" base-type="float"><qti-default-value><qti-value>${item.points}</qti-value></qti-default-value></qti-outcome-declaration>\n`;
  const prompt = `<p>${esc(item.stem)}</p>`;
  if (item.kind === 'multiple_choice' || item.kind === 'multiple_response' || item.kind === 'true_false') {
    const opts = item.kind === 'true_false' ? [{ id: 'true', text: 'True' }, { id: 'false', text: 'False' }] : item.options;
    const correct = item.kind === 'multiple_choice' ? [String(item.key.correct)]
      : item.kind === 'true_false' ? [item.key.correct === true ? 'true' : 'false']
      : ((item.key.correct as string[]) ?? []).map(String);
    const multi = item.kind === 'multiple_response';
    decl = `  <qti-response-declaration identifier="RESPONSE" cardinality="${multi ? 'multiple' : 'single'}" base-type="identifier">\n    <qti-correct-response>${correct.map((c) => `<qti-value>${esc(c.replace(SAFE_ID, '_'))}</qti-value>`).join('')}</qti-correct-response>\n  </qti-response-declaration>\n`;
    body = `    ${prompt}\n    <qti-choice-interaction response-identifier="RESPONSE" shuffle="false" max-choices="${multi ? 0 : 1}">\n${opts.map((o) => `      <qti-simple-choice identifier="${esc(o.id.replace(SAFE_ID, '_'))}">${esc(o.text)}</qti-simple-choice>`).join('\n')}\n    </qti-choice-interaction>`;
  } else if (item.kind === 'numeric') {
    decl = `  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="float">\n    <qti-correct-response><qti-value>${Number(item.key.value)}</qti-value></qti-correct-response>\n  </qti-response-declaration>\n`;
    body = `    ${prompt}\n    <qti-text-entry-interaction response-identifier="RESPONSE" expected-length="12"/>`;
  } else if (item.kind === 'short_answer') {
    decl = `  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string">\n    <qti-correct-response>${((item.key.accepted as string[]) ?? []).map((a) => `<qti-value>${esc(a)}</qti-value>`).join('')}</qti-correct-response>\n  </qti-response-declaration>\n`;
    body = `    ${prompt}\n    <qti-text-entry-interaction response-identifier="RESPONSE" expected-length="40"/>`;
  } else {
    decl = `  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string"/>\n`;
    body = `    ${prompt}\n    <qti-extended-text-interaction response-identifier="RESPONSE" expected-lines="8"/>`;
  }
  const xml = `${head}${decl}${points}  <qti-item-body>\n${body}\n  </qti-item-body>\n</qti-assessment-item>\n`;
  return { name: `${id}.xml`, xml };
}

export function exportItems(items: readonly QtiItem[]): { name: string; xml: string }[] {
  return items.map((it, i) => exportItem(it, i + 1));
}

const local = (e: Element): string => e.localName.replace(/^qti-/, '').toLowerCase();
const all = (root: Element | Document, name: string): Element[] =>
  [...root.getElementsByTagName('*')].filter((e) => local(e) === name.replace(/-/g, '').toLowerCase() || local(e) === name.toLowerCase());
const text = (e: Element | null | undefined): string => (e?.textContent ?? '').replace(/\s+/g, ' ').trim();

/** One QTI assessmentItem. Never throws: a document it cannot read is a warning. */
export function importItem(xml: string, source = 'item'): Imported {
  const warnings: string[] = [];
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(xml, 'application/xml');
  } catch {
    return { items: [], warnings: [`${source}: not readable as XML.`] };
  }
  if (doc.getElementsByTagName('parsererror').length > 0) return { items: [], warnings: [`${source}: not readable as XML.`] };
  const root = doc.documentElement;
  if (!root || !/assessment-?item$/i.test(root.localName.replace(/^qti-/, ''))) {
    return { items: [], warnings: [`${source}: not a QTI assessment item (found <${root?.localName ?? 'nothing'}>).`] };
  }
  const interactions = [...root.getElementsByTagName('*')].filter((e) => /interaction$/.test(e.localName));
  if (interactions.length !== 1) {
    return { items: [], warnings: [`${source}: omitted — it has ${interactions.length} interactions and only a single one is supported.`] };
  }
  const inter = interactions[0];
  const kindName = inter.localName.replace(/^qti-/, '').replace(/-/g, '').toLowerCase();
  const body = all(root, 'item-body')[0] ?? root;
  const firstP = [...body.getElementsByTagName('*')].find((e) => e.localName === 'p' && !inter.contains(e));
  const stem = text(firstP) || text(body).slice(0, 5000);
  if (!stem) return { items: [], warnings: [`${source}: omitted — no question text.`] };
  const decl = all(root, 'response-declaration')[0];
  const base = (decl?.getAttribute('base-type') ?? '').toLowerCase();
  const values = decl ? all(decl, 'correct-response').flatMap((c) => all(c, 'value')).map((v) => text(v)) : [];
  const maxScore = all(root, 'outcome-declaration').find((o) => o.getAttribute('identifier') === 'MAXSCORE');
  const pts = Number.parseFloat(text(maxScore ? all(maxScore, 'value')[0] : null));
  const points = Number.isFinite(pts) && pts > 0 ? pts : 1;

  if (kindName === 'choiceinteraction') {
    const options = all(inter, 'simple-choice').map((c) => ({ id: (c.getAttribute('identifier') ?? '').replace(SAFE_ID, '_'), text: text(c) })).filter((o) => o.id && o.text);
    if (options.length < 2) return { items: [], warnings: [`${source}: omitted — fewer than two usable choices.`] };
    const max = Number.parseInt(inter.getAttribute('max-choices') ?? '1', 10);
    const correct = values.map((v) => v.replace(SAFE_ID, '_')).filter((v) => options.some((o) => o.id === v));
    if (correct.length === 0) return { items: [], warnings: [`${source}: omitted — no correct response among its choices.`] };
    const ids = options.map((o) => o.id.toLowerCase()).sort().join();
    if (max === 1 && correct.length === 1 && ids === 'false,true') {
      return { items: [{ kind: 'true_false', stem, options: [], key: { correct: correct[0].toLowerCase() === 'true' }, points }], warnings };
    }
    if (max === 1 && correct.length === 1) return { items: [{ kind: 'multiple_choice', stem, options, key: { correct: correct[0] }, points }], warnings };
    return { items: [{ kind: 'multiple_response', stem, options, key: { correct }, points }], warnings };
  }
  if (kindName === 'textentryinteraction') {
    if (base === 'float' || base === 'integer') {
      const v = Number.parseFloat(values[0] ?? '');
      if (!Number.isFinite(v)) return { items: [], warnings: [`${source}: omitted — no numeric correct response.`] };
      return { items: [{ kind: 'numeric', stem, options: [], key: { value: v, tolerance: 0 }, points }], warnings };
    }
    const accepted = values.filter((v) => v.length > 0);
    if (accepted.length === 0) return { items: [], warnings: [`${source}: omitted — no accepted answer.`] };
    return { items: [{ kind: 'short_answer', stem, options: [], key: { accepted }, points }], warnings };
  }
  if (kindName === 'extendedtextinteraction') return { items: [{ kind: 'essay', stem, options: [], key: {}, points }], warnings };
  return { items: [], warnings: [`${source}: omitted — <${inter.localName}> is not supported (choice, text entry and extended text are).`] };
}

/** Several documents at once; the warnings of all are kept in order. */
export function importItems(docs: readonly { name: string; xml: string }[]): Imported {
  const out: Imported = { items: [], warnings: [] };
  for (const d of docs) {
    const r = importItem(d.xml, d.name);
    out.items.push(...r.items);
    out.warnings.push(...r.warnings);
  }
  return out;
}
