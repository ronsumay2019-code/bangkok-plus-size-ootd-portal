import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupInvoiceLines, invoiceTotals, invoiceTitle, invoiceBlocks, wrapWords, splitPages, php, type InvoiceArtworkInput } from '../src/utils/invoiceArtwork';

const line = { code: 'T7', description: 'Linen set', size: '3XL', colour: 'Black', unitPrice: 650, qty: 1 };
const input: InvoiceArtworkInput = { buyerName: 'SAMPLE Buyer A', kind: 'live', number: 'SAMPLE-001', status: 'AWAITING PAYMENT', liveTitle: 'SAMPLE LIVE', liveDate: '25 Oct 2026', invoiceDate: '2026-10-25T08:00:00Z', dueDate: '2026-10-26T08:00:00Z', lines: [line, line, line], shipping: 80 };

test('groups identical host-derived items, retains different sizes, colours and prices', () => {
  const grouped = groupInvoiceLines([line, { ...line, qty: 2 }, { ...line, size: '2XL' }, { ...line, colour: 'Red' }, { ...line, unitPrice: 700 }]);
  assert.equal(grouped.length, 4);
  assert.equal(grouped[0].qty, 3);
  assert.equal(grouped[0].amount, 1950);
  const totals = invoiceTotals(input.lines, 80);
  assert.deepEqual({ subtotal: totals.subtotal, total: totals.total, balance: totals.balance }, { subtotal: 1950, total: 2030, balance: 2030 });
});
test('money arithmetic uses cents, rejects invalid amounts and quantities', () => {
  assert.equal(invoiceTotals([{ ...line, unitPrice: 0.1, qty: 3 }], 0.2).total, 0.5);
  for (const unitPrice of [-1, NaN, Infinity, 0.001]) assert.throws(() => groupInvoiceLines([{ ...line, unitPrice }]));
  for (const qty of [0, -1, 1.5, NaN]) assert.throws(() => groupInvoiceLines([{ ...line, qty }]));
  assert.equal(php(1950), '₱1,950.00');
});
test('titles distinguish live and pre-order invoices', () => {
  assert.equal(invoiceTitle('live'), 'LIVE ORDER INVOICE');
  assert.equal(invoiceTitle('preorder'), 'PRE-ORDER INVOICE');
});
test('invoice blocks use item fields and quantities and only caller-provided payment slots', () => {
  const blocks = invoiceBlocks(input);
  assert.ok(blocks.some(b => b.columns?.[0] === 'T7 Linen set · Black\n3XL' && b.columns[1] === '3' && b.columns[3] === '₱1,950.00'));
  assert.deepEqual(blocks.find(b => b.paymentQRs)?.paymentQRs, ['gcash', 'maya', 'bank'].map(id => ({ id, active: null })));
  const active = { account: 'SAMPLE', number: 'SAMPLE', image: 'data:image/png;base64,SAMPLE' };
  assert.deepEqual(invoiceBlocks({ ...input, paymentQRs: [{ id: 'maya', active }] }).find(b => b.paymentQRs)?.paymentQRs?.[1], { id: 'maya', active });
  assert.ok(blocks.some(b => b.columns?.[0] === 'Payment window' && b.columns[1] === '24 hours'));
});
test('wrapWords wraps at words, preserves paragraphs, and splits overlong words', () => {
  const measure = (s: string) => s.length;
  assert.deepEqual(wrapWords('Linen set Black', 9, measure), ['Linen set', 'Black']);
  assert.deepEqual(wrapWords('ABCDE\n\nFG', 3, measure), ['ABC', 'DE', '', 'FG']);
  assert.deepEqual(wrapWords('', 3, measure), ['']);
});
test('pagination fits exact boundaries, continues rows and numbers all pages', () => {
  assert.deepEqual(splitPages([40, 60, 1, 99, 100], 10, 110), [
    { rows: [0, 1], label: 'Page 1 of 3' }, { rows: [2, 3], label: 'Page 2 of 3' }, { rows: [4], label: 'Page 3 of 3' },
  ]);
  assert.throws(() => splitPages([101], 10, 110), /too tall/);
  assert.throws(() => splitPages([NaN]), /too tall/);
  assert.deepEqual(splitPages([]), [{ rows: [], label: 'Page 1 of 1' }]);
});

test('R-003/6: pending shipping prints Pending assignment and excludes unassigned charge', () => {
  const pending = invoiceTotals(input.lines, 'pending');
  assert.equal(pending.shipping, 'pending');
  assert.equal(pending.total, 1950);
  assert.equal(pending.balance, 1950);
  assert.ok(invoiceBlocks({ ...input, shipping: 'pending' }).some(b => b.columns?.[0] === 'Shipping' && b.columns[1] === 'Pending assignment'));
  assert.ok(invoiceBlocks(input).some(b => b.columns?.[0] === 'Shipping' && b.columns[1] === '₱80.00'));
});
