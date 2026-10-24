import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderComment } from '../server/orderIntent';

test('order comments: mine in its spellings, pamine, glued codes and code-only replies', () => {
  for (const c of ['Mine T1', 'mine rustans pink', 'MYNE 9', 'm1ne D3 2XL', 'pamine po', 'MineT4', 'Minepuso', 'T1', 'D3 po', 'Confirm T2', '9'])
    assert.ok(orderComment(c), `"${c}" is an order`);
});

test('not orders: questions, reactions, cancellations and what she already ordered', () => {
  for (const c of ['', '   ', 'how much', 'Hm', 'Mgkano', 'Hm po ito?', 'cancel T1', 'pa cancel po', 'pakita lahat ng na mine ko', 'Thank you', 'Ok', 'Good day! Hm po ito? Thank u', 'May dress with sleeves? 🌹', 'Please flex yung parang 2-color na short sleeves flowy', 'Pwede po ba linen pants?'])
    assert.equal(orderComment(c), null, `"${c}" is not an order`);
});

test('item named without "mine" is kept to check on the replay, never as a plain order', () => {
  for (const c of ['Linen pants blk', 'White set sa suot mo Myra', 'Linen pants brown. Dark ha', '2XL']) {
    const o = orderComment(c);
    assert.ok(o && o.toCheck, `"${c}" is kept to check`);
  }
  assert.equal(orderComment('Mine T1')?.toCheck, undefined, 'a real mine is not just "to check"');
});
