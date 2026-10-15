import { describe, expect, it } from 'vitest';
import { privateHost, publicCalendarUrl } from './publichost';

describe('privateHost', () => {
  it('refuses loopback by every spelling it is written in', () => {
    for (const host of ['localhost', 'LOCALHOST', 'app.localhost', '127.0.0.1', '127.1.2.3', '::1', '[::1]', '::ffff:127.0.0.1']) {
      expect(privateHost(host), host).toBe(true);
    }
  });

  it('refuses the cloud metadata address, which is the whole trick', () => {
    expect(privateHost('169.254.169.254')).toBe(true);
    expect(privateHost('169.254.0.1')).toBe(true);
  });

  it('refuses the private IPv4 ranges and nothing beside them', () => {
    expect(privateHost('10.0.0.1')).toBe(true);
    expect(privateHost('172.16.0.1')).toBe(true);
    expect(privateHost('172.31.255.255')).toBe(true);
    expect(privateHost('192.168.1.1')).toBe(true);
    expect(privateHost('100.64.0.1')).toBe(true);
    // The addresses either side of 172.16/12, which are public.
    expect(privateHost('172.15.0.1')).toBe(false);
    expect(privateHost('172.32.0.1')).toBe(false);
    expect(privateHost('100.63.0.1')).toBe(false);
    expect(privateHost('100.128.0.1')).toBe(false);
  });

  it('refuses the IPv6 private blocks', () => {
    expect(privateHost('fd00::1')).toBe(true);
    expect(privateHost('fc00::1')).toBe(true);
    expect(privateHost('fe80::1')).toBe(true);
    expect(privateHost('2606:4700::1111')).toBe(false);
  });

  /**
   * A URL's `hostname` rewrites an IPv4 address carried inside IPv6 to hex:
   * `https://[::ffff:169.254.169.254]/` arrives as `[::ffff:a9fe:a9fe]`. The rule used to recognise
   * only the dotted spelling, which no URL produces, so the cloud metadata address and loopback
   * passed as "public" through this form. These go through `new URL` the way a request does.
   */
  describe('an IPv4 address carried inside IPv6, as a URL spells it', () => {
    const viaUrl = (literal: string) => new URL(`https://[${literal}]/x`).hostname;

    it.each([
      ['mapped loopback', '::ffff:127.0.0.1'],
      ['mapped cloud metadata', '::ffff:169.254.169.254'],
      ['mapped private 10/8', '::ffff:10.0.0.1'],
      ['mapped private 192.168/16', '::ffff:192.168.1.1'],
      ['mapped, already hex', '::ffff:a9fe:a9fe'],
      ['compatible loopback', '::127.0.0.1'],
      ['compatible cloud metadata', '::169.254.169.254'],
      ['NAT64 of cloud metadata', '64:ff9b::169.254.169.254'],
      ['NAT64 of loopback', '64:ff9b::7f00:1'],
      ['6to4 of cloud metadata', '2002:a9fe:a9fe::1'],
      ['6to4 of loopback', '2002:7f00:1::'],
    ])('refuses %s', (_name, literal) => {
      expect(privateHost(viaUrl(literal)), `${literal} -> ${viaUrl(literal)}`).toBe(true);
    });

    it.each([
      ['mapped public', '::ffff:8.8.8.8'],
      ['NAT64 of a public address', '64:ff9b::808:808'],
      ['6to4 of a public address', '2002:808:808::1'],
      ['an ordinary global address', '2606:4700::1111'],
      ['a documentation-range address', '2001:db8::1'],
    ])('still allows %s', (_name, literal) => {
      expect(privateHost(viaUrl(literal)), `${literal} -> ${viaUrl(literal)}`).toBe(false);
    });

    it('goes through publicCalendarUrl the way a request does', () => {
      expect(publicCalendarUrl('https://[::ffff:169.254.169.254]/latest/meta-data/').ok).toBe(false);
      expect(publicCalendarUrl('https://[::ffff:7f00:1]:8443/').ok).toBe(false);
    });
  });

  it('refuses the names a local network hands out', () => {
    expect(privateHost('printer.local')).toBe(true);
    expect(privateHost('db.internal')).toBe(true);
    expect(privateHost('router.home.arpa')).toBe(true);
  });

  it('allows a real calendar host', () => {
    for (const host of ['brightspace.vanderbilt.edu', 'outlook.office365.com', 'calendar.google.com', 'p01-calendars.icloud.com']) {
      expect(privateHost(host), host).toBe(false);
    }
  });
});

describe('publicCalendarUrl', () => {
  it('takes an https address on a public host', () => {
    const got = publicCalendarUrl('https://brightspace.vanderbilt.edu/feed/user/abc.ics');
    expect(got.ok).toBe(true);
  });

  it('refuses http, which would put the feed token on the wire', () => {
    expect(publicCalendarUrl('http://example.com/a.ics')).toMatchObject({ ok: false });
  });

  it('refuses the schemes that are not a fetch at all', () => {
    expect(publicCalendarUrl('file:///etc/passwd')).toMatchObject({ ok: false });
    expect(publicCalendarUrl('webcal://example.com/a.ics')).toMatchObject({ ok: false });
  });

  // The bug this exists for: the dev forwarder checked the scheme and let
  // https through to the machine it was running on.
  it('refuses https pointed at the machine it runs on', () => {
    expect(publicCalendarUrl('https://127.0.0.1:8443/')).toMatchObject({ ok: false });
    expect(publicCalendarUrl('https://localhost/a.ics')).toMatchObject({ ok: false });
    expect(publicCalendarUrl('https://169.254.169.254/latest/meta-data/')).toMatchObject({ ok: false });
  });

  it('refuses something that is not an address', () => {
    expect(publicCalendarUrl('')).toMatchObject({ ok: false });
    expect(publicCalendarUrl('not a url')).toMatchObject({ ok: false });
  });
});
