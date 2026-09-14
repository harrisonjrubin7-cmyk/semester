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
