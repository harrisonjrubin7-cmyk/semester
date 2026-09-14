/**
 * Is this address somewhere on the public internet?
 *
 * Asked by anything in this repo that fetches a URL somebody typed. The one
 * that matters today is the dev server's calendar forwarder in
 * `vite.config.ts`: it takes `?url=` from the page and fetches it with the
 * developer's own network, which reaches everything a browser cannot —
 * `127.0.0.1`, the router, a database on the LAN, and on a cloud box the
 * metadata service at `169.254.169.254` that hands out credentials to anyone
 * who asks.
 *
 * That forwarder used to check the scheme and nothing else, and its comment
 * said https "cannot be pointed at the machine it runs on", which is not true
 * of `https://127.0.0.1:8443/` or of any private name with a certificate. On a
 * laptop serving only itself that is a small thing; `vite --host` is how this
 * app is opened on a phone, and at that point every device on the café wifi
 * has a forwarder into the developer's machine.
 *
 * ## What this can and cannot do
 *
 * It refuses by literal and by name. It cannot resolve a hostname — that
 * happens inside `fetch`, after this has had its say — so a public name
 * pointed at `127.0.0.1` still gets through. This is the cheap refusal that
 * removes every form somebody would actually type or be redirected to; the
 * bound on what the answer may be (a calendar, and a small one) is what stands
 * behind it.
 *
 * Deliberately a copy of the rule in `supabase/functions/fetchcal/index.ts`
 * rather than a shared import: that one is deployed alone to Deno by the
 * Supabase CLI and cannot reach into this directory. The two are checked
 * against the same list, and this is the copy with the tests.
 */

/** Hosts nothing on the public internet is called, refused by name and by literal. */
export function privateHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (!h) return true;
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local')) return true;
  if (h.endsWith('.internal') || h.endsWith('.home.arpa')) return true;
  // IPv6: loopback, the unspecified address, and the unique-local and
  // link-local blocks.
  if (h === '::1' || h === '::' || /^f[cd][0-9a-f]{2}:/.test(h) || /^fe80:/.test(h)) return true;
  // An IPv4 address written inside IPv6, which is the same machine by another
  // spelling: ::ffff:127.0.0.1.
  const mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(h);
  if (mapped) return privateHost(mapped[1]);
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    // 169.254.0.0/16 — link-local, and where every cloud keeps its metadata.
    if (a === 169 && b === 254) return true;
    // 100.64.0.0/10 — carrier-grade NAT, and what Tailscale hands out.
    if (a === 100 && b >= 64 && b <= 127) return true;
  }
  return false;
}

/**
 * A calendar address this may fetch, or why not.
 *
 * https only: a calendar link carries a token that is the whole of the
 * authentication for somebody's timetable, and http would put it on the wire.
 */
export function publicCalendarUrl(raw: string): { ok: true; url: URL } | { ok: false; why: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, why: 'Pass ?url= an https calendar address.' };
  }
  if (url.protocol !== 'https:') return { ok: false, why: 'Calendar links have to be https.' };
  if (privateHost(url.hostname)) return { ok: false, why: 'That address is not on the public internet.' };
  return { ok: true, url };
}
