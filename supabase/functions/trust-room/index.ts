/**
 * The procurement room's file server.
 *
 * Everything this function decides is in `../_shared/trustroom.ts`, which
 * `app/src/lib/trust/room-server.test.ts` drives branch by branch. This file
 * only wires in the two things that need Deno: the service-key client that
 * calls `trust_room_open`, and the storage signer for the private
 * `trust-packet` bucket.
 *
 * `verify_jwt` is off (supabase/config.toml) because the caller is a reviewer
 * at a university with no Semester account; the link token in the POST body is
 * the credential, and the database decides what it opens. See
 * `supabase/DEPLOY.md` → trust-room.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleTrustRoom, type RoomRow } from '../_shared/trustroom.ts';

const db = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false } },
);

Deno.serve((req) =>
  handleTrustRoom(req, {
    allowedOrigin: Deno.env.get('ALLOWED_ORIGIN'),
    allowDev: Deno.env.get('CORS_ALLOW_DEV'),
    async open(token, artifact) {
      const { data, error } = await db.rpc('trust_room_open', { want_token: token, want_artifact: artifact });
      if (error) throw new Error('trust_room_open failed');
      return (data ?? []) as RoomRow[];
    },
    async sign(bucket, path, seconds) {
      const { data, error } = await db.storage.from(bucket).createSignedUrl(path, seconds);
      if (error || !data?.signedUrl) return null;
      return data.signedUrl;
    },
  }),
);
