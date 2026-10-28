// Stored (uncompressed) zip writer with CRC-32, enough for .xlsx and .docx packages. No dependency.
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
