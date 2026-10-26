/** Host calls are the only source of the live's item vocabulary. */
export interface ItemEvent {
  seq: number;
  code: string;
  price: number | null;
  sizes: string[];
  colours: string[];
  description?: string;
  calledAt: string;
}
export interface RawMessage {
  id: string;
  at: string;
  name: string;
  text: string;
  channel: 'live_chat' | 'messenger';
}
export interface Segment {
  eventSeq: number;
  startAt: string;
  endAt: string;
}
export interface Capture {
  buyer: string;
  code: string;
  price: number | null;
  size?: string;
  colour?: string;
  qty: number;
  messageId: string;
  at: string;
  eventSeq: number | null;
  channel: RawMessage['channel'];
  kind: 'first' | 'extra';
  /** Original no-code evidence, when this message clarified it. */
  clarifiedMessageIds?: string[];
  /** Per-field source message, only for an inherited buyer specification. */
  inheritedFrom?: { size?: string; colour?: string };
  /** A later host call matched this earlier message; review is still required. */
  preCall?: true;
}
export interface Unclear {
  buyer: string;
  messageId: string;
  at: string;
  text: string;
  eventSeq: number | null;
  channel: RawMessage['channel'];
  reason: 'missing_code' | 'ambiguous_extra' | 'ambiguous_code' | 'pre_call';
}
