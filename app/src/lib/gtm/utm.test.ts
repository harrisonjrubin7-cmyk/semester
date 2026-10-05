import { describe, expect, it } from 'vitest';
import { campaignName, campaignUrl, hasStandardAttribution, parseCampaignName } from './utm';

const P = { source: 'Instagram', medium: 'organic_social', tenant: 'ExampleU', cycle: 'Fall 2027', audience: 'first-year', objective: 'Inquiry' };

describe('UTM convention', () => {
  it('builds the plan’s own example', () => {
    const url = new URL(campaignUrl('https://semester.app/for-students', { ...P, cycle: 'fall2027', audience: 'firstyear', content: 'student_story_engineering_v2' }));
    expect(url.searchParams.get('utm_source')).toBe('instagram');
    expect(url.searchParams.get('utm_medium')).toBe('organic_social');
    expect(url.searchParams.get('utm_campaign')).toBe('exampleu_fall2027_firstyear_inquiry');
    expect(url.searchParams.get('utm_content')).toBe('student_story_engineering_v2');
  });

  it('keeps the separator out of every part so a name always splits back into four', () => {
    const name = campaignName({ tenant: 'Example_U', cycle: 'Fall 2027', audience: 'Transfér', objective: 'app start' });
    expect(name).toBe('example-u_fall-2027_transfer_app-start');
    expect(parseCampaignName(name)).toEqual({ tenant: 'example-u', cycle: 'fall-2027', audience: 'transfer', objective: 'app-start' });
    expect(parseCampaignName('a_b_c')).toBeNull();
    expect(parseCampaignName('a_b_C_d')).toBeNull();
  });

  it('refuses an empty part rather than emitting a name that will not parse', () => {
    expect(() => campaignName({ ...P, audience: '  ' })).toThrow(/audience/);
  });

  it('refuses a base URL that already carries other data', () => {
    expect(() => campaignUrl('https://semester.app/x?email=a@b.edu', P)).toThrow(/no other parameters/);
    expect(() => campaignUrl('https://semester.app/x?sid=123', P)).toThrow();
  });

  it('adds a placement code for QR links, and recognises only standard links', () => {
    const qr = campaignUrl('https://semester.app/start', { ...P, source: 'qr', medium: 'print' }, 'Rand Hall Kiosk');
    expect(new URL(qr).searchParams.get('loc')).toBe('rand-hall-kiosk');
    expect(hasStandardAttribution(qr)).toBe(true);
    expect(hasStandardAttribution('https://semester.app/start')).toBe(false);
    expect(hasStandardAttribution(`${qr}&fbclid=abc`)).toBe(false);
    expect(hasStandardAttribution('not a url')).toBe(false);
  });
});
