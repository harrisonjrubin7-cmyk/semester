// Compares engine.js against LibreOffice's values for every formula cell, in every scenario. Run by engine_parity.py.
const fs = require('fs');
const { Model, isErr } = require('./engine.js');
const { data, expected, edited, edits } = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const m = new Model(data);
let cells = 0, skipped = 0; const bad = [];
// Checks row 22 compares the live model with the pasted Scenario_Results snapshot, which the engine does not carry.
// Checks!C26 counts row 22, so with changed inputs the workbook reports a failing snapshot there; the dashboard counts rows 4-21 and 29-30 itself.
const SKIP = new Set(['Checks!B22', 'Checks!C22', 'Checks!C26']);
const t0 = Date.now();
for (const k of Object.keys(expected)) {
  m.set('Scenario_Control', 'D3', +k);
  for (const sh in expected[k]) for (const a in expected[k][sh]) {
    if (SKIP.has(sh + '!' + a)) { skipped++; continue; }
    const want = expected[k][sh][a]; let got = m.get(sh, a); cells++;
    if (isErr(got)) got = String(got) + (got.message ? ' ' + got.message : '');
    let ok;
    if (typeof want === 'number' && typeof got === 'number') ok = Math.abs(got - want) <= 1e-7 * Math.max(1, Math.abs(want));
    else if (want === null || want === undefined) ok = got === null || got === '' || got === 0;
    else if (typeof want === 'string' && /^\d{4}-\d\d-\d\d/.test(want)) ok = true; // dates are compared through the numbers built on them
    else ok = String(want) === String(got);
    if (!ok) bad.push(`scenario ${k} ${sh}!${a}: workbook ${JSON.stringify(want)} engine ${JSON.stringify(got)}`);
  }
}
// Same comparison with the inputs changed.
edits.forEach(([sh, a, v]) => m.set(sh, a, v, true)); m.clear();
for (const k of Object.keys(edited)) {
  m.set('Scenario_Control', 'D3', +k);
  for (const sh in edited[k]) for (const a in edited[k][sh]) {
    if (SKIP.has(sh + '!' + a)) { skipped++; continue; }
    const want = edited[k][sh][a]; let got = m.get(sh, a); cells++;
    if (isErr(got)) got = String(got);
    let ok;
    if (typeof want === 'number' && typeof got === 'number') ok = Math.abs(got - want) <= 1e-7 * Math.max(1, Math.abs(want));
    else if (want === null || want === undefined) ok = got === null || got === '' || got === 0;
    else if (typeof want === 'string' && /^\d{4}-\d\d-\d\d/.test(want)) ok = true;
    else ok = String(want) === String(got);
    if (!ok) bad.push(`edited scenario ${k} ${sh}!${a}: workbook ${JSON.stringify(want)} engine ${JSON.stringify(got)}`);
  }
}
console.log(`${cells} formula cells compared across ${Object.keys(expected).length} scenarios plus ${Object.keys(edited).length} with changed inputs in ${Date.now() - t0} ms; ${skipped} snapshot-check cells skipped; ${bad.length} differences`);
bad.slice(0, 25).forEach((b) => console.log('  ' + b));
process.exit(bad.length ? 1 : 0);
