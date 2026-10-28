export type PushRun = () => Response | Promise<Response>;

/**
 * Fail closed before the scheduler can reach service-role reads or outbound
 * delivery. The deployed entrypoint supplies the environment secret and the
 * protected push run separately so this boundary can be executed in tests.
 */
export async function handlePushRequest(req: Request, secret: string, run: PushRun): Promise<Response> {
  if (!secret) return new Response('not configured', { status: 503 });
  if (req.headers.get('Authorization') !== `Bearer ${secret}`) {
    return new Response('no', { status: 401 });
  }
  return run();
}
