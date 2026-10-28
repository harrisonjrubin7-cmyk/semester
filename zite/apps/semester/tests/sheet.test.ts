import { test, eq } from './harness';
import { evaluate, show, toCsv, fromCsv, toXlsx, crc32, parseRef, type Grid } from '../src/lib/sheetRules';

const vals = (g: Grid) => evaluate(g).map((r) => r.map(show));

test('arithmetic follows precedence; refs and ranges work', () => {
  eq(vals([['2', '3', '=A1+B1*2', '=(A1+B1)*2', '=2^3^2', '=-A1^2', '=50%']])[0], ['2', '3', '8', '10', '512', '-4', '0.5']);
  eq(vals([['1'], ['2'], ['3'], ['=SUM(A1:A3)'], ['=AVERAGE(A1:A3)'], ['=MEDIAN(A1:A3,10)'], ['=ROUND(STDEV(A1:A3),3)'], ['=COUNT(A1:A3)']]).map((r) => r[0]).slice(3), ['6', '2', '2.5', '1', '3']);
});
test('IF, comparisons and text joining', () => {
  eq(vals([['90', '=IF(A1>=60,"pass","fail")', '="Score: "&A1', '=A1<>90']])[0], ['90', 'pass', 'Score: 90', '0']);
});
test('errors: divide by zero, bad name, bad ref, cycles, and they propagate', () => {
  const v = vals([['=1/0', '=NOPE(1)', '=A1+1', '=D1', '=C1+1', '=Z999']]);
  eq(v[0], ['#DIV/0!', '#NAME?', '#DIV/0!', '#CYCLE!', '#DIV/0!', '#REF!']);
  eq(vals([['=B1', '=A1']])[0], ['#CYCLE!', '#CYCLE!']);
});
test('a formula cannot reach outside the engine (no eval)', () => {
  eq(vals([['=constructor', '=alert(1)', '=A1;process.exit()']])[0], ['#NAME?', '#NAME?', '#NAME?']);
});
test('blank cells are zero in arithmetic, skipped in averages (control)', () => {
  eq(vals([['', '4', '=A1+B1', '=AVERAGE(A1:B1)']])[0], ['', '4', '4', '4']);
});
test('CSV out guards against formula injection; CSV in never runs formulas', () => {
  eq(toCsv([['=1+1', '=HYPERLINK', 'a,b', '-3'], ['@SUM(1)', '', '', '']]), '2,#NAME?,"a,b",-3\n\'@SUM(1),,,\n');
  const g = fromCsv('x,"y ""q"""\n=1+1,2\n');
  eq([g[0][0], g[0][1], g[1][0], show(evaluate(g)[1][0])], ['x', 'y "q"', "'=1+1", "'=1+1"]);
});
test('refs stay inside the grid limits', () => { eq([parseRef('A1'), parseRef('Z200'), parseRef('A201'), parseRef('AA1')], [{ r: 0, c: 0 }, { r: 199, c: 25 }, null, null]); });
test('xlsx is a valid zip with the five parts and formulas kept', () => {
  eq(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  const b = toXlsx([['Item', 'Cost'], ['Books', '120'], ['Total', '=SUM(B2:B2)'], ['<&>', '']]);
  const text = new TextDecoder('latin1').decode(b);
  eq([b[0], b[1], b[2], b[3]], [0x50, 0x4b, 0x03, 0x04]);
  eq(['[Content_Types].xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml', '_rels/.rels', 'xl/_rels/workbook.xml.rels'].every((n) => text.split(n).length >= 3), true);
  eq(text.includes('<c r="B3"><f>SUM(B2:B2)</f><v>120</v></c>'), true);
  eq(text.includes('&lt;&amp;&gt;'), true);
});
