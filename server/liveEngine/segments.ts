import type { ItemEvent, Segment } from './types';

export function orderedEvents(events: readonly ItemEvent[]): ItemEvent[] {
  const sorted = [...events].sort((a, b) => Date.parse(a.calledAt) - Date.parse(b.calledAt));
  const seqs = new Set<number>();
  for (const event of sorted) {
    if (!Number.isFinite(Date.parse(event.calledAt)) || !event.code.trim() || seqs.has(event.seq))
      throw new Error('Invalid host event timestamp, code or duplicate sequence');
    seqs.add(event.seq);
  }
  return sorted;
}

/** Half-open search segments [startAt, endAt); never item eligibility windows. */
export function segments(events: readonly ItemEvent[], liveEndedAt: string): Segment[] {
  const sorted = orderedEvents(events);
  const end = Date.parse(liveEndedAt);
  if (!Number.isFinite(end) || sorted.some(e => Date.parse(e.calledAt) > end))
    throw new Error('Invalid live end');
  return sorted.map((event, i) => ({
    eventSeq: event.seq, startAt: event.calledAt,
    endAt: sorted[i + 1]?.calledAt ?? liveEndedAt,
  }));
}
