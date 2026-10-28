// Spreadsheet: a small, safe formula engine (no eval), CSV in/out and a real .xlsx writer. Pure functions only.
export const MAX_ROWS = 200;
export const MAX_COLS = 26;
export type Grid = string[][]; // raw cell input: text, number, or "=formula"
export type Value = number | string | { error: string };
export const isErr = (v: Value): v is { error: string } => typeof v === 'object';

export const colName = (c: number) => String.fromCharCode(65 + c);
export const ref = (r: number, c: number) => `${colName(c)}${r + 1}`;
export function parseRef(s: string): { r: number; c: number } | null {
  const m = /^\$?([A-Z])\$?(\d{1,3})$/.exec(s.toUpperCase());
  if (!m) return null;
  const r = Number(m[2]) - 1; const c = m[1].charCodeAt(0) - 65;
  return r >= 0 && r < MAX_ROWS && c < MAX_COLS ? { r, c } : null;
}
export function blankGrid(rows = 20, cols = 8): Grid { return Array.from({ length: rows }, () => Array(cols).fill('')); }

type Tok = { t: 'num'; v: number } | { t: 'str'; v: string } | { t: 'ref'; v: string } | { t: 'range'; a: string; b: string } | { t: 'fn'; v: string } | { t: 'op'; v: string } | { t: '(' } | { t: ')' } | { t: ',' };
function lex(src: string): Tok[] {
  const out: Tok[] = []; let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) { i++; continue; }
    const num = /^\d+(\.\d+)?([eE][+-]?\d+)?|^\.\d+/.exec(src.slice(i));
    if (num) { out.push({ t: 'num', v: Number(num[0]) }); i += num[0].length; continue; }
    if (ch === '"') { let j = i + 1; let s = ''; while (j < src.length && !(src[j] === '"' && src[j + 1] !== '"')) { if (src[j] === '"') j++; s += src[j]; j++; } if (j >= src.length) throw new Error('#VALUE!'); out.push({ t: 'str', v: s }); i = j + 1; continue; }
    const rg = /^\$?[A-Za-z]\$?\d{1,3}:\$?[A-Za-z]\$?\d{1,3}/.exec(src.slice(i));
    if (rg) { const [a, b] = rg[0].split(':'); out.push({ t: 'range', a, b }); i += rg[0].length; continue; }
    const id = /^[A-Za-z][A-Za-z0-9]*/.exec(src.slice(i));
    if (id) {
      const after = src.slice(i + id[0].length).trimStart();
      if (after.startsWith('(')) out.push({ t: 'fn', v: id[0].toUpperCase() });
      else if (/^\$?[A-Za-z]\$?\d{1,3}$/.test(id[0])) out.push({ t: 'ref', v: id[0] });
      else if (/^(TRUE|FALSE)$/i.test(id[0])) out.push({ t: 'num', v: /^TRUE$/i.test(id[0]) ? 1 : 0 });
      else throw new Error('#NAME?');
      i += id[0].length; continue;
    }
    if (src[i] === '$') { const r2 = /^\$[A-Za-z]\$?\d{1,3}/.exec(src.slice(i)); if (r2) { out.push({ t: 'ref', v: r2[0] }); i += r2[0].length; continue; } }
    const op = /^(<=|>=|<>|[-+*/^&=<>%])/.exec(src.slice(i));
    if (op) { out.push({ t: 'op', v: op[0] }); i += op[0].length; continue; }
    if (ch === '(') { out.push({ t: '(' }); i++; continue; }
    if (ch === ')') { out.push({ t: ')' }); i++; continue; }
    if (ch === ',' || ch === ';') { out.push({ t: ',' }); i++; continue; }
    throw new Error('#VALUE!');
  }
  return out;
}

type Ctx = { cell: (r: number, c: number) => Value };
const num = (v: Value): number => { if (isErr(v)) throw new Error(v.error); if (typeof v === 'number') return v; if (v.trim() === '') return 0; const n = Number(v); if (Number.isNaN(n)) throw new Error('#VALUE!'); return n; };
const flatNums = (args: (Value | Value[])[]) => args.flatMap((a) => (Array.isArray(a) ? a.filter((x) => typeof x === 'number' || isErr(x)) : [a])).map(num);

const FNS: Record<string, (a: (Value | Value[])[]) => Value> = {
  SUM: (a) => flatNums(a).reduce((s, x) => s + x, 0),
  AVERAGE: (a) => { const x = flatNums(a); if (!x.length) throw new Error('#DIV/0!'); return x.reduce((s, y) => s + y, 0) / x.length; },
  MIN: (a) => { const x = flatNums(a); return x.length ? Math.min(...x) : 0; },
  MAX: (a) => { const x = flatNums(a); return x.length ? Math.max(...x) : 0; },
  COUNT: (a) => a.flatMap((x) => (Array.isArray(x) ? x : [x])).filter((x) => typeof x === 'number').length,
  MEDIAN: (a) => { const x = flatNums(a).sort((p, q) => p - q); if (!x.length) throw new Error('#NUM!'); const m = Math.floor(x.length / 2); return x.length % 2 ? x[m] : (x[m - 1] + x[m]) / 2; },
  STDEV: (a) => { const x = flatNums(a); if (x.length < 2) throw new Error('#DIV/0!'); const m = x.reduce((s, y) => s + y, 0) / x.length; return Math.sqrt(x.reduce((s, y) => s + (y - m) ** 2, 0) / (x.length - 1)); },
  ROUND: (a) => { const f = 10 ** num(one(a[1] ?? 0)); return Math.round(num(one(a[0])) * f) / f; },
  ABS: (a) => Math.abs(num(one(a[0]))),
  SQRT: (a) => { const x = num(one(a[0])); if (x < 0) throw new Error('#NUM!'); return Math.sqrt(x); },
  IF: (a) => (num(one(a[0])) !== 0 ? one(a[1] ?? 1) : one(a[2] ?? 0)),
};
function one(v: Value | Value[]): Value { if (Array.isArray(v)) throw new Error('#VALUE!'); return v; }

function parse(toks: Tok[], ctx: Ctx): Value {
  let p = 0;
  const peek = () => toks[p];
  const isOp = (...ops: string[]) => { const t = peek(); return !!t && t.t === 'op' && ops.includes(t.v); };
  const range = (a: string, b: string): Value[] => {
    const x = parseRef(a); const y = parseRef(b); if (!x || !y) throw new Error('#REF!');
    const out: Value[] = [];
    for (let r = Math.min(x.r, y.r); r <= Math.max(x.r, y.r); r++) for (let c = Math.min(x.c, y.c); c <= Math.max(x.c, y.c); c++) out.push(ctx.cell(r, c));
    return out;
  };
  const primary = (): Value | Value[] => {
    const t = toks[p++];
    if (!t) throw new Error('#VALUE!');
    if (t.t === 'num' || t.t === 'str') return t.v;
    if (t.t === 'ref') { const x = parseRef(t.v); if (!x) throw new Error('#REF!'); const v = ctx.cell(x.r, x.c); if (isErr(v)) throw new Error(v.error); return v === '' ? 0 : v; }
    if (t.t === 'range') return range(t.a, t.b);
    if (t.t === 'op' && (t.v === '-' || t.v === '+')) { const v = num(one(power())); return t.v === '-' ? -v : v; }
    if (t.t === '(') { const v = compare(); if (toks[p++]?.t !== ')') throw new Error('#VALUE!'); return v; }
    if (t.t === 'fn') {
      const f = FNS[t.v]; if (!f) throw new Error('#NAME?');
      p++; const args: (Value | Value[])[] = [];
      if (peek()?.t !== ')') { args.push(compareOrRange()); while (peek()?.t === ',') { p++; args.push(compareOrRange()); } }
      if (toks[p++]?.t !== ')') throw new Error('#VALUE!');
      return f(args);
    }
    throw new Error('#VALUE!');
  };
  const compareOrRange = (): Value | Value[] => (peek()?.t === 'range' && (toks[p + 1]?.t === ',' || toks[p + 1]?.t === ')') ? range((toks[p] as { a: string }).a, (toks[p++] as { b: string }).b) : compare());
  const postfix = (): Value | Value[] => { let v = primary(); while (isOp('%')) { p++; v = num(one(v)) / 100; } return v; };
  const power = (): Value | Value[] => { const b = postfix(); if (isOp('^')) { p++; return num(one(b)) ** num(one(power())); } return b; };
  const term = (): Value => { let v = one(power()); while (isOp('*', '/')) { const o = (toks[p++] as { v: string }).v; const r = num(one(power())); if (o === '/' && r === 0) throw new Error('#DIV/0!'); v = o === '*' ? num(v) * r : num(v) / r; } return v; };
  const sum = (): Value => { let v = term(); while (isOp('+', '-')) { const o = (toks[p++] as { v: string }).v; const r = num(term()); v = o === '+' ? num(v) + r : num(v) - r; } return v; };
  const concat = (): Value => { let v = sum(); while (isOp('&')) { p++; const r = sum(); v = `${show(v)}${show(r)}`; } return v; };
  const compare = (): Value => {
    const l = concat();
    if (isOp('=', '<>', '<', '>', '<=', '>=')) {
      const o = (toks[p++] as { v: string }).v; const r = concat();
      const [a, b] = typeof l === 'number' && typeof r === 'number' ? [l, r] : [show(l).toLowerCase(), show(r).toLowerCase()];
      return ({ '=': a === b, '<>': a !== b, '<': a < b, '>': a > b, '<=': a <= b, '>=': a >= b } as Record<string, boolean>)[o] ? 1 : 0;
    }
    return l;
  };
  const v = compare();
  if (p !== toks.length) throw new Error('#VALUE!');
  return v;
}

export function show(v: Value): string {
  if (isErr(v)) return v.error;
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Number(v.toPrecision(12)));
  return v;
}

/** Evaluate every cell. Cycles give #CYCLE!; errors propagate. */
export function evaluate(grid: Grid): Value[][] {
  const memo = new Map<string, Value>(); const visiting = new Set<string>();
  const cell = (r: number, c: number): Value => {
    const k = `${r},${c}`;
    if (memo.has(k)) return memo.get(k)!;
    if (visiting.has(k)) return { error: '#CYCLE!' };
    const raw = grid[r]?.[c] ?? '';
    let v: Value;
    if (raw.startsWith('=')) {
      visiting.add(k);
      try { v = parse(lex(raw.slice(1)), { cell }); if (typeof v === 'number' && !Number.isFinite(v)) v = { error: '#NUM!' }; } catch (e) { v = { error: e instanceof Error && /^#/.test(e.message) ? e.message : '#VALUE!' }; }
      visiting.delete(k);
    } else v = raw.trim() !== '' && !Number.isNaN(Number(raw)) ? Number(raw) : raw;
    memo.set(k, v);
    return v;
  };
  return grid.map((row, r) => row.map((_, c) => cell(r, c)));
}

/** Values out as CSV. Text that a spreadsheet would run as a formula is prefixed with ' (CSV injection). */
export function toCsv(grid: Grid): string {
  const vals = evaluate(grid);
  const last = (row: string[]) => { let n = row.length; while (n > 0 && row[n - 1] === '') n--; return n; };
  const rows = vals.map((r) => r.map(show));
  let h = rows.length; while (h > 0 && last(rows[h - 1]) === 0) h--;
  const w = Math.max(0, ...rows.slice(0, h).map(last));
  return rows.slice(0, h).map((r) => r.slice(0, w).map((s) => {
    const safe = /^[=+\-@\t\r]/.test(s) && Number.isNaN(Number(s)) ? `'${s}` : s;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  }).join(',')).join('\n') + (h ? '\n' : '');
}

export function fromCsv(text: string): Grid {
  const rows: string[][] = []; let row: string[] = []; let f = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { f += '"'; i++; } else if (ch === '"') q = false; else f += ch; continue; }
    if (ch === '"') q = true; else if (ch === ',') { row.push(f); f = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; } else f += ch;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  const g = rows.slice(0, MAX_ROWS).map((r) => r.slice(0, MAX_COLS).map((s) => (s.startsWith('=') ? `'${s}` : s))); // imported text never runs as a formula
  const w = Math.max(8, ...g.map((r) => r.length));
  while (g.length < 20) g.push([]);
  return g.map((r) => [...r, ...Array(w - r.length).fill('')]);
}

// --- .xlsx (Office Open XML) writer: stored zip, no dependency ---
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export function crc32(b: Uint8Array): number { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
export function zip(files: { name: string; data: Uint8Array }[]): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder(); const parts: Uint8Array[] = []; const central: Uint8Array[] = []; let off = 0;
  const u16 = (v: number) => [v & 0xff, (v >>> 8) & 0xff]; const u32 = (v: number) => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];
  for (const f of files) {
    const nm = enc.encode(f.name); const crc = crc32(f.data); const sz = f.data.length;
    const head = new Uint8Array([...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(sz), ...u32(sz), ...u16(nm.length), ...u16(0), ...nm]);
    parts.push(head, f.data);
    central.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(sz), ...u32(sz), ...u16(nm.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off), ...nm]));
    off += head.length + sz;
  }
  const cdSize = central.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(cdSize), ...u32(off), ...u16(0)]);
  const all = [...parts, ...central, end]; const out = new Uint8Array(all.reduce((s, a) => s + a.length, 0)); let p = 0;
  for (const a of all) { out.set(a, p); p += a.length; }
  return out;
}
const xml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as Record<string, string>)[c]).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
export function toXlsx(grid: Grid, sheetName = 'Sheet1'): Uint8Array<ArrayBuffer> {
  const vals = evaluate(grid); const enc = new TextEncoder();
  const rows = grid.map((row, r) => {
    const cells = row.map((raw, c) => {
      if (raw === '') return '';
      const v = vals[r][c]; const at = ref(r, c);
      const f = raw.startsWith('=') ? `<f>${xml(raw.slice(1))}</f>` : '';
      if (isErr(v)) return `<c r="${at}" t="e">${f}<v>${xml(v.error === '#CYCLE!' ? '#REF!' : v.error)}</v></c>`;
      if (typeof v === 'number') return `<c r="${at}">${f}<v>${v}</v></c>`;
      return f ? `<c r="${at}" t="str">${f}<v>${xml(v)}</v></c>` : `<c r="${at}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
    }).join('');
    return cells ? `<row r="${r + 1}">${cells}</row>` : '';
  }).join('');
  const name = xml(sheetName.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Sheet1');
  const files: Record<string, string> = {
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${name}" sheetId="1" r:id="rId1"/></sheets><calcPr fullCalcOnLoad="1"/></workbook>`,
    'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`,
  };
  return zip(Object.entries(files).map(([n, s]) => ({ name: n, data: enc.encode(s) })));
}
