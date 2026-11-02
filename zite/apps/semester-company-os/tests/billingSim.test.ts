import { test, eq } from './harness';
import { applyEvent, newLedger, runScenario, SCENARIOS, step, QUOTE, INVOICE, PAYMENT, entitlementFor } from '../src/lib/billingSim';

const sc = (n: string) => runScenario(SCENARIOS.find((s) => s.name === n)!);
test('duplicate webhook is processed once', () => { const l = sc('Duplicate webhook'); eq(l.paidMinor, 250000); eq(l.processed.length, 1); });
test('failed payment → grace, then suspended', () => {
  const after1 = applyEvent(newLedger('active'), { id: 'a', type: 'payment.failed' });
  eq(after1.entitlement, 'grace');
  eq(sc('Failed payment and grace period').entitlement, 'suspended');
});
test('payment during grace restores access', () => eq(sc('Recovery during grace').entitlement, 'active'));
test('refund cannot exceed payments', () => { const l = sc('Refund'); eq(l.refundedMinor, 50000); eq(l.log.some((x) => x.includes('refund exceeds')), true); });
test('cancelled subscription stays cancelled after a late payment', () => { const l = sc('Cancellation'); eq(l.subscription, 'cancelled'); eq(l.entitlement, 'revoked'); });
test('quote cannot be sent before approval', () => eq(step(QUOTE, 'draft', 'send').ok, false));
test('quote happy path', () => { let s = 'draft'; for (const e of ['review', 'approve', 'send', 'accept']) { const r = step(QUOTE, s, e); eq(r.ok, true); s = r.state; } eq(s, 'accepted'); });
test('voided invoice cannot be paid', () => eq(step(INVOICE, 'voided', 'pay_full').ok, false));
test('failed payment cannot be refunded', () => eq(step(PAYMENT, 'failed', 'refund_full').ok, false));
test('entitlement follows subscription state only', () => { eq(entitlementFor('trialing'), 'active'); eq(entitlementFor('past_due'), 'grace'); eq(entitlementFor('ended'), 'revoked'); });
test('non-integer or negative amounts are rejected', () => { const l = applyEvent(newLedger(), { id: 'x', type: 'payment.succeeded', amount: -5 }); eq(l.paidMinor, 0); eq(l.processed.length, 0); });
