import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '../../..');
const site = [
  readFileSync(join(root, 'company-site/index.html'), 'utf8'),
  readFileSync(join(root, 'company-site/site.js'), 'utf8'),
].join('\n');

describe('company-site production availability', () => {
  it('keeps signup and billing claims behind their production activation gates', () => {
    expect(site).toContain('sign-up may ask for an invite');
    expect(site).toContain('Checkout is not available yet');
    expect(site).not.toMatch(/public signup is open/i);
    expect(site).not.toMatch(/no invitation required/i);
    expect(site).not.toMatch(/checkout runs on (?:stripe )?test keys/i);
    expect(site).not.toMatch(/hosted stripe checkout passed/i);
    expect(site).not.toMatch(/plus can be bought/i);
  });
  it('publishes verified personal export and deletion, with retained-record limits', () => {
    expect(site).toContain('["Full self-service data export","Yes","Yes","Yes","Yes","av"]');
    expect(site).toContain('["Self-service account deletion with a receipt","av"');
    expect(site).toContain('withheld records belonging to other people');
    expect(site).toContain('Legal holds and retained financial records');
    expect(site).not.toContain('the full export is in development');
    expect(site).not.toContain('Exports the copy on your device only, not everything we hold.');
  });

  it('distinguishes deployed LTI software from an approved institutional connection', () => {
    expect(site).not.toContain("The LTI service isn’t deployed");
    expect(site).not.toContain("The LTI service isn't deployed");
    expect(site).not.toContain('Canvas; not deployed to the live project');
    expect(site).toContain('no institution has registered a platform');
    expect(site).toContain('["LTI 1.3 launch (Canvas)","No","Optional","Yes","Yes","bt"]');
  });

  it('leaves billing and staffed support unavailable until their real activation gates pass', () => {
    expect(site).toContain('["Paid plans (Plus) and invoicing","Yes","Yes","Yes","Yes","ip"]');
    expect(site).toContain('["24/7 critical support","No","No","No","Yes","pl"]');
    expect(site).toContain('318 of 318, checked October 1, 2026');
  });

  it('holds every previously non-green roadmap card to code-complete status without erasing its external gate', () => {
    const roadmap = site.slice(site.indexOf('const RM='), site.indexOf('document.getElementById("roadmap-cols")'));
    expect(site).toContain('Last updated October 1, 2026');
    expect(roadmap).toContain('["Built & tested, evidence pending","dev"');
    expect(roadmap).toContain('["Built & tested, activation gated","ex"');
    expect(roadmap).not.toContain('["In active development"');
    expect(roadmap).toContain('manual assistive-technology review and an external evaluation remain open');
    expect(roadmap).toContain('live-payment evidence and commercial activation remain open');
    expect(roadmap).toContain('provider credentials and live activation remain open');
    expect(roadmap).toContain('no institution platform is registered or verified');
    expect(roadmap).toContain('notification deployment, staffed production enablement and UAT remain open');
    expect(roadmap).toContain('an approved institution feed remains open');

    for (const path of [
      'app/src/lib/captions.test.ts',
      'app/src/a11y/fielderror.test.ts',
      'app/src/lib/billing/checkout.test.ts',
      'app/src/lib/connect.scopes.test.ts',
      'app/src/lib/connect.test.ts',
      'app/src/lib/lti.test.ts',
      'app/server/institution/scim.test.ts',
      'app/src/components/console/supportqueue.test.tsx',
      'app/src/lib/registrar.test.ts',
    ]) expect(existsSync(join(root, path)), path).toBe(true);
  });
});
