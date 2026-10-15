/// <reference types="node" />
import { createHmac } from 'node:crypto';

/**
 * The events the Stripe normalizer and the webhook handler are held to, and the
 * constants that make them reproducible. Shared by `normalize.test.ts` and by
 * the one-off that recorded `stripe.golden.json` from the handler **before** it
 * was moved to read through the adapter.
 */

export const SECRET = 'whsec_parity';
export const KEY = 'sk_test_parity';
export const NOW = 1790000000;
export const CHECKOUT = '3f2b8c1e-9a4d-4e7b-8c21-5d6f7a8b9c0d';

export const sign = (body: string) => `t=${NOW},v1=${createHmac('sha256', SECRET).update(`${NOW}.${body}`).digest('hex')}`;
export const event = (type: string, object: Record<string, unknown>, id = 'evt_p1') =>
  JSON.stringify({ id, type, livemode: false, created: NOW - 5, data: { object } });

/** [name, raw body]. The name is the key into `stripe.golden.json`. */
export const cases: Array<[string, string]> = [
  ['an invoice payment failure', event('invoice.payment_failed', { id: 'in_1', subscription: 'sub_1', amount_due: 799, currency: 'usd', created: NOW - 60 })],
  ['a paid invoice with tax listed in total_taxes', event('invoice.paid', {
    id: 'in_paid', subscription: 'sub_1', amount_paid: 864, subtotal_excluding_tax: 799, total_taxes: [{ amount: 65 }], currency: 'usd', created: NOW - 60 })],
  ['a succeeded invoice with the older total_tax_amounts shape', event('invoice.payment_succeeded', {
    id: 'in_old', subscription: 'sub_1', amount_paid: 864, subtotal: 864, total_tax_amounts: [{ amount: 65 }, { amount: 10 }], currency: 'usd', created: NOW - 60, due_date: NOW + 86400 })],
  ['a finalization failure that needs the customer’s location', event('invoice.finalization_failed', {
    id: 'in_tax', subscription: 'sub_1', amount_due: 815, subtotal_excluding_tax: 799, total_excluding_tax: 750,
    total_taxes: [{ amount: 65 }], currency: 'usd', created: NOW - 60, automatic_tax: { status: 'requires_location_inputs' } })],
  ['a finalization failure that is a tax outage', event('invoice.finalization_failed', {
    id: 'in_outage', subscription: 'sub_1', amount_due: 799, subtotal_excluding_tax: 799, total_taxes: [], currency: 'usd', created: NOW - 60,
    automatic_tax: { status: 'failed' } })],
  ['an invoice whose subscription is under parent.subscription_details', event('invoice.paid', {
    id: 'in_new', parent: { subscription_details: { subscription: 'sub_new' } }, amount_paid: 799, currency: 'usd', created: NOW - 60 })],
  ['an invoice whose subscription is an expanded object', event('invoice.paid', {
    id: 'in_exp', subscription: { id: 'sub_exp' }, amount_paid: 799, currency: 'usd', created: NOW - 60 })],
  ['an invoice event with no subscription at all', event('invoice.payment_failed', { id: 'in_nosub', amount_due: 799, currency: 'usd', created: NOW - 60 })],
  ['an invoice event with no id', event('invoice.paid', { subscription: 'sub_1', amount_paid: 799 })],
  ['an invoice with a non-numeric amount', event('invoice.paid', { id: 'in_nan', subscription: 'sub_1', amount_paid: 'lots', currency: 'usd' })],
  ['a completed subscription checkout', event('checkout.session.completed', {
    client_reference_id: CHECKOUT, mode: 'subscription', subscription: 'sub_1', customer: 'cus_1' })],
  ['a completed checkout named only in metadata', event('checkout.session.completed', {
    metadata: { semester_checkout_id: CHECKOUT }, mode: 'subscription', subscription: { id: 'sub_m' }, customer: { id: 'cus_m' } })],
  ['a completed checkout that is not a subscription', event('checkout.session.completed', { client_reference_id: CHECKOUT, mode: 'payment' })],
  ['a completed checkout with a client reference that is not a uuid', event('checkout.session.completed', { client_reference_id: 'not-a-uuid', mode: 'subscription' })],
  ['a subscription update with the period on the subscription', event('customer.subscription.updated', {
    id: 'sub_1', status: 'active', current_period_start: NOW - 100, current_period_end: NOW + 2592000, cancel_at_period_end: true })],
  ['a subscription update with the period on its items', event('customer.subscription.updated', {
    id: 'sub_1', status: 'past_due', items: { data: [{ current_period_start: NOW - 100, current_period_end: NOW + 100 }] } })],
  ['a subscription deletion', event('customer.subscription.deleted', { id: 'sub_1', status: 'canceled' })],
  ['a subscription deletion that still reports an active status', event('customer.subscription.deleted', { id: 'sub_1', status: 'active' })],
  ['a subscription whose status is unknown', event('customer.subscription.updated', { id: 'sub_1', status: 'something_new' })],
  ['a subscription with no id', event('customer.subscription.updated', { status: 'active' })],
  ['a refund', event('charge.refunded', { amount_refunded: 799 })],
  ['a refund with no amount', event('charge.refunded', {})],
  ['a dispute', event('charge.dispute.created', { amount: 799 })],
  ['an event of a type nobody handles', event('customer.created', { id: 'cus_1' })],
  ['an event with no object at all', JSON.stringify({ id: 'evt_n', type: 'ping', livemode: false, created: NOW - 5 })],
];
