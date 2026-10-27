# Review packet RP-004: Tonight's capture release (built by Claude)

**For: Grok (independent reviewer).** Upload this whole file into Grok, then paste Grok's full answer back to Claude.

## Your role
You are the **independent adversarial reviewer**. Claude built this. **Find what is wrong, missing, risky or unsafe.** Don't praise.

This goes live **tonight** (Mon 26 Oct) for a real Facebook live at 7–8 PM Manila. The team keeps its usual paper process in parallel. The portal's job tonight is to **capture everything safely and automatically**, so the orders can be rebuilt after the live.

## What to send back (exactly this format)
1. **Verdict:** APPROVE / CHANGES NEEDED / REJECT.
2. **Findings,** most serious first. For each one:
   - severity (Critical / High / Medium / Low);
   - file and line;
   - what is wrong;
   - **a concrete example and the wrong result**;
   - the fix.
3. What you tried to break and could not.
4. Questions for the owner, only if a business rule is unclear.

## What tonight's release must do
1. **Keep every live comment exactly as written** (collection `raw_comments`), from both the Facebook webhook and the Graph API read. Nothing filtered at save time.
2. **While the video is LIVE, read Facebook's own captions every ~3 minutes and keep every new line** (collection `transcripts`). Background: after the live, Facebook's file for a past live covered only its first minute.
3. **Owner/admin "Facebook transcript check" in the Replay tab** (read-only "Check", plus "Fetch & keep transcript"). The Facebook token must **never** reach the browser.
4. **Replay job (GitHub Action):** download the replay, cut the audio into 10-minute pieces with ffmpeg, and transcribe with Groq Whisper (Tagalog). It is started by committing `jobs/replay-request.json`.
5. **Security lock-down:** a migration that drops the anonymous-access policies. Already applied and verified: no public policies left, server requests still OK.
6. The normal portal state load now reads **only** its own collections, so `raw_comments` and `transcripts` are never loaded on every request and are never deleted by the state save.

## What to attack
- **Secrets:**
  - Can the Page token or the Groq key leak through any response, log or error message?
  - Look at the paging links Facebook returns, at the error bodies, and at the `source` URL now included in the transcript check.
- **Lost data:**
  - Can a comment fail to be kept? Consider webhook only vs Graph only, a missing name, and a comment arriving for a live the portal didn't link.
  - Can a raw comment's name be **overwritten** with an empty one by a later Graph read?
  - Two serverless copies reading and saving `transcripts` at the same moment: can caption lines be lost?
- **Wrong data:** could captions from one live be saved under another live or video? Could duplicate caption lines pile up?
- **Load and save:** could the new filtered load make the state save **delete** real orders or lives? Can `getRecord` misbehave with special characters in ids?
- **The replay job:**
  - expired download link;
  - Groq rate limits ("wait it out" loop);
  - a 5-hour video against the runner's time and disk;
  - the trigger firing by accident;
  - a request file pointing at something that isn't a Facebook video.
- **Tonight's risks:** what is most likely to fail at 7 PM, and what should be checked on the preview before GO at 5 PM?

## Builder's checks (claimed by Claude)
- `npm test`: 64 pass, including new tests for caption merging, filtered loads, side collections surviving a save, and webhook comments kept raw.
- `npm run build`: OK.
- `npm run lint`: the same 23 old errors as before.
- Live verification on 26 Oct:
  - the owner's "Check" on the LINEN SHOP video returned Facebook's caption list;
  - "Fetch & keep" saved 17 lines (0:02–1:00);
  - the security migration was verified in the database.

## The full code change since the last reviewed state (`git diff 4c01a94..HEAD` on the files listed; PR #10's own files were reviewed in RP-003)

```diff
diff --git a/.github/workflows/replay-transcribe.yml b/.github/workflows/replay-transcribe.yml
new file mode 100644
index 0000000..d9be3cc
--- /dev/null
+++ b/.github/workflows/replay-transcribe.yml
@@ -0,0 +1,33 @@
+name: Replay transcription
+
+# Runs when a replay request is committed (T-031 path B). Downloads the live's replay and transcribes it with Groq.
+on:
+  push:
+    paths:
+      - jobs/replay-request.json
+
+permissions:
+  contents: read
+
+jobs:
+  transcribe:
+    runs-on: ubuntu-latest
+    timeout-minutes: 340
+    steps:
+      - uses: actions/checkout@v4
+      - uses: actions/setup-node@v4
+        with:
+          node-version: 22
+      - name: Check ffmpeg
+        run: ffmpeg -version | head -1
+      - name: Download and transcribe
+        env:
+          GROQ_API_KEY: ${{ secrets.GROQ_API_KEY }}
+        run: node scripts/replay-transcribe.mjs
+      - name: Keep the transcript
+        if: always()
+        uses: actions/upload-artifact@v4
+        with:
+          name: replay-transcript
+          path: out/
+          if-no-files-found: ignore
diff --git a/scripts/replay-transcribe.mjs b/scripts/replay-transcribe.mjs
new file mode 100644
index 0000000..83f7deb
--- /dev/null
+++ b/scripts/replay-transcribe.mjs
@@ -0,0 +1,74 @@
+// Replay transcription (T-031 path B, B33/B34): download a live's replay, cut the audio into
+// 10-minute mono pieces and transcribe each with Groq Whisper (Tagalog). This is the first portal's
+// proven method. Runs in GitHub Actions (enough time and disk for a 5-hour video).
+// Input: jobs/replay-request.json { videoId, sourceUrl }. Output: out/<videoId>.json and .srt; a summary in the log.
+import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, createWriteStream } from 'node:fs';
+import { execFileSync } from 'node:child_process';
+import { Readable } from 'node:stream';
+import { pipeline } from 'node:stream/promises';
+
+const key = process.env.GROQ_API_KEY;
+if (!key) { console.error('GROQ_API_KEY is missing: add it under repo Settings → Secrets and variables → Actions.'); process.exit(1); }
+const req = JSON.parse(readFileSync('jobs/replay-request.json', 'utf8'));
+if (!/^\d{5,25}$/.test(String(req.videoId)) || !/^https:\/\/[^\s]+fbcdn\.net\//.test(String(req.sourceUrl))) {
+  console.error('jobs/replay-request.json needs a numeric videoId and a Facebook (fbcdn.net) sourceUrl.'); process.exit(1);
+}
+const PIECE = 600; // seconds per piece
+mkdirSync('work/pieces', { recursive: true });
+mkdirSync('out', { recursive: true });
+const t0 = Date.now();
+const since = () => `${Math.round((Date.now() - t0) / 1000)}s`;
+
+console.log(`[${since()}] downloading the replay of ${req.videoId}`);
+const res = await fetch(req.sourceUrl);
+if (!res.ok || !res.body) { console.error(`download failed: HTTP ${res.status} (the Facebook link may have expired)`); process.exit(1); }
+await pipeline(Readable.fromWeb(res.body), createWriteStream('work/video.mp4'));
+console.log(`[${since()}] downloaded ${(statSync('work/video.mp4').size / 1e6).toFixed(1)} MB`);
+
+execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', 'work/video.mp4', '-vn', '-ac', '1', '-ar', '16000', '-b:a', '48k',
+  '-f', 'segment', '-segment_time', String(PIECE), 'work/pieces/p%03d.mp3']);
+const pieces = readdirSync('work/pieces').filter((f) => f.endsWith('.mp3')).sort();
+console.log(`[${since()}] cut into ${pieces.length} pieces of ${PIECE / 60} minutes`);
+
+const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
+async function transcribe(file) {
+  for (let attempt = 1; attempt <= 30; attempt++) {
+    const form = new FormData();
+    form.append('file', new Blob([readFileSync(file)], { type: 'audio/mpeg' }), file.split('/').pop());
+    form.append('model', 'whisper-large-v3');
+    form.append('language', 'tl');
+    form.append('response_format', 'verbose_json');
+    form.append('temperature', '0');
+    const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form });
+    if (r.ok) return r.json();
+    const body = await r.text();
+    if (r.status === 429 || r.status >= 500) {
+      // Groq's free plan limits audio per hour: wait it out, as the first portal did
+      const wait = Math.min(Number(r.headers.get('retry-after')) || 60, 900);
+      console.log(`[${since()}] ${file}: HTTP ${r.status}, waiting ${wait}s (attempt ${attempt})`);
+      await sleep(wait * 1000);
+      continue;
+    }
+    throw new Error(`${file}: HTTP ${r.status} ${body.slice(0, 300)}`);
+  }
+  throw new Error(`${file}: gave up after 30 attempts`);
+}
+
+const cues = [];
+for (const [i, name] of pieces.entries()) {
+  const out = await transcribe(`work/pieces/${name}`);
+  const offset = i * PIECE;
+  for (const seg of out.segments || []) {
+    const text = String(seg.text || '').trim();
+    if (text) cues.push({ start: +(offset + seg.start).toFixed(2), end: +(offset + seg.end).toFixed(2), text });
+  }
+  console.log(`[${since()}] piece ${i + 1}/${pieces.length} done, ${cues.length} lines so far`);
+}
+
+const hms = (s) => { const ms = Math.round((s % 1) * 1000); s = Math.floor(s); return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')},${String(ms).padStart(3, '0')}`; };
+writeFileSync(`out/${req.videoId}.json`, JSON.stringify({ videoId: req.videoId, engine: 'groq whisper-large-v3 (tl)', createdAt: new Date().toISOString(), seconds: pieces.length * PIECE, cueCount: cues.length, cues }));
+writeFileSync(`out/${req.videoId}.srt`, cues.map((c, i) => `${i + 1}\n${hms(c.start)} --> ${hms(c.end)}\n${c.text}\n`).join('\n'));
+console.log(`[${since()}] finished: ${cues.length} lines`);
+console.log('===== TRANSCRIPT START =====');
+for (const c of cues) console.log(`${hms(c.start)}  ${c.text}`);
+console.log('===== TRANSCRIPT END =====');
diff --git a/server.ts b/server.ts
index 5c7f6a1..59e8968 100644
--- a/server.ts
+++ b/server.ts
@@ -42,6 +42,7 @@ import {
 import { AsyncLock, ProofStore, StateSync, SupabaseBackend, storeConfigFromEnv } from './server/portalStore';
 import { DEFAULT_STAFF, PortalAuth, PortalUser, SESSION_HEADER } from './server/auth';
 import { orderComment } from './server/orderIntent';
+import { mergeCues, parseSrt } from './server/liveEngine/srt';
 import { cleanBuyerName } from './src/utils/buyerName';
 
 dotenv.config();
@@ -2271,6 +2272,46 @@ function captureLiveComment(c: {
   return { captured, detail: captured ? `Order comment saved for review: "${message}" by ${who}` : `Not an order: "${message}" by ${who}` };
 }
 
+/** Every comment on a live, kept exactly as written (T-010): the order finder and the evidence need the
+ * whole chat, not only order-like comments. Side collection "raw_comments": never loaded by the state sync. */
+const rawKeptIds = new Set<string>();
+interface RawComment { id: string; liveId: string; videoId?: string; at: string; name?: string; fromId?: string; text: string; source: 'webhook' | 'graph' }
+async function keepRawComments(rows: RawComment[]): Promise<number> {
+  if (!portalBackend) return 0;
+  const fresh = rows.filter((r) => r.id && !rawKeptIds.has(r.id));
+  if (!fresh.length) return 0;
+  await portalBackend.upsertRecords(fresh.map((r) => ({ collection: 'raw_comments', id: r.id, data: r })));
+  for (const r of fresh) rawKeptIds.add(r.id);
+  return fresh.length;
+}
+
+/** While a live is on air, Facebook's own captions are read every ~3 minutes and every new line is kept
+ * (T-031 path A, B34: after the live Facebook keeps only a short file). The replay job is the backup. */
+const captionReadAt = new Map<string, number>();
+async function keepLiveCaptions(videoId: string, liveId: string, token: string): Promise<number | null> {
+  if (!portalBackend || Date.now() - (captionReadAt.get(videoId) || 0) < 170_000) return null;
+  captionReadAt.set(videoId, Date.now());
+  try {
+    const r = await fetch(`https://graph.facebook.com/v22.0/${encodeURIComponent(videoId)}/captions?access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(15000) });
+    const j: any = await r.json().catch(() => ({}));
+    const list: any[] = Array.isArray(j?.data) ? j.data : [];
+    const pick = list.find((c) => c?.is_auto_generated) || list[0];
+    if (!pick?.uri) return null;
+    const file = await fetch(String(pick.uri), { signal: AbortSignal.timeout(20000) });
+    if (!file.ok) return null;
+    const incoming = parseSrt(await file.text());
+    const kept = await portalBackend.getRecord('transcripts', videoId);
+    const cues = mergeCues(kept?.data?.cues || [], incoming);
+    await portalBackend.upsertRecords([{ collection: 'transcripts', id: videoId, data: {
+      ...(kept?.data || {}), id: videoId, videoId, liveId, locale: pick.locale || null, isAutoGenerated: !!pick.is_auto_generated,
+      lastReadAt: new Date().toISOString(), reads: (kept?.data?.reads || 0) + 1, cueCount: cues.length, cues,
+    } }]);
+    return cues.length;
+  } catch {
+    return null;
+  }
+}
+
 app.post('/api/meta/webhook', async (req, res) => {
   const appSecret = process.env.META_APP_SECRET;
   const signatureHeader = req.headers['x-hub-signature-256'] as string | undefined;
@@ -2295,6 +2336,7 @@ app.post('/api/meta/webhook', async (req, res) => {
   const nowIso = new Date().toISOString();
 
   let eventType = 'unknown';
+  const rawFromWebhook: RawComment[] = [];
   let eventDetails = 'Received webhook event payload';
 
   if (body?.entry && Array.isArray(body.entry)) {
@@ -2406,6 +2448,12 @@ app.post('/api/meta/webhook', async (req, res) => {
             }
             eventType = 'comment';
             if (String(v.from?.id || '') !== String(entry.id || '')) rememberCommenter(v.comment_id || v.id, v.from?.name);
+            const rawLive = liveForComment(v.post_id, v.comment_id || v.id);
+            if (rawLive && (v.comment_id || v.id)) rawFromWebhook.push({
+              id: String(v.comment_id || v.id), liveId: rawLive.id, videoId: rawLive.fbVideoId, text: String(v.message || ''),
+              at: v.created_time ? new Date(Number(v.created_time) * 1000 || v.created_time).toISOString() : nowIso,
+              name: v.from?.name, fromId: v.from?.id ? String(v.from.id) : undefined, source: 'webhook',
+            });
             const result = captureLiveComment({
               commentId: v.comment_id || v.id,
               postId: v.post_id,
@@ -2431,6 +2479,7 @@ app.post('/api/meta/webhook', async (req, res) => {
     payload: body,
   };
 
+  await keepRawComments(rawFromWebhook).catch((err) => console.error('Raw comments not kept:', err?.message));
   webhookEventsLog.unshift(logEntry);
   if (webhookEventsLog.length > 50) {
     webhookEventsLog.pop();
@@ -2441,6 +2490,69 @@ app.post('/api/meta/webhook', async (req, res) => {
 });
 
 // 8d. Periodic Facebook Graph API v22.0 Sync (POST /api/facebook/live-sync)
+// Facebook's own transcript for a live video (B33): read with the Page token on the server; the token never leaves it.
+app.get('/api/live/transcript-check', async (req, res) => {
+  if (!requireRole(req, res, ['owner', 'admin'])) return;
+  const videoId = String(req.query.video || '').trim();
+  if (!/^\d{5,25}$/.test(videoId)) return res.status(400).json({ error: 'Give the Facebook video ID (numbers only).' });
+  const token = getMetaPageAccessToken();
+  if (!token) return res.status(503).json({ error: 'The Facebook Page token is not set on the server.' });
+  const read = async (pathAndQuery: string) => {
+    const sep = pathAndQuery.includes('?') ? '&' : '?';
+    try {
+      const r = await fetch(`https://graph.facebook.com/v22.0/${pathAndQuery}${sep}access_token=${encodeURIComponent(token)}`, {
+        signal: AbortSignal.timeout(15000),
+      });
+      return { status: r.status, body: await r.json().catch(() => null) };
+    } catch (err: any) {
+      return { status: 0, body: { error: { message: err?.message || 'network error' } } };
+    }
+  };
+  const [captions, video] = await Promise.all([
+    read(`${videoId}/captions`),
+    read(`${videoId}?fields=id,title,length,live_status,created_time,source`),
+  ]);
+  // With save=1 the caption file is fetched here (the server can reach Facebook's file host) and kept as
+  // collection "transcripts", which the state sync never loads or deletes.
+  let saved: any = null;
+  if (req.query.save === '1') {
+    const list: any[] = Array.isArray(captions.body?.data) ? captions.body.data : [];
+    const pick = list.find((c) => c?.is_auto_generated) || list[0];
+    if (!pick?.uri) saved = { error: 'Facebook returned no caption file for this video.' };
+    else if (!portalBackend) saved = { error: 'No database is connected, so the transcript cannot be kept.' };
+    else {
+      try {
+        const r = await fetch(String(pick.uri), { signal: AbortSignal.timeout(30000) });
+        if (!r.ok) throw new Error(`caption file HTTP ${r.status}`);
+        const raw = await r.text();
+        const cues = parseSrt(raw);
+        // What the file itself holds, so a short transcript can be told apart from a reading problem
+        const file = { bytes: raw.length, timeLines: (raw.match(/-->/g) || []).length, contentType: r.headers.get('content-type'), tail: raw.slice(-400) };
+        const kept = await portalBackend.getRecord('transcripts', videoId);
+        const merged = mergeCues(kept?.data?.cues || [], cues);
+        const record = {
+          ...(kept?.data || {}), id: videoId, videoId, locale: pick.locale || null, isAutoGenerated: !!pick.is_auto_generated,
+          videoLengthSec: video.body?.length ?? null, fetchedAt: new Date().toISOString(), cueCount: merged.length, file, cues: merged,
+        };
+        await portalBackend.upsertRecords([{ collection: 'transcripts', id: videoId, data: record }]);
+        saved = { cueCount: merged.length, newFromThisFile: cues.length, file, firstLines: merged.slice(0, 5), lastLine: merged[merged.length - 1] || null };
+      } catch (err: any) {
+        saved = { error: `Could not fetch or keep the caption file: ${err?.message || 'unknown error'}` };
+      }
+    }
+  }
+  // Facebook's paging links carry the token; never send it to the browser.
+  // Whether the replay-transcription key is configured (never its value)
+  const transcriptionKey = process.env.GROQ_API_KEY ? 'set' : 'missing';
+  // Where the Page token comes from: Vercel settings (env) or the copy kept in the database (KI-005)
+  const envToken = process.env.META_PAGE_ACCESS_TOKEN || process.env.FB_PAGE_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN || process.env.PAGE_ACCESS_TOKEN || process.env.FB_ACCESS_TOKEN || process.env.FACEBOOK_PAGE_ACCESS_TOKEN || process.env.FACEBOOK_ACCESS_TOKEN || process.env.META_TOKEN || process.env.FB_TOKEN;
+  const tokenSource = envToken ? 'vercel settings' : 'database copy';
+  const safe = JSON.stringify({ videoId, checkedAt: new Date().toISOString(), transcriptionKey, tokenSource, captions, video, saved })
+    .split(token).join('[token]')
+    .split(encodeURIComponent(token)).join('[token]');
+  res.type('application/json').send(safe);
+});
+
 app.post('/api/facebook/live-sync', async (req, res) => {
   const { liveId, forceStatus, fbVideoId, fbPageId, accessToken } = req.body || {};
   let targetLive = lives.find((l) => l.id === (liveId || activeLive.id)) || lives[0];
@@ -2576,7 +2688,13 @@ app.post('/api/facebook/live-sync', async (req, res) => {
             }
           }
           targetLive.totalMined = orders.filter((o) => o.liveId === targetLive.id).length;
+          await keepRawComments(commentsList.filter((c) => c.id).map((c) => ({
+            id: String(c.id), liveId: targetLive.id, videoId, text: String(c.message || ''),
+            at: c.created_time ? new Date(c.created_time).toISOString() : nowIso,
+            name: c.from?.name || commenterNames[c.id], fromId: c.from?.id ? String(c.from.id) : undefined, source: 'graph' as const,
+          }))).catch((err) => console.error('Raw comments not kept:', err?.message));
         }
+        if (effectiveStatus === 'LIVE' || targetLive.status === 'live') await keepLiveCaptions(videoId, targetLive.id, fbToken);
       }
 
       const convUrl = `https://graph.facebook.com/v22.0/${encodeURIComponent(
diff --git a/server/liveEngine/srt.ts b/server/liveEngine/srt.ts
new file mode 100644
index 0000000..1162363
--- /dev/null
+++ b/server/liveEngine/srt.ts
@@ -0,0 +1,36 @@
+/** One caption line from a Facebook .srt transcript; times are seconds from the start of the video. */
+export interface Cue {
+  start: number;
+  end: number;
+  text: string;
+}
+
+const toSeconds = (t: string): number => {
+  const m = /^(\d+):(\d{2}):(\d{2})[,.](\d{1,3})$/.exec(t.trim());
+  if (!m) return NaN;
+  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4].padEnd(3, '0')) / 1000;
+};
+
+/** Parses .srt text into cues; malformed blocks are skipped, never guessed. */
+export function parseSrt(srt: string): Cue[] {
+  const cues: Cue[] = [];
+  for (const block of srt.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split(/\n{2,}/)) {
+    const lines = block.split('\n').filter((l) => l.trim() !== '');
+    const timeAt = lines.findIndex((l) => l.includes('-->'));
+    if (timeAt < 0) continue;
+    const [a, b] = lines[timeAt].split('-->');
+    const start = toSeconds(a);
+    const end = toSeconds(b);
+    const text = lines.slice(timeAt + 1).join(' ').trim();
+    if (!Number.isFinite(start) || !Number.isFinite(end) || !text) continue;
+    cues.push({ start, end, text });
+  }
+  return cues;
+}
+
+/** Adds new caption lines to the ones already kept: same start time and text means the same line. Sorted by time. */
+export function mergeCues(kept: readonly Cue[], incoming: readonly Cue[]): Cue[] {
+  const byKey = new Map<string, Cue>();
+  for (const c of [...kept, ...incoming]) byKey.set(`${c.start.toFixed(2)}|${c.text}`, c);
+  return [...byKey.values()].sort((a, b) => a.start - b.start || a.end - b.end);
+}
diff --git a/server/portalStore.ts b/server/portalStore.ts
index e5cacd7..ad98668 100644
--- a/server/portalStore.ts
+++ b/server/portalStore.ts
@@ -38,7 +38,9 @@ export interface SessionRow {
 }
 
 export interface PortalBackend {
-  loadRecords(): Promise<StoredRecord[]>;
+  /** Only the named collections when given; side collections (raw comments, transcripts) stay out of every request. */
+  loadRecords(collections?: string[]): Promise<StoredRecord[]>;
+  getRecord(collection: string, id: string): Promise<StoredRecord | null>;
   loadKv(): Promise<StoredKv[]>;
   upsertRecords(rows: StoredRecord[]): Promise<void>;
   deleteRecords(collection: string, ids: string[]): Promise<void>;
@@ -84,10 +86,10 @@ export class SupabaseBackend implements PortalBackend {
     return res;
   }
 
-  private async selectAll<T>(table: string, select: string): Promise<T[]> {
+  private async selectAll<T>(table: string, select: string, filter = ''): Promise<T[]> {
     const out: T[] = [];
     for (let from = 0; ; from += PAGE_SIZE) {
-      const res = await this.request(`${table}?select=${select}&order=updated_at.asc`, {}, {
+      const res = await this.request(`${table}?select=${select}${filter}&order=updated_at.asc`, {}, {
         Range: `${from}-${from + PAGE_SIZE - 1}`,
         'Range-Unit': 'items',
       });
@@ -97,8 +99,15 @@ export class SupabaseBackend implements PortalBackend {
     }
   }
 
-  loadRecords() {
-    return this.selectAll<StoredRecord>('portal_records', 'collection,id,data');
+  loadRecords(collections?: string[]) {
+    const filter = collections?.length ? `&collection=in.(${collections.map(encodeURIComponent).join(',')})` : '';
+    return this.selectAll<StoredRecord>('portal_records', 'collection,id,data', filter);
+  }
+
+  async getRecord(collection: string, id: string) {
+    const res = await this.request(`portal_records?select=collection,id,data&collection=eq.${encodeURIComponent(collection)}&id=eq.${encodeURIComponent(id)}`);
+    const rows = (await res.json()) as StoredRecord[];
+    return rows[0] || null;
   }
 
   loadKv() {
@@ -192,12 +201,17 @@ export class MemoryBackend implements PortalBackend {
     return JSON.parse(JSON.stringify(v));
   }
 
-  async loadRecords() {
+  async loadRecords(collections?: string[]) {
     if (this.failNextLoad) {
       this.failNextLoad = false;
       throw new Error('Simulated database outage');
     }
-    return this.clone([...this.records.values()]);
+    const all = [...this.records.values()];
+    return this.clone(collections?.length ? all.filter((r) => collections.includes(r.collection)) : all);
+  }
+  async getRecord(collection: string, id: string) {
+    const hit = [...this.records.values()].find((r) => r.collection === collection && r.id === id);
+    return hit ? this.clone(hit) : null;
   }
   async loadKv() {
     return [...this.kv.entries()].map(([key, value]) => this.clone({ key, value }));
@@ -264,7 +278,7 @@ export class StateSync {
   }
 
   async load() {
-    const [records, kv] = await Promise.all([this.backend.loadRecords(), this.backend.loadKv()]);
+    const [records, kv] = await Promise.all([this.backend.loadRecords(Object.keys(this.bindings.collections)), this.backend.loadKv()]);
     const byCollection = new Map<string, any[]>();
     for (const name of Object.keys(this.bindings.collections)) byCollection.set(name, []);
     this.recordSnapshot.clear();
diff --git a/src/components/FacebookTranscriptCheck.tsx b/src/components/FacebookTranscriptCheck.tsx
new file mode 100644
index 0000000..7b6035a
--- /dev/null
+++ b/src/components/FacebookTranscriptCheck.tsx
@@ -0,0 +1,61 @@
+import React, { useState } from 'react';
+import { FileText } from 'lucide-react';
+
+/** Shows what Facebook gives the portal for a live video's own transcript (B33). Read-only. */
+export const FacebookTranscriptCheck: React.FC<{ defaultVideoId?: string }> = ({ defaultVideoId }) => {
+  const [videoId, setVideoId] = useState(defaultVideoId || '');
+  const [busy, setBusy] = useState(false);
+  const [result, setResult] = useState<string | null>(null);
+
+  const check = async (save = false) => {
+    setBusy(true);
+    setResult(null);
+    try {
+      const r = await fetch(`/api/live/transcript-check?video=${encodeURIComponent(videoId.trim())}${save ? '&save=1' : ''}`);
+      const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
+      setResult(JSON.stringify(j, null, 2));
+    } catch (err: any) {
+      setResult(`Network error: ${err?.message || 'unknown'}`);
+    } finally {
+      setBusy(false);
+    }
+  };
+
+  return (
+    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-3">
+      <div className="flex items-center gap-2">
+        <FileText className="w-5 h-5 text-sky-400" />
+        <h3 className="text-sm font-bold text-white">Facebook transcript check</h3>
+      </div>
+      <p className="text-xs text-neutral-400">Asks Facebook for this live video's own transcript, the one viewers turn on from the ⋯ menu. "Check" changes nothing. "Fetch & keep transcript" saves the caption lines for the order finder.</p>
+      <div className="flex gap-2">
+        <input
+          type="text"
+          name="transcriptVideoId"
+          aria-label="Facebook video ID"
+          value={videoId}
+          onChange={(e) => setVideoId(e.target.value)}
+          placeholder="Facebook video ID"
+          className="flex-1 bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white font-mono"
+        />
+        <button
+          type="button"
+          onClick={() => check(false)}
+          disabled={busy || !videoId.trim()}
+          className="px-4 py-2 rounded-lg bg-sky-700 hover:bg-sky-600 disabled:opacity-50 text-white text-sm font-semibold"
+        >
+          {busy ? 'Checking…' : 'Check'}
+        </button>
+        <button
+          type="button"
+          onClick={() => check(true)}
+          disabled={busy || !videoId.trim()}
+          className="px-4 py-2 rounded-lg bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50 text-white text-sm font-semibold"
+        >
+          Fetch &amp; keep transcript
+        </button>
+      </div>
+      {result && <pre className="text-[11px] text-neutral-300 bg-neutral-950 border border-neutral-800 rounded-lg p-3 max-h-96 overflow-auto whitespace-pre-wrap">{result}</pre>}
+    </div>
+  );
+};
diff --git a/src/components/ReplayReviewStudio.tsx b/src/components/ReplayReviewStudio.tsx
index 0a83e84..b821504 100644
--- a/src/components/ReplayReviewStudio.tsx
+++ b/src/components/ReplayReviewStudio.tsx
@@ -27,6 +27,7 @@ import {
   Loader2
 } from 'lucide-react';
 import { LiveSession, BuyerOrder } from '../types/reconciliation';
+import { FacebookTranscriptCheck } from './FacebookTranscriptCheck';
 
 interface ReplayReviewStudioProps {
   live: LiveSession;
@@ -303,6 +304,8 @@ export const ReplayReviewStudio: React.FC<ReplayReviewStudioProps> = ({
 
   return (
     <div className="space-y-6">
+      <FacebookTranscriptCheck defaultVideoId={live.fbVideoId || ''} />
+
       {/* Replay Studio Header & Lag Calibration Bar */}
       <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl">
         <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-3 border-b border-neutral-800">
diff --git a/supabase/migrations/20261026_lockdown_anon.sql b/supabase/migrations/20261026_lockdown_anon.sql
new file mode 100644
index 0000000..b0491db
--- /dev/null
+++ b/supabase/migrations/20261026_lockdown_anon.sql
@@ -0,0 +1,8 @@
+-- T-005 security lock-down (KI-004), prepared 26 Oct 2026, applied only with the owner's approval.
+-- Removes the temporary policies that give the anonymous (public) key full access to every portal table.
+-- Row-level security is already ON for all four tables, and the portal server uses the service-role key,
+-- which isn't affected by these policies. After this, only the server can read or write.
+drop policy if exists temp_dev_all on public.portal_kv;
+drop policy if exists temp_dev_all on public.portal_records;
+drop policy if exists temp_dev_all on public.portal_sessions;
+drop policy if exists temp_dev_all on public.portal_staff;
diff --git a/tests/portalStore.test.ts b/tests/portalStore.test.ts
index f9131e0..a665bf0 100644
--- a/tests/portalStore.test.ts
+++ b/tests/portalStore.test.ts
@@ -113,6 +113,13 @@ test('SupabaseBackend speaks the REST API: paging, upsert, delete by id list', a
     await backend.upsertRecords(rows);
     const loaded = await backend.loadRecords();
     assert.equal(loaded.length, 1205, 'reads past the 1000-row page size');
+    await backend.upsertRecords([{ collection: 'raw_comments', id: 'c1', data: { text: 'mine T7' } }, { collection: 'transcripts', id: 'v1', data: { cues: [] } }]);
+    assert.equal((await backend.loadRecords(['orders'])).length, 1205, 'side collections stay out of the normal load');
+    assert.equal((await backend.loadRecords()).length, 1207);
+    assert.deepEqual((await backend.getRecord('raw_comments', 'c1'))?.data, { text: 'mine T7' });
+    assert.equal(await backend.getRecord('raw_comments', 'nope'), null);
+    await backend.deleteRecords('raw_comments', ['c1']);
+    await backend.deleteRecords('transcripts', ['v1']);
     await backend.deleteRecords('orders', ['o"0', 'o"1', 'o"2']);
     assert.equal((await backend.loadRecords()).length, 1202);
     await backend.upsertKv([{ key: 'phpPerThbRate', value: 1.7 }]);
@@ -138,3 +145,14 @@ test('a value set back to empty (null) is removed, not saved as null, and loads
   await sync.load();
   assert.equal(state.summary, null);
 });
+
+test('the state sync loads only its own collections and never deletes side collections', async () => {
+  const db = new MemoryBackend();
+  await db.upsertRecords([{ collection: 'raw_comments', id: 'c1', data: { text: 'mine T7' } }]);
+  const a = makeCopy(db);
+  await a.sync.load();
+  a.state.orders.push({ id: 'o1' });
+  await a.sync.save();
+  assert.ok(await db.getRecord('raw_comments', 'c1'), 'raw comments survive a save');
+  assert.equal((await db.loadRecords(['orders'])).length, 1);
+});
diff --git a/tests/serverFlow.test.ts b/tests/serverFlow.test.ts
index 536ebf5..4063487 100644
--- a/tests/serverFlow.test.ts
+++ b/tests/serverFlow.test.ts
@@ -165,6 +165,10 @@ test('the same live comment delivered to two copies at once creates one order',
   const made = s.data.orders.filter((o: any) => o.sourceCommentId === 'cmt_dup_1');
   assert.equal(made.length, 1);
   assert.equal(made[0].buyerName, 'Joy Tuazon', 'name kept as written');
+  const raw = db.tables.portal_records.filter((r: any) => r.collection === 'raw_comments' && r.id === 'cmt_dup_1');
+  assert.equal(raw.length, 1, 'the comment is also kept exactly as written, once');
+  assert.equal(raw[0].data.text, 'Mine rustans pink');
+  assert.equal(raw[0].data.name, 'Joy Tuazon');
 });
 
 test('only real order comments on the live become orders, pending and with no made-up price', async () => {
@@ -241,6 +245,10 @@ test('owner creates admin and co-owner links; admins cannot create links or see
   assert.equal(override.status, 200, 'the role comes from the sign-in, not from the request body');
   const noReason = await call(B, '/api/owner/order-override', { token: ownerToken, body: { orderId: 'ord_live_2', overrides: { size: '4XL' } } });
   assert.equal(noReason.status, 200, 'the owner overrides without giving a reason');
+  const tx = await call(A, '/api/live/transcript-check?video=3310662652470857', { token: ownerToken, method: 'GET' });
+  assert.equal(tx.status, 503, 'without a Page token the transcript check says so instead of guessing');
+  assert.ok(!JSON.stringify(tx.data).includes('gsk_'), 'no key value is ever returned');
+  assert.equal((await call(A, '/api/live/transcript-check?video=abc', { token: ownerToken, method: 'GET' })).status, 400, 'only numeric video IDs');
 });
 
 test('reset is disabled once data lives in the database', async () => {
diff --git a/tests/srt.test.ts b/tests/srt.test.ts
new file mode 100644
index 0000000..45544da
--- /dev/null
+++ b/tests/srt.test.ts
@@ -0,0 +1,24 @@
+import { test } from 'node:test';
+import assert from 'node:assert/strict';
+import { parseSrt } from '../server/liveEngine/srt';
+
+test('parses Facebook .srt captions into timed lines', () => {
+  const srt = '﻿1\r\n00:00:01,500 --> 00:00:04,000\r\nT7 po linen set\r\n650 lang\r\n\r\n2\r\n01:02:03,040 --> 01:02:05,000\r\nblack at beige\r\n\r\n3\r\nbroken line\r\nno time here\r\n';
+  assert.deepEqual(parseSrt(srt), [
+    { start: 1.5, end: 4, text: 'T7 po linen set 650 lang' },
+    { start: 3723.04, end: 3725, text: 'black at beige' },
+  ]);
+});
+
+test('an empty or malformed file gives no lines instead of guesses', () => {
+  assert.deepEqual(parseSrt(''), []);
+  assert.deepEqual(parseSrt('1\n00:00:xx --> 00:00:02,000\nhello'), []);
+});
+
+test('caption reads during a live add new lines and never duplicate old ones', async () => {
+  const { mergeCues } = await import('../server/liveEngine/srt');
+  const first = [{ start: 1, end: 2, text: 'T7 po' }, { start: 3, end: 4, text: '650' }];
+  const second = [{ start: 3, end: 4, text: '650' }, { start: 5, end: 6, text: 'black at beige' }];
+  assert.deepEqual(mergeCues(first, second).map((c) => c.text), ['T7 po', '650', 'black at beige']);
+  assert.deepEqual(mergeCues(second, []).length, 2);
+});
diff --git a/tsconfig.json b/tsconfig.json
index 2506189..1111921 100644
--- a/tsconfig.json
+++ b/tsconfig.json
@@ -26,5 +26,5 @@
     "allowImportingTsExtensions": true,
     "noEmit": true
   },
-  "exclude": ["dist", "extracted"]
+  "exclude": ["dist", "extracted", "reference", "kos"]
 }
```
