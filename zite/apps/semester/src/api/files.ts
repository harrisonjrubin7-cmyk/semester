import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, forbid, audit, userNames } from '../lib/server';
import { pg } from '../lib/pg';
import { ensureFil, putScanned, ensureScanned } from '../lib/filServer';
import { checkUpload, decodeBase64, PURPOSES } from '../lib/fileRules';

type Row = Record<string, unknown>;
const fail = (e: string | null | undefined) => { if (e) forbid(e); };
const NOT_SHAREABLE = 'That person is not an active member of your institution.';

// Private file store (decision D2). No public or shareable URLs exist: bytes leave only through `download`,
// which re-authorizes every call in Postgres (fil_read) and logs allowed and denied attempts.
export default createEndpoint({
  description: 'Private files: upload, list, download with a per-request permission check, share with a member for a set time, revoke, delete',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('mine') }),
    z.object({ action: z.literal('upload'), name: z.string().max(200), mime: z.string().max(120), purpose: z.enum(PURPOSES), base64: z.string().max(5_600_000) }),
    z.object({ action: z.literal('download'), id: z.string().uuid() }),
    z.object({ action: z.literal('share'), id: z.string().uuid(), email: z.string().email().max(200), days: z.number().int().min(1).max(365) }),
    z.object({ action: z.literal('revoke'), id: z.string().uuid(), userId: z.string() }),
    z.object({ action: z.literal('delete'), id: z.string().uuid() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    await ensureFil();
    const sql = pg();
    const T = a.institutionId, me = a.userId;

    if (input.action === 'upload') {
      const bytes = decodeBase64(input.base64);
      if (!bytes) forbid('The file could not be read. Try again.');
      fail(checkUpload(input.name, input.mime, bytes!.length));
      // Safety screen before anything is stored (lib/fileScan.ts). A refused file is not kept.
      const put = await putScanned(T, me, input.name, input.mime, input.purpose, bytes!);
      if ('blocked' in put) { await audit(a, 'File refused by safety screen', 'file:refused', `${input.mime} · ${put.blocked.join(' ')}`, 'Owner'); forbid(`This file was not accepted: ${put.blocked.join(' ')}`); }
      const id = (put as { id: string }).id;
      await audit(a, 'Private file uploaded', `file:${id}`, `${input.mime} · ${bytes!.length} bytes`, 'Owner');
      return { id };
    }
    if (input.action === 'download') {
      await ensureScanned(T, [input.id]);
      const r = ((await sql.query(`SELECT name, mime, encode(bytes, 'base64') AS b64 FROM fil_read($1,$2,$3)`, [T, input.id, me])) as Row[])[0];
      // Same answer whether the file does not exist, belongs to someone else, or the share ended.
      if (!r) forbid('You do not have access to this file.');
      return { name: String(r!.name), mime: String(r!.mime), base64: String(r!.b64).replace(/\n/g, '') };
    }
    if (input.action === 'share') {
      const { rows } = await zite.sql({ query: `SELECT "id" FROM "ziteUsers" WHERE lower("email") = lower($1) LIMIT 1`, params: [input.email.trim()] });
      const target = rows[0] ? String((rows[0] as Row).id) : null;
      if (!target) forbid(NOT_SHAREABLE);
      const m = await zite.memberships.findAll({ filters: { member: target!, institution: T }, limit: 5 });
      if (!m.records.some((x) => x.status === 'Active')) forbid(NOT_SHAREABLE);
      fail(((await sql.query(`SELECT fil_grant($1,$2,$3,$4,$5) AS e`, [T, input.id, me, target, input.days])) as { e: string | null }[])[0].e);
      await audit(a, 'Private file shared', `file:${input.id}`, `${input.days} days`, 'Owner');
      await zite.messages.create({ record: { body: `A file was shared with you for ${input.days} days. Open You → Files to read it.`, sender: me, recipients: [target!], isNotification: true } as never }).catch(() => undefined);
    }
    if (input.action === 'revoke') {
      fail(((await sql.query(`SELECT fil_revoke($1,$2,$3,$4) AS e`, [T, input.id, me, input.userId])) as { e: string | null }[])[0].e);
      await audit(a, 'Private file share revoked', `file:${input.id}`, '', 'Owner');
    }
    if (input.action === 'delete') {
      fail(((await sql.query(`SELECT fil_delete($1,$2,$3) AS e`, [T, input.id, me])) as { e: string | null }[])[0].e);
      await audit(a, 'Private file deleted', `file:${input.id}`, 'bytes removed', 'Owner');
    }

    const [own, shared, grants] = await Promise.all([
      sql.query(`SELECT id, name, mime, size_bytes, purpose, created_at FROM fil_files WHERE tenant_id = $1 AND owner_id = $2 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 200`, [T, me]) as Promise<Row[]>,
      sql.query(`SELECT f.id, f.name, f.mime, f.size_bytes, f.owner_id, g.expires_at FROM fil_grants g JOIN fil_files f ON f.id = g.file_id
                 WHERE g.tenant_id = $1 AND g.grantee_id = $2 AND g.revoked_at IS NULL AND g.expires_at > now() AND f.deleted_at IS NULL ORDER BY g.created_at DESC LIMIT 200`, [T, me]) as Promise<Row[]>,
      sql.query(`SELECT g.file_id, g.grantee_id, g.expires_at FROM fil_grants g JOIN fil_files f ON f.id = g.file_id
                 WHERE g.tenant_id = $1 AND f.owner_id = $2 AND g.revoked_at IS NULL AND g.expires_at > now()`, [T, me]) as Promise<Row[]>,
    ]);
    const names = await userNames([...shared.map((s) => String(s.owner_id)), ...grants.map((g) => String(g.grantee_id))]);
    const iso = (v: unknown) => new Date(String(v)).toISOString();
    return {
      mine: own.map((f) => ({ id: String(f.id), name: String(f.name), mime: String(f.mime), size: Number(f.size_bytes), purpose: String(f.purpose), at: iso(f.created_at),
        sharedWith: grants.filter((g) => g.file_id === f.id).map((g) => ({ userId: String(g.grantee_id), name: names[String(g.grantee_id)] ?? 'Member', until: iso(g.expires_at) })) })),
      sharedWithMe: shared.map((f) => ({ id: String(f.id), name: String(f.name), mime: String(f.mime), size: Number(f.size_bytes), owner: names[String(f.owner_id)] ?? 'Member', until: iso(f.expires_at) })),
    };
  },
});
