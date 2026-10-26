/** One caption line from a Facebook .srt transcript; times are seconds from the start of the video. */
export interface Cue {
  start: number;
  end: number;
  text: string;
}

const toSeconds = (t: string): number => {
  const m = /^(\d+):(\d{2}):(\d{2})[,.](\d{1,3})$/.exec(t.trim());
  if (!m) return NaN;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4].padEnd(3, '0')) / 1000;
};

/** Parses .srt text into cues; malformed blocks are skipped, never guessed. */
export function parseSrt(srt: string): Cue[] {
  const cues: Cue[] = [];
  for (const block of srt.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split(/\n{2,}/)) {
    const lines = block.split('\n').filter((l) => l.trim() !== '');
    const timeAt = lines.findIndex((l) => l.includes('-->'));
    if (timeAt < 0) continue;
    const [a, b] = lines[timeAt].split('-->');
    const start = toSeconds(a);
    const end = toSeconds(b);
    const text = lines.slice(timeAt + 1).join(' ').trim();
    if (!Number.isFinite(start) || !Number.isFinite(end) || !text) continue;
    cues.push({ start, end, text });
  }
  return cues;
}
