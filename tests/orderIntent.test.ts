import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderComment } from '../server/orderIntent';

test('order comments: mine in its spellings, pamine, glued codes and code-only replies', () => {
  for (const c of ['Mine T1', 'mine rustans pink', 'MYNE 9', 'm1ne D3 2XL', 'pamine po', 'MineT4', 'Minepuso', 'T1', 'D3 po', 'Confirm T2', '9'])
    assert.ok(orderComment(c), `"${c}" is an order`);
});

test('not orders: questions, reactions, cancellations and what she already ordered', () => {
  for (const c of ['', '   ', 'how much', 'Hm', 'Mgkano', 'Hm po ito?', 'cancel T1', 'pa cancel po', 'pakita lahat ng na mine ko', 'Thank you', 'Ok', '2XL', 'Good day! Hm po ito? Thank u'])
    assert.equal(orderComment(c), null, `"${c}" is not an order`);
});
