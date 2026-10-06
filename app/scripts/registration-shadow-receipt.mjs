/**
 * Sandbox for one section in dual-run.
 *
 * Run from `app/`: `node scripts/registration-shadow-receipt.mjs`
 * No database, no network, no `registration_enroll`. The SIS notice below is
 * a fixture. A receipt that takes a seat exits 1.
 */
import { shadowReceipt } from '../src/lib/enrollment/shadowreceipt.ts';

const receipt = shadowReceipt({
  externalRef: 'sis-ref-1001',
  sectionCode: 'MATH 101',
  term: '2026FA',
  outcome: 'enrolled',
});

if (receipt.authority !== 'sis' || receipt.wroteSeat !== false || receipt.source !== 'imported') {
  console.error('shadow receipt claimed a Semester seat');
  process.exit(1);
}

console.log(JSON.stringify(receipt));
