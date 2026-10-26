// Replay transcription (T-031 path B, B33/B34): download a live's replay, cut the audio into
// 10-minute mono pieces and transcribe each with Groq Whisper (Tagalog). This is the first portal's
// proven method. Runs in GitHub Actions (enough time and disk for a 5-hour video).
// Input: jobs/replay-request.json { videoId, sourceUrl }. Output: out/<videoId>.json and .srt; a summary in the log.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, createWriteStream } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const key = process.env.GROQ_API_KEY;
if (!key) { console.error('GROQ_API_KEY is missing: add it under repo Settings → Secrets and variables → Actions.'); process.exit(1); }
const req = JSON.parse(readFileSync('jobs/replay-request.json', 'utf8'));
if (!/^\d{5,25}$/.test(String(req.videoId)) || !/^https:\/\/[^\s]+fbcdn\.net\//.test(String(req.sourceUrl))) {
  console.error('jobs/replay-request.json needs a numeric videoId and a Facebook (fbcdn.net) sourceUrl.'); process.exit(1);
}
const PIECE = 600; // seconds per piece
mkdirSync('work/pieces', { recursive: true });
mkdirSync('out', { recursive: true });
const t0 = Date.now();
const since = () => `${Math.round((Date.now() - t0) / 1000)}s`;

console.log(`[${since()}] downloading the replay of ${req.videoId}`);
const res = await fetch(req.sourceUrl);
if (!res.ok || !res.body) { console.error(`download failed: HTTP ${res.status} (the Facebook link may have expired)`); process.exit(1); }
await pipeline(Readable.fromWeb(res.body), createWriteStream('work/video.mp4'));
console.log(`[${since()}] downloaded ${(statSync('work/video.mp4').size / 1e6).toFixed(1)} MB`);

execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', 'work/video.mp4', '-vn', '-ac', '1', '-ar', '16000', '-b:a', '48k',
  '-f', 'segment', '-segment_time', String(PIECE), 'work/pieces/p%03d.mp3']);
const pieces = readdirSync('work/pieces').filter((f) => f.endsWith('.mp3')).sort();
console.log(`[${since()}] cut into ${pieces.length} pieces of ${PIECE / 60} minutes`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function transcribe(file) {
  for (let attempt = 1; attempt <= 30; attempt++) {
    const form = new FormData();
    form.append('file', new Blob([readFileSync(file)], { type: 'audio/mpeg' }), file.split('/').pop());
    form.append('model', 'whisper-large-v3');
    form.append('language', 'tl');
    form.append('response_format', 'verbose_json');
    form.append('temperature', '0');
    const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form });
    if (r.ok) return r.json();
    const body = await r.text();
    if (r.status === 429 || r.status >= 500) {
      // Groq's free plan limits audio per hour: wait it out, as the first portal did
      const wait = Math.min(Number(r.headers.get('retry-after')) || 60, 900);
      console.log(`[${since()}] ${file}: HTTP ${r.status}, waiting ${wait}s (attempt ${attempt})`);
      await sleep(wait * 1000);
      continue;
    }
    throw new Error(`${file}: HTTP ${r.status} ${body.slice(0, 300)}`);
  }
  throw new Error(`${file}: gave up after 30 attempts`);
}

const cues = [];
for (const [i, name] of pieces.entries()) {
  const out = await transcribe(`work/pieces/${name}`);
  const offset = i * PIECE;
  for (const seg of out.segments || []) {
    const text = String(seg.text || '').trim();
    if (text) cues.push({ start: +(offset + seg.start).toFixed(2), end: +(offset + seg.end).toFixed(2), text });
  }
  console.log(`[${since()}] piece ${i + 1}/${pieces.length} done, ${cues.length} lines so far`);
}

const hms = (s) => { const ms = Math.round((s % 1) * 1000); s = Math.floor(s); return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')},${String(ms).padStart(3, '0')}`; };
writeFileSync(`out/${req.videoId}.json`, JSON.stringify({ videoId: req.videoId, engine: 'groq whisper-large-v3 (tl)', createdAt: new Date().toISOString(), seconds: pieces.length * PIECE, cueCount: cues.length, cues }));
writeFileSync(`out/${req.videoId}.srt`, cues.map((c, i) => `${i + 1}\n${hms(c.start)} --> ${hms(c.end)}\n${c.text}\n`).join('\n'));
console.log(`[${since()}] finished: ${cues.length} lines`);
console.log('===== TRANSCRIPT START =====');
for (const c of cues) console.log(`${hms(c.start)}  ${c.text}`);
console.log('===== TRANSCRIPT END =====');
