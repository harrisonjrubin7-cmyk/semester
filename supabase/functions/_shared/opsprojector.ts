export interface OpsProjectorDeps {
  secret: string | undefined;
  run(): Promise<unknown>;
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' },
});

async function sameSecret(presented: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(presented)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  let different = a.length ^ b.length;
  for (let i = 0; i < a.length; i += 1) different |= a[i] ^ b[i];
  return different === 0;
}

/** A dormant-by-default manual boundary around one bounded projector batch. */
export async function serveOpsProjector(req: Request, deps: OpsProjectorDeps | null): Promise<Response> {
  if (!deps || !deps.secret || deps.secret.length < 32) {
    return json(503, { error: 'The projection worker is not configured.' });
  }
  if (req.method !== 'POST') return json(405, { error: 'POST only.' });

  const token = /^Bearer\s+(.+)$/i.exec(req.headers.get('Authorization') ?? '')?.[1]?.trim() ?? '';
  if (!token || !(await sameSecret(token, deps.secret))) return json(401, { error: 'Unauthorized.' });

  try {
    return json(200, await deps.run());
  } catch {
    return json(500, { error: 'The projection batch failed.' });
  }
}
