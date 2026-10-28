import { describe, expect, it, vi } from 'vitest';
import {
  handleProductivitySourceCheck,
  type ProductivitySourceCheckAnswer,
  type ProductivitySourceCheckDeps,
} from '../../../supabase/functions/_shared/productivitysourcecheck';

const URL = 'https://library.example.edu/article';
const post = (auth?: string, body: unknown = { url: URL, excerpt: 'Exact source text' }) => new Request(
  'https://x.supabase.co/functions/v1/productivity-sourcecheck',
  { method: 'POST', headers: auth ? { Authorization: auth } : {}, body: JSON.stringify(body) },
);

function dependencies(overrides: Partial<ProductivitySourceCheckDeps> = {}) {
  const deps: ProductivitySourceCheckDeps = {
    authenticated: vi.fn(async (auth) => auth === 'Bearer good-token'),
    approvedHosts: [],
    resolve: vi.fn(async (_host, record) => record === 'A' ? ['203.0.113.8'] : ['2001:4860:4860::8888']),
    fetch: vi.fn(async () => new Response('<p>Exact source text</p>', { headers: { 'Content-Type': 'text/html' } })),
    now: () => '2026-10-28T20:00:00.000Z',
    ...overrides,
  };
  return deps;
}

const read = async (response: Response) => (await response.json()) as ProductivitySourceCheckAnswer;

describe('the productivity source-check function', () => {
  it('answers preflight without authentication or network work', async () => {
    const deps = dependencies();
    const response = await handleProductivitySourceCheck(
      new Request(URL, { method: 'OPTIONS' }), deps, { 'Access-Control-Allow-Origin': 'https://app.test' },
    );
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://app.test');
    expect(deps.authenticated).not.toHaveBeenCalled();
    expect(deps.fetch).not.toHaveBeenCalled();
  });

  it('fails closed when the deployed function has no service configuration', async () => {
    const response = await handleProductivitySourceCheck(post('Bearer good-token'), null);
    expect(response.status).toBe(503);
    expect(await read(response)).toEqual({ error: 'Source checking is not configured.' });
  });

  it('rejects a missing, invalid or unreadable session before DNS or fetch', async () => {
    for (const authenticated of [undefined, 'Bearer wrong-token', 'Bearer auth-down']) {
      const deps = dependencies({
        authenticated: vi.fn(async (auth) => {
          if (auth === 'Bearer auth-down') throw new Error('auth unavailable');
          return auth === 'Bearer good-token';
        }),
      });
      const response = await handleProductivitySourceCheck(post(authenticated), deps);
      expect(response.status, String(authenticated)).toBe(authenticated === 'Bearer auth-down' ? 400 : 401);
      expect(deps.resolve, String(authenticated)).not.toHaveBeenCalled();
      expect(deps.fetch, String(authenticated)).not.toHaveBeenCalled();
    }
  });

  it('rejects private DNS answers before fetch', async () => {
    const deps = dependencies({ resolve: vi.fn(async () => ['127.0.0.1']) });
    const response = await handleProductivitySourceCheck(post('Bearer good-token'), deps);
    expect(response.status).toBe(400);
    expect((await read(response)).error).toMatch(/public addresses/i);
    expect(deps.fetch).not.toHaveBeenCalled();
  });

  it('checks a bounded public source after authentication', async () => {
    const deps = dependencies();
    const response = await handleProductivitySourceCheck(post('Bearer good-token'), deps);
    expect(response.status).toBe(200);
    expect(await read(response)).toEqual({
      state: 'available', excerptFound: true, url: URL, checkedAt: '2026-10-28T20:00:00.000Z',
    });
    expect(deps.authenticated).toHaveBeenCalledWith('Bearer good-token');
    expect(deps.fetch).toHaveBeenCalledTimes(1);
  });

  it('does not treat malformed script or style element content as source text', async () => {
    const deps = dependencies({
      fetch: vi.fn(async () => new Response(
        '<script>Injected source text</script\t\n bar><style>Injected source text</style ><p>Exact source text</p>',
        { headers: { 'Content-Type': 'text/html' } },
      )),
    });
    const response = await handleProductivitySourceCheck(
      post('Bearer good-token', { url: URL, excerpt: 'Injected source text' }),
      deps,
    );
    expect(response.status).toBe(200);
    expect((await read(response)).excerptFound).toBe(false);
  });

  it('preserves literal less-than characters in plain-text sources and excerpts', async () => {
    const deps = dependencies({
      fetch: vi.fn(async () => new Response(
        'The threshold value < 5 is exact source text.',
        { headers: { 'Content-Type': 'text/plain' } },
      )),
    });
    const response = await handleProductivitySourceCheck(
      post('Bearer good-token', { url: URL, excerpt: 'value < 5' }),
      deps,
    );
    expect(response.status).toBe(200);
    expect((await read(response)).excerptFound).toBe(true);
  });
});
