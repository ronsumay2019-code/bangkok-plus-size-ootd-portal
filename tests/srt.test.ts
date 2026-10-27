import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSrt } from '../server/liveEngine/srt';

test('parses Facebook .srt captions into timed lines', () => {
  const srt = '﻿1\r\n00:00:01,500 --> 00:00:04,000\r\nT7 po linen set\r\n650 lang\r\n\r\n2\r\n01:02:03,040 --> 01:02:05,000\r\nblack at beige\r\n\r\n3\r\nbroken line\r\nno time here\r\n';
  assert.deepEqual(parseSrt(srt), [
    { start: 1.5, end: 4, text: 'T7 po linen set 650 lang' },
    { start: 3723.04, end: 3725, text: 'black at beige' },
  ]);
});

test('an empty or malformed file gives no lines instead of guesses', () => {
  assert.deepEqual(parseSrt(''), []);
  assert.deepEqual(parseSrt('1\n00:00:xx --> 00:00:02,000\nhello'), []);
});

test('caption reads during a live add new lines and never duplicate old ones', async () => {
  const { mergeCues } = await import('../server/liveEngine/srt');
  const first = [{ start: 1, end: 2, text: 'T7 po' }, { start: 3, end: 4, text: '650' }];
  const second = [{ start: 3, end: 4, text: '650' }, { start: 5, end: 6, text: 'black at beige' }];
  assert.deepEqual(mergeCues(first, second).map((c) => c.text), ['T7 po', '650', 'black at beige']);
  assert.deepEqual(mergeCues(second, []).length, 2);
});

import { fillBlanks } from '../server/fillBlanks';

test('a later read without a name never blanks the name a webhook kept (R-004 #3)', () => {
  const webhook = { id: 'c1', name: 'Joy Tuazon', fromId: '1', text: 'Mine rustans pink', source: 'webhook' };
  const graph = { id: 'c1', name: undefined, fromId: undefined, text: 'Mine rustans pink', source: 'graph' };
  assert.deepEqual(fillBlanks(webhook, graph as any), webhook);
  assert.equal(fillBlanks({ id: 'c2', name: '' } as any, { id: 'c2', name: 'Ana' }).name, 'Ana', 'an empty name is filled by a later read');
  assert.deepEqual(fillBlanks(null, graph), graph, 'nothing kept yet: the new read is kept as is');
});

import { insideMessengerWindow } from '../server/messengerWindow';

test("the portal sends in Messenger only within 24 hours of the buyer's last message", () => {
  const now = Date.parse('2026-10-26T12:00:00Z');
  const at = (h: number) => new Date(now - h * 3600 * 1000).toISOString();
  assert.equal(insideMessengerWindow([{ sender: 'buyer', timestamp: at(23) }], now), true);
  assert.equal(insideMessengerWindow([{ sender: 'buyer', timestamp: at(25) }], now), false);
  assert.equal(insideMessengerWindow([{ sender: 'buyer', timestamp: at(30) }, { sender: 'page_agent', timestamp: at(1) }], now), false, "the Page's own replies don't reopen the window");
  assert.equal(insideMessengerWindow([], now), false, 'no buyer message: never send');
});
