import { test } from 'node:test';
import assert from 'node:assert/strict';
import { segments } from '../server/liveEngine/segments';
import { job1 } from '../server/liveEngine/job1';
import type { ItemEvent, RawMessage } from '../server/liveEngine/types';

// Synthetic host calls and anonymized Taglish examples; not a golden real-live fixture.
const at = (minute: number) => new Date(Date.UTC(2026, 9, 25, 12, minute)).toISOString();
const events: ItemEvent[] = [
  { seq: 1, code: 'T7', price: 650, sizes: ['2XL', '3XL'], colours: ['Black', 'Red'], calledAt: at(0) },
  { seq: 2, code: 'T3', price: null, sizes: ['XL'], colours: ['Blue'], calledAt: at(10) },
];
const msg = (text: string, minute = 1, name = 'Buyer A', id = text, channel: RawMessage['channel'] = 'live_chat'): RawMessage =>
  ({ id, at: at(minute), name, text, channel });

test('segments are half-open host search filters, sorted without mutating inputs', () => {
  const reversed = [...events].reverse();
  assert.deepEqual(segments(reversed, at(20)), [
    { eventSeq: 1, startAt: at(0), endAt: at(10) },
    { eventSeq: 2, startAt: at(10), endAt: at(20) },
  ]);
  assert.equal(reversed[0].seq, 2);
  assert.deepEqual(segments([], at(20)), []);
  assert.throws(() => segments(events, at(5)));
  assert.throws(() => segments(events, 'invalid'));
});

test('all match forms, loose spacing, glued MINE and Taglish spellings', () => {
  for (const text of ['mine T7', 't7', 'T 7 3XL', 'T7 red po', 'myne t7', 'm1ne T 7', 'mineT7']) {
    const result = job1(events, [msg(text)]);
    assert.equal(result.captures.length, 1, text);
    assert.equal(result.captures[0].code, 'T7');
  }
  assert.equal(job1(events, [msg('pamine T3', 11)]).captures[0].code, 'T3');
});

test('host eligibility uses Facebook time and allows old codes in later events', () => {
  const result = job1(events, [msg('mine T3', 1), msg('mine X99', 2), msg('T7', 10, 'Buyer B'), msg('T7', -1, 'Buyer C', 'pre-first')]);
  const later = result.captures.find(c => c.buyer === 'Buyer B')!;
  assert.equal(later.eventSeq, 2);
  assert.equal(later.code, 'T7');
  assert.equal(result.captures.filter(c => c.preCall).length, 2);
  assert.equal(job1(events, [msg('T70'), msg('AT7'), msg('T7X')]).captures.length, 0);
});

test('unclear MINE keeps evidence until same buyer clarifies across events/channels', () => {
  const result = job1(events, [msg('T7', 12, 'Buyer A', 'clarify', 'messenger'),
    msg('mine 3XL red po', 1, 'Buyer A', 'original'),
    msg('mine po', 2, 'Buyer B', 'unresolved'), msg('ganda nyan', 3)]);
  assert.equal(result.captures.length, 1);
  assert.deepEqual(result.captures[0].clarifiedMessageIds, ['original']);
  assert.equal(result.captures[0].size, '3XL');
  assert.equal(result.captures[0].colour, 'Red');
  assert.equal(result.captures[0].messageId, 'clarify');
  assert.equal(result.captures[0].eventSeq, 2);
  assert.deepEqual(result.unclear.map(u => u.messageId), ['unresolved']);
});

test('extra quantities are pieces; repeated MINE across Messenger remains one', () => {
  const result = job1(events, [msg('mine T7', 1), msg('mine T7', 2, 'Buyer A', 'repeat', 'messenger'),
    msg('+1', 3), msg('two more', 4), msg('T7 2', 5), msg('one more T7', 6), msg('add 1 T7', 7)]);
  assert.deepEqual(result.captures.map(c => [c.kind, c.qty]),
    [['first', 1], ['extra', 1], ['extra', 2], ['extra', 2], ['extra', 1], ['extra', 1]]);
  assert.equal(job1(events, [msg('mine T7 2')]).captures[0].kind, 'first');
});

test('no-code extras with multiple possible items are retained, never guessed', () => {
  const result = job1(events, [msg('T7'), msg('T3', 11), msg('+1', 12)]);
  assert.equal(result.captures.length, 2);
  assert.equal(result.unclear[0].reason, 'ambiguous_extra');
});

test('host metadata supplies defaults and price; chat cannot create values', () => {
  const capture = job1(events, [msg('mine T3 999 green 4XL', 11)]).captures[0];
  assert.equal(capture.price, null);
  assert.equal(capture.size, 'XL');
  assert.equal(capture.colour, 'Blue');
  const multiple = job1(events, [msg('mine T7')]).captures[0];
  assert.equal(multiple.size, undefined);
  assert.equal(multiple.colour, undefined);
});

test('questions, appreciation and Job 2 changes create no new captures', () => {
  for (const text of ['magkano T7?', 'hm T7 po', 'ganda nyan', 'maganda T7', 'cancel T7', 'palit T7', 'T7 malambot tela', 'thank you T7'])
    assert.equal(job1(events, [msg(text)]).captures.length, 0, text);
});

test('Messenger counts equally and duplicate delivery adds nothing, even extras', () => {
  const extra = msg('T7 +1', 12, 'Buyer A', 'duplicate', 'messenger');
  const result = job1(events, [msg('T7', 11, 'Buyer A', 'first', 'messenger'), extra, extra]);
  assert.deepEqual(result.captures.map(c => c.qty), [1, 1]);
  assert.equal(result.captures[0].channel, 'messenger');
});

test('R-003/1: MINE plus a called code survives thanks, appreciation, questions and changes', () => {
  for (const text of ['mine T7 salamat po', 'mine T7 3XL maganda po', 'mine T7 po?', 'mine T7 palit red', 'mine T7 change', 'mine T7 swap'])
    assert.equal(job1(events, [msg(text)]).captures.length, 1, text);
  const question = job1(events, [msg('T7 red?')]);
  assert.equal(question.captures.length, 0);
  assert.equal(question.unclear[0]?.reason, 'ambiguous_code');
});

test('R-003/2: specifications tolerate extra words, vague code mentions stay unclear', () => {
  for (const text of ['T7 3XL red po now', 'T7 3XL hurry', 'T7 red now'])
    assert.equal(job1(events, [msg(text)]).captures.length, 1, text);
  for (const text of ['T7 how much', 'magkano T7?', 'T7 salamat', 'palit T7']) {
    const result = job1(events, [msg(text)]);
    assert.equal(result.captures.length, 0, text);
    assert.equal(result.unclear[0]?.messageId, text, text);
  }
});

const moreEvents: ItemEvent[] = [...events,
  { ...events[0], seq: 30, code: 'T9', calledAt: at(30) }];
test('R-003/3: clarification expires after next event and marks inherited evidence', () => {
  const stale = job1(moreEvents, [msg('mine 2XL', 1), msg('mine T9', 31)]);
  assert.equal(stale.captures[0].size, undefined);
  assert.equal(stale.unclear.length, 1);
  for (const minute of [2, 11]) {
    const linked = job1(moreEvents, [msg('mine 2XL red', 1, 'Buyer A', 'pending'), msg('mine T7', minute)]);
    assert.equal(linked.captures[0].size, '2XL');
    assert.deepEqual(linked.captures[0].inheritedFrom, { size: 'pending', colour: 'pending' });
  }
  const override = job1(events, [msg('mine 2XL red', 1), msg('mine T7 3XL black', 2)]).captures[0];
  assert.equal(override.size, '3XL');
  assert.equal(override.colour, 'Black');
  assert.equal(override.inheritedFrom, undefined);
});

test('R-003/4: pre-call signals stay flagged, and only later host codes can promote', () => {
  const raw = [msg('mine T7 3XL', -3), msg('X99', -2, 'Buyer B'), msg('+1', -1, 'Buyer C'), msg('ganda nyan', -1, 'Buyer D')];
  const before = job1([], raw);
  assert.equal(before.unclear.length, 3);
  assert.ok(before.unclear.every(u => u.reason === 'pre_call' && u.eventSeq === null));
  const after = job1(events, raw);
  assert.equal(after.captures.length, 1);
  assert.equal(after.captures[0].code, 'T7');
  assert.equal(after.captures[0].eventSeq, null);
  assert.equal(after.captures[0].preCall, true);
  assert.equal(after.unclear.length, 3);
  const future = job1(events, [msg('mine T3', 1)]);
  assert.equal(future.captures[0]?.preCall, true);
  assert.equal(future.unclear[0]?.reason, 'pre_call');
});

test('R-003/5: initial quantities are first, initial additions remain ambiguous', () => {
  const first = job1(events, [msg('mine T7 2')]).captures[0];
  assert.equal(first.kind, 'first');
  assert.equal(first.qty, 2);
  for (const text of ['mine T7 +1', 'T7 two more', 'add 1 T7']) {
    const result = job1(events, [msg(text)]);
    assert.equal(result.captures.length, 0);
    assert.equal(result.unclear[0]?.reason, 'ambiguous_extra');
  }
});

test('R-003: re-called host code uses metadata available at order time', () => {
  const recalled = [...events, { ...events[0], seq: 3, price: 700, sizes: ['4XL'], colours: ['Green'], calledAt: at(20) }];
  const result = job1(recalled, [msg('mine T7', 1, 'Buyer A', 'old-price'), msg('mine T7', 21, 'Buyer B', 'new-price')]);
  assert.deepEqual(result.captures.map(c => c.price), [650, 700]);
  assert.equal(result.captures[1].size, '4XL');
  assert.equal(result.captures[1].colour, 'Green');
});
