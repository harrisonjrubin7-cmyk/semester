import { test, eq } from './harness';
import { scanBytes, zipEntries } from '../src/lib/fileScan';
import { zip } from '../src/lib/zip';
import { toDocx } from '../src/lib/docxRules';
import { toXlsx } from '../src/lib/sheetRules';
import { toPptx } from '../src/lib/deckRules';

const enc = (s: string) => new TextEncoder().encode(s);
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const ok = (name: string, mime: string, b: Uint8Array) => scanBytes(name, mime, b).verdict;
const why = (name: string, mime: string, b: Uint8Array) => scanBytes(name, mime, b).reasons;

test('control: real documents of every accepted type pass, including the files Semester itself makes', () => {
  eq([ok('essay.pdf', 'application/pdf', enc('%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\n%%EOF')), ok('chart.png', 'image/png', PNG),
    ok('photo.jpg', 'image/jpeg', new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2])), ok('notes.txt', 'text/plain', enc('Café notes — résumé\n')),
    ok('data.csv', 'text/csv', enc('name,score\nAna,-3\nBo,4\n'))], ['clean', 'clean', 'clean', 'clean', 'clean']);
  eq([ok('essay.docx', DOCX, toDocx('Essay', '# Title\n\nBody text.')), ok('budget.xlsx', XLSX, toXlsx([['Item', 'Cost'], ['Books', '120']], 'Budget')),
    ok('talk.pptx', PPTX, toPptx('Talk', [{ title: 'One', bullets: ['a'], notes: '' }], ''))], ['clean', 'clean', 'clean']);
});
test('the bytes must be the type claimed', () => {
  eq(why('essay.pdf', 'application/pdf', PNG), ['The file is not really a PDF.']);
  eq(why('a.png', 'image/png', enc('%PDF-1.4')), ['The file is not really a PNG image.']);
  eq(why('a.docx', DOCX, zip([{ name: '[Content_Types].xml', data: enc('<x/>') }, { name: 'xl/workbook.xml', data: enc('<x/>') }])), ['The file is not the Office document type it claims to be.']);
  eq(why('a.docx', DOCX, enc('not a zip')), ['The file is not really an Office document.']);
});
test('programs, scripts and hidden extensions are refused', () => {
  eq(why('report.pdf', 'application/pdf', new Uint8Array([0x4d, 0x5a, 0x90, 0])).includes('This is a program, not a document.'), true);
  eq(why('notes.txt', 'text/plain', enc('#!/bin/sh\nrm -rf ~\n')), ['The file is a script.']);
  eq(why('essay.pdf.exe', 'application/pdf', enc('%PDF-1.4')).length >= 1, true);
  eq(why('essay.exe.pdf', 'application/pdf', enc('%PDF-1.4')), ['The name hides a second, risky file extension.']);
  eq(why('cv.docm', DOCX, toDocx('x', 'y')), ['Files ending in .docm are not accepted.']);
});
test('active content: PDF JavaScript, launch actions, embedded files; Office macros and ActiveX', () => {
  eq(why('a.pdf', 'application/pdf', enc('%PDF-1.7 << /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >>')), ['The PDF contains JavaScript.']);
  eq(why('a.pdf', 'application/pdf', enc('%PDF-1.7 << /S /Launch /F (cmd.exe) >>')), ['The PDF tries to open another program.']);
  eq(why('a.pdf', 'application/pdf', enc('%PDF-1.7 << /Type /EmbeddedFile >>')), ['The PDF has files hidden inside it.']);
  const macro = zip([{ name: '[Content_Types].xml', data: enc('<x/>') }, { name: 'word/document.xml', data: enc('<x/>') }, { name: 'word/vbaProject.bin', data: new Uint8Array([1, 2]) }]);
  eq(why('a.docx', DOCX, macro), ['The document contains macros.']);
  const ax = zip([{ name: '[Content_Types].xml', data: enc('<x/>') }, { name: 'word/document.xml', data: enc('<x/>') }, { name: 'word/activeX/activeX1.xml', data: enc('<x/>') }]);
  eq(why('a.docx', DOCX, ax), ['The document contains ActiveX controls.']);
});
test('archive tricks: path traversal and embedded programs inside an Office file', () => {
  const trav = zip([{ name: '[Content_Types].xml', data: enc('<x/>') }, { name: 'word/document.xml', data: enc('<x/>') }, { name: 'word/../../evil.xml', data: enc('<x/>') }]);
  eq(why('a.docx', DOCX, trav), ['The document has unsafe paths inside it.']);
  const emb = zip([{ name: '[Content_Types].xml', data: enc('<x/>') }, { name: 'word/document.xml', data: enc('<x/>') }, { name: 'word/embeddings/payload.exe', data: enc('MZ') }]);
  eq(why('a.docx', DOCX, emb), ['The document has programs or archives embedded in it.']);
});
test('compression bomb: a declared expansion far beyond the file size is refused', () => {
  const b = zip([{ name: '[Content_Types].xml', data: enc('<x/>') }, { name: 'word/document.xml', data: enc('<x/>') }]);
  // Patch the second central-directory entry to claim 500 MB uncompressed from 5 bytes compressed.
  const view = new DataView(b.buffer); const entries = zipEntries(b)!; eq(entries.length, 2);
  let p = -1; for (let i = b.length - 22; i >= 0; i--) if (view.getUint32(i, true) === 0x06054b50) { p = view.getUint32(i + 16, true); break; }
  p += 46 + view.getUint16(p + 28, true) + view.getUint16(p + 30, true) + view.getUint16(p + 32, true);
  view.setUint32(p + 24, 500 * 1024 * 1024, true);
  eq(why('a.docx', DOCX, b), ['The document expands to far more than its size (possible compression bomb).']);
});
test('text: binary content, invalid UTF-8 and CSV formula injection are refused', () => {
  eq(why('a.txt', 'text/plain', new Uint8Array([0x61, 0, 0x62])), ['The file contains binary data, not text.']);
  eq(why('a.txt', 'text/plain', new Uint8Array([0xc3, 0x28])), ['The text is not valid UTF-8. Save it as UTF-8 and try again.']);
  eq(why('a.csv', 'text/csv', enc('name,total\nx,=HYPERLINK("http://evil","click")\n')), ['The CSV contains spreadsheet formulas that would run when opened.']);
  eq(ok('a.csv', 'text/csv', enc('delta\n-5\n+3\n')), 'clean');
});
test('the EICAR test signature is caught in any accepted type; unknown types are refused', () => {
  const eicar = enc('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*');
  eq(why('a.txt', 'text/plain', eicar), ['The file matches the antivirus test signature (EICAR).']);
  eq(why('a.bin', 'application/octet-stream', enc('x')), ['That file type is not accepted.']);
});
