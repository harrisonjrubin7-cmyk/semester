export interface ProductivitySourceCheckDeps {
  authenticated(auth: string): Promise<boolean>;
  approvedHosts: readonly string[];
  resolve(host: string, record: 'A' | 'AAAA'): Promise<readonly string[]>;
  fetch(url: URL, init: RequestInit): Promise<Response>;
  now(): string;
}

export interface ProductivitySourceCheckAnswer {
  error?: string;
  state?: 'available' | 'unavailable';
  status?: number;
  excerptFound?: boolean;
  url?: string;
  checkedAt?: string;
}

const privateAddress = (address: string) => {
  if (address.includes(':')) return !/^2[0-9a-f]{3}:/i.test(address) || /^2001:db8:/i.test(address);
  const parts = address.split('.').map(Number);
  return parts.length !== 4
    || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
    || parts[0] === 0
    || parts[0] === 10
    || parts[0] === 127
    || parts[0] >= 224
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && (parts[1] === 168 || parts[1] === 0))
    || (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127)
    || (parts[0] === 198 && (parts[1] === 18 || parts[1] === 19));
};

async function approvedUrl(raw: string, deps: ProductivitySourceCheckDeps): Promise<URL> {
  const url = new URL(raw);
  const host = url.hostname.toLowerCase();
  if (
    url.protocol !== 'https:'
    || url.username
    || url.password
    || (url.port && url.port !== '443')
    || !(/^[a-z0-9.-]+\.edu$/.test(host) || deps.approvedHosts.includes(host))
  ) throw new Error('Use a public .edu source or an institution-approved source host.');
  if (url.search) throw new Error('Use a public source URL without query tokens.');
  const addresses = (await Promise.allSettled([deps.resolve(host, 'A'), deps.resolve(host, 'AAAA')]))
    .flatMap((result) => result.status === 'fulfilled' ? result.value : []);
  if (!addresses.length || addresses.some(privateAddress)) throw new Error('Source must resolve exclusively to public addresses.');
  return url;
}

function withoutRawTextElements(value: string) {
  let result = value;
  for (const tag of ['script', 'style']) {
    let searchFrom = 0;
    while (searchFrom < result.length) {
      const lower = result.toLowerCase();
      const start = lower.indexOf(`<${tag}`, searchFrom);
      if (start < 0) break;
      const afterName = lower[start + tag.length + 1];
      if (afterName && /[a-z0-9:_-]/.test(afterName)) {
        searchFrom = start + tag.length + 1;
        continue;
      }
      const openEnd = lower.indexOf('>', start + tag.length + 1);
      if (openEnd < 0) return result.slice(0, start);
      const close = lower.indexOf(`</${tag}`, openEnd + 1);
      if (close < 0) return result.slice(0, start);
      const closeEnd = lower.indexOf('>', close + tag.length + 2);
      if (closeEnd < 0) return result.slice(0, start);
      result = `${result.slice(0, start)} ${result.slice(closeEnd + 1)}`;
      searchFrom = start + 1;
    }
  }
  return result;
}

function withoutTags(value: string) {
  let result = '';
  let insideTag = false;
  for (const character of value) {
    if (!insideTag && character === '<') {
      insideTag = true;
      result += ' ';
    } else if (insideTag && character === '>') {
      insideTag = false;
      result += ' ';
    } else if (!insideTag) result += character;
  }
  return result;
}

const normalize = (value: string) => withoutTags(withoutRawTextElements(value))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim();

export async function handleProductivitySourceCheck(
  req: Request,
  deps: ProductivitySourceCheckDeps | null,
  cors: Record<string, string> = {},
): Promise<Response> {
  const headers = { ...cors, 'Content-Type': 'application/json' };
  const response = (status: number, body: ProductivitySourceCheckAnswer) =>
    new Response(JSON.stringify(body), { status, headers });

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return response(405, { error: 'Use POST.' });
  if (!deps) return response(503, { error: 'Source checking is not configured.' });

  try {
    const auth = req.headers.get('authorization') ?? '';
    if (!auth || !(await deps.authenticated(auth))) return response(401, { error: 'Sign in before checking sources.' });

    const raw = await req.text();
    if (raw.length>5000) return response(413, { error: 'Source request is too large.' });
    const input = JSON.parse(raw) as { url?: unknown; excerpt?: unknown };
    if (
      typeof input.url !== 'string'
      || typeof input.excerpt !== 'string'
      || input.url.length > 2000
      || input.excerpt.length > 1000
    ) return response(400, { error: 'Provide a public URL and a short exact excerpt.' });

    let url = await approvedUrl(input.url, deps);
    const signal = AbortSignal.timeout(8000);
    let page: Response | undefined;
    for (let i = 0; i < 4; i += 1) {
      page = await deps.fetch(url, { redirect: 'manual', signal, headers: { Accept: 'text/html,text/plain' } });
      if (page.status >= 300 && page.status < 400) {
        const next = page.headers.get('location');
        await page.body?.cancel();
        if (!next) throw new Error('Source redirect has no destination.');
        url = await approvedUrl(new URL(next, url).href, deps);
        page = undefined;
        continue;
      }
      break;
    }
    if (!page) throw new Error('Too many source redirects.');
    if (!page.ok) {
      await page.body?.cancel();
      return response(200, { state: 'unavailable', status: page.status, url: url.href, checkedAt: deps.now() });
    }
    if (!/text\/(html|plain)/i.test(page.headers.get('content-type') ?? '')) {
      await page.body?.cancel();
      throw new Error('Use a public HTML or plain-text source.');
    }
    const reader = page.body?.getReader();
    if (!reader) throw new Error('Source returned no content.');
    const decoder = new TextDecoder();
    let text = '';
    let bytes = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.length;
        if (bytes>512000) throw new Error('Source exceeds the bounded check size.');
        text += decoder.decode(chunk.value, { stream: true });
      }
      text += decoder.decode();
    } finally {
      await reader.cancel();
    }
    const excerpt = normalize(input.excerpt);
    return response(200, {
      state: 'available',
      excerptFound: Boolean(excerpt) && normalize(text).includes(excerpt),
      url: url.href,
      checkedAt: deps.now(),
    });
  } catch (error) {
    return response(400, { error: error instanceof Error ? error.message : 'Source check failed.' });
  }
}
