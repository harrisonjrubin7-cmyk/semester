import { test, eq } from './harness';
import { supplierKey, looksSplit, approvalsNeeded, matchInvoice, payable } from '../src/lib/procureRules';

test('supplier names compare normalised', () => { eq(supplierKey(' ACME Supply Co. '), supplierKey('acme supply co')); });
test('threshold splitting is detected', () => {
  eq(looksSplit({ amount: 250000, threshold: 500000, recent: [300000] }), true);
  eq(looksSplit({ amount: 100000, threshold: 500000, recent: [300000] }), false);
  eq(looksSplit({ amount: 250000, threshold: 500000, recent: [] }), false);
  eq(looksSplit({ amount: 600000, threshold: 500000, recent: [300000] }), false);
  eq(approvalsNeeded({ amount: 100, threshold: 500000, split: true }), 2);
  eq(approvalsNeeded({ amount: 600000, threshold: 500000, split: false }), 2);
  eq(approvalsNeeded({ amount: 100, threshold: 500000, split: false }), 1);
});
test('match exceptions and payability', () => {
  eq(matchInvoice({ ordered: 300000, received: 200000, invoicedBefore: 0, amount: 200000, tolerancePct: 5 }), null);
  eq(matchInvoice({ ordered: 300000, received: 200000, invoicedBefore: 200000, amount: 100000, tolerancePct: 5 }), 'Invoiced total exceeds what was received beyond tolerance');
  eq(matchInvoice({ ordered: 300000, received: 300000, invoicedBefore: 0, amount: 316000, tolerancePct: 5 }), 'Invoiced total exceeds the order beyond tolerance');
  eq(matchInvoice({ ordered: 300000, received: 300000, invoicedBefore: 0, amount: 315000, tolerancePct: 5 }), null);
  eq(payable('exception'), false);
  eq(payable('accepted'), true);
});
