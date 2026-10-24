import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanBuyerName, fixMojibake } from '../src/utils/buyerName';

test('repairs names garbled by double encoding', () => {
  assert.equal(cleanBuyerName('Weng De Leon EraÃ±a'), 'Weng De Leon Eraña');
  assert.equal(cleanBuyerName('Mary Ann TuaÃ±o'), 'Mary Ann Tuaño');
  assert.equal(cleanBuyerName('Jhoy EscobiÃ±as'), 'Jhoy Escobiñas');
  assert.equal(cleanBuyerName("Jo' Marie Benedicto HofileÃ±a"), "Jo' Marie Benedicto Hofileña");
  assert.equal(cleanBuyerName('Jhoy Escobi�as'), 'Jhoy Escobiñas');
});

test('leaves correct names alone', () => {
  for (const name of ['Vera Santos', 'Joy Tuazon', 'Teresa Lopez', 'Liza Barrera Cruz', 'Escobiñas', 'Eraña Reyes']) {
    assert.equal(cleanBuyerName(name), name);
  }
  assert.equal(cleanBuyerName(''), 'Customer');
  assert.equal(cleanBuyerName(null), 'Customer');
});

test('repairs garbled emoji in notes and leaves normal text unchanged', () => {
  const garbled = Buffer.from('⚠️ Vague claim', 'utf8').toString('latin1').replace(/\x9a/g, 'š').replace(/\x8f/g, '\u008f');
  assert.equal(fixMojibake(garbled), '⚠️ Vague claim');
  assert.equal(fixMojibake('Price ₱550 · ok'), 'Price ₱550 · ok');
});
