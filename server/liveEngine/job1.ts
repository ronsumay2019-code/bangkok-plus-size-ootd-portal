import type { Capture, ItemEvent, RawMessage, Unclear } from './types';
import { orderedEvents } from './segments';

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const flexible = (s: string) => [...s.replace(/\s/g, '')].map(escape).join('\\s*');
const mine = /\b(?:pa\s*)?m[iy1]ne(?=\b|[a-z0-9])/i;
const nonOrder = /\?|\b(?:magkano|mgkano|hm|how much|available|meron|mayroon|cancel|palit|change|swap|ganda|maganda|malambot|thank|salamat)\b/i;
const extraPattern = /\+\s*(\d+)\b|\b(one|two|\d+)\s+more\b|\badd\s+(\d+)\b/i;
const buyerKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
const codeKey = (code: string) => code.replace(/\s/g, '').toLocaleLowerCase();

function option(text: string, values: readonly string[]): string | undefined {
  return [...values].sort((a, b) => b.length - a.length).find(value =>
    new RegExp(`(?<![a-z0-9])${flexible(value)}(?![a-z0-9])`, 'i').test(text));
}
function extraQty(text: string): number | undefined {
  const match = text.match(extraPattern);
  if (!match) return undefined;
  const word = match[1] ?? match[2] ?? match[3];
  const qty = word.toLowerCase() === 'one' ? 1 : word.toLowerCase() === 'two' ? 2 : Number(word);
  return Number.isSafeInteger(qty) && qty > 0 ? qty : undefined;
}

/** Messages must already be scoped to this live (the two-argument API has no end time).
 * Captures are candidates for Job 2, not approved/final orders.
 */
export function job1(events: readonly ItemEvent[], messages: readonly RawMessage[]): { captures: Capture[]; unclear: Unclear[] } {
  const host = orderedEvents(events);
  const captures: Capture[] = [];
  const unclear: Unclear[] = [];
  const seen = new Set<string>();
  for (const message of [...messages].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))) {
    const time = Date.parse(message.at);
    if (!Number.isFinite(time)) throw new Error('Invalid message timestamp');
    const delivery = `${message.channel}:${message.id}`;
    if (seen.has(delivery)) continue;
    const called = host.filter(e => Date.parse(e.calledAt) <= time);
    const current = called.at(-1);
    if (!current) continue;
    seen.add(delivery);
    // Repeated host calls update metadata without introducing a chat-derived code.
    const known = new Map(called.map(e => [codeKey(e.code), e]));
    const text = message.text;
    if (nonOrder.test(text)) continue;
    const hasMine = mine.test(text);
    const matches = [...known.values()].flatMap(event => {
      const pattern = new RegExp(`(?<![a-z0-9])${flexible(event.code)}(?![a-z0-9])`, 'i');
      const match = pattern.exec(text.replace(mine, ' '));
      return match ? [{ event, match }] : [];
    });
    const buyer = buyerKey(message.name);
    const previous = captures.filter(c => buyerKey(c.buyer) === buyer);
    const explicitExtra = extraQty(text);
    let selected = matches.map(m => m.event);
    if (!selected.length && explicitExtra && !text.replace(extraPattern, '').replace(/\b(?:po|pls|please)\b|[^\p{L}\p{N}]/giu, '')) {
      const codes = [...new Set(previous.map(c => codeKey(c.code)))];
      if (codes.length === 1) selected = [known.get(codes[0])!];
    }
    if (!selected.length) {
      if (hasMine || explicitExtra) unclear.push({ buyer: message.name, messageId: message.id,
        at: message.at, text, eventSeq: current.seq, channel: message.channel,
        reason: explicitExtra ? 'ambiguous_extra' : 'missing_code' });
      continue;
    }
    for (const event of selected) {
      const stripped = text.replace(mine, ' ').replace(new RegExp(flexible(event.code), 'i'), ' ');
      const size = option(stripped, event.sizes);
      const colour = option(stripped, event.colours);
      // Without MINE, permit code/specification replies and polite particles only.
      let remainder = stripped;
      for (const value of [...event.sizes, ...event.colours].sort((a, b) => b.length - a.length))
        remainder = remainder.replace(new RegExp(`(?<![a-z0-9])${flexible(value)}(?![a-z0-9])`, 'ig'), ' ');
      remainder = remainder.replace(extraPattern, ' ').replace(/\b(?:po|pls|please|pa|ako|mine)\b|\b\d+\b|[^\p{L}\p{N}]/giu, '');
      if (!hasMine && remainder) continue;
      const afterCode = text.replace(mine, ' ').match(new RegExp(`${flexible(event.code)}\\s+(\\d+)\\s*(?:po|pls|please)?[.!]*$`, 'i'));
      const suffixQty = afterCode ? Number(afterCode[1]) : undefined;
      const qty = explicitExtra ?? (suffixQty && Number.isSafeInteger(suffixQty) ? suffixQty : undefined);
      const already = previous.some(c => codeKey(c.code) === codeKey(event.code));
      if (already && !qty) continue;
      // Only an unambiguous code-only or MINE+code reply resolves pending MINEs.
      const pending = selected.length === 1 && !qty && !remainder
        ? unclear.filter(u => buyerKey(u.buyer) === buyer && u.reason === 'missing_code') : [];
      const originalText = pending.map(u => u.text).join(' ');
      captures.push({ buyer: message.name, code: event.code, price: event.price,
        size: size ?? option(originalText, event.sizes) ?? (event.sizes.length === 1 ? event.sizes[0] : undefined),
        colour: colour ?? option(originalText, event.colours) ?? (event.colours.length === 1 ? event.colours[0] : undefined),
        qty: qty ?? 1, messageId: message.id, at: message.at, eventSeq: current.seq,
        channel: message.channel, kind: qty ? 'extra' : 'first',
        ...(pending.length ? { clarifiedMessageIds: pending.map(u => u.messageId) } : {}),
      });
      for (const entry of pending) unclear.splice(unclear.indexOf(entry), 1);
    }
  }
  return { captures, unclear };
}
