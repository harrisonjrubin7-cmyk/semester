import { pg } from './pg';
import { FIL_MIGRATION } from './filMigration';

let ready: Promise<void> | null = null;
/** Private file store schema (fil-001, fil-002). */
export const ensureFil = () => { if (!ready) ready = (async () => { for (const q of FIL_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };

type Att = { ref_id: string; file_id: string; name: string; mime: string; size_bytes: number; locked: boolean };
/** Files attached to the given works, keyed by work id. */
export async function attachmentsFor(tenant: string, kind: 'submission' | 'achievement', refs: string[]) {
  if (!refs.length) return {} as Record<string, { fileId: string; name: string; mime: string; size: number; locked: boolean }[]>;
  await ensureFil();
  const rows = (await pg().query(`SELECT a.ref_id, a.file_id, f.name, f.mime, f.size_bytes, a.locked FROM fil_attachments a JOIN fil_files f ON f.id = a.file_id
    WHERE a.tenant_id = $1 AND a.kind = $2 AND a.ref_id = ANY($3) AND f.deleted_at IS NULL ORDER BY a.created_at`, [tenant, kind, refs])) as Att[];
  const out: Record<string, { fileId: string; name: string; mime: string; size: number; locked: boolean }[]> = {};
  for (const r of rows) (out[r.ref_id] ??= []).push({ fileId: String(r.file_id), name: r.name, mime: r.mime, size: Number(r.size_bytes), locked: !!r.locked });
  return out;
}

/** Bytes of a file attached to a work the caller has already been authorized to see, as base64. */
export async function readAttached(tenant: string, fileId: string, actor: string, kind: 'submission' | 'achievement', ref: string) {
  await ensureFil();
  const r = ((await pg().query(`SELECT name, mime, encode(bytes, 'base64') AS b64 FROM fil_read_attached($1,$2,$3,$4,$5)`, [tenant, fileId, actor, kind, ref])) as { name: string; mime: string; b64: string }[])[0];
  return r ? { name: r.name, mime: r.mime, base64: r.b64.replace(/\n/g, '') } : null;
}
