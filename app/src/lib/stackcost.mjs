/**
 * The stack-consolidation calculator: what a school pays for the systems Semester
 * Core is planned to take over, against what it would pay with Semester.
 *
 * Plain JavaScript, because the company site's page is one HTML file and carries
 * a copy of the code between the `>>> embed` and `<<< embed` lines below;
 * `stackcost.test.ts` fails while the copy differs, and `REGISTERS=write` rewrites
 * it. The site tool (`site/tools/Tools.tsx`) imports this file as it stands.
 *
 * Rules, each held by a test:
 *  - A system counts as switched off only in a year when its contract has ended
 *    AND Semester's replacement is available. Both are the school's inputs; the
 *    register's word for the module (planned, today, for every one) is shown
 *    beside it and never used to make the numbers look better.
 *  - Semester's price is the school's own quote. There is no published price to
 *    fill in, so a row with no price is not switched off and nothing is saved on it.
 *  - Nothing is saved on a row with no current cost, and a switch-off that falls
 *    after the five years shown is not counted.
 *  - Every figure is a planning estimate from the inputs, never a guarantee.
 */

// >>> embed
const HORIZON = 5;
const num = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/[$,\s]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const yearOrNull = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : null;
};
function stackCalc(input) {
  const esc = Math.min(num(input.escalation), 25) / 100;
  const rows = input.rows.map((r) => {
    const annual = num(r.annualCost);
    const price = num(r.semesterAnnual);
    const contractEnds = yearOrNull(r.contractEnds) ?? 0;
    const ready = yearOrNull(r.readyYear);
    let switchYear = null;
    let why = '';
    if (annual === 0) why = 'no current cost entered';
    else if (ready === null) why = 'no year entered for when the replacement is available';
    else if (price === 0) why = 'no Semester price entered';
    else {
      const y = Math.max(contractEnds + 1, ready, 1);
      if (y > HORIZON) why = 'the switch-off would fall in year ' + y + ', after the ' + HORIZON + ' years shown';
      else switchYear = y;
    }
    return { id: r.id, name: r.name, annual, price, migration: num(r.migrationOnce), hours: num(r.adminHours), contractEnds, ready, switchYear, why };
  });
  const years = [];
  let cumulative = 0;
  let hoursTotal = 0;
  let paybackMonth = null;
  const firstSwitch = rows.reduce((m, r) => (r.switchYear !== null && r.switchYear < m ? r.switchYear : m), HORIZON + 1);
  for (let y = 1; y <= HORIZON; y++) {
    const grow = Math.pow(1 + esc, y - 1);
    let current = 0;
    let remaining = 0;
    let semester = 0;
    let migration = 0;
    let hours = 0;
    for (const r of rows) {
      const base = r.annual * grow;
      current += base;
      if (r.switchYear !== null && y >= r.switchYear) {
        semester += r.price;
        if (y === r.switchYear) migration += r.migration;
        hours += r.hours;
      } else remaining += base;
    }
    const withSemester = remaining + semester + migration;
    const saving = current - withSemester;
    const before = cumulative;
    cumulative += saving;
    hoursTotal += hours;
    if (paybackMonth === null && y >= firstSwitch && cumulative >= 0 && saving > 0) {
      paybackMonth = before >= 0 ? (y - 1) * 12 + 1 : (y - 1) * 12 + Math.ceil((12 * -before) / saving);
    }
    years.push({ year: y, current, remaining, semester, migration, withSemester, saving, cumulative, hours });
  }
  const totalCurrent = years.reduce((a, y) => a + y.current, 0);
  const totalWith = years.reduce((a, y) => a + y.withSemester, 0);
  return { years, rows, totalCurrent, totalWith, totalSaving: totalCurrent - totalWith, hoursTotal, paybackMonth, switched: rows.filter((r) => r.switchYear !== null).length };
}
const csvCell = (s) => {
  const t = String(s);
  return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
};
function stackCsv(input, result, statuses) {
  const line = (cells) => cells.map(csvCell).join(',');
  const out = [
    line(['Semester stack comparison: a planning estimate from the inputs below, not a quote or a guarantee']),
    line(['Every input is the school’s own. Semester has no published institutional price.']),
    line(['Annual price increase on current systems (%)', input.escalation || 0]),
    '',
    line(['System', 'Register says', 'Current cost / yr', 'Contract ends (end of year)', 'Replacement available from (year)', 'Semester price / yr', 'One-time migration', 'Admin hours / yr freed', 'Switched off in year', 'Why not']),
  ];
  result.rows.forEach((r) => out.push(line([r.name, (statuses && statuses[r.id]) || '', r.annual, r.contractEnds, r.ready === null ? '' : r.ready, r.price, r.migration, r.hours, r.switchYear === null ? 'not within ' + HORIZON + ' years' : r.switchYear, r.why])));
  out.push('', line(['Year', 'Current systems', 'Systems still running', 'Semester', 'Migration', 'With Semester', 'Saving', 'Cumulative saving', 'Admin hours freed']));
  result.years.forEach((y) => out.push(line([y.year, Math.round(y.current), Math.round(y.remaining), Math.round(y.semester), Math.round(y.migration), Math.round(y.withSemester), Math.round(y.saving), Math.round(y.cumulative), Math.round(y.hours)])));
  out.push('', line(['Five-year total: current', Math.round(result.totalCurrent), 'with Semester', Math.round(result.totalWith), 'saving', Math.round(result.totalSaving)]));
  out.push(line(['Payback month', result.paybackMonth === null ? 'not within ' + HORIZON + ' years' : result.paybackMonth]));
  return out.join('\n') + '\n';
}
const INSTITUTION_TYPES = [
  { id: 'community', name: 'Community college', scale: 0.5 },
  { id: 'public4', name: '4-year public', scale: 1 },
  { id: 'private4', name: '4-year private', scale: 0.8 },
  { id: 'k12', name: 'K-12 district', scale: 0.6 },
];
const exampleRow = (scale = 1) => ({
  annualCost: Math.round(100000 * scale),
  contractEnds: 2,
  readyYear: 3,
  semesterAnnual: Math.round(60000 * scale),
  migrationOnce: Math.round(30000 * scale),
  adminHours: 200,
});
// <<< embed

/**
 * The institution types set the scale of the illustrative example and nothing else.
 * The example is labelled as illustrative wherever it appears: it is not Semester's
 * price or any school's cost, and every row is the same shape so it reads as a placeholder.
 */
export { HORIZON, INSTITUTION_TYPES, exampleRow, stackCalc, stackCsv };
