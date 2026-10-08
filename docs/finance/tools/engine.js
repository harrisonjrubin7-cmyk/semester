/* A small spreadsheet engine for the finance workbook.
 *
 * It evaluates the workbook's own formulas (exported by export_model.py), so a change made in the dashboard runs
 * through the same arithmetic as the spreadsheet rather than through a second copy of the model. It implements only
 * the 21 functions the workbook uses; anything else evaluates to #NAME? and engine_parity.js fails.
 *
 * Model(data): data = { sheetName: { "A1": number | string | boolean | "=formula" } }
 *   m.get(sheet, "D3")          value of one cell
 *   m.set(sheet, "D3", value, keepCache)  change an input (clears the cache unless keepCache; call m.clear() after a batch)
 *   m.raw_(sheet, "D3")        the stored value or formula text
 *   m.range(sheet, "D8:O8")     array of values
 * Values: number, string, boolean, null (blank) or an Err.
 */
(function (root) {
  'use strict';
  class Err { constructor(code) { this.code = code; } toString() { return this.code; } }
  const isErr = (v) => v instanceof Err;
  const ERR = (c) => new Err(c);
  class Arr { constructor(rows) { this.rows = rows; this.h = rows.length; this.w = rows.length ? rows[0].length : 0; } }

  function colNum(s) { let n = 0; for (const ch of s) n = n * 26 + ch.charCodeAt(0) - 64; return n; }
  function colName(n) { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }
  function parseAddr(a) { const m = /^\$?([A-Z]{1,3})\$?(\d+)$/.exec(a); if (!m) throw new Error('bad address ' + a); return [+m[2], colNum(m[1])]; }

  // ---------- tokenizer and parser
  const REF = /^(?:(?:'((?:[^']|'')+)'|([A-Za-z_][A-Za-z0-9_.]*))!)?\$?([A-Z]{1,3})\$?(\d+)(?::\$?([A-Z]{1,3})\$?(\d+))?(?![A-Za-z0-9_(])/;
  const FN = /^[A-Za-z_][A-Za-z0-9_.]*(?=\()/;
  const NUM = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/;

  function tokenize(src) {
    const out = []; let i = 0;
    while (i < src.length) {
      const ch = src[i];
      if (ch === ' ' || ch === '\t' || ch === '\n') { i++; continue; }
      if (ch === '"') {
        let j = i + 1, s = '';
        for (;;) {
          if (j >= src.length) throw new Error('unterminated string');
          if (src[j] === '"') { if (src[j + 1] === '"') { s += '"'; j += 2; continue; } break; }
          s += src[j++];
        }
        out.push({ t: 'str', v: s }); i = j + 1; continue;
      }
      const rest = src.slice(i);
      let m;
      if ((m = FN.exec(rest))) { out.push({ t: 'fn', v: m[0].replace(/^_xlfn\./, '').toUpperCase() }); i += m[0].length; continue; }
      if ((m = REF.exec(rest))) {
        const sheet = m[1] ? m[1].replace(/''/g, "'") : (m[2] || null);
        out.push(m[5] ? { t: 'range', sheet, c1: colNum(m[3]), r1: +m[4], c2: colNum(m[5]), r2: +m[6] }
          : { t: 'ref', sheet, c: colNum(m[3]), r: +m[4] });
        i += m[0].length; continue;
      }
      if ((m = NUM.exec(rest))) { out.push({ t: 'num', v: parseFloat(m[0]) }); i += m[0].length; continue; }
      if ((m = /^(TRUE|FALSE)(?![A-Za-z0-9_])/i.exec(rest))) { out.push({ t: 'bool', v: m[1].toUpperCase() === 'TRUE' }); i += m[0].length; continue; }
      if ((m = /^(<=|>=|<>|[-+*\/^&=<>(),:])/.exec(rest))) { out.push({ t: 'op', v: m[0] }); i += m[0].length; continue; }
      throw new Error('cannot tokenize at: ' + rest.slice(0, 20));
    }
    return out;
  }

  function parse(src) {
    const toks = tokenize(src); let p = 0;
    const peek = () => toks[p], isOp = (v) => toks[p] && toks[p].t === 'op' && toks[p].v === v;
    function expect(v) { if (!isOp(v)) throw new Error('expected ' + v + ' in ' + src); p++; }
    function cmp() {
      let l = cat();
      while (toks[p] && toks[p].t === 'op' && ['=', '<>', '<', '>', '<=', '>='].includes(toks[p].v)) { const op = toks[p++].v; l = { n: 'bin', op, l, r: cat() }; }
      return l;
    }
    function cat() { let l = add(); while (isOp('&')) { p++; l = { n: 'bin', op: '&', l, r: add() }; } return l; }
    function add() { let l = mul(); while (isOp('+') || isOp('-')) { const op = toks[p++].v; l = { n: 'bin', op, l, r: mul() }; } return l; }
    function mul() { let l = pow(); while (isOp('*') || isOp('/')) { const op = toks[p++].v; l = { n: 'bin', op, l, r: pow() }; } return l; }
    function pow() { let l = unary(); while (isOp('^')) { p++; l = { n: 'bin', op: '^', l, r: unary() }; } return l; }
    function unary() {
      if (isOp('-')) { p++; return { n: 'neg', e: unary() }; }
      if (isOp('+')) { p++; return unary(); }
      return atom();
    }
    function atom() {
      const a = atom1();
      if (isOp(':')) { p++; return { n: 'rangeop', a, b: atom1() }; }
      return a;
    }
    function atom1() {
      const t = toks[p++];
      if (!t) throw new Error('unexpected end of ' + src);
      if (t.t === 'num') return { n: 'num', v: t.v };
      if (t.t === 'str') return { n: 'str', v: t.v };
      if (t.t === 'bool') return { n: 'bool', v: t.v };
      if (t.t === 'ref') return { n: 'ref', sheet: t.sheet, r: t.r, c: t.c };
      if (t.t === 'range') return { n: 'range', sheet: t.sheet, r1: Math.min(t.r1, t.r2), r2: Math.max(t.r1, t.r2), c1: Math.min(t.c1, t.c2), c2: Math.max(t.c1, t.c2) };
      if (t.t === 'fn') {
        expect('('); const args = [];
        if (!isOp(')')) { for (;;) { args.push(cmp()); if (isOp(',')) { p++; continue; } break; } }
        expect(')'); return { n: 'fn', name: t.v, args };
      }
      if (t.t === 'op' && t.v === '(') { const e = cmp(); expect(')'); return e; }
      throw new Error('unexpected token ' + JSON.stringify(t) + ' in ' + src);
    }
    const ast = cmp();
    if (p !== toks.length) throw new Error('trailing tokens in ' + src);
    return ast;
  }

  // ---------- value helpers
  function toNum(v) {
    if (isErr(v)) return v;
    if (v === null || v === undefined) return 0;
    if (typeof v === 'number') return v;
    if (typeof v === 'boolean') return v ? 1 : 0;
    const s = String(v).trim();
    if (s !== '' && !isNaN(Number(s))) return Number(s);
    return ERR('#VALUE!');
  }
  function toBool(v) {
    if (isErr(v)) return v;
    if (v === null || v === undefined) return false;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    const s = String(v).toUpperCase();
    if (s === 'TRUE') return true; if (s === 'FALSE') return false;
    return ERR('#VALUE!');
  }
  function numStr(n) {
    if (Number.isInteger(n) && Math.abs(n) < 1e15) return String(n);
    let s = Number(n.toPrecision(15)).toString();
    return s;
  }
  function toStr(v) {
    if (isErr(v)) return v;
    if (v === null || v === undefined) return '';
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    if (typeof v === 'number') return numStr(v);
    return String(v);
  }
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const EPOCH = Date.UTC(1899, 11, 30);
  const serialToDate = (s) => new Date(EPOCH + Math.floor(s) * 864e5);
  const dateToSerial = (d) => Math.round((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - EPOCH) / 864e5);

  function typeRank(v) { return typeof v === 'number' ? 1 : typeof v === 'string' ? 2 : 3; }
  function compare(op, a, b) {
    if (isErr(a)) return a; if (isErr(b)) return b;
    if (a === null || a === undefined) a = typeof b === 'string' ? '' : typeof b === 'boolean' ? false : 0;
    if (b === null || b === undefined) b = typeof a === 'string' ? '' : typeof a === 'boolean' ? false : 0;
    let c;
    if (typeRank(a) !== typeRank(b)) c = typeRank(a) - typeRank(b);
    else if (typeof a === 'string') { const x = a.toLowerCase(), y = b.toLowerCase(); c = x < y ? -1 : x > y ? 1 : 0; }
    else c = a < b ? -1 : a > b ? 1 : 0;
    switch (op) {
      case '=': return c === 0; case '<>': return c !== 0; case '<': return c < 0;
      case '>': return c > 0; case '<=': return c <= 0; default: return c >= 0;
    }
  }
  function scalarBin(op, a, b) {
    if (op === '&') { const x = toStr(a), y = toStr(b); return isErr(x) ? x : isErr(y) ? y : x + y; }
    if (['=', '<>', '<', '>', '<=', '>='].includes(op)) return compare(op, a, b);
    const x = toNum(a), y = toNum(b);
    if (isErr(x)) return x; if (isErr(y)) return y;
    switch (op) {
      case '+': return x + y; case '-': return x - y; case '*': return x * y;
      case '/': return y === 0 ? ERR('#DIV/0!') : x / y;
      default: { const r = Math.pow(x, y); return Number.isFinite(r) ? r : ERR('#NUM!'); }
    }
  }
  function bin(op, a, b) {
    const aa = a instanceof Arr, bb = b instanceof Arr;
    if (!aa && !bb) return scalarBin(op, a, b);
    const h = aa ? a.h : b.h, w = aa ? a.w : b.w;
    if (aa && bb && (a.h !== b.h || a.w !== b.w)) return ERR('#VALUE!');
    const rows = [];
    for (let i = 0; i < h; i++) { const row = []; for (let j = 0; j < w; j++) row.push(scalarBin(op, aa ? a.rows[i][j] : a, bb ? b.rows[i][j] : b)); rows.push(row); }
    return new Arr(rows);
  }
  const scalar = (v) => (v instanceof Arr ? (v.h ? v.rows[0][0] : null) : v);
  function flat(v) { return v instanceof Arr ? [].concat(...v.rows) : [v]; }

  function critFn(c) {
    c = scalar(c);
    if (typeof c === 'string') {
      const m = /^(<=|>=|<>|<|>|=)?(.*)$/s.exec(c); const op = m[1] || '=', rhs = m[2];
      if (op === '<>' && rhs === '') return (v) => v !== null && v !== '';
      const isNum = rhs.trim() !== '' && !isNaN(Number(rhs));
      if (isNum) { const n = Number(rhs); return (v) => typeof v === 'number' && cmpNum(op, v, n); }
      return (v) => { if (typeof v === 'string' || v === null) { const r = compare(op, v === null ? '' : v, rhs); return r === true; } return op === '<>'; };
    }
    if (typeof c === 'number') return (v) => typeof v === 'number' && v === c;
    if (typeof c === 'boolean') return (v) => v === c;
    return () => false;
  }
  function cmpNum(op, a, b) { switch (op) { case '=': return a === b; case '<>': return a !== b; case '<': return a < b; case '>': return a > b; case '<=': return a <= b; default: return a >= b; } }

  function roundHalfAway(x, d) { const f = Math.pow(10, d); return Math.sign(x) * Math.round(Math.abs(x) * f + 1e-9) / f; }

  // ---------- model
  class Model {
    constructor(data) {
      this.raw = {}; this.ast = {}; this.cache = {}; this.busy = {};
      for (const sh in data) {
        const m = new Map();
        for (const a in data[sh]) { const [r, c] = parseAddr(a); m.set(r * 1000 + c, data[sh][a]); }
        this.raw[sh] = m; this.cache[sh] = new Map(); this.ast[sh] = new Map();
      }
    }
    set(sheet, addr, value, keepCache) {
      const [r, c] = parseAddr(addr); const k = r * 1000 + c;
      if (value === null || value === undefined) this.raw[sheet].delete(k); else this.raw[sheet].set(k, value);
      if (!keepCache) this.clear();
    }
    raw_(sheet, addr) { const [r, c] = parseAddr(addr); return this.raw[sheet].get(r * 1000 + c); }
    clear() { for (const sh in this.cache) this.cache[sh].clear(); }
    cell(sheet, r, c) {
      const cache = this.cache[sheet];
      if (!cache) return ERR('#REF!');
      const k = r * 1000 + c;
      if (cache.has(k)) return cache.get(k);
      const raw = this.raw[sheet].get(k);
      let v;
      if (typeof raw === 'string' && raw.charCodeAt(0) === 61) {
        const key = sheet + '!' + k;
        if (this.busy[key]) return ERR('#CIRC!');
        this.busy[key] = true;
        try {
          let ast = this.ast[sheet].get(k);
          if (!ast) { ast = parse(raw.slice(1)); this.ast[sheet].set(k, ast); }
          v = this.ev(ast, sheet);
          if (v instanceof Arr) v = scalar(v);
          if (v === undefined) v = null;
        } catch (e) { v = ERR('#NAME?'); v.message = e.message; }
        delete this.busy[key];
      } else v = raw === undefined ? null : raw;
      cache.set(k, v);
      return v;
    }
    get(sheet, addr) { const [r, c] = parseAddr(addr); return this.cell(sheet, r, c); }
    range(sheet, a) {
      const [x, y] = a.split(':'); const [r1, c1] = parseAddr(x), [r2, c2] = parseAddr(y || x); const out = [];
      for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) out.push(this.cell(sheet, r, c));
      return out;
    }
    rng(sheet, n) {
      const rows = [];
      for (let r = n.r1; r <= n.r2; r++) { const row = []; for (let c = n.c1; c <= n.c2; c++) row.push(this.cell(sheet, r, c)); rows.push(row); }
      return new Arr(rows);
    }
    ev(n, sh) {
      switch (n.n) {
        case 'num': case 'str': case 'bool': return n.v;
        case 'ref': return this.cell(n.sheet || sh, n.r, n.c);
        case 'range': return this.rng(n.sheet || sh, n);
        case 'rangeop': {
          const a = this.evRef(n.a, sh), b = this.evRef(n.b, sh);
          if (!a || !b || a.sheet !== b.sheet) return ERR('#REF!');
          return this.rng(a.sheet, { r1: Math.min(a.r, b.r), r2: Math.max(a.r, b.r), c1: Math.min(a.c, b.c), c2: Math.max(a.c, b.c) });
        }
        case 'neg': { const v = this.ev(n.e, sh); return bin('*', v, -1); }
        case 'bin': return bin(n.op, this.ev(n.l, sh), this.ev(n.r, sh));
        case 'fn': return this.fn(n, sh);
        default: return ERR('#NAME?');
      }
    }
    evRef(n, sh) { // a node that points at one cell: a plain reference, or INDEX over a range
      if (n.n === 'ref') return { sheet: n.sheet || sh, r: n.r, c: n.c };
      if (n.n === 'fn' && n.name === 'INDEX' && n.args[0].n === 'range') {
        const g = n.args[0]; let r = toNum(scalar(this.ev(n.args[1], sh))); let c = n.args.length > 2 ? toNum(scalar(this.ev(n.args[2], sh))) : null;
        if (isErr(r) || (c !== null && isErr(c))) return null;
        const h = g.r2 - g.r1 + 1, w = g.c2 - g.c1 + 1;
        if (c === null) { if (w === 1) c = 1; else if (h === 1) { c = r; r = 1; } else return null; }
        if (r < 1 || c < 1 || r > h || c > w) return null;
        return { sheet: g.sheet || sh, r: g.r1 + r - 1, c: g.c1 + c - 1 };
      }
      return null;
    }
    nums(args, sh) { // values of SUM-like arguments: ranges skip text/blank, direct arguments coerce
      const out = [];
      for (const a of args) {
        const v = this.ev(a, sh);
        if (v instanceof Arr) { for (const x of flat(v)) { if (isErr(x)) return x; if (typeof x === 'number') out.push(x); } }
        else { const x = toNum(v); if (isErr(x)) return x; out.push(x); }
      }
      return out;
    }
    fn(n, sh) {
      const A = n.args, name = n.name, e = (i) => this.ev(A[i], sh);
      switch (name) {
        case 'IF': {
          const c = toBool(scalar(e(0))); if (isErr(c)) return c;
          if (c) return A.length > 1 ? e(1) : true;
          return A.length > 2 ? e(2) : false;
        }
        case 'AND': case 'OR': {
          let acc = name === 'AND';
          for (const a of A) {
            const v = this.ev(a, sh);
            for (const x of flat(v)) {
              if (v instanceof Arr && (x === null || typeof x === 'string')) continue;
              const b = toBool(x); if (isErr(b)) return b;
              acc = name === 'AND' ? acc && b : acc || b;
            }
          }
          return acc;
        }
        case 'NOT': { const b = toBool(scalar(e(0))); return isErr(b) ? b : !b; }
        case 'ISNUMBER': return typeof scalar(e(0)) === 'number';
        case 'INT': { const x = toNum(scalar(e(0))); return isErr(x) ? x : Math.floor(x); }
        case 'ABS': { const x = toNum(scalar(e(0))); return isErr(x) ? x : Math.abs(x); }
        case 'ROUND': { const x = toNum(scalar(e(0))), d = toNum(scalar(e(1))); return isErr(x) ? x : isErr(d) ? d : roundHalfAway(x, d); }
        case 'SUM': { const v = this.nums(A, sh); return isErr(v) ? v : v.reduce((s, x) => s + x, 0); }
        case 'MIN': { const v = this.nums(A, sh); return isErr(v) ? v : v.length ? Math.min(...v) : 0; }
        case 'MAX': { const v = this.nums(A, sh); return isErr(v) ? v : v.length ? Math.max(...v) : 0; }
        case 'AVERAGE': { const v = this.nums(A, sh); return isErr(v) ? v : v.length ? v.reduce((s, x) => s + x, 0) / v.length : ERR('#DIV/0!'); }
        case 'INDEX': {
          const a = e(0); if (!(a instanceof Arr)) return ERR('#VALUE!');
          let r = toNum(scalar(e(1))); let c = A.length > 2 ? toNum(scalar(e(2))) : null;
          if (isErr(r)) return r; if (c !== null && isErr(c)) return c;
          if (c === null) { if (a.w === 1) c = 1; else if (a.h === 1) { c = r; r = 1; } else return ERR('#REF!'); }
          if (r < 1 || c < 1 || r > a.h || c > a.w) return ERR('#REF!');
          return a.rows[r - 1][c - 1];
        }
        case 'SUMIF': case 'COUNTIF': case 'SUMIFS': case 'MINIFS': {
          let sumR, pairs;
          if (name === 'SUMIF') { sumR = A.length > 2 ? e(2) : e(0); pairs = [[e(0), e(1)]]; }
          else if (name === 'COUNTIF') { sumR = null; pairs = [[e(0), e(1)]]; }
          else { sumR = e(0); pairs = []; for (let i = 1; i + 1 < A.length; i += 2) pairs.push([e(i), e(i + 1)]); }
          const fs = pairs.map(([r, c]) => [flat(r), critFn(c)]);
          const sv = sumR ? flat(sumR) : null; const len = fs[0][0].length;
          let acc = name === 'MINIFS' ? null : 0;
          for (let i = 0; i < len; i++) {
            if (!fs.every(([vals, f]) => f(vals[i]))) continue;
            if (name === 'COUNTIF') acc++;
            else { const x = sv[i]; if (isErr(x)) return x; if (typeof x !== 'number') continue; acc = name === 'MINIFS' ? (acc === null ? x : Math.min(acc, x)) : acc + x; }
          }
          return acc === null ? 0 : acc;
        }
        case 'SUMPRODUCT': {
          const arrs = A.map((a, i) => e(i)); const sets = arrs.map((x) => flat(x));
          const len = sets[0].length; let tot = 0;
          for (let i = 0; i < len; i++) {
            let p = 1;
            for (const s of sets) { const x = s[i]; if (isErr(x)) return x; p *= typeof x === 'number' ? x : 0; }
            tot += p;
          }
          return tot;
        }
        case 'MONTH': { const s = toNum(scalar(e(0))); return isErr(s) ? s : serialToDate(s).getUTCMonth() + 1; }
        case 'EDATE': {
          const s = toNum(scalar(e(0))), m = toNum(scalar(e(1))); if (isErr(s)) return s; if (isErr(m)) return m;
          const d = serialToDate(s), t = d.getUTCFullYear() * 12 + d.getUTCMonth() + Math.trunc(m);
          const y = Math.floor(t / 12), mo = t - y * 12, last = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
          return dateToSerial(new Date(Date.UTC(y, mo, Math.min(d.getUTCDate(), last))));
        }
        case 'TEXT': {
          const v = scalar(e(0)), f = toStr(scalar(e(1))); const s = toNum(v); if (isErr(s)) return s;
          if (f === 'mmm-yy') { const d = serialToDate(s); return MONTHS[d.getUTCMonth()] + '-' + String(d.getUTCFullYear()).slice(2); }
          return ERR('#VALUE!');
        }
        default: return ERR('#NAME?');
      }
    }
  }

  root.SheetEngine = { Model, Err, isErr, colName, colNum, parseAddr };
  if (typeof module !== 'undefined') module.exports = root.SheetEngine;
})(typeof globalThis !== 'undefined' ? globalThis : this);
