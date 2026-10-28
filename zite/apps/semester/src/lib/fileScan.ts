// File safety screening (spec §4.2 "file safety step"). Pure and deterministic, run on the server before a file is
// stored and again (lazily) for files stored before screening existed. This is a format and content screen, NOT an
// antivirus engine: it confirms the bytes are the type claimed, refuses executables, scripts, macros, active PDF content,
// risky archives and the industry EICAR test file. Signature-based antivirus needs an approved scanning service.
export const SCAN_ENGINE = 'semester-screen-1';
export type ScanResult = { verdict: 'clean' | 'blocked'; reasons: string[]; engine: string };

const OOXML: Record<string, string> = {
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'word/',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xl/',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'ppt/',
};
const RISKY_EXT = /\.(exe|dll|com|scr|pif|msi|msp|bat|cmd|ps1|psm1|vbs|vbe|js|jse|wsf|wsh|hta|jar|apk|app|dmg|sh|bash|py|rb|pl|php|html?|svg|xhtml|lnk|iso|img|docm|xlsm|pptm|dotm|xltm|potm|zip|rar|7z|gz|tar)$/i;
const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
const MAX_ENTRIES = 2000, MAX_UNPACKED = 100 * 1024 * 1024, MAX_RATIO = 100;

const starts = (b: Uint8Array, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v);
const latin1 = (b: Uint8Array) => { let s = ''; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192)); return s; };
const u16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

export type ZipEntry = { name: string; compressed: number; uncompressed: number; encrypted: boolean };
/** Reads a zip's central directory. Returns null when the file is not a readable zip. */
export function zipEntries(b: Uint8Array): ZipEntry[] | null {
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 65535); i--) if (u32(b, i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) return null;
  const count = u16(b, eocd + 10); let p = u32(b, eocd + 16); const out: ZipEntry[] = [];
  for (let k = 0; k < count; k++) {
    if (p + 46 > b.length || u32(b, p) !== 0x02014b50) return null;
    const nameLen = u16(b, p + 28), extra = u16(b, p + 30), comment = u16(b, p + 32);
    out.push({ name: latin1(b.subarray(p + 46, p + 46 + nameLen)), encrypted: (u16(b, p + 8) & 1) === 1, compressed: u32(b, p + 20), uncompressed: u32(b, p + 24) });
    p += 46 + nameLen + extra + comment;
  }
  return out;
}

function validUtf8(b: Uint8Array): boolean {
  try { new TextDecoder('utf-8', { fatal: true }).decode(b); return true; } catch { return false; }
}

/** Screens one file. `mime` is what the uploader declared; it must match the bytes. */
export function scanBytes(name: string, mime: string, b: Uint8Array): ScanResult {
  const reasons: string[] = []; const no = (r: string) => reasons.push(r);
  const n = name.trim().toLowerCase();
  if (RISKY_EXT.test(n)) no(`Files ending in .${n.split('.').pop()} are not accepted.`);
  if ((n.match(/\./g) ?? []).length >= 2 && RISKY_EXT.test(n.replace(/\.[a-z0-9]+$/, ''))) no('The name hides a second, risky file extension.');
  if (starts(b, [0x4d, 0x5a]) || starts(b, [0x7f, 0x45, 0x4c, 0x46]) || starts(b, [0xcf, 0xfa, 0xed, 0xfe]) || starts(b, [0xfe, 0xed, 0xfa, 0xce]) || starts(b, [0xfe, 0xed, 0xfa, 0xcf]) || starts(b, [0xca, 0xfe, 0xba, 0xbe]))
    no('This is a program, not a document.');
  const text = latin1(b);
  if (text.includes(EICAR)) no('The file matches the antivirus test signature (EICAR).');

  if (mime === 'application/pdf') {
    if (!text.startsWith('%PDF-')) no('The file is not really a PDF.');
    if (/\/(JavaScript|JS)\b/.test(text)) no('The PDF contains JavaScript.');
    if (/\/Launch\b/.test(text)) no('The PDF tries to open another program.');
    if (/\/EmbeddedFile\b/.test(text)) no('The PDF has files hidden inside it.');
    if (/\/Encrypt\b/.test(text)) no('The PDF is encrypted, so it cannot be checked. Save it without a password.');
  } else if (mime === 'image/png') {
    if (!starts(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) no('The file is not really a PNG image.');
  } else if (mime === 'image/jpeg') {
    if (!starts(b, [0xff, 0xd8, 0xff])) no('The file is not really a JPEG image.');
  } else if (mime === 'text/plain' || mime === 'text/csv') {
    if (b.includes(0)) no('The file contains binary data, not text.');
    else if (!validUtf8(b)) no('The text is not valid UTF-8. Save it as UTF-8 and try again.');
    if (text.startsWith('#!')) no('The file is a script.');
    if (mime === 'text/csv' && /(^|[\r\n,])\s*[=+@-]\s*[A-Za-z]+\s*\(/.test(text.slice(0, 200000))) no('The CSV contains spreadsheet formulas that would run when opened.');
  } else if (OOXML[mime]) {
    const entries = starts(b, [0x50, 0x4b, 0x03, 0x04]) ? zipEntries(b) : null;
    if (!entries) no('The file is not really an Office document.');
    else {
      const names = entries.map((e) => e.name);
      if (!names.includes('[Content_Types].xml') || !names.some((x) => x.startsWith(OOXML[mime]))) no('The file is not the Office document type it claims to be.');
      if (names.some((x) => /vbaProject\.bin$|vbaData\.xml$/i.test(x))) no('The document contains macros.');
      if (names.some((x) => /(^|\/)activeX\//i.test(x))) no('The document contains ActiveX controls.');
      if (names.some((x) => x.startsWith('/') || x.split('/').includes('..') || x.includes('\\'))) no('The document has unsafe paths inside it.');
      if (names.some((x) => /\.(exe|dll|js|vbs|bat|cmd|ps1|jar|zip|rar|7z)$/i.test(x) || /(^|\/)embeddings\/.*\.(bin|exe|zip)$/i.test(x))) no('The document has programs or archives embedded in it.');
      if (entries.some((e) => e.encrypted)) no('The document is encrypted, so it cannot be checked.');
      const unpacked = entries.reduce((s, e) => s + e.uncompressed, 0);
      if (entries.length > MAX_ENTRIES || unpacked > MAX_UNPACKED || entries.some((e) => e.compressed > 0 && e.uncompressed / e.compressed > MAX_RATIO && e.uncompressed > 1024 * 1024))
        no('The document expands to far more than its size (possible compression bomb).');
    }
  } else no('That file type is not accepted.');
  return { verdict: reasons.length ? 'blocked' : 'clean', reasons: [...new Set(reasons)], engine: SCAN_ENGINE };
}
