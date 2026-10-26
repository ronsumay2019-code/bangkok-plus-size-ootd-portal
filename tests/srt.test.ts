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
