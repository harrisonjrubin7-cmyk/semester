import { pg } from './pg';
import { FIL_MIGRATION } from './filMigration';
import { scanBytes, SCAN_ENGINE } from './fileScan';

let ready: Promise<void> | null = null;
/** Private file store schema (fil-001, fil-002). */
export const ensureFil = () => { if (!ready) ready = (async () => { for (const q of FIL_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };

type Att = { ref_id: string; file_id: string; name: string; mime: string; size_bytes: number; locked: boolean; scan_status: string; scan_reason: string };
/** Files attached to the given works, keyed by work id. */
export async function attachmentsFor(tenant: string, kind: 'submission' | 'achievement', refs: string[]) {
  if (!refs.length) return {} as Record<string, { fileId: string; name: string; mime: string; size: number; locked: boolean; scan: string; scanReason: string }[]>;
  await ensureFil();
  const rows = (await pg().query(`SELECT a.ref_id, a.file_id, f.name, f.mime, f.size_bytes, a.locked, f.scan_status, f.scan_reason FROM fil_attachments a JOIN fil_files f ON f.id = a.file_id
    WHERE a.tenant_id = $1 AND a.kind = $2 AND a.ref_id = ANY($3) AND f.deleted_at IS NULL ORDER BY a.created_at`, [tenant, kind, refs])) as Att[];
  const out: Record<string, { fileId: string; name: string; mime: string; size: number; locked: boolean; scan: string; scanReason: string }[]> = {};
  for (const r of rows) (out[r.ref_id] ??= []).push({ fileId: String(r.file_id), name: r.name, mime: r.mime, size: Number(r.size_bytes), locked: !!r.locked, scan: String(r.scan_status), scanReason: String(r.scan_reason ?? '') });
  return out;
}

/** Bytes of a file attached to a work the caller has already been authorized to see, as base64. */
export async function readAttached(tenant: string, fileId: string, actor: string, kind: 'submission' | 'achievement', ref: string) {
  await ensureFil();
  const r = ((await pg().query(`SELECT name, mime, encode(bytes, 'base64') AS b64 FROM fil_read_attached($1,$2,$3,$4,$5)`, [tenant, fileId, actor, kind, ref])) as { name: string; mime: string; b64: string }[])[0];
  return r ? { name: r.name, mime: r.mime, base64: r.b64.replace(/\n/g, '') } : null;
}

/** Screens files that were stored before screening existed (status 'pending') and records the result. Server-side only. */
export async function ensureScanned(tenant: string, fileIds: string[]) {
  if (!fileIds.length) return;
  await ensureFil();
  const rows = (await pg().query(`SELECT f.id, f.name, f.mime, encode(b.bytes, 'base64') AS b64 FROM fil_files f JOIN fil_blobs b ON b.file_id = f.id
    WHERE f.tenant_id = $1 AND f.id = ANY($2::uuid[]) AND f.scan_status = 'pending'`, [tenant, fileIds])) as { id: string; name: string; mime: string; b64: string }[];
  for (const r of rows) {
    const res = scanBytes(r.name, r.mime, new Uint8Array(Buffer.from(r.b64, 'base64')));
    await pg().query(`SELECT fil_record_scan($1,$2,$3,$4,$5)`, [tenant, r.id, res.verdict, res.reasons.join(' '), res.engine]);
  }
}

/** Screens then stores an upload. A blocked file is refused and never stored; the reasons are returned. */
export async function putScanned(tenant: string, owner: string, name: string, mime: string, purpose: string, bytes: Uint8Array): Promise<{ id: string } | { blocked: string[] }> {
  await ensureFil();
  const res = scanBytes(name, mime, bytes);
  if (res.verdict === 'blocked') return { blocked: res.reasons };
  const id = ((await pg().query(`SELECT fil_put($1,$2,$3,$4,$5,$6) AS id`, [tenant, owner, name, mime, purpose, Buffer.from(bytes)])) as { id: string }[])[0].id;
  await pg().query(`SELECT fil_record_scan($1,$2,'clean','',$3)`, [tenant, id, SCAN_ENGINE]);
  return { id };
}
