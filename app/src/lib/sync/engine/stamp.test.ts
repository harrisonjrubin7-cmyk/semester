import { describe, expect, it } from 'vitest';
import { stampToVersion, versionToStamp } from './stamp';

describe('stampToVersion', () => {
  it('reads a Postgres timestamptz to the microsecond', () => {
    expect(stampToVersion('2026-10-04T11:28:25.123456+00:00')).toBe(Date.parse('2026-10-04T11:28:25Z') * 1000 + 123456);
  });
  it('treats a short fraction as the digits it is, not as milliseconds', () => {
    expect(stampToVersion('2026-10-04T11:28:25.5+00:00') - stampToVersion('2026-10-04T11:28:25+00:00')).toBe(500000);
    expect(stampToVersion('2026-10-04T11:28:25.000001Z') - stampToVersion('2026-10-04T11:28:25Z')).toBe(1);
  });
  it('honours an offset, so +02:00 and Z name the same instant', () => {
    expect(stampToVersion('2026-10-04T13:28:25.250000+02:00')).toBe(stampToVersion('2026-10-04T11:28:25.250000Z'));
    expect(stampToVersion('2026-10-04T06:58:25-04:30')).toBe(stampToVersion('2026-10-04T11:28:25Z'));
  });
  it('accepts the space Postgres prints between date and time', () => {
    expect(stampToVersion('2026-10-04 11:28:25.1+00')).toBe(stampToVersion('2026-10-04T11:28:25.1Z'));
  });
  it('refuses what is not a timestamp', () => {
    expect(() => stampToVersion('yesterday')).toThrow(RangeError);
    expect(() => stampToVersion('2026-10-04')).toThrow(RangeError);
  });
  it('orders two writes inside one millisecond', () => {
    expect(stampToVersion('2026-10-04T11:28:25.000900Z')).toBeGreaterThan(stampToVersion('2026-10-04T11:28:25.000100Z'));
  });
});

describe('versionToStamp', () => {
  it('round-trips to the same instant, to the microsecond, for any stamp', () => {
    for (const s of ['2026-10-04T11:28:25.123456Z', '2026-12-31T23:59:59.999999Z', '2027-01-01T00:00:00.000000Z', '2026-02-28T00:00:00.000001Z']) {
      expect(stampToVersion(versionToStamp(stampToVersion(s)))).toBe(stampToVersion(s));
      expect(versionToStamp(stampToVersion(s))).toBe(s);
    }
  });
  it('stays an exact integer for decades', () => {
    const far = stampToVersion('2100-01-01T00:00:00.999999Z');
    expect(Number.isSafeInteger(far)).toBe(true);
  });
});
