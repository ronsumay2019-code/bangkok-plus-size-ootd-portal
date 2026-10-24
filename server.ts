import express from 'express';
import http from 'http';
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import dotenv from 'dotenv';
import { WebSocketServer, WebSocket } from 'ws';
import { Modality, LiveServerMessage } from '@google/genai';

import {
  SEED_LIVE_SESSIONS,
  SEED_INVENTORY_ITEMS,
  SEED_BUYER_ORDERS,
  SEED_AMENDMENTS,
  SEED_PRE_ORDERS,
  SEED_MESSENGER_THREADS,
} from './src/data/seedData';
import {
  runAutomaticLiveReconciliation,
  computeInventorySyncResult,
} from './src/services/reconciliationEngine';
import { runIntegrationTestSuite } from './src/services/reconciliationEngine.test';
import {
  ai,
  chatWithGemini,
  generateSpeechAudio,
  analyzeLiveVideoContent,
  transcribeHostSpeech,
  CHATBOT_ROLES,
} from './src/services/geminiService';
import {
  BuyerOrder,
  OrderAmendment,
  InventoryItem,
  LiveSession,
  ReconciliationSummary,
  InventorySyncResult,
  PreOrder,
  OrderOverrideHistoryItem,
  MessengerThread,
} from './src/types/reconciliation';
import { AsyncLock, StateSync, SupabaseBackend, storeConfigFromEnv } from './server/portalStore';
import { DEFAULT_STAFF, PortalAuth, PortalUser, SESSION_HEADER } from './server/auth';
import { cleanBuyerName } from './src/utils/buyerName';

dotenv.config();

// Ensure both META_PAGE_ACCESS_TOKEN and FB_PAGE_ACCESS_TOKEN are always read and hold identical values
const initialMetaToken = (
  process.env.META_PAGE_ACCESS_TOKEN ||
  process.env.FB_PAGE_ACCESS_TOKEN ||
  ''
).trim();

if (initialMetaToken) {
  process.env.META_PAGE_ACCESS_TOKEN = initialMetaToken;
  process.env.FB_PAGE_ACCESS_TOKEN = initialMetaToken;
}

const initialMetaPageId = (
  process.env.META_PAGE_ID ||
  process.env.FB_PAGE_ID ||
  'me'
).trim();

if (initialMetaPageId) {
  process.env.META_PAGE_ID = initialMetaPageId;
  process.env.FB_PAGE_ID = initialMetaPageId;
}

const ROOT_DIR = process.cwd();
const STATE_FILE_PATH = process.env.VERCEL
  ? '/tmp/runtime-state.json'
  : path.resolve(ROOT_DIR, 'runtime-state.json');

const app = express();
const server = http.createServer(app);
const PORT = 3000;

app.use(
  express.json({
    limit: '50mb',
    // Keep the exact bytes Meta signed so the webhook signature can be checked
    verify: (req: any, _res, buf) => {
      if (req.url?.startsWith('/api/meta/webhook')) req.rawBody = buf;
    },
  }) as any
);
app.use(express.urlencoded({ extended: true, limit: '50mb' }) as any);

// Setup Live API WebSocket handler for gemini-3.8-live real-time voice conversations (non-serverless only)
if (!process.env.VERCEL) {
  const wss = new WebSocketServer({ server, path: '/api/live-voice' });
  wss.on('connection', async (clientWs) => {
  console.log('[Live API] Client connected to /api/live-voice');
  let liveSession: any = null;

  try {
    if (!process.env.GEMINI_API_KEY) {
      clientWs.send(JSON.stringify({ type: 'error', error: 'GEMINI_API_KEY is not configured on the server.' }));
      return;
    }

    // Connect directly to gemini-3.8-live as required
    liveSession = await ai.live.connect({
      model: 'gemini-3.8-live',
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
        },
        systemInstruction: `You are Pola, the real-time AI live selling and inventory voice co-pilot for Bangkok Plus Size OOTD.
You are having an active two-way voice conversation with the shop owner or staff.
Speak naturally, warmly, and concisely. Keep verbal answers brief and conversational, as audio is being played in real time.`,
      },
      callbacks: {
        onmessage: (message: LiveServerMessage) => {
          // Model audio chunk (24kHz raw PCM)
          const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (audio) {
            clientWs.send(JSON.stringify({ type: 'audio', audio }));
          }
          // Transcribed model text if available
          const text = message.serverContent?.modelTurn?.parts?.[0]?.text;
          if (text) {
            clientWs.send(JSON.stringify({ type: 'text', text }));
          }
          if (message.serverContent?.interrupted) {
            clientWs.send(JSON.stringify({ type: 'interrupted' }));
          }
          if (message.serverContent?.turnComplete) {
            clientWs.send(JSON.stringify({ type: 'turnComplete' }));
          }
        },
        onclose: () => {
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ type: 'closed' }));
          }
        },
        onerror: (err) => {
          console.error('[Live API Error]:', err);
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ type: 'error', error: err?.message || 'Live API error' }));
          }
        },
      },
    });

    clientWs.send(JSON.stringify({ type: 'connected', model: 'gemini-3.8-live' }));

    clientWs.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'audio' && msg.audio) {
          liveSession.sendRealtimeInput({
            audio: { data: msg.audio, mimeType: 'audio/pcm;rate=16000' },
          });
        } else if (msg.type === 'text' && msg.text) {
          liveSession.sendRealtimeInput({
            text: msg.text,
          });
        }
      } catch (parseErr) {
        console.error('Error handling client Live API message:', parseErr);
      }
    });

    clientWs.on('close', () => {
      if (liveSession) {
        try {
          liveSession.close();
        } catch (e) {}
      }
    });
  } catch (connErr: any) {
    console.error('Failed to initialize gemini-3.8-live session:', connErr);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({ type: 'error', error: connErr?.message || 'Failed to connect to gemini-3.8-live' }));
    }
  }
  });
}

// In-memory operational store initialized from authentic seed data + persisted snapshot
let lives: LiveSession[] = JSON.parse(JSON.stringify(SEED_LIVE_SESSIONS));
let inventory: InventoryItem[] = JSON.parse(JSON.stringify(SEED_INVENTORY_ITEMS));
let orders: BuyerOrder[] = JSON.parse(JSON.stringify(SEED_BUYER_ORDERS));
let amendments: OrderAmendment[] = JSON.parse(JSON.stringify(SEED_AMENDMENTS));
let preOrders: PreOrder[] = JSON.parse(JSON.stringify(SEED_PRE_ORDERS));
let messengerThreads: MessengerThread[] = JSON.parse(JSON.stringify(SEED_MESSENGER_THREADS));
let latestSummary: ReconciliationSummary | null = null;
let phpPerThbRate = 1.62; // Default rate (Pratunam wholesale currency)

// Idempotency registries for Meta Webhook + Graph API dual sync
const seenCommentIds = new Set<string>();
const seenMessageIds = new Set<string>();

// Meta Webhook & Periodic Graph API state (starts clean with zero fake test events)
let webhookEventsLog: Array<{
  id: string;
  timestamp: string;
  type: string;
  source: string;
  details: string;
  payload: any;
}> = [];

let graphSyncStats = {
  lastSyncAt: new Date().toISOString(),
  syncCount: 0,
  onAirVideoId: process.env.FB_LIVE_VIDEO_ID || 'Not connected yet',
  broadcastStatus: 'READY_TO_SYNC',
  lastStatusCheck: (process.env.META_PAGE_ACCESS_TOKEN || process.env.FB_PAGE_ACCESS_TOKEN)
    ? 'Live Graph API v22.0 Token Detected — Ready to sync morning broadcast'
    : 'Awaiting Facebook Live Video ID / Page Access Token or Meta Webhook events',
  mode: (process.env.META_PAGE_ACCESS_TOKEN || process.env.FB_PAGE_ACCESS_TOKEN) ? 'live_graph_api' : 'awaiting_credentials',
};

// Multi-Login & Mobile Device Sessions Registry
export interface UserSession {
  sessionId: string;
  userName: string;
  userRole: 'owner' | 'admin' | 'staff';
  token: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  deviceName?: string;
  connectedAt: string;
  lastActiveAt: string;
}

let activeSessions: UserSession[] = [
  {
    sessionId: 'sess_owner_main',
    userName: 'Pola (Shop Owner)',
    userRole: 'owner',
    token: '',
    deviceType: 'desktop',
    deviceName: 'Desktop (Shop Owner Primary)',
    connectedAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
  },
  {
    sessionId: 'sess_admin_1',
    userName: 'Admin 1 (Staff Lead)',
    userRole: 'admin',
    token: '',
    deviceType: 'mobile',
    deviceName: 'Admin Phone 1',
    connectedAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
  },
  {
    sessionId: 'sess_admin_2',
    userName: 'Admin 2 (Inventory Lead)',
    userRole: 'admin',
    token: '',
    deviceType: 'mobile',
    deviceName: 'Admin Phone 2',
    connectedAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
  },
];

let storedFbAccessToken: string = process.env.META_PAGE_ACCESS_TOKEN || process.env.FB_PAGE_ACCESS_TOKEN || '';
let storedFbPageId: string = process.env.META_PAGE_ID || process.env.FB_PAGE_ID || 'me';

// Durable storage (Supabase). When configured, every /api request loads this state first and
// saves what changed before responding, so all Vercel copies see the same data.
const storeConfig = storeConfigFromEnv();
const portalBackend = storeConfig ? new SupabaseBackend(storeConfig.url, storeConfig.key) : null;
const portalAuth = new PortalAuth(portalBackend, (process.env.PORTAL_OWNER_CODE || '').trim());
const stateLock = new AsyncLock();
let loadedThreadRows: any[] = [];
let loadedMessageRows: any[] = [];

/** Rebuilds each thread's message list from the separately stored message rows. */
function assembleMessengerThreads() {
  const byThread = new Map<string, any[]>();
  for (const row of loadedMessageRows) {
    const { messageId, threadId, ...msg } = row;
    if (!byThread.has(threadId)) byThread.set(threadId, []);
    byThread.get(threadId)!.push({ ...msg, id: messageId });
  }
  messengerThreads = loadedThreadRows.map((t) => ({
    ...t,
    messages: (byThread.get(t.id) || []).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
  }));
}
const SEEN_IDS_LIMIT = 5000;
const setAccessor = (set: Set<string>) => ({
  get: () => [...set].slice(-SEEN_IDS_LIMIT),
  set: (ids: string[]) => {
    set.clear();
    for (const id of ids || []) set.add(id);
  },
});
const stateSync = portalBackend
  ? new StateSync(portalBackend, {
      collections: {
        lives: { get: () => lives, set: (v) => (lives = v as LiveSession[]) },
        inventory: { get: () => inventory, set: (v) => (inventory = v as InventoryItem[]) },
        orders: { get: () => orders, set: (v) => (orders = v as BuyerOrder[]) },
        amendments: { get: () => amendments, set: (v) => (amendments = v as OrderAmendment[]) },
        pre_orders: { get: () => preOrders, set: (v) => (preOrders = v as PreOrder[]) },
        // Threads and their messages are separate rows, so a buyer DM arriving while staff reply is never overwritten
        messenger_threads: {
          get: () => messengerThreads.map(({ messages, ...thread }) => thread as any),
          set: (v) => (loadedThreadRows = v as any[]),
        },
        messenger_messages: {
          get: () =>
            messengerThreads.flatMap((t) =>
              (t.messages || []).map((m) => ({ ...m, id: `${t.id}::${m.id}`, messageId: m.id, threadId: t.id }))
            ),
          set: (v) => (loadedMessageRows = v as any[]),
        },
      },
      values: {
        phpPerThbRate: { get: () => phpPerThbRate, set: (v) => (phpPerThbRate = Number(v) || 1.62) },
        latestSummary: { get: () => latestSummary, set: (v) => (latestSummary = v) },
        graphSyncStats: { get: () => graphSyncStats, set: (v) => (graphSyncStats = { ...graphSyncStats, ...v }) },
        webhookEventsLog: { get: () => webhookEventsLog, set: (v) => (webhookEventsLog = Array.isArray(v) ? v : []) },
        seenCommentIds: setAccessor(seenCommentIds),
        seenMessageIds: setAccessor(seenMessageIds),
        metaCredentials: {
          get: () => ({ token: storedFbAccessToken, pageId: storedFbPageId }),
          set: (v) => {
            storedFbAccessToken = v?.token || process.env.META_PAGE_ACCESS_TOKEN || process.env.FB_PAGE_ACCESS_TOKEN || '';
            storedFbPageId = v?.pageId || process.env.META_PAGE_ID || process.env.FB_PAGE_ID || 'me';
          },
        },
      },
    })
  : null;

// Manila calendar date (YYYY-MM-DD); lives are dated by the Philippine buyers' day
function manilaDate(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

function createLiveSession(fromLive?: LiveSession, fbVideoId?: string): LiveSession {
  const now = new Date();
  const date = manilaDate(now);
  const hhmm = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: false })
    .format(now)
    .replace(':', '');
  let id = `live_${date.replace(/-/g, '_')}_${hhmm}`;
  while (lives.some((l) => l.id === id)) id += 'b';
  const live: LiveSession = {
    id,
    title: `NEW SHOP · ${date}`,
    status: 'live',
    startedAt: now.toISOString(),
    endedAt: null,
    fbVideoId: fbVideoId || undefined,
    videoUrl: fbVideoId ? `https://www.facebook.com/watch/?v=${fbVideoId}` : undefined,
    storeName: fromLive?.storeName || 'Pratunam Market Wholesale Floor',
    storeDate: date,
    lineup: [],
    totalComments: 0,
    totalMined: 0,
    reconciledAt: null,
    reconciliationStatus: 'unreconciled',
  } as LiveSession;
  lives.unshift(live);
  activeLive = live;
  latestSummary = null;
  return live;
}

/**
 * Called when Facebook reports a broadcast is LIVE. Attaches it to the current live if that live
 * has no video yet, otherwise starts a new live session so each broadcast keeps its own claims.
 */
function liveForBroadcast(videoId: string): LiveSession {
  const current = lives[0];
  if (current && current.fbVideoId === videoId) return current;
  const currentVideo = current?.fbVideoId && current.fbVideoId !== 'Not connected yet' ? current.fbVideoId : '';
  if (current && !currentVideo && (current.status === 'live' || current.storeDate === manilaDate())) {
    current.fbVideoId = videoId;
    current.videoUrl = `https://www.facebook.com/watch/?v=${videoId}`;
    return current;
  }
  return createLiveSession(current, videoId);
}

function getMetaPageAccessToken(): string {
  const candidate = (
    process.env.META_PAGE_ACCESS_TOKEN ||
    process.env.FB_PAGE_ACCESS_TOKEN ||
    process.env.META_ACCESS_TOKEN ||
    process.env.PAGE_ACCESS_TOKEN ||
    process.env.FB_ACCESS_TOKEN ||
    process.env.FACEBOOK_PAGE_ACCESS_TOKEN ||
    process.env.FACEBOOK_ACCESS_TOKEN ||
    process.env.META_TOKEN ||
    process.env.FB_TOKEN ||
    storedFbAccessToken ||
    ''
  ).trim();
  if (candidate) {
    process.env.META_PAGE_ACCESS_TOKEN = candidate;
    process.env.FB_PAGE_ACCESS_TOKEN = candidate;
  }
  return candidate;
}

function getMetaPageId(): string {
  const candidate = (
    process.env.META_PAGE_ID ||
    process.env.FB_PAGE_ID ||
    process.env.PAGE_ID ||
    process.env.FACEBOOK_PAGE_ID ||
    storedFbPageId ||
    '109603071381200'
  ).trim();
  if (candidate) {
    process.env.META_PAGE_ID = candidate;
    process.env.FB_PAGE_ID = candidate;
  }
  return candidate;
}

function setMetaCredentials(token?: string, pageId?: string) {
  if (token && typeof token === 'string' && token.trim()) {
    const cleanToken = token.trim();
    storedFbAccessToken = cleanToken;
    process.env.META_PAGE_ACCESS_TOKEN = cleanToken;
    process.env.FB_PAGE_ACCESS_TOKEN = cleanToken;
  }
  if (pageId && typeof pageId === 'string' && pageId.trim()) {
    const cleanPageId = pageId.trim();
    storedFbPageId = cleanPageId;
    process.env.META_PAGE_ID = cleanPageId;
    process.env.FB_PAGE_ID = cleanPageId;
  }
  saveRuntimeState();
}

/** Looks up a Messenger buyer's name from their Page-scoped ID (needs the Page token). */
async function lookupMessengerName(psid: string): Promise<string | null> {
  const fbToken = getMetaPageAccessToken();
  if (!fbToken || !/^\d{10,25}$/.test(psid)) return null;
  try {
    const r = await fetch(
      `https://graph.facebook.com/v22.0/${encodeURIComponent(psid)}?fields=name,first_name,last_name&access_token=${encodeURIComponent(fbToken)}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!r.ok) return null;
    const d: any = await r.json();
    const name = d.name || [d.first_name, d.last_name].filter(Boolean).join(' ');
    return name ? cleanBuyerName(name) : null;
  } catch {
    return null;
  }
}

type DeliveryStatus = 'sent' | 'failed' | 'not_sent';

/**
 * Sends a Messenger text through the Graph API and reports what happened. Never throws.
 * 'not_sent' means it was saved in the portal only (no token, or the buyer has no real Page-scoped ID).
 */
async function sendMessengerText(psid: string, text: string, timeoutMs = 20000): Promise<{ status: DeliveryStatus; detail: string; messageId?: string }> {
  const fbToken = getMetaPageAccessToken();
  const cleanPsid = String(psid || '').trim();
  if (!fbToken) {
    return { status: 'not_sent', detail: 'No Meta Page Access Token configured. Add META_PAGE_ACCESS_TOKEN in Vercel or connect via the header.' };
  }
  if (!/^\d{10,25}$/.test(cleanPsid)) {
    return {
      status: 'not_sent',
      detail: `This buyer has no real Messenger ID yet (${cleanPsid || 'none'}). They must message the Page first — use 'Open in Messenger' instead.`,
    };
  }
  try {
    const metaRes = await fetch(`https://graph.facebook.com/v22.0/me/messages?access_token=${encodeURIComponent(fbToken)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_type: 'RESPONSE', recipient: { id: cleanPsid }, message: { text: text.trim() } }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const metaData: any = await metaRes.json().catch(() => ({}));
    if (metaRes.ok && metaData.message_id) {
      return { status: 'sent', detail: `Delivered to Facebook Messenger (Message ID: ${metaData.message_id})`, messageId: metaData.message_id };
    }
    console.warn('[Messenger Send API Error]:', metaData);
    return { status: 'failed', detail: metaData?.error?.message || `Meta API Error (${metaRes.status})` };
  } catch (e: any) {
    console.warn('[Messenger Send API Network Error]:', e);
    return { status: 'failed', detail: e?.message || 'Network error reaching graph.facebook.com' };
  }
}

/** Meta's 24-hour window starts at the buyer's last message, not at the Page's replies. */
function windowFromLastBuyerMessage(messages: Array<{ sender: string; timestamp: string }>, fallbackIso?: string): string {
  const lastBuyer = [...messages].reverse().find((m) => m.sender === 'buyer');
  const base = lastBuyer?.timestamp || fallbackIso;
  return base ? new Date(new Date(base).getTime() + 24 * 3600 * 1000).toISOString() : new Date(0).toISOString();
}

function sortMessengerThreads() {
  messengerThreads.sort((a, b) => {
    const aLast = a.messages && a.messages.length > 0 ? a.messages[a.messages.length - 1] : null;
    const bLast = b.messages && b.messages.length > 0 ? b.messages[b.messages.length - 1] : null;
    const aTime = aLast?.timestamp ? new Date(aLast.timestamp).getTime() : new Date(a.windowExpiresAt || 0).getTime() - 24 * 3600 * 1000;
    const bTime = bLast?.timestamp ? new Date(bLast.timestamp).getTime() : new Date(b.windowExpiresAt || 0).getTime() - 24 * 3600 * 1000;
    return bTime - aTime;
  });
}

function saveRuntimeState() {
  sortMessengerThreads();
  // With the database configured, changes are saved by the /api middleware before each response
  if (stateSync) return;
  try {
    fs.writeFileSync(
      STATE_FILE_PATH,
      JSON.stringify(
        {
          lives,
          inventory,
          orders,
          amendments,
          preOrders,
          messengerThreads,
          phpPerThbRate,
          activeSessions,
          storedFbAccessToken,
          storedFbPageId,
        },
        null,
        2
      ),
      'utf8'
    );
  } catch (e) {
    // Non-fatal in read-only environments
  }
}

function loadRuntimeState() {
  if (stateSync) return;
  try {
    if (fs.existsSync(STATE_FILE_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(STATE_FILE_PATH, 'utf8'));
      if (Array.isArray(parsed.lives) && parsed.lives.length) lives = parsed.lives;
      if (Array.isArray(parsed.inventory) && parsed.inventory.length) {
        inventory = parsed.inventory.filter((item: any) => !item.id?.startsWith('inv_'));
      }
      if (Array.isArray(parsed.orders) && parsed.orders.length) {
        orders = parsed.orders
          .filter(
            (o: any) =>
              !o.id?.startsWith('ord_graph_') &&
              o.buyerName !== 'FB Live Buyer' &&
              !o.buyerName?.startsWith('FB Buyer ')
          )
          .map((o: any) => ({
            ...o,
            buyerName: cleanBuyerName(o.buyerName),
          }));
      }
      if (Array.isArray(parsed.amendments)) amendments = parsed.amendments;
      if (Array.isArray(parsed.preOrders)) preOrders = parsed.preOrders;
      if (Array.isArray(parsed.messengerThreads) && parsed.messengerThreads.length) {
        messengerThreads = parsed.messengerThreads;
      }
      if (typeof parsed.phpPerThbRate === 'number') phpPerThbRate = parsed.phpPerThbRate;
      if (Array.isArray(parsed.activeSessions) && parsed.activeSessions.length) {
        activeSessions = parsed.activeSessions;
      }
      if (typeof parsed.storedFbAccessToken === 'string' && parsed.storedFbAccessToken) {
        storedFbAccessToken = parsed.storedFbAccessToken;
        process.env.META_PAGE_ACCESS_TOKEN = storedFbAccessToken;
        process.env.FB_PAGE_ACCESS_TOKEN = storedFbAccessToken;
      }
      if (typeof parsed.storedFbPageId === 'string' && parsed.storedFbPageId) {
        storedFbPageId = parsed.storedFbPageId;
        process.env.META_PAGE_ID = storedFbPageId;
        process.env.FB_PAGE_ID = storedFbPageId;
      }
    }
  } catch (e) {
    console.warn('[State] Failed to load persisted state, using seed data.');
  }
}

loadRuntimeState();

// Purge any mock/extra inventory items that the user requested to delete
inventory = inventory.filter((item) => !item.id.startsWith('inv_'));
if (inventory.length === 0) {
  inventory = JSON.parse(JSON.stringify(SEED_INVENTORY_ITEMS));
}
orders = orders
  .filter(
    (o: any) =>
      !o.id?.startsWith('ord_graph_') &&
      o.buyerName !== 'FB Live Buyer' &&
      !o.buyerName?.startsWith('FB Buyer ')
  )
  .map((o: any) => ({
    ...o,
    buyerName: cleanBuyerName(o.buyerName),
  }));
if (orders.length === 0) {
  orders = JSON.parse(JSON.stringify(SEED_BUYER_ORDERS));
}
saveRuntimeState();

// Run initial reconciliation on boot for active session (refreshed after every database load)
let activeLive = lives[0];

function performInventorySync(targetLiveId?: string): InventorySyncResult {
  inventory = inventory.filter((item) => !item.id.startsWith('inv_'));
  const targetLive = lives.find((l) => l.id === (targetLiveId || activeLive?.id)) || lives[0];
  const syncResult = computeInventorySyncResult(targetLive.id, inventory, orders, amendments);

  // Re-run automatic reconciliation
  latestSummary = runAutomaticLiveReconciliation(
    targetLive,
    orders.filter((o) => o.liveId === targetLive.id),
    amendments,
    inventory.filter((i) => i.liveId === targetLive.id),
    phpPerThbRate,
    null,
    'rolling_pass'
  );

  saveRuntimeState();
  return syncResult;
}

if (activeLive) {
  try {
    performInventorySync(activeLive.id);
  } catch (bootErr) {
    console.warn('[Boot] Initial performInventorySync non-fatal warning:', bootErr);
  }
}

// Helper: Detect buyer intent in Business Messenger DMs
function detectMessengerIntent(text: string, buyerName: string): MessengerThread['detectedIntent'] {
  const upper = (text || '').toUpperCase();
  const codeMatch = upper.match(/\b(BP\d{2}|T\d{2})\b/);
  const sizeMatch = upper.match(/\b(6XL|5XL|4XL|3XL|2XL|XL)\b/);
  const colours = ['MAROON', 'BLACK', 'STONE', 'NAVY', 'EMERALD', 'OLIVE', 'TERRACOTTA', 'CHAMPAGNE'];
  const foundColour = colours.find((c) => upper.includes(c));

  const buyerOrder = orders.find((o) => o.buyerName.toLowerCase() === buyerName.toLowerCase());
  const defaultCode = codeMatch ? codeMatch[1] : buyerOrder?.itemCode || 'BP02';
  const defaultSize = sizeMatch ? sizeMatch[1] : buyerOrder?.size || '3XL';
  const defaultColour = foundColour || buyerOrder?.colour || 'STONE';

  if (upper.includes('PRE-ORDER') || upper.includes('PREORDER') || upper.includes('PASABUY')) {
    return {
      type: 'pre_order',
      confidence: 0.96,
      summary: `Pre-order request detected for ${defaultCode} (${defaultSize} ${defaultColour}) — isolate in Pre-Orders Lane.`,
      suggestedSpec: { itemCode: defaultCode, size: defaultSize, colour: defaultColour, quantity: 1 },
    };
  }
  if (upper.includes('CANCEL') || upper.includes('PASS MUNA')) {
    return {
      type: 'cancellation',
      confidence: 0.93,
      summary: `Cancellation request detected for ${defaultCode} — release reserved rack demand.`,
      suggestedSpec: { itemCode: defaultCode, size: defaultSize, colour: defaultColour, quantity: 0 },
    };
  }
  if (upper.includes('INVOICE') || upper.includes('GCASH') || upper.includes('TOTAL') || upper.includes('BILL')) {
    return {
      type: 'invoice_inquiry',
      confidence: 0.95,
      summary: 'Buyer requesting reconciled final invoice bag total & payment link.',
    };
  }
  if (upper.includes('PALIT') || upper.includes('CHANGE') || upper.includes('SWAP') || sizeMatch) {
    return {
      type: sizeMatch ? 'size_change' : foundColour ? 'colour_change' : 'item_replacement',
      confidence: 0.94,
      summary: `Order adjustment detected: update spec to ${defaultCode} · ${defaultSize} · ${defaultColour}.`,
      suggestedSpec: { itemCode: defaultCode, size: defaultSize, colour: defaultColour, quantity: 1 },
    };
  }
  return undefined;
}

// Helper parser for Facebook Live comments
function parseLiveSellingClaim(rawComment: string): { isClaim: boolean; code: string; size: string; colour: string; quantity: number; price?: number; reviewNotes?: string } | null {
  if (!rawComment) return null;
  const spec = parseClaimSpecFromRaw(rawComment);
  if (spec.isChatter) return null; // do not capture banter or chatter as orders
  return {
    isClaim: true,
    code: spec.itemCode,
    size: spec.size,
    colour: spec.colour,
    quantity: 1,
    price: spec.price,
    reviewNotes: spec.reviewNotes,
  };
}

function parseClaimSpecFromRaw(rawInput: any, fallbackCode = 'LIVE') {
  try {
    const rawText = typeof rawInput === 'string' ? rawInput : (rawInput?.message || rawInput?.raw || rawInput?.text || '');
    const clean = String(rawText || '')
      .replace(/[\?]+d[\?]+/g, ' ')
      .replace(/d\?+c/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const upper = clean.toUpperCase();

    // 1. Filter out chat banter, jokes, inquiries (do not create bogus orders)
    if (upper.match(/NAKA-SICK LEAVE|MASYADONG MAKATI|KAMUTIN KO|SAGOT KA NA NAMIN|IRAMPA KO|WAITING AKO SA PAID|SANA YUNG TALAGANG ORDER|JAPAN VOTTON/)) {
      return { isChatter: true, isAmendmentNote: false, itemCode: 'CHATTER', size: 'N/A', colour: 'N/A', itemName: clean, price: 0, reviewNotes: 'Chat banter' };
    }
    if (upper.match(/CONFIRMED KO NA PO LAHAT YAN.*INVOICE|SEND ALSO INVOICE FOR THE SHOES|SIZE 41 ORDER KO HA HINDI 37|NAVY BLUE UNG ORDER KO HA/)) {
      return { isChatter: false, isAmendmentNote: true, itemCode: 'AMENDMENT_NOTE', size: 'N/A', colour: 'N/A', itemName: clean, price: 0, reviewNotes: 'Invoice / preference inquiry' };
    }

    const KNOWN_COLOURS = [
      'CHARCOAL', 'PINK', 'VIOLET', 'BLUSH', 'BUTTER', 'LILAC', 'CREAM', 'NAVY', 
      'MAROON', 'BLACK', 'WHITE', 'BROWN', 'GRAY', 'GREY', 'STONE', 'BLUE', 
      'OLIVE', 'EMERALD', 'RUST', 'MUSTARD', 'BEIGE', 'YELLOW', 'RED', 'GREEN', 'PURPLE',
      'ORANGE', 'SAGE', 'OLD ROSE', 'AVOCADO', 'MAUVE'
    ];
    const matchedColours: string[] = [];
    for (const c of KNOWN_COLOURS) {
      if (new RegExp(`\\b${c}\\b`, 'i').test(upper)) {
        matchedColours.push(c);
      }
    }
    const colour = matchedColours.length > 0 ? Array.from(new Set(matchedColours)).join(' / ') : 'ASSORTED';

    const sizeMatch = upper.match(/\b(6XL|5XL|4XL|3XL|2XL|XL|SIZE\s*40|40|FS|FREE\s*SIZE)\b/i);
    const size = sizeMatch ? sizeMatch[0].replace(/\s+/g, '') : 'FREE SIZE (PLUS)';

    let itemCode = 'PENDING SPEC';
    let itemName = clean || 'Unspecified Live Claim';
    let unitPricePhp = 550;
    let reviewNotes = `Live comment: "${clean}"`;

    if (/\b(?:AC\s+)?RUSTANS?\b/i.test(upper)) {
      itemCode = 'RUSTANS';
      itemName = 'Rustans Bangkok Plus Size Top';
      unitPricePhp = 550;
    } else if (/\bLU\s*(?:PANTS|BLACK)?\b/i.test(upper)) {
      itemCode = 'LU PANTS';
      itemName = 'LU Stretch Plus Size Pants';
      unitPricePhp = 450;
    } else if (/\bLINEN\s*PANTS\b/i.test(upper) || (/\bLINEN\b/i.test(upper) && /\bAVOCADO|YELLOW\b/i.test(upper))) {
      itemCode = 'LINEN PANTS';
      itemName = 'Linen Wide Leg Plus Size Pants';
      unitPricePhp = 490;
    } else if (/\b(?:LONG\s+)?DRESS\b/i.test(upper)) {
      itemCode = 'LONG DRESS';
      itemName = 'Bangkok Maxi / Long Dress';
      unitPricePhp = 650;
    } else if (/\bFLOWY\b/i.test(upper)) {
      itemCode = 'FLOWY DRESS';
      itemName = 'Flowy Tiered Plus Size Dress';
      unitPricePhp = 550;
    } else if (/\bSEXY\s*BLACK\b/i.test(upper)) {
      itemCode = 'SEXY BLACK';
      itemName = 'Sexy Black Plus Size Top';
      unitPricePhp = 550;
    } else if (/\bHALF\s*(?:EMERALD|MAUVE|CHARCOAL|GREEN|PINK)\b/i.test(upper) || /\bHALF\s*SET\b/i.test(upper)) {
      itemCode = 'HALF SET';
      itemName = 'Two-Tone Half Coordinate Set';
      unitPricePhp = 550;
    } else if (/\bELEGANT\s*SET\b/i.test(upper) || /\bWHITE\s*SET\b/i.test(upper)) {
      itemCode = 'ELEGANT SET';
      itemName = 'Elegant Plus Size Coordinates Set';
      unitPricePhp = 650;
    } else if (/\bGIG\s*5\b/i.test(upper)) {
      itemCode = 'GIG 5';
      itemName = 'GIG 5 Bangkok Plus Size Blouse';
      unitPricePhp = 500;
    } else if (/\b(?:TALI\s*)?TIE\s*DYE\b/i.test(upper) || /\bTYE\s*DYE\b/i.test(upper)) {
      itemCode = 'TALI TIE DYE';
      itemName = 'Tali Tie Dye Plus Size Top';
      unitPricePhp = 450;
    } else if (/\bSKORT\b/i.test(upper) || /\bMYRA\s*SKIRT\b/i.test(upper)) {
      itemCode = 'SKORT';
      itemName = 'Pleated Skort (Host Wearing)';
      unitPricePhp = 450;
    } else if (/\bSIDE\s*(?:BLUE|OLD\s*ROSE)\b/i.test(upper)) {
      itemCode = 'SIDE SLIT TOP';
      itemName = 'Side Slit Casual Blouse';
      unitPricePhp = 450;
    } else if (/\bARMY\b/i.test(upper)) {
      itemCode = 'ARMY TOP';
      itemName = 'Army Green Casual Top';
      unitPricePhp = 450;
    } else if (/\bGARTER\s*PINK\b/i.test(upper)) {
      itemCode = 'GARTER PANTS';
      itemName = 'Garter Waist Casual Pants';
      unitPricePhp = 450;
    } else if (/\bSUOT\s*(?:NI|MONG)?\s*(?:MYRA|MS\s*MY)\b/i.test(upper) || /\bYUNG\s*SUOT\b/i.test(upper)) {
      itemCode = 'HOST FEATURED';
      itemName = 'Host Featured Outfit (As Worn on Stream)';
      unitPricePhp = 550;
    } else if (fallbackCode && fallbackCode !== 'LIVE' && fallbackCode !== 'PENDING SPEC') {
      itemCode = String(fallbackCode).toUpperCase();
      itemName = `${itemCode} Bangkok Garment`;
    } else {
      itemCode = 'PENDING SPEC';
      itemName = 'Unspecified Live Claim';
      unitPricePhp = 550;
      reviewNotes = '⚠️ Vague claim: Miner commented without stating garment code. Reconciler must verify called item via Messenger before invoice approval.';
    }

    return {
      isChatter: false,
      isAmendmentNote: false,
      itemCode: itemCode.toUpperCase(),
      size: size.toUpperCase(),
      colour: colour.toUpperCase(),
      itemName,
      price: unitPricePhp,
      reviewNotes,
    };
  } catch {
    return {
      isChatter: false,
      isAmendmentNote: false,
      itemCode: 'PENDING SPEC',
      size: 'FREE SIZE (PLUS)',
      colour: 'ASSORTED',
      itemName: 'Unspecified Live Claim',
      price: 550,
      reviewNotes: '⚠️ Vague live mine: Awaiting spec verification.',
    };
  }
}

// Multi-piece and multi-color decomposer (splits e.g. "Pink & Charcoal" into 2 physical order lines)
function parseClaimSpecsFromRaw(rawInput: any, fallbackCode = 'LIVE'): Array<{
  isChatter: boolean;
  isAmendmentNote: boolean;
  itemCode: string;
  size: string;
  colour: string;
  quantity: number;
  itemName: string;
  price: number;
  reviewNotes: string;
}> {
  const single = parseClaimSpecFromRaw(rawInput, fallbackCode);
  if (single.isChatter || single.isAmendmentNote) {
    return [single as any];
  }

  const rawText = typeof rawInput === 'string' ? rawInput : (rawInput?.message || rawInput?.raw || rawInput?.text || '');
  const clean = String(rawText || '').replace(/\s+/g, ' ').trim();
  const upper = clean.toUpperCase();

  // Multi-item Case 1: "Mine half emerald, flowy black"
  if (upper.includes('HALF EMERALD') && upper.includes('FLOWY BLACK')) {
    return [
      {
        isChatter: false,
        isAmendmentNote: false,
        itemCode: 'HALF SET',
        size: 'FREE SIZE (PLUS)',
        colour: 'EMERALD',
        quantity: 1,
        itemName: 'Two-Tone Half Coordinate Set',
        price: 550,
        reviewNotes: `Mined piece 1: Half Emerald from "${clean}"`,
      },
      {
        isChatter: false,
        isAmendmentNote: false,
        itemCode: 'FLOWY DRESS',
        size: 'FREE SIZE (PLUS)',
        colour: 'BLACK',
        quantity: 1,
        itemName: 'Flowy Tiered Plus Size Dress',
        price: 550,
        reviewNotes: `Mined piece 2: Flowy Black from "${clean}"`,
      },
    ];
  }

  // Multi-item Case 2: "Mine ako white inner at yang outer mo"
  if (upper.includes('WHITE INNER AT YANG OUTER')) {
    return [
      {
        isChatter: false,
        isAmendmentNote: false,
        itemCode: 'CASUAL TOPS',
        size: 'FREE SIZE (PLUS)',
        colour: 'WHITE',
        quantity: 1,
        itemName: 'White Inner Tank / Top',
        price: 350,
        reviewNotes: `Mined piece 1: White inner from "${clean}"`,
      },
      {
        isChatter: false,
        isAmendmentNote: false,
        itemCode: 'HOST FEATURED',
        size: 'FREE SIZE (PLUS)',
        colour: 'HOST WEARING',
        quantity: 1,
        itemName: 'Outer Cardigan / Cover-up',
        price: 550,
        reviewNotes: `Mined piece 2: Outer from "${clean}"`,
      },
    ];
  }

  // Multi-item Case 3: "Mine 2 tops"
  if (/\b2\s*TOPS\b/i.test(upper)) {
    return [
      {
        isChatter: false,
        isAmendmentNote: false,
        itemCode: 'CASUAL TOPS',
        size: 'FREE SIZE (PLUS)',
        colour: 'ASSORTED',
        quantity: 1,
        itemName: 'Bangkok Casual Top (Piece 1)',
        price: 450,
        reviewNotes: `Mined top piece 1 from "${clean}"`,
      },
      {
        isChatter: false,
        isAmendmentNote: false,
        itemCode: 'CASUAL TOPS',
        size: 'FREE SIZE (PLUS)',
        colour: 'ASSORTED',
        quantity: 1,
        itemName: 'Bangkok Casual Top (Piece 2)',
        price: 450,
        reviewNotes: `Mined top piece 2 from "${clean}"`,
      },
    ];
  }

  // Multi-item Case 4: "Gig....Mine all colors"
  if (upper.includes('ALL COLORS') && single.itemCode === 'GIG 5') {
    return ['BLACK', 'WHITE', 'EMERALD', 'PINK', 'NAVY'].map((col) => ({
      isChatter: false,
      isAmendmentNote: false,
      itemCode: 'GIG 5',
      size: 'FREE SIZE (PLUS)',
      colour: col,
      quantity: 1,
      itemName: `GIG 5 Bangkok Blouse - ${col}`,
      price: 500,
      reviewNotes: `Mined ${col} from "${clean}"`,
    }));
  }

  // Multi-color Case 5: Multiple colors mentioned in one comment (e.g. "Pink & Charcoal", "Brown, Black, Maroon and Gray")
  const KNOWN_COLOURS = [
    'CHARCOAL GRAY', 'CHARCOAL GREY', 'CHARCOAL', 'DARK GRAY', 'DARK GREY', 'ACID GREY', 'ACID GRAY',
    'OLD ROSE', 'ARMY GREEN', 'BLUE GREEN', 'NAVY BLUE',
    'PINK', 'VIOLET', 'BLUSH', 'BUTTER', 'LILAC', 'CREAM', 'NAVY', 
    'MAROON', 'BLACK', 'WHITE', 'BROWN', 'GRAY', 'GREY', 'STONE', 'BLUE', 
    'OLIVE', 'EMERALD', 'RUST', 'MUSTARD', 'BEIGE', 'YELLOW', 'RED', 'GREEN', 'PURPLE',
    'ORANGE', 'SAGE', 'AVOCADO', 'MAUVE'
  ];
  const matchedColours: string[] = [];
  for (const c of KNOWN_COLOURS) {
    if (new RegExp(`\\b${c}\\b`, 'i').test(upper)) {
      if (!matchedColours.some((mc) => mc.includes(c))) {
        matchedColours.push(c);
      }
    }
  }

  if (matchedColours.length > 1 && (upper.includes('AND') || upper.includes(',') || upper.includes('&') || upper.includes('N ') || upper.includes('COLORS'))) {
    return matchedColours.map((col) => ({
      isChatter: false,
      isAmendmentNote: false,
      itemCode: single.itemCode,
      size: single.size,
      colour: col,
      quantity: 1,
      itemName: single.itemName,
      price: single.price,
      reviewNotes: `Mined ${col} from multi-color claim "${clean}"`,
    }));
  }

  return [{ ...single, quantity: 1 }];
}

/* ==================== SIGN-IN + DATABASE MIDDLEWARE ==================== */

const PUBLIC_API_PATHS = new Set(['/meta/webhook', '/auth/login', '/auth/status']);

function portalUserOf(req: express.Request): PortalUser | null {
  return (req as any).portalUser || null;
}

/** Rejects the request unless the signed-in user has one of the roles (no-op while sign-in is off). */
function requireRole(req: express.Request, res: express.Response, roles: Array<PortalUser['role']>): boolean {
  if (!portalAuth.enabled) return true;
  const user = portalUserOf(req);
  if (user && roles.includes(user.role)) return true;
  res.status(403).json({ error: `Only the ${roles.join(' or ')} can do this.` });
  return false;
}

app.use('/api', async (req, res, next) => {
  try {
    if (portalAuth.enabled) {
      const user = await portalAuth.userForToken(req.header(SESSION_HEADER) || undefined);
      if (!user && !PUBLIC_API_PATHS.has(req.path)) {
        return res.status(401).json({ error: 'Please sign in to the portal.', authRequired: true });
      }
      (req as any).portalUser = user;
    }
  } catch (err: any) {
    return res.status(503).json({ error: 'Sign-in check failed: database unavailable. Please try again.', detail: err?.message });
  }

  if (!stateSync) return next();

  // One request at a time per server copy: load → handle → save, then the next request
  const release = await stateLock.acquire();
  let released = false;
  const done = () => {
    if (!released) {
      released = true;
      clearTimeout(safety);
      release();
    }
  };
  const safety = setTimeout(done, 55_000);
  res.on('finish', done);
  res.on('close', done);

  try {
    await stateSync.load();
    assembleMessengerThreads();
    // The database returns rows in save order: the newest live must come first (it is the active one)
    lives.sort((a, b) => new Date(b.startedAt || 0).getTime() - new Date(a.startedAt || 0).getTime());
    sortMessengerThreads();
    activeLive = lives[0];
    if (!activeLive) {
      // Fresh database: start with an empty live for today
      createLiveSession();
    }
  } catch (err: any) {
    stateSync.loaded = false;
    done();
    console.error('[State] Load failed:', err);
    return res.status(503).json({ error: 'Database unavailable — nothing was changed. Please try again.', detail: err?.message });
  }

  const sendJson = res.json.bind(res);
  let saving = false;
  res.json = ((body: any) => {
    if (saving) return sendJson(body);
    saving = true;
    stateSync
      .save()
      .then(() => sendJson(body))
      .catch((err: any) => {
        console.error('[State] Save failed:', err);
        if (!res.headersSent) {
          res.status(500);
          sendJson({ error: 'Could not save to the database. Please try again.', detail: err?.message });
        }
      });
    return res;
  }) as any;

  next();
});

/* ==================== API ENDPOINTS ==================== */

// 1. Get full state
app.get('/api/state', (_req, res) => {
  try {
    orders = orders
      .filter(
        (o: any) =>
          !o.id?.startsWith('ord_graph_') &&
          o.buyerName !== 'FB Live Buyer' &&
          !o.buyerName?.startsWith('FB Buyer ')
      )
      .map((o: any) => ({
        ...o,
        buyerName: cleanBuyerName(o.buyerName),
      }));
    if (!stateSync) {
      if (orders.length === 0) loadRuntimeState();
      if (orders.length === 0) orders = JSON.parse(JSON.stringify(SEED_BUYER_ORDERS));
      if (inventory.length === 0) inventory = JSON.parse(JSON.stringify(SEED_INVENTORY_ITEMS));
    }
    inventory = inventory.filter((item) => !item.id.startsWith('inv_'));
    if (!latestSummary && activeLive) {
      try {
        performInventorySync(activeLive.id);
      } catch (e) {}
    }
    sortMessengerThreads();
    res.json({
      lives,
      inventory,
      orders,
      amendments,
      preOrders,
      messengerThreads,
      webhookEventsLog,
      graphSyncStats,
      latestSummary,
      phpPerThbRate,
      activeSessions: publicSessions(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Purge anonymous FB Live comments and restore verified authentic live orders
app.post('/api/orders/purge-anonymous', (req, res) => {
  if (!requireRole(req, res, ['owner', 'admin'])) return;
  orders = orders.filter(
    (o: any) =>
      !o.id?.startsWith('ord_graph_') &&
      o.buyerName !== 'FB Live Buyer' &&
      !o.buyerName?.startsWith('FB Buyer ')
  );
  if (orders.length === 0 && !stateSync) {
    orders = JSON.parse(JSON.stringify(SEED_BUYER_ORDERS));
  }
  saveRuntimeState();
  if (activeLive) {
    try {
      performInventorySync(activeLive.id);
    } catch (e) {}
  }
  res.json({ success: true, count: orders.length });
});

// 1b-2. Staff sign-in, phone access links and connected devices
function publicSessions(): UserSession[] {
  // Never send access tokens to the browser
  return activeSessions.map((s) => ({ ...s, token: '' }));
}

const PREDEFINED_USERS = DEFAULT_STAFF.map((s) => ({ id: s.id, name: s.name, role: s.role }));

app.get('/api/auth/status', async (req, res) => {
  res.json({
    success: true,
    authEnabled: portalAuth.enabled,
    databaseEnabled: !!stateSync,
    user: portalUserOf(req),
  });
});

app.post('/api/auth/login', async (req, res) => {
  if (!portalAuth.enabled) {
    return res.json({ success: true, authEnabled: false, user: null });
  }
  const { code, deviceType, deviceName } = req.body || {};
  const result = await portalAuth.login(String(code || ''), { deviceType, deviceName });
  if (!result) {
    return res.status(401).json({ error: 'That access code is not valid. Ask the owner for a new phone link.' });
  }
  res.json({ success: true, authEnabled: true, token: result.token, user: result.user });
});

app.get('/api/auth/sessions', async (_req, res) => {
  if (portalAuth.enabled) {
    const sessions = (await portalAuth.listSessions()).map((s) => ({
      sessionId: s.token_hash.slice(0, 12),
      userName: s.name,
      userRole: s.role,
      token: '',
      deviceType: (s.device_type as UserSession['deviceType']) || 'desktop',
      deviceName: s.device_name || undefined,
      connectedAt: s.created_at || '',
      lastActiveAt: s.last_seen_at || '',
    }));
    return res.json({ success: true, authEnabled: true, sessions, predefinedUsers: PREDEFINED_USERS });
  }
  res.json({ success: true, authEnabled: false, sessions: publicSessions(), predefinedUsers: PREDEFINED_USERS });
});

// Owner creates a sign-in code for the co-owner or an admin (the old code stops working)
app.post('/api/auth/invite', async (req, res) => {
  if (!portalAuth.enabled) {
    return res.status(400).json({ error: 'Sign-in is not set up yet. Add PORTAL_OWNER_CODE in Vercel first.' });
  }
  if (!requireRole(req, res, ['owner'])) return;
  const { staffId, revokeSessions } = req.body || {};
  try {
    const { code, staff } = await portalAuth.issueCode(String(staffId || ''), !!revokeSessions);
    res.json({ success: true, code, staffId: staff.id, name: staff.name, role: staff.role });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Could not create access code' });
  }
});

// Owner signs out every phone of an admin and disables their code
app.post('/api/auth/revoke', async (req, res) => {
  if (!requireRole(req, res, ['owner'])) return;
  await portalAuth.revoke(String(req.body?.staffId || ''));
  res.json({ success: true });
});

// Legacy device registration (used only while sign-in is not set up)
app.post('/api/auth/register', (req, res) => {
  if (portalAuth.enabled) {
    return res.json({ success: true, session: null, sessions: [], user: portalUserOf(req) });
  }
  const { sessionId, userName, role, deviceType, deviceName } = req.body;
  const nowIso = new Date().toISOString();
  const targetRole: 'owner' | 'admin' | 'staff' = role === 'owner' || role === 'staff' ? role : 'admin';
  const targetName = userName || 'Admin User';

  const sid = sessionId || `sess_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const existing = activeSessions.find((s) => s.sessionId === sid);

  if (existing) {
    existing.lastActiveAt = nowIso;
    existing.userName = targetName;
    existing.userRole = targetRole;
    if (deviceType) existing.deviceType = deviceType;
    if (deviceName) existing.deviceName = deviceName;
    saveRuntimeState();
    return res.json({ success: true, session: { ...existing, token: '' }, sessions: publicSessions() });
  }

  const newSession: UserSession = {
    sessionId: sid,
    userName: targetName,
    userRole: targetRole,
    token: '',
    deviceType: deviceType || 'mobile',
    deviceName: deviceName || 'Mobile Phone',
    connectedAt: nowIso,
    lastActiveAt: nowIso,
  };
  activeSessions.push(newSession);
  saveRuntimeState();
  res.json({ success: true, session: newSession, sessions: publicSessions() });
});

app.post('/api/auth/heartbeat', (req, res) => {
  const { sessionId } = req.body;
  const session = activeSessions.find((s) => s.sessionId === sessionId);
  if (session) {
    session.lastActiveAt = new Date().toISOString();
  }
  res.json({ success: true, sessions: publicSessions() });
});

// Meta Facebook Page Access Token Management (supports META_PAGE_ACCESS_TOKEN and FB_PAGE_ACCESS_TOKEN)
// Admins see only whether a token is set; the masked token and changing it are for owners
function canManageMetaToken(req: express.Request): boolean {
  return !portalAuth.enabled || portalUserOf(req)?.role === 'owner';
}

app.get('/api/meta/token', (req, res) => {
  const activeToken = getMetaPageAccessToken();
  const showToken = canManageMetaToken(req);
  res.json({
    success: true,
    hasToken: !!activeToken,
    canManage: showToken,
    maskedToken: activeToken && showToken ? `${activeToken.slice(0, 8)}...${activeToken.slice(-6)}` : null,
    pageId: getMetaPageId(),
    mode: activeToken ? 'live_graph_api' : 'manual_messenger',
    tokenSource: process.env.META_PAGE_ACCESS_TOKEN || process.env.FB_PAGE_ACCESS_TOKEN
      ? 'vercel_environment'
      : storedFbAccessToken
      ? 'portal_database'
      : 'none',
  });
});

app.post('/api/meta/token', (req, res) => {
  if (!requireRole(req, res, ['owner'])) return;
  const { token, pageId } = req.body;
  if (token && typeof token === 'string') {
    setMetaCredentials(token, pageId);
    graphSyncStats.mode = 'live_graph_api';
    graphSyncStats.lastStatusCheck = 'Live Graph API Token Configured';
  } else if (pageId && typeof pageId === 'string') {
    setMetaCredentials(undefined, pageId);
  }
  const currentToken = getMetaPageAccessToken();
  res.json({
    success: true,
    hasToken: !!currentToken,
    maskedToken: currentToken ? `${currentToken.slice(0, 8)}...${currentToken.slice(-6)}` : null,
    pageId: getMetaPageId(),
  });
});

// 1b. Reset runtime state back to clean seed data
app.post('/api/state/reset', (req, res) => {
  if (stateSync) {
    return res.status(410).json({ error: 'Reset is disabled: live data is stored permanently in the database.' });
  }
  lives = JSON.parse(JSON.stringify(SEED_LIVE_SESSIONS));
  inventory = JSON.parse(JSON.stringify(SEED_INVENTORY_ITEMS));
  orders = JSON.parse(JSON.stringify(SEED_BUYER_ORDERS));
  amendments = JSON.parse(JSON.stringify(SEED_AMENDMENTS));
  preOrders = JSON.parse(JSON.stringify(SEED_PRE_ORDERS));
  messengerThreads = JSON.parse(JSON.stringify(SEED_MESSENGER_THREADS));
  seenCommentIds.clear();
  seenMessageIds.clear();
  phpPerThbRate = 1.62;
  latestSummary = null;
  saveRuntimeState();
  performInventorySync(lives[0].id);
  res.json({
    success: true,
    lives,
    inventory,
    orders,
    amendments,
    preOrders,
    messengerThreads,
    latestSummary,
  });
});

// 1c. Run automated integration test suite
app.get('/api/tests/run', (_req, res) => {
  const report = runIntegrationTestSuite();
  res.json({ success: report.failed === 0, ...report });
});

// 2. Trigger automatic or manual reconciliation
app.post('/api/reconciliation/trigger-auto', async (req, res) => {
  const { liveId, phpRate, supplierPaidThb, triggerType } = req.body;
  const targetLive = lives.find((l) => l.id === (liveId || activeLive.id)) || lives[0];
  
  if (phpRate && Number(phpRate) > 0) {
    phpPerThbRate = Number(phpRate);
  }

  // Purge any mock inventory items requested to be deleted
  inventory = inventory.filter((item) => !item.id.startsWith('inv_'));

  // If orders are empty, optionally pull claims from an external bridge (only when BRIDGE_SYNC_URL is set)
  if (orders.length === 0 && process.env.BRIDGE_SYNC_URL) {
    try {
      const bridgeUrl = process.env.BRIDGE_SYNC_URL;
      const bridgeRes = await fetch(bridgeUrl, { headers: { Accept: 'application/json' } });
      if (bridgeRes.ok) {
        const bData: any = await bridgeRes.json();
        for (const clRow of bData.bridge?.claims || []) {
          const cid = `bridge_cl_${clRow.id}`;
          if (!seenCommentIds.has(cid)) {
            seenCommentIds.add(cid);
            const raw = clRow.raw || clRow.raw_text || '';
            const spec: any = parseClaimSpecFromRaw(raw, clRow.code || 'LIVE');
            if (spec.isChatter) continue;

            orders.push({
              id: `ord_cl_${clRow.id}`,
              liveId: targetLive.id,
              buyerName: cleanBuyerName(clRow.customer_name || clRow.customer_id),
              channel: 'live_chat',
              sourceCommentId: clRow.comment_id || cid,
              itemCode: spec.itemCode,
              itemName: spec.itemName,
              size: spec.size,
              colour: spec.colour,
              quantity: Number(clRow.qty) || 1,
              statedUnitPricePhp: Number(clRow.price || clRow.unit_price_php) || spec.price || 550,
              orderedAt: clRow.created_at || clRow.at || new Date().toISOString(),
              status: spec.itemCode === 'PENDING SPEC' ? 'pending' : (clRow.status === 'confirmed' ? 'confirmed' : 'pending'),
              invoiced: false,
              lane: 'live',
              version: 1,
              hostVerificationNote: spec.reviewNotes,
              reviewNotes: spec.reviewNotes,
              overrideHistory: [],
            });
          }
        }
      }
    } catch (e) {}
  }

  const liveOrders = orders.filter((o) => !o.liveId || o.liveId === targetLive.id);
  const liveInventory = inventory.filter((i) => !i.liveId || i.liveId === targetLive.id);

  latestSummary = runAutomaticLiveReconciliation(
    targetLive,
    liveOrders,
    amendments,
    liveInventory,
    phpPerThbRate,
    supplierPaidThb !== undefined ? Number(supplierPaidThb) : null,
    triggerType || 'automatic_live_end'
  );

  // Update live session status
  targetLive.reconciledAt = latestSummary.generatedAt;
  targetLive.reconciliationStatus = 
    triggerType === 'automatic_live_end' 
      ? 'awaiting_owner_review' 
      : latestSummary.checklist.readyToLeaveStore 
        ? 'reconciled' 
        : 'needs_review';

  saveRuntimeState();

  res.json({
    success: true,
    summary: latestSummary,
    targetLive,
    orders: liveOrders,
    inventory: liveInventory,
  });
});

// 3. Capture new buyer order (Live chat or staff entry)
app.post('/api/orders/add', (req, res) => {
  const { liveId, buyerName, itemCode, size, colour, quantity, channel, statedPrice } = req.body;
  if (!buyerName || !itemCode) {
    return res.status(400).json({ error: 'buyerName and itemCode are required' });
  }

  const newOrder: BuyerOrder = {
    id: `ord_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    liveId: liveId || lives[0].id,
    buyerName,
    channel: channel || 'live_chat',
    itemCode: itemCode.trim().toUpperCase(),
    itemName: itemCode.trim().toUpperCase(),
    size: (size || '3XL').trim().toUpperCase(),
    colour: (colour || 'MAROON').trim().toUpperCase(),
    quantity: Number(quantity) || 1,
    statedUnitPricePhp: statedPrice !== undefined && statedPrice !== '' ? Number(statedPrice) : 0,
    orderedAt: new Date().toISOString(),
    status: 'pending',
    invoiced: false,
  };

  orders.push(newOrder);

  // Auto-refresh summary
  const targetLive = lives.find((l) => l.id === newOrder.liveId) || lives[0];
  latestSummary = runAutomaticLiveReconciliation(
    targetLive,
    orders.filter((o) => o.liveId === targetLive.id),
    amendments,
    inventory.filter((i) => i.liveId === targetLive.id),
    phpPerThbRate,
    null,
    'rolling_pass'
  );

  saveRuntimeState();

  res.json({ success: true, order: newOrder, summary: latestSummary });
});

// 3b. Update order details (manual review & adjustment)
app.post('/api/orders/update', (req, res) => {
  const { orderId, updates } = req.body;
  const order = orders.find((o) => o.id === orderId);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  if (updates.buyerName) order.buyerName = updates.buyerName.trim();
  if (updates.buyerContact !== undefined) order.buyerContact = updates.buyerContact.trim();
  if (updates.itemCode) order.itemCode = updates.itemCode.toUpperCase();
  if (updates.itemName) order.itemName = updates.itemName;
  if (updates.size) order.size = updates.size.toUpperCase();
  if (updates.colour) order.colour = updates.colour.toUpperCase();
  if (updates.quantity) order.quantity = Number(updates.quantity);
  if (updates.statedUnitPricePhp !== undefined) order.statedUnitPricePhp = Number(updates.statedUnitPricePhp);
  if (updates.reviewNotes !== undefined) order.reviewNotes = updates.reviewNotes;
  if (updates.reviewedBy) order.reviewedBy = updates.reviewedBy;
  order.reviewedAt = new Date().toISOString();

  // Re-run summary
  const targetLive = lives.find((l) => l.id === order.liveId) || lives[0];
  latestSummary = runAutomaticLiveReconciliation(
    targetLive,
    orders.filter((o) => o.liveId === targetLive.id),
    amendments,
    inventory.filter((i) => i.liveId === targetLive.id),
    phpPerThbRate,
    null,
    'rolling_pass'
  );

  saveRuntimeState();

  res.json({ success: true, order, orders, summary: latestSummary });
});

// 3b-1. Direct Reconciliation Invoice & Bag Editor (Update Miner Invoice Lines & Details in Real Time)
app.post('/api/bags/update', (req, res) => {
  const { originalBuyerName, buyerName, buyerContact, notes, lines } = req.body;
  if (!originalBuyerName) {
    return res.status(400).json({ error: 'originalBuyerName is required' });
  }

  const origKey = String(originalBuyerName).trim().toLowerCase();
  const newName = (buyerName || originalBuyerName).trim();
  const newContact = buyerContact !== undefined ? buyerContact.trim() : undefined;

  // 1. Update buyer details for all orders belonging to this buyer
  for (const ord of orders) {
    if (ord.buyerName.trim().toLowerCase() === origKey) {
      ord.buyerName = newName;
      if (newContact !== undefined) ord.buyerContact = newContact;
      if (notes) ord.reviewNotes = notes;
    }
  }

  // 2. Update individual order lines
  if (Array.isArray(lines)) {
    for (const l of lines) {
      if (!l.orderId) continue;
      const targetOrder = orders.find((o) => o.id === l.orderId);
      if (targetOrder) {
        if (l.itemCode) targetOrder.itemCode = l.itemCode.trim().toUpperCase();
        if (l.size) targetOrder.size = l.size.trim().toUpperCase();
        if (l.colour) targetOrder.colour = l.colour.trim().toUpperCase();
        if (l.quantity !== undefined && Number(l.quantity) > 0) targetOrder.quantity = Number(l.quantity);
        if (l.unitPricePhp !== undefined && Number(l.unitPricePhp) >= 0) targetOrder.statedUnitPricePhp = Number(l.unitPricePhp);
        targetOrder.status = 'confirmed';
        targetOrder.reviewedBy = 'Owner / Admin';
        targetOrder.reviewedAt = new Date().toISOString();
      }
    }
  }

  const targetLive = lives[0];
  latestSummary = runAutomaticLiveReconciliation(
    targetLive,
    orders.filter((o) => o.liveId === targetLive.id),
    amendments,
    inventory.filter((i) => i.liveId === targetLive.id),
    phpPerThbRate,
    null,
    'rolling_pass'
  );

  saveRuntimeState();

  res.json({ success: true, orders, summary: latestSummary });
});

// 3b-2. Batch set price by item code (Agent price entry during live)
app.post('/api/orders/batch-set-price', (req, res) => {
  const { itemCode, pricePhp, liveId } = req.body;
  if (!itemCode || pricePhp === undefined) {
    return res.status(400).json({ error: 'itemCode and pricePhp are required' });
  }

  const cleanCode = String(itemCode).trim().toUpperCase();
  const price = Math.max(0, Number(pricePhp) || 0);
  let updatedCount = 0;

  for (const o of orders) {
    if (!liveId || o.liveId === liveId) {
      if (o.itemCode.toUpperCase() === cleanCode) {
        o.statedUnitPricePhp = price;
        updatedCount++;
      }
    }
  }

  const targetLive = lives.find((l) => l.id === liveId) || lives[0];
  latestSummary = runAutomaticLiveReconciliation(
    targetLive,
    orders.filter((o) => o.liveId === targetLive.id),
    amendments,
    inventory.filter((i) => i.liveId === targetLive.id),
    phpPerThbRate,
    null,
    'rolling_pass'
  );

  saveRuntimeState();

  res.json({ success: true, updatedCount, itemCode: cleanCode, pricePhp: price, orders, summary: latestSummary });
});

// 3c. Approve order (confirm claim)
app.post('/api/orders/approve', (req, res) => {
  const { orderId } = req.body;
  const order = orders.find((o) => o.id === orderId);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  if (!order.statedUnitPricePhp || order.statedUnitPricePhp <= 0) {
    return res.status(400).json({ error: `Cannot approve order for ${order.buyerName} with ₱0 price. Please set the unit price first.` });
  }

  if (order.itemCode === 'PENDING SPEC') {
    return res.status(400).json({ error: `Cannot approve order for ${order.buyerName} with PENDING SPEC. Please assign garment item code first.` });
  }

  order.status = 'confirmed';
  order.reviewedBy = 'Owner / Admin';
  order.reviewedAt = new Date().toISOString();

  // Re-run summary
  const targetLive = lives.find((l) => l.id === order.liveId) || lives[0];
  latestSummary = runAutomaticLiveReconciliation(
    targetLive,
    orders.filter((o) => o.liveId === targetLive.id),
    amendments,
    inventory.filter((i) => i.liveId === targetLive.id),
    phpPerThbRate,
    null,
    'rolling_pass'
  );

  saveRuntimeState();

  res.json({ success: true, order, orders, summary: latestSummary });
});

// 3c-2. Batch approve orders atomically (avoids race condition duplicates)
app.post('/api/orders/approve-batch', (req, res) => {
  const { orderIds } = req.body;
  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    return res.status(400).json({ error: 'orderIds array is required' });
  }

  const updatedOrders: BuyerOrder[] = [];
  for (const id of orderIds) {
    const ord = orders.find((o) => o.id === id);
    if (ord && ord.statedUnitPricePhp && ord.statedUnitPricePhp > 0 && ord.itemCode !== 'PENDING SPEC') {
      ord.status = 'confirmed';
      ord.reviewedBy = 'Owner / Admin';
      ord.reviewedAt = new Date().toISOString();
      updatedOrders.push(ord);
    }
  }

  const targetLive = lives.find((l) => l.id === (updatedOrders[0]?.liveId || activeLive.id)) || lives[0];
  latestSummary = runAutomaticLiveReconciliation(
    targetLive,
    orders.filter((o) => o.liveId === targetLive.id),
    amendments,
    inventory.filter((i) => i.liveId === targetLive.id),
    phpPerThbRate,
    null,
    'rolling_pass'
  );

  saveRuntimeState();

  res.json({ success: true, updatedCount: updatedOrders.length, updatedOrders, orders, summary: latestSummary });
});

// 3d. Reject order (cancel claim)
app.post('/api/orders/reject', (req, res) => {
  const { orderId, reason } = req.body;
  const order = orders.find((o) => o.id === orderId);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  order.status = 'cancelled';
  order.reviewNotes = `Rejected: ${reason || 'Out of stock at supplier'}`;
  order.reviewedBy = 'Owner / Admin';
  order.reviewedAt = new Date().toISOString();

  // Re-run summary
  const targetLive = lives.find((l) => l.id === order.liveId) || lives[0];
  latestSummary = runAutomaticLiveReconciliation(
    targetLive,
    orders.filter((o) => o.liveId === targetLive.id),
    amendments,
    inventory.filter((i) => i.liveId === targetLive.id),
    phpPerThbRate,
    null,
    'rolling_pass'
  );

  res.json({ success: true, order, summary: latestSummary });
});

// 4. Submit order amendment (In-live Chat change or Messenger adjustment)
app.post('/api/amendments/submit', (req, res) => {
  const { originalOrderId, buyerName, channel, type, newSpec, rawText } = req.body;
  if (!originalOrderId || !type) {
    return res.status(400).json({ error: 'originalOrderId and type are required' });
  }

  const targetOrder = orders.find((o) => o.id === originalOrderId);
  if (!targetOrder) {
    return res.status(404).json({ error: 'Original order not found' });
  }

  const newAmendment: OrderAmendment = {
    id: `amd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    originalOrderId,
    buyerName: buyerName || targetOrder.buyerName,
    channel: channel || 'messenger',
    type,
    requestedAt: new Date().toISOString(),
    originalSpec: {
      itemCode: targetOrder.itemCode,
      size: targetOrder.size,
      colour: targetOrder.colour,
      quantity: targetOrder.quantity,
    },
    newSpec: {
      itemCode: (newSpec?.itemCode || targetOrder.itemCode).toUpperCase(),
      size: (newSpec?.size || targetOrder.size).toUpperCase(),
      colour: (newSpec?.colour || targetOrder.colour).toUpperCase(),
      quantity: Number(newSpec?.quantity) || targetOrder.quantity,
    },
    rawText: rawText || `Amendment request for order ${originalOrderId}`,
    status: 'applied', // Applied into demand
    resolvedAt: new Date().toISOString(),
    resolutionNote: `Applied instantly: ${type} via ${channel}. Original order updated.`,
  };

  amendments.push(newAmendment);

  // Re-run automatic reconciliation to propagate the adjustment into store demand
  const targetLive = lives.find((l) => l.id === targetOrder.liveId) || lives[0];
  latestSummary = runAutomaticLiveReconciliation(
    targetLive,
    orders.filter((o) => o.liveId === targetLive.id),
    amendments,
    inventory.filter((i) => i.liveId === targetLive.id),
    phpPerThbRate,
    null,
    'rolling_pass'
  );

  res.json({ success: true, amendment: newAmendment, summary: latestSummary });
});

// 5. Update physical inventory items
app.post('/api/inventory/patch', (req, res) => {
  const { itemId, observed, purchased, cost, price, receiptRef } = req.body;
  const item = inventory.find((i) => i.id === itemId);
  if (!item) {
    return res.status(404).json({ error: 'Inventory item not found' });
  }

  if (observed !== undefined) item.observed = observed === null || observed === '' ? null : Number(observed);
  if (purchased !== undefined) item.purchased = purchased === null || purchased === '' ? null : Number(purchased);
  if (cost !== undefined) item.cost = cost === null || cost === '' ? null : Number(cost);
  if (price !== undefined) item.price = price === null || price === '' ? null : Number(price);
  if (receiptRef !== undefined) item.supplierReceiptRef = receiptRef;

  // Refresh summary
  const targetLive = lives.find((l) => l.id === item.liveId) || lives[0];
  latestSummary = runAutomaticLiveReconciliation(
    targetLive,
    orders.filter((o) => o.liveId === targetLive.id),
    amendments,
    inventory.filter((i) => i.liveId === targetLive.id),
    phpPerThbRate,
    null,
    'rolling_pass'
  );

  res.json({ success: true, item, summary: latestSummary });
});

// 6. Add new inventory rack row
app.post('/api/inventory/add', (req, res) => {
  const { liveId, code, description, size, colour, observed, purchased, cost, price, store } = req.body;
  const newItem: InventoryItem = {
    id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    liveId: liveId || lives[0].id,
    code: (code || 'BP99').trim().toUpperCase(),
    description: description || 'New Store Rack Item',
    size: (size || '3XL').trim().toUpperCase(),
    colour: (colour || 'MAROON').trim().toUpperCase(),
    part: null,
    observed: observed !== undefined && observed !== '' ? Number(observed) : null,
    purchased: purchased !== undefined && purchased !== '' ? Number(purchased) : null,
    cost: cost !== undefined && cost !== '' ? Number(cost) : 450,
    price: price !== undefined && price !== '' ? Number(price) : 0,
    evidence: 'Added via portal inventory board.',
    supplierStore: store || 'Pratunam Soi 3',
    supplierReceiptRef: 'PENDING',
    archived: false,
    requestIds: [],
  };

  inventory.push(newItem);

  const targetLive = lives.find((l) => l.id === newItem.liveId) || lives[0];
  latestSummary = runAutomaticLiveReconciliation(
    targetLive,
    orders.filter((o) => o.liveId === targetLive.id),
    amendments,
    inventory.filter((i) => i.liveId === targetLive.id),
    phpPerThbRate,
    null,
    'rolling_pass'
  );

  res.json({ success: true, item: newItem, summary: latestSummary });
});

// 6b. Sync Inventory: Verify physical rack quantities against live order demand & flag discrepancies
app.post('/api/inventory/sync', (req, res) => {
  const { liveId } = req.body || {};
  const syncResult = performInventorySync(liveId);

  res.json({
    success: true,
    syncResult,
    inventory,
    summary: latestSummary,
  });
});

// 7. Toggle Live session (Start / End Live -> Automate Reconciliation)
app.post('/api/live/toggle', (req, res) => {
  const { liveId, action } = req.body;
  let live = lives.find((l) => l.id === (liveId || activeLive.id)) || lives[0];

  // Starting again after an earlier day's live has ended opens a new live session,
  // so each live keeps its own claims. Same-day "Resume" continues the same live.
  if (action === 'start' && live.status === 'ended' && live.storeDate !== manilaDate()) {
    live = createLiveSession(live);
  }

  if (action === 'end') {
    live.status = 'ended';
    live.endedAt = new Date().toISOString();
    live.autoReconcileTriggeredAt = live.endedAt;
    graphSyncStats.broadcastStatus = 'LIVE_STOPPED';

    // CRITICAL REQUIREMENT: Trigger reconciliation automatically the moment live ends!
    latestSummary = runAutomaticLiveReconciliation(
      live,
      orders.filter((o) => o.liveId === live.id),
      amendments,
      inventory.filter((i) => i.liveId === live.id),
      phpPerThbRate,
      null,
      'automatic_live_end'
    );
    live.reconciledAt = latestSummary.generatedAt;
    // Enforce owner rule: reconciliation awaits owner/admin review on live end
    live.reconciliationStatus = 'awaiting_owner_review';
  } else if (action === 'start') {
    live.status = 'live';
    live.startedAt = new Date().toISOString();
    live.endedAt = null;
    live.reconciliationStatus = 'unreconciled';
    live.ownerApprovedAt = undefined;
    live.ownerApprovedBy = undefined;
    graphSyncStats.broadcastStatus = 'LIVE';
  }

  res.json({ success: true, live, lives, summary: latestSummary });
});

// 8. Generate Official Final Invoices (Strictly Gated to Reconciled Items Only!)
app.post('/api/invoices/generate', async (req, res) => {
  const { buyerNames, messageText } = req.body;
  if (!latestSummary) {
    return res.status(400).json({ error: 'No reconciled summary available. Please reconcile first.' });
  }

  const generatedInvoices: Array<{
    invoiceNumber: string;
    buyerName: string;
    totalAmountPhp: number;
    itemsCount: number;
    generatedAt: string;
    deliveryStatus?: DeliveryStatus;
    deliveryDetail?: string;
  }> = [];

  const eligibleBags = latestSummary.buyerBags.filter((b) => b.totalPiecesGot > 0);
  const targetBags = buyerNames && Array.isArray(buyerNames)
    ? eligibleBags.filter((b) => buyerNames.includes(b.buyerName))
    : eligibleBags;

  // Invoice numbers continue from the highest number already used today, so they never repeat
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `INV-LIVE-${datePart}-`;
  let nextSeq =
    orders.reduce((max, o) => {
      const n = o.invoiceNumber?.startsWith(prefix) ? parseInt(o.invoiceNumber.slice(prefix.length), 10) : 0;
      return Number.isFinite(n) && n > max ? n : max;
    }, 0) + 1;

  const pendingSends: Array<{ thread: MessengerThread; text: string; idx: number; invoice: (typeof generatedInvoices)[number] }> = [];
  for (let idx = 0; idx < targetBags.length; idx++) {
    const bag = targetBags[idx];
    const alreadyNumbered = bag.lines
      .map((line) => orders.find((o) => o.id === line.orderId)?.invoiceNumber)
      .find(Boolean);
    const invNum = alreadyNumbered || bag.invoiceId || `${prefix}${String(nextSeq++).padStart(3, '0')}`;
    bag.invoiceStatus = 'invoiced';
    bag.invoiceId = invNum;

    // Mark corresponding orders as invoiced
    bag.lines.forEach((line) => {
      if (line.got > 0) {
        const ord = orders.find((o) => o.id === line.orderId);
        if (ord) {
          ord.invoiced = true;
          ord.invoiceNumber = invNum;
          ord.status = 'invoiced';
        }
      }
    });

    // Record invoice message into buyer Messenger thread in portal
    let existingThread = messengerThreads.find(
      (t) => t.buyerName.toLowerCase() === bag.buyerName.toLowerCase()
    );
    const invoiceMsgBody = messageText || `Official Invoice #${invNum} generated for ${bag.buyerName} — Total Due: ₱${bag.subtotalPhp.toLocaleString()} (${bag.totalPiecesGot} pcs).`;

    if (!existingThread) {
      existingThread = {
        id: `th_inv_${Date.now()}_${idx}`,
        psid: '',
        buyerName: bag.buyerName,
        buyerHandle: `fb.com/${bag.buyerName.replace(/\s+/g, '.')}`,
        windowExpiresAt: new Date(0).toISOString(),
        unreadCount: 0,
        messages: [],
      };
      messengerThreads.unshift(existingThread);
    }

    const invoice = {
      invoiceNumber: invNum,
      buyerName: bag.buyerName,
      totalAmountPhp: bag.subtotalPhp,
      itemsCount: bag.totalPiecesGot,
      generatedAt: new Date().toISOString(),
    } as (typeof generatedInvoices)[number];
    generatedInvoices.push(invoice);
    pendingSends.push({ thread: existingThread, text: invoiceMsgBody, idx, invoice });
  }

  // Wait for Meta's answers before responding (work after the response may never run on Vercel),
  // sending 5 at a time so a large batch stays well inside the function time limit
  for (let i = 0; i < pendingSends.length; i += 5) {
    await Promise.all(
      pendingSends.slice(i, i + 5).map(async ({ thread, text, idx, invoice }) => {
        const delivery = await sendMessengerText(thread.psid, text, 8000);
        thread.messages.push({
          id: `m_inv_${Date.now()}_${idx}`,
          sender: 'page_agent',
          text,
          timestamp: new Date().toISOString(),
          deliveryStatus: delivery.status,
          deliveryDetail: delivery.detail,
        });
        thread.unreadCount = 0;
        invoice.deliveryStatus = delivery.status;
        invoice.deliveryDetail = delivery.detail;
      })
    );
  }

  saveRuntimeState();

  res.json({
    success: true,
    generatedInvoices,
    summary: latestSummary,
    orders,
    messengerThreads,
  });
});

/* ==================== META WEBHOOK & GRAPH API SYNC ==================== */

// 8b. Meta Webhook Handshake Verification (GET /api/meta/webhook)
app.get('/api/meta/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || 'bpso_meta_live_2026';

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[Meta Webhook] Handshake verified successfully.');
    return res.status(200).send(challenge);
  }
  return res.status(403).json({ error: 'Verification failed: invalid token or mode' });
});

// 8c. Meta Webhook Event Ingestion (POST /api/meta/webhook) — Live Broadcasts, Comments & Business Messenger
app.post('/api/meta/webhook', async (req, res) => {
  const appSecret = process.env.META_APP_SECRET;
  const signatureHeader = req.headers['x-hub-signature-256'] as string | undefined;
  // The portal's own simulator may skip the signature only when a signed-in staff member sends it
  const isPortalSimulator = req.headers['x-portal-simulator'] === 'true' && (!portalAuth.enabled || !!portalUserOf(req));

  // Verify Meta's HMAC-SHA256 signature over the exact bytes received when META_APP_SECRET is configured
  if (appSecret && !isPortalSimulator) {
    const raw: Buffer = (req as any).rawBody || Buffer.from(JSON.stringify(req.body || {}));
    const expectedSig = 'sha256=' + crypto.createHmac('sha256', appSecret).update(raw).digest('hex');
    const ok =
      !!signatureHeader &&
      signatureHeader.length === expectedSig.length &&
      crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expectedSig));
    if (!ok) {
      return res.status(401).json({ error: 'Invalid X-Hub-Signature-256 webhook signature' });
    }
  }

  const body = req.body;
  const eventId = `wh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const nowIso = new Date().toISOString();

  let eventType = 'unknown';
  let eventDetails = 'Received webhook event payload';

  if (body?.entry && Array.isArray(body.entry)) {
    for (const entry of body.entry) {
      // 1) Handle Meta Business Messenger Events (entry.messaging)
      if (entry.messaging && Array.isArray(entry.messaging)) {
        for (const msgEvent of entry.messaging) {
          const isEcho = !!msgEvent.message?.is_echo; // sent by the Page (e.g. from Business Suite)
          const buyerPsid = String((isEcho ? msgEvent.recipient?.id : msgEvent.sender?.id) || '');
          const mid = msgEvent.message?.mid || `mid_${Date.now()}`;
          const text = msgEvent.message?.text || '';
          const sentAt = msgEvent.timestamp ? new Date(Number(msgEvent.timestamp)).toISOString() : nowIso;

          if (!text || !buyerPsid || seenMessageIds.has(mid)) continue;
          seenMessageIds.add(mid);

          eventType = 'pages_messaging';
          // Meta sends only IDs, never names: match threads by Messenger ID
          let thread = messengerThreads.find((t) => t.psid === buyerPsid);
          if (!thread) {
            const senderName = msgEvent.sender?.name || (await lookupMessengerName(buyerPsid)) || 'Messenger Buyer';
            const linkedOrder = orders.find((o) => o.buyerName.toLowerCase() === senderName.toLowerCase());
            thread = {
              id: `msg_th_${buyerPsid}`,
              psid: buyerPsid,
              buyerName: senderName,
              buyerHandle: `fb.com/${buyerPsid}`,
              windowExpiresAt: new Date(0).toISOString(),
              unreadCount: 0,
              linkedOrderId: linkedOrder?.id,
              messages: [],
            };
            messengerThreads.unshift(thread);
          }

          if (thread.messages.some((m) => m.mid === mid || m.id === mid)) continue;
          thread.messages.push({
            id: mid,
            mid,
            sender: isEcho ? 'page_agent' : 'buyer',
            text,
            timestamp: sentAt,
            ...(isEcho ? { deliveryStatus: 'sent' as const } : {}),
          });

          if (!isEcho) {
            const intent = detectMessengerIntent(text, thread.buyerName);
            if (intent) thread.detectedIntent = intent;
            thread.unreadCount = (thread.unreadCount || 0) + 1;
            eventDetails = `Business Messenger DM from ${thread.buyerName}: "${text}"${intent ? ` [Auto-Triage: ${intent.type.toUpperCase()}]` : ''}`;
          } else {
            eventDetails = `Page reply to ${thread.buyerName} (sent outside the portal): "${text}"`;
          }
          thread.windowExpiresAt = windowFromLastBuyerMessage(thread.messages, thread.windowExpiresAt);
          sortMessengerThreads();
        }
      }

      // 2) Handle Live Video & Feed Comment Changes (entry.changes)
      if (entry.changes && Array.isArray(entry.changes)) {
        for (const change of entry.changes) {
          if (change.field === 'live_videos') {
            const status = change.value?.status; // 'LIVE', 'LIVE_STOPPED', 'VOD', 'PROCESSING'
            const videoId = change.value?.id || entry.id;
            eventType = 'live_videos';
            eventDetails = `Live video ${videoId} status changed to ${status}`;

            const targetLive =
              status === 'LIVE' && videoId
                ? liveForBroadcast(String(videoId))
                : lives.find((l) => l.fbVideoId === videoId || l.status === 'live') || lives[0];

            if (status === 'LIVE') {
              targetLive.status = 'live';
              targetLive.metaWebhookStatus = 'active';
              targetLive.fbVideoId = videoId;
              graphSyncStats.broadcastStatus = 'LIVE';
              graphSyncStats.onAirVideoId = videoId;
            } else if (status === 'LIVE_STOPPED' || status === 'VOD' || status === 'ENDED') {
              targetLive.status = 'ended';
              targetLive.endedAt = nowIso;
              targetLive.metaWebhookStatus = 'active';
              graphSyncStats.broadcastStatus = status;

              // Trigger full inventory sync + automatic reconciliation immediately upon live ending
              targetLive.autoReconcileTriggeredAt = nowIso;
              performInventorySync(targetLive.id);
              latestSummary = runAutomaticLiveReconciliation(
                targetLive,
                orders.filter((o) => o.liveId === targetLive.id),
                amendments,
                inventory.filter((i) => i.liveId === targetLive.id),
                phpPerThbRate,
                null,
                'automatic_live_end'
              );

              targetLive.reconciledAt = latestSummary.generatedAt;
              targetLive.reconciliationStatus = 'awaiting_owner_review';
              eventDetails += ' -> Auto-reconciliation & rack sync triggered; awaiting owner review';
            }
          } else if (change.field === 'feed' || change.field === 'comments') {
            eventType = 'comment_claim';
            const comment = change.value;
            const commentId = comment?.comment_id || comment?.id || `c_${Date.now()}`;
            const message = comment?.message || '';
            const sender = comment?.from?.name || 'Live Viewer';

            if (seenCommentIds.has(commentId)) {
              eventDetails = `Duplicate webhook delivery ignored (comment_id: ${commentId})`;
              continue;
            }
            seenCommentIds.add(commentId);

            eventDetails = `Comment claim: "${message}" by ${sender}`;

            const targetLive = lives.find((l) => l.status === 'live') || lives[0];
            const specs = parseClaimSpecsFromRaw(message);
            for (const [specIdx, spec] of specs.entries()) {
              if (spec.isChatter || spec.isAmendmentNote) continue;
              const orderId = `ord_wh_${String(commentId).replace(/[^\w-]/g, '_')}_${specIdx + 1}`;
              if (orders.some((o) => o.id === orderId)) continue;
              const existingSameBuyerSpec = orders.some(
                (o) =>
                  o.liveId === targetLive.id &&
                  o.buyerName.toLowerCase() === sender.toLowerCase() &&
                  o.itemCode === spec.itemCode &&
                  o.size === (spec.size || 'FREE SIZE (PLUS)') &&
                  o.colour === spec.colour
              );

              const newOrder: BuyerOrder = {
                // Same comment → same order id, so a webhook retried by Meta on another copy cannot duplicate it
                id: orderId,
                liveId: targetLive.id,
                buyerName: cleanBuyerName(sender),
                channel: 'live_chat',
                sourceCommentId: commentId,
                itemCode: spec.itemCode,
                itemName: spec.itemName,
                size: spec.size || 'FREE SIZE (PLUS)',
                colour: spec.colour || 'ASSORTED',
                quantity: spec.quantity || 1,
                statedUnitPricePhp: spec.price || 550,
                orderedAt: nowIso,
                status: spec.itemCode === 'PENDING SPEC' ? 'pending' : 'confirmed',
                invoiced: false,
                lane: 'live',
                version: 1,
                hostVerificationNote: spec.reviewNotes || `Captured from live: "${message}"`,
                reviewNotes: spec.reviewNotes || `Live comment: "${message}"`,
                overrideHistory: [],
                isDuplicateFlagged: existingSameBuyerSpec,
                duplicateReason: existingSameBuyerSpec
                  ? 'Repeat comment for same item/size detected during live stream'
                  : undefined,
              };
              orders.push(newOrder);
              targetLive.totalMined = (targetLive.totalMined || 0) + 1;
            }
            targetLive.totalComments = (targetLive.totalComments || 0) + 1;
            performInventorySync(targetLive.id);
          }
        }
      }
    }
  }

  const logEntry = {
    id: eventId,
    timestamp: nowIso,
    type: eventType,
    source: eventType === 'pages_messaging' ? 'Business Messenger' : 'Meta Webhook',
    details: eventDetails,
    payload: body,
  };

  webhookEventsLog.unshift(logEntry);
  if (webhookEventsLog.length > 50) {
    webhookEventsLog.pop();
  }

  saveRuntimeState();
  res.status(200).json({ success: true, eventId, eventDetails, logEntry, messengerThreads });
});

// 8d. Periodic Facebook Graph API v22.0 Sync (POST /api/facebook/live-sync)
app.post('/api/facebook/live-sync', async (req, res) => {
  const { liveId, forceStatus, fbVideoId, fbPageId, accessToken } = req.body || {};
  let targetLive = lives.find((l) => l.id === (liveId || activeLive.id)) || lives[0];
  const nowIso = new Date().toISOString();

  if (fbVideoId && String(fbVideoId).trim()) {
    const cleanVid = String(fbVideoId).trim().replace(/.*\/videos\/(\d+).*/, '$1');
    targetLive.fbVideoId = cleanVid;
    graphSyncStats.onAirVideoId = cleanVid;
  }

  if ((accessToken || fbPageId) && !canManageMetaToken(req)) {
    return res.status(403).json({ error: 'Only an owner can change the Facebook token or Page ID.' });
  }
  if (accessToken && String(accessToken).trim()) {
    setMetaCredentials(String(accessToken).trim(), fbPageId ? String(fbPageId).trim() : undefined);
  } else if (fbPageId && String(fbPageId).trim()) {
    setMetaCredentials(undefined, String(fbPageId).trim());
  }

  const fbToken = getMetaPageAccessToken();
  const pageId = getMetaPageId();

  graphSyncStats.lastSyncAt = nowIso;
  graphSyncStats.syncCount += 1;
  targetLive.lastGraphSyncAt = nowIso;
  targetLive.graphSyncCount = (targetLive.graphSyncCount || 0) + 1;

  let backfilledComments = 0;
  let totalCommentsFetched = 0;
  let syncedThreadsCount = 0;
  let effectiveStatus = forceStatus || graphSyncStats.broadcastStatus;
  let graphError: string | null = null;

  if (fbToken) {
    graphSyncStats.mode = 'live_graph_api';
    try {
      // A new broadcast that is on air right now gets its own live session
      if (!fbVideoId) {
        const onAirRes = await fetch(
          `https://graph.facebook.com/v22.0/${encodeURIComponent(pageId)}/live_videos?broadcast_status=["LIVE"]&fields=id,status,video{id}&limit=1&access_token=${encodeURIComponent(fbToken)}`,
          { signal: AbortSignal.timeout(10000) }
        ).catch(() => null);
        if (onAirRes?.ok) {
          const onAir: any = await onAirRes.json().catch(() => ({}));
          const live = (onAir.data || []).find((v: any) => v.status === 'LIVE');
          const onAirId = live ? String(live.video?.id || live.id) : '';
          if (onAirId && onAirId !== targetLive.fbVideoId) {
            targetLive = liveForBroadcast(onAirId);
            graphSyncStats.onAirVideoId = onAirId;
          }
        }
      }

      let videoId = targetLive.fbVideoId;

      if (!videoId || videoId === 'Not connected yet') {
        const listUrl = `https://graph.facebook.com/v22.0/${encodeURIComponent(
          pageId
        )}/live_videos?fields=id,title,description,status,creation_time,permalink_url,video{id}&limit=5&access_token=${encodeURIComponent(
          fbToken
        )}`;
        const listRes = await fetch(listUrl);
        if (listRes.ok) {
          const listData: any = await listRes.json();
          const latestVid = (listData.data || []).find((v: any) => v.status === 'LIVE') || listData.data?.[0];
          const resolvedVid = latestVid?.video?.id || latestVid?.id;
          if (resolvedVid) {
            videoId = String(resolvedVid);
            targetLive.fbVideoId = videoId;
            graphSyncStats.onAirVideoId = videoId;
            const titleText = latestVid.title || (typeof latestVid.description === 'string' ? latestVid.description.split('\n')[0].trim() : '');
            if (titleText) targetLive.title = titleText;
            if (latestVid.status) effectiveStatus = latestVid.status;
            if (latestVid.permalink_url) targetLive.videoUrl = `https://www.facebook.com${latestVid.permalink_url}`;
          }
        }
        // Fallback to /{pageId}/videos (does not require Meta Live Video API review)
        if (!videoId || videoId === 'Not connected yet') {
          const vidsUrl = `https://graph.facebook.com/v22.0/${encodeURIComponent(
            pageId
          )}/videos?fields=id,live_status,title,description,created_time,permalink_url&limit=10&access_token=${encodeURIComponent(
            fbToken
          )}`;
          const vidsRes = await fetch(vidsUrl);
          if (vidsRes.ok) {
            const vidsData: any = await vidsRes.json();
            const liveVids = (vidsData.data || []).filter((v: any) => typeof v.live_status === 'string' && v.live_status.length > 0);
            const chosen = liveVids.find((v: any) => v.live_status === 'LIVE') || liveVids[0] || vidsData.data?.[0];
            if (chosen?.id) {
              videoId = String(chosen.id);
              targetLive.fbVideoId = videoId;
              graphSyncStats.onAirVideoId = videoId;
              const titleText = chosen.title || (typeof chosen.description === 'string' ? chosen.description.split('\n')[0].trim() : '');
              if (titleText) targetLive.title = titleText;
              if (chosen.live_status) effectiveStatus = chosen.live_status;
              if (chosen.permalink_url) targetLive.videoUrl = `https://www.facebook.com${chosen.permalink_url}`;
              graphError = null;
            }
          } else if (!listRes.ok) {
            const errJson: any = await vidsRes.json().catch(() => ({}));
            graphError = errJson?.error?.message || `Graph API HTTP ${vidsRes.status}`;
          }
        }
      }

      if (videoId && videoId !== 'Not connected yet') {
        const graphUrl = `https://graph.facebook.com/v22.0/${encodeURIComponent(
          videoId
        )}?fields=id,title,description,live_status&access_token=${encodeURIComponent(
          fbToken
        )}`;
        const graphRes = await fetch(graphUrl);
        if (graphRes.ok) {
          const graphData: any = await graphRes.json();
          if (graphData.live_status) effectiveStatus = graphData.live_status;
          const titleText = graphData.title || (typeof graphData.description === 'string' ? graphData.description.split('\n')[0].trim() : '');
          if (titleText) targetLive.title = titleText;
        }
        const streamCommentsUrl = `https://graph.facebook.com/v22.0/${encodeURIComponent(
          videoId
        )}/comments?fields=id,message,from{id,name},created_time&filter=stream&order=reverse_chronological&limit=500&access_token=${encodeURIComponent(
          fbToken
        )}`;
        let commentsRes = await fetch(streamCommentsUrl);
        let commentsJson: any = commentsRes.ok ? await commentsRes.json().catch(() => ({})) : {};
        if (!Array.isArray(commentsJson.data) || commentsJson.data.length === 0) {
          const plainCommentsUrl = `https://graph.facebook.com/v22.0/${encodeURIComponent(
            videoId
          )}/comments?fields=id,message,from{id,name},created_time&limit=500&access_token=${encodeURIComponent(
            fbToken
          )}`;
          commentsRes = await fetch(plainCommentsUrl);
          commentsJson = commentsRes.ok ? await commentsRes.json().catch(() => ({})) : {};
        }
        if (commentsRes.ok) {
          const commentsList = Array.isArray(commentsJson.data) ? commentsJson.data.slice().reverse() : [];
          totalCommentsFetched = commentsList.length;
          targetLive.totalComments = Math.max(targetLive.totalComments || 0, totalCommentsFetched);

          for (const c of commentsList) {
            if (c.id && !seenCommentIds.has(c.id)) {
              seenCommentIds.add(c.id);
            }
          }
          // Preserve authentic live orders - do not create anonymous orders from public video comments
          targetLive.totalMined = orders.filter((o) => o.liveId === targetLive.id).length;
        } else {
          const errJson: any = await commentsRes.json().catch(() => ({}));
          graphError = errJson?.error?.message || `Graph API HTTP ${commentsRes.status}`;
        }
      }

      const convUrl = `https://graph.facebook.com/v22.0/${encodeURIComponent(
        pageId
      )}/conversations?fields=id,updated_time,participants,messages.limit(10){id,message,from,created_time}&limit=25&access_token=${encodeURIComponent(
        fbToken
      )}`;
      const convRes = await fetch(convUrl);
      if (convRes.ok) {
        const convData: any = await convRes.json();
        for (const conv of convData.data || []) {
          const msgs = (conv.messages?.data || []).slice().reverse();
          if (!msgs.length) continue;
          const participants = conv.participants?.data || [];
          const canonicalPageId = getMetaPageId();
          const buyerParticipant = participants.find(
            (p: any) => String(p.id) !== String(canonicalPageId) && String(p.id) !== '100064426114382' && !/bangkok plus size ootd/i.test(p.name || '')
          ) || participants[0];
          const buyerName = buyerParticipant?.name || 'Messenger Buyer';
          const psid = buyerParticipant?.id || conv.id;
          const lastBuyerMsg = [...msgs].reverse().find((m: any) => m.from?.name === buyerName) || msgs[msgs.length - 1];
          const intent = detectMessengerIntent(lastBuyerMsg?.message || '', buyerName);
          const linkedOrder = orders.find((o) => o.buyerName.toLowerCase() === buyerName.toLowerCase());

          const mappedMessages = msgs.map((m: any) => ({
            id: m.id,
            mid: m.id,
            sender: (m.from?.name === buyerName ? 'buyer' : 'page_agent') as 'buyer' | 'page_agent',
            text: m.message || '',
            timestamp: m.created_time || nowIso,
          }));

          const existing = messengerThreads.find((t) => t.psid === psid || t.id === conv.id);
          if (existing) {
            // Merge: keep older messages and delivery statuses the portal already has
            const known = new Set(existing.messages.map((m) => m.mid || m.id));
            const fresh = mappedMessages.filter((m: any) => !known.has(m.mid) && !known.has(m.id));
            existing.messages.push(...fresh);
            existing.messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            existing.unreadCount = (existing.unreadCount || 0) + fresh.filter((m: any) => m.sender === 'buyer').length;
            if (buyerName && buyerName !== 'Messenger Buyer') existing.buyerName = buyerName;
            existing.psid = psid;
            if (intent) existing.detectedIntent = intent;
            if (!existing.linkedOrderId && linkedOrder) existing.linkedOrderId = linkedOrder.id;
            existing.windowExpiresAt = windowFromLastBuyerMessage(existing.messages, existing.windowExpiresAt);
          } else {
            messengerThreads.push({
              id: conv.id,
              psid,
              buyerName,
              buyerHandle: `fb.com/${psid}`,
              windowExpiresAt: windowFromLastBuyerMessage(mappedMessages),
              unreadCount: 0,
              linkedOrderId: linkedOrder?.id,
              detectedIntent: intent,
              messages: mappedMessages,
            });
          }
          syncedThreadsCount++;
        }
      }
    } catch (err: any) {
      graphError = err?.message || 'Network error contacting graph.facebook.com';
    }
  } else if (process.env.BRIDGE_SYNC_URL) {
    // Optional external bridge (only when BRIDGE_SYNC_URL is set; the portal no longer depends on the old main system)
    try {
      const bridgeUrl = process.env.BRIDGE_SYNC_URL;
      const bridgeRes = await fetch(bridgeUrl, { headers: { Accept: 'application/json' } });
      if (bridgeRes.ok) {
        const bData: any = await bridgeRes.json();
        graphSyncStats.mode = 'live_graph_api';
        const recentVid = (bData.recentBroadcasts || [])[0] || (bData.bridge?.lives || [])[0];
        if (recentVid) {
          const vidId = recentVid.videoId || recentVid.fb_video_id;
          if (vidId) {
            targetLive.fbVideoId = String(vidId);
            graphSyncStats.onAirVideoId = String(vidId);
            targetLive.videoUrl = `https://www.facebook.com/watch/?v=${vidId}`;
          }
          if (recentVid.title) targetLive.title = recentVid.title;
          const st = recentVid.status || (bData.onAir ? 'LIVE' : 'VOD');
          effectiveStatus = st === 'live' ? 'LIVE' : st === 'ended' ? 'VOD' : st;
        }

        const hasAuthenticOrders = orders.some((o) => o.id.startsWith('ord_live_'));
        if (!hasAuthenticOrders) {
          for (const reqRow of bData.bridge?.orderRequests || []) {
            const cid = `bridge_req_${reqRow.id}`;
            if (!seenCommentIds.has(cid)) {
              seenCommentIds.add(cid);
              const raw = reqRow.raw_message || reqRow.item_description || reqRow.item_code || '';
              const specs = parseClaimSpecsFromRaw(raw, reqRow.item_code || 'LIVE');

              for (let sIdx = 0; sIdx < specs.length; sIdx++) {
                const spec = specs[sIdx];
                if (spec.isChatter) continue;

                orders.push({
                  id: specs.length > 1 ? `ord_br_${reqRow.id}_${sIdx + 1}` : `ord_br_${reqRow.id}`,
                  liveId: targetLive.id,
                  buyerName: cleanBuyerName(reqRow.buyer_name),
                  channel: 'live_chat',
                  sourceCommentId: cid,
                  itemCode: spec.itemCode,
                  itemName: spec.itemName,
                  size: spec.size,
                  colour: spec.colour,
                  quantity: spec.quantity || 1,
                  statedUnitPricePhp: Number(reqRow.unit_price_php) || spec.price || 550,
                  orderedAt: reqRow.created_at || nowIso,
                  status: spec.itemCode === 'PENDING SPEC' ? 'pending' : (reqRow.status === 'confirmed' ? 'confirmed' : 'pending'),
                  invoiced: false,
                  lane: reqRow.lane === 'preorder' || reqRow.lane === 'pre_order' ? 'pre_order' : 'live',
                  version: 1,
                  hostVerificationNote: spec.reviewNotes,
                  reviewNotes: spec.reviewNotes,
                  overrideHistory: [],
                });
                backfilledComments++;
              }
            }
          }
          for (const clRow of bData.bridge?.claims || []) {
            const cid = `bridge_cl_${clRow.id}`;
            if (!seenCommentIds.has(cid)) {
              seenCommentIds.add(cid);
              const raw = clRow.raw || clRow.raw_text || '';
              const specs = parseClaimSpecsFromRaw(raw, clRow.code || 'LIVE');

              for (let sIdx = 0; sIdx < specs.length; sIdx++) {
                const spec = specs[sIdx];
                if (spec.isChatter) continue;

                orders.push({
                  id: specs.length > 1 ? `ord_cl_${clRow.id}_${sIdx + 1}` : `ord_cl_${clRow.id}`,
                  liveId: targetLive.id,
                  buyerName: cleanBuyerName(clRow.customer_name || clRow.customer_id),
                  channel: 'live_chat',
                  sourceCommentId: clRow.comment_id || cid,
                  itemCode: spec.itemCode,
                  itemName: spec.itemName,
                  size: spec.size,
                  colour: spec.colour,
                  quantity: spec.quantity || 1,
                  statedUnitPricePhp: Number(clRow.unit_price_php || clRow.price) || spec.price || 550,
                  orderedAt: clRow.created_at || clRow.at || nowIso,
                  status: spec.itemCode === 'PENDING SPEC' ? 'pending' : (clRow.status === 'confirmed' ? 'confirmed' : 'pending'),
                  invoiced: false,
                  lane: 'live',
                  version: 1,
                  hostVerificationNote: spec.reviewNotes,
                  reviewNotes: spec.reviewNotes,
                  overrideHistory: [],
                });
                backfilledComments++;
              }
            }
          }
        }

        totalCommentsFetched = Math.max(bData.imported?.read || 0, orders.filter((o) => o.liveId === targetLive.id).length);
        targetLive.totalComments = Math.max(targetLive.totalComments || 0, totalCommentsFetched);
        targetLive.totalMined = orders.filter((o) => o.liveId === targetLive.id).length;

        for (const conv of bData.bridge?.conversations || []) {
          const existingIdx = messengerThreads.findIndex((t) => t.id === conv.id || t.psid === conv.psid);
          const mappedMessages = (conv.messages || []).map((m: any) => ({
            id: m.id,
            mid: m.id,
            sender: (m.fromPage ? 'page_agent' : 'buyer') as 'buyer' | 'page_agent',
            text: m.message || '',
            timestamp: m.createdAt || nowIso,
          }));
          const lastBuyerMsg = [...mappedMessages].reverse().find((m: any) => m.sender === 'buyer');
          const intent = detectMessengerIntent(lastBuyerMsg?.text || conv.snippet || '', conv.buyerName || 'Buyer');
          const threadObj: MessengerThread = {
            id: conv.id,
            psid: conv.psid,
            buyerName: conv.buyerName || 'Messenger Buyer',
            buyerHandle: `fb.com/${conv.psid}`,
            windowExpiresAt: new Date(new Date(conv.updatedAt || nowIso).getTime() + 24 * 3600 * 1000).toISOString(),
            unreadCount: conv.unreadCount || 0,
            detectedIntent: intent,
            messages: mappedMessages,
          };
          if (existingIdx >= 0) messengerThreads[existingIdx] = threadObj;
          else messengerThreads.push(threadObj);
          syncedThreadsCount++;
        }
      }
    } catch (bridgeErr: any) {
      graphError = bridgeErr?.message || null;
    }
  }

  if (effectiveStatus) {
    graphSyncStats.broadcastStatus = effectiveStatus;
    if (effectiveStatus === 'LIVE_STOPPED' || effectiveStatus === 'VOD' || effectiveStatus === 'ENDED') {
      targetLive.status = 'ended';
      targetLive.endedAt = targetLive.endedAt || nowIso;
      targetLive.autoReconcileTriggeredAt = nowIso;

      performInventorySync(targetLive.id);
      latestSummary = runAutomaticLiveReconciliation(
        targetLive,
        orders.filter((o) => o.liveId === targetLive.id),
        amendments,
        inventory.filter((i) => i.liveId === targetLive.id),
        phpPerThbRate,
        null,
        'automatic_live_end'
      );
      targetLive.reconciledAt = latestSummary.generatedAt;
      targetLive.reconciliationStatus = 'awaiting_owner_review';
    } else {
      if (effectiveStatus === 'LIVE') {
        targetLive.status = 'live';
        targetLive.endedAt = null;
      }
      performInventorySync(targetLive.id);
    }
  }

  graphSyncStats.lastStatusCheck = graphError
    ? `Graph API Error: ${graphError}`
    : fbToken || graphSyncStats.mode === 'live_graph_api'
    ? `Synced Graph API v22.0 at ${new Date().toLocaleTimeString()} (${totalCommentsFetched} comments scanned, +${backfilledComments} claims mined, ${syncedThreadsCount} Messenger threads)`
    : `Checked at ${new Date().toLocaleTimeString()} — Enter FB Live Video ID & Page Access Token to pull morning live data`;

  saveRuntimeState();
  res.json({
    success: !graphError,
    graphError,
    graphSyncStats,
    targetLive,
    orders,
    inventory,
    messengerThreads,
    latestSummary,
    backfilledComments,
    totalCommentsFetched,
    syncedThreadsCount,
  });
});

// 8d-0. Bulk Import Raw Live Comments / Transcript Lines from Morning Live (POST /api/orders/bulk-import)
app.post('/api/orders/bulk-import', (req, res) => {
  const { liveId, rawLines } = req.body || {};
  if (!rawLines || typeof rawLines !== 'string') {
    return res.status(400).json({ error: 'rawLines string is required' });
  }

  const targetLive = lives.find((l) => l.id === (liveId || activeLive.id)) || lives[0];
  const lines = rawLines
    .split(/\r?\n/)
    .map((l: string) => l.trim())
    .filter(Boolean);

  let importedCount = 0;
  const nowIso = new Date().toISOString();

  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    const dashIdx = line.indexOf(' - ');
    let buyerName = 'Live Buyer';
    let commentText = line;

    if (colonIdx > 0 && colonIdx < 40) {
      buyerName = line.slice(0, colonIdx).trim();
      commentText = line.slice(colonIdx + 1).trim();
    } else if (dashIdx > 0 && dashIdx < 40) {
      buyerName = line.slice(0, dashIdx).trim();
      commentText = line.slice(dashIdx + 3).trim();
    }

    const specs = parseClaimSpecsFromRaw(commentText);
    for (const spec of specs) {
      if (spec.isChatter || spec.isAmendmentNote) continue;
      orders.push({
        id: `ord_imp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        liveId: targetLive.id,
        buyerName: cleanBuyerName(buyerName),
        channel: 'live_chat',
        itemCode: spec.itemCode,
        itemName: spec.itemName,
        size: spec.size || 'FREE SIZE (PLUS)',
        colour: spec.colour || 'ASSORTED',
        quantity: spec.quantity || 1,
        statedUnitPricePhp: spec.price || 550,
        orderedAt: nowIso,
        status: spec.itemCode === 'PENDING SPEC' ? 'pending' : 'confirmed',
        invoiced: false,
        lane: 'live',
        version: 1,
        hostVerificationNote: spec.reviewNotes || `Captured from live comment: "${commentText}"`,
        reviewNotes: spec.reviewNotes || `Live comment: "${commentText}"`,
        overrideHistory: [],
      });
      importedCount++;
    }
  }

  targetLive.totalComments = (targetLive.totalComments || 0) + lines.length;
  targetLive.totalMined = orders.filter((o) => o.liveId === targetLive.id).length;

  const syncResult = performInventorySync(targetLive.id);
  saveRuntimeState();

  res.json({
    success: true,
    importedCount,
    totalScanned: lines.length,
    orders,
    targetLive,
    syncResult,
    summary: latestSummary,
  });
});

/* ==================== BUSINESS MESSENGER INBOX & AUTOMATION ==================== */

// 8d-1. Get Business Messenger Threads
app.get('/api/meta/messenger/threads', (_req, res) => {
  res.json({ success: true, messengerThreads });
});

// 8d-2. Send Reply or Reconciled Invoice via Business Messenger (POST /api/meta/messenger/reply)
app.post('/api/meta/messenger/reply', async (req, res) => {
  const { threadId, text, psid: reqPsid, buyerName: reqBuyerName, clientMessageId } = req.body || {};
  if (!text || !String(text).trim() || (!threadId && !reqPsid)) {
    return res.status(400).json({ error: 'threadId or psid, and text are required' });
  }

  let thread = messengerThreads.find(
    (t) => (threadId && t.id === threadId) || (reqPsid && t.psid === reqPsid)
  );
  if (!thread) {
    // Only possible if the conversation was never saved (e.g. the database was configured mid-way)
    thread = {
      id: threadId || `th_${Date.now()}`,
      psid: String(reqPsid || ''),
      buyerName: reqBuyerName || 'Messenger Buyer',
      buyerHandle: `fb.com/${reqPsid || 'buyer'}`,
      windowExpiresAt: new Date(0).toISOString(),
      unreadCount: 0,
      messages: [],
    };
    messengerThreads.unshift(thread);
  }

  // The token comes only from the server (Vercel setting or the owner's saved token), never from the browser
  const delivery = await sendMessengerText(thread.psid, String(text));

  // Reuse the browser's id so its instant "sending…" bubble is replaced, not duplicated
  const safeClientId = typeof clientMessageId === 'string' && /^[\w-]{6,80}$/.test(clientMessageId) ? clientMessageId : '';
  const newMsg = {
    id: safeClientId || `m_reply_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    sender: 'page_agent' as const,
    text: String(text).trim(),
    timestamp: new Date().toISOString(),
    deliveryStatus: delivery.status,
    deliveryDetail: delivery.detail,
    ...(delivery.messageId ? { mid: delivery.messageId } : {}),
  };
  if (delivery.messageId) seenMessageIds.add(delivery.messageId); // the echo webhook for this message is then skipped

  const existingIdx = thread.messages.findIndex((m) => m.id === newMsg.id);
  if (existingIdx >= 0) thread.messages[existingIdx] = newMsg;
  else thread.messages.push(newMsg);
  thread.unreadCount = 0;
  sortMessengerThreads();
  saveRuntimeState();

  const metaApiStatus = delivery.status === 'sent' ? 'sent_to_facebook' : delivery.status === 'failed' ? 'error' : 'local_only';
  res.json({
    success: delivery.status !== 'failed',
    thread,
    message: newMsg,
    metaApiStatus,
    metaApiDetail: delivery.detail,
  });
});

// 8d-3. Simulate Incoming Buyer Business Messenger DM (POST /api/meta/messenger/simulate-dm)
app.post('/api/meta/messenger/simulate-dm', (req, res) => {
  const { buyerName, text } = req.body;
  if (!buyerName || !text) {
    return res.status(400).json({ error: 'buyerName and text are required' });
  }

  const nowIso = new Date().toISOString();
  const mid = `mid_sim_${Date.now()}`;
  const intent = detectMessengerIntent(text, buyerName);
  const linkedOrder = orders.find((o) => o.buyerName.toLowerCase() === buyerName.toLowerCase());

  let thread = messengerThreads.find((t) => t.buyerName.toLowerCase() === buyerName.toLowerCase());
  if (!thread) {
    thread = {
      id: `msg_th_${Date.now()}`,
      psid: `psid_${Math.floor(10000000 + Math.random() * 90000000)}`,
      buyerName,
      buyerHandle: `fb.com/${buyerName.toLowerCase().replace(/\s+/g, '.')}`,
      windowExpiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      unreadCount: 1,
      linkedOrderId: linkedOrder?.id,
      detectedIntent: intent,
      messages: [],
    };
    messengerThreads.unshift(thread);
  } else {
    thread.unreadCount = (thread.unreadCount || 0) + 1;
    thread.windowExpiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    if (intent) thread.detectedIntent = intent;
  }

  thread.messages.push({
    id: mid,
    mid,
    sender: 'buyer',
    text,
    timestamp: nowIso,
  });

  webhookEventsLog.unshift({
    id: `wh_msg_${Date.now()}`,
    timestamp: nowIso,
    type: 'pages_messaging',
    source: 'Business Messenger',
    details: `Buyer DM from ${buyerName}: "${text}"${intent ? ` -> Auto-detected ${intent.type}` : ''}`,
    payload: { object: 'page', entry: [{ messaging: [{ sender: { name: buyerName }, message: { mid, text } }] }] },
  });

  saveRuntimeState();
  res.json({ success: true, thread, messengerThreads, webhookEventsLog });
});

/* ==================== OWNER REVIEW APPROVAL & FULL OVERRIDE ==================== */

// 8e. Owner / Admin Approval Gate for Reconciliation (POST /api/owner/review-approval)
app.post('/api/owner/review-approval', (req, res) => {
  const { liveId, action, notes } = req.body;
  const signedIn = portalUserOf(req);
  const role = portalAuth.enabled ? signedIn?.role : req.body.role;
  const reviewedBy = portalAuth.enabled ? signedIn?.name : req.body.reviewedBy;

  // Enforce Owner or Admin role verification
  if (role !== 'owner' && role !== 'admin') {
    return res.status(403).json({
      error: 'Unauthorized: Only the Shop Owner or Admin has authority to approve reconciliation and release invoices.',
    });
  }

  const targetLive = lives.find((l) => l.id === (liveId || activeLive.id)) || lives[0];

  if (action === 'request_amendment') {
    targetLive.reconciliationStatus = 'needs_review';
    targetLive.ownerReviewNotes = notes || 'Owner requested physical store recount and item amendments before sign-off.';
  } else {
    // Approved
    targetLive.reconciliationStatus = 'reconciled';
    targetLive.ownerApprovedAt = new Date().toISOString();
    targetLive.ownerApprovedBy = reviewedBy || `${role.toUpperCase()} (Authorized)`;
    targetLive.ownerReviewNotes = notes || 'Reconciliation approved by Owner/Admin. Ready for invoice distribution.';
  }

  res.json({
    success: true,
    targetLive,
    message: action === 'request_amendment' ? 'Amendment requested.' : 'Reconciliation approved by Owner/Admin.',
  });
});

// 8f. Full Override Power for Owner or Admin (POST /api/owner/order-override)
app.post('/api/owner/order-override', (req, res) => {
  const { orderId, isPreOrder, reason, overrides } = req.body;
  const signedIn = portalUserOf(req);
  const role = portalAuth.enabled ? signedIn?.role : req.body.role;
  const author = portalAuth.enabled ? signedIn?.name : req.body.author;

  // Enforce Owner or Admin role check
  if (role !== 'owner' && role !== 'admin') {
    return res.status(403).json({
      error: 'Unauthorized: Full order override power is strictly restricted to Owner or Admin.',
    });
  }

  if (!reason || !reason.trim()) {
    return res.status(400).json({
      error: 'Override reason is mandatory for operational audit compliance.',
    });
  }

  const nowIso = new Date().toISOString();

  // If overriding a Pre-Order in the separate lane
  if (isPreOrder) {
    const preOrder = preOrders.find((p) => p.id === orderId);
    if (!preOrder) {
      return res.status(404).json({ error: 'Pre-order not found' });
    }

    const beforeState: Partial<BuyerOrder> = {
      itemCode: preOrder.itemCode,
      itemName: preOrder.itemName,
      size: preOrder.size,
      colour: preOrder.colour,
      quantity: preOrder.quantity,
      statedUnitPricePhp: preOrder.statedUnitPricePhp,
      status: preOrder.status as any,
    };
    const currentVersion = (preOrder.version || 1) + 1;

    if (overrides.size) preOrder.size = overrides.size.toUpperCase();
    if (overrides.colour) preOrder.colour = overrides.colour.toUpperCase();
    if (overrides.quantity !== undefined) preOrder.quantity = Number(overrides.quantity);
    if (overrides.statedUnitPricePhp !== undefined) preOrder.statedUnitPricePhp = Number(overrides.statedUnitPricePhp);
    if (overrides.status) preOrder.status = overrides.status;
    if (overrides.notes !== undefined) preOrder.notes = overrides.notes;
    if (overrides.itemCode) preOrder.itemCode = overrides.itemCode.toUpperCase();
    if (overrides.itemName) preOrder.itemName = overrides.itemName;

    preOrder.version = currentVersion;
    if (!preOrder.overrideHistory) preOrder.overrideHistory = [];

    const historyItem: OrderOverrideHistoryItem = {
      version: currentVersion,
      by: author || `${role.toUpperCase()} (Authorized)`,
      at: nowIso,
      reason: reason.trim(),
      before: beforeState,
      after: {
        itemCode: preOrder.itemCode,
        itemName: preOrder.itemName,
        size: preOrder.size,
        colour: preOrder.colour,
        quantity: preOrder.quantity,
        statedUnitPricePhp: preOrder.statedUnitPricePhp,
        status: preOrder.status as any,
      },
    };
    preOrder.overrideHistory.push(historyItem);

    return res.json({ success: true, order: preOrder, historyItem });
  }

  // Live order override
  const order = orders.find((o) => o.id === orderId);
  if (!order) {
    return res.status(404).json({ error: 'Live order not found' });
  }

  const beforeState: Partial<BuyerOrder> = {
    itemCode: order.itemCode,
    itemName: order.itemName,
    size: order.size,
    colour: order.colour,
    quantity: order.quantity,
    statedUnitPricePhp: order.statedUnitPricePhp,
    status: order.status,
    reviewNotes: order.reviewNotes,
    channel: order.channel,
  };
  const currentVersion = (order.version || 1) + 1;

  if (overrides.size) order.size = overrides.size.toUpperCase();
  if (overrides.colour) order.colour = overrides.colour.toUpperCase();
  if (overrides.quantity !== undefined) order.quantity = Number(overrides.quantity);
  if (overrides.statedUnitPricePhp !== undefined) order.statedUnitPricePhp = Number(overrides.statedUnitPricePhp);
  if (overrides.status) order.status = overrides.status;
  if (overrides.reviewNotes !== undefined) order.reviewNotes = overrides.reviewNotes;
  if (overrides.itemCode) order.itemCode = overrides.itemCode.toUpperCase();
  if (overrides.itemName) order.itemName = overrides.itemName;
  if (overrides.channel) order.channel = overrides.channel;

  order.version = currentVersion;
  order.reviewedBy = author || `${role.toUpperCase()} (Authorized)`;
  order.reviewedAt = nowIso;

  if (!order.overrideHistory) order.overrideHistory = [];
  const historyItem: OrderOverrideHistoryItem = {
    version: currentVersion,
    by: author || `${role.toUpperCase()} (Authorized)`,
    at: nowIso,
    reason: reason.trim(),
    before: beforeState,
    after: {
      itemCode: order.itemCode,
      itemName: order.itemName,
      size: order.size,
      colour: order.colour,
      quantity: order.quantity,
      statedUnitPricePhp: order.statedUnitPricePhp,
      status: order.status,
      reviewNotes: order.reviewNotes,
      channel: order.channel,
    },
  };
  order.overrideHistory.push(historyItem);

  // Re-run summary
  const targetLive = lives.find((l) => l.id === order.liveId) || lives[0];
  latestSummary = runAutomaticLiveReconciliation(
    targetLive,
    orders.filter((o) => o.liveId === targetLive.id),
    amendments,
    inventory.filter((i) => i.liveId === targetLive.id),
    phpPerThbRate,
    null,
    'rolling_pass'
  );

  res.json({ success: true, order, historyItem, summary: latestSummary });
});

/* ==================== PRE-ORDERS SEPARATE LANE ==================== */

// 8g. Get all Pre-Orders
app.get('/api/pre-orders', (_req, res) => {
  res.json({ preOrders });
});

// 8h. Create Pre-Order (without altering live broadcast orders!)
app.post('/api/pre-orders/add', (req, res) => {
  const { buyerName, buyerContact, itemCode, itemName, size, colour, quantity, statedUnitPricePhp, channel, notes, targetStore } = req.body;
  if (!buyerName || !itemCode) {
    return res.status(400).json({ error: 'buyerName and itemCode are required' });
  }

  const newPreOrder: PreOrder = {
    id: `pre_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    buyerName: buyerName.trim(),
    buyerContact: buyerContact ? buyerContact.trim() : undefined,
    itemCode: itemCode.trim().toUpperCase(),
    itemName: (itemName || itemCode).trim().toUpperCase(),
    size: (size || '3XL').trim().toUpperCase(),
    colour: (colour || 'MAROON').trim().toUpperCase(),
    quantity: Number(quantity) || 1,
    statedUnitPricePhp: statedUnitPricePhp !== undefined && statedUnitPricePhp !== '' ? Number(statedUnitPricePhp) : 0,
    channel: channel || 'messenger',
    createdAt: new Date().toISOString(),
    status: 'pending',
    targetStore: targetStore || 'Pratunam Market Wholesale',
    notes: notes || 'Pre-order placed outside live broadcast. Dedicated pre-order lane.',
    version: 1,
    overrideHistory: [],
  };

  preOrders.unshift(newPreOrder);
  res.json({ success: true, preOrder: newPreOrder });
});

// 8i. Update Pre-Order status
app.post('/api/pre-orders/update-status', (req, res) => {
  const { preOrderId, status, notes } = req.body;
  const item = preOrders.find((p) => p.id === preOrderId);
  if (!item) {
    return res.status(404).json({ error: 'Pre-order not found' });
  }

  if (status) item.status = status;
  if (notes !== undefined) item.notes = notes;

  res.json({ success: true, preOrder: item });
});

// 9. Gemini Multi-Turn AI Chat (Roles: Reconciler, Auditor, Sourcing, Triage; Models: gemini-4-argon, gemini-3.8-flash, gemini-3.1-flash-lite)
app.post('/api/ai/chat', async (req, res) => {
  const { messages, context, model, role, customInstruction } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  try {
    const contextData = context || JSON.stringify({
      activeLive: lives[0],
      reconciliation: latestSummary ? {
        accuracy: latestSummary.accuracy,
        totalPurchasedCostThb: latestSummary.totalPurchasedCostThb,
        projectedRevenuePhp: latestSummary.projectedRevenuePhp,
        extraStockCostThb: latestSummary.extraStockCostThb,
        lostSalesPhp: latestSummary.projectedLostSalesPhp,
        affectedShortageBuyers: latestSummary.affectedShortageBuyers,
        readyToLeaveStore: latestSummary.checklist.readyToLeaveStore,
      } : null,
    });

    const result = await chatWithGemini(messages, {
      model,
      role,
      contextData,
      customInstruction,
    });

    res.json({
      success: true,
      reply: result.reply,
      usedModel: result.usedModel,
      role: result.role,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9b. Get available Chatbot Roles with system instructions
app.get('/api/ai/roles', (_req, res) => {
  res.json({ success: true, roles: CHATBOT_ROLES });
});

// 9c. Text-to-Speech playback via gemini-3.8-flash-lite-tts
app.post('/api/ai/speak', async (req, res) => {
  const { text, voice } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'text is required' });
  }

  try {
    const audioBase64 = await generateSpeechAudio(text, voice || 'Kore');
    res.json({ success: true, audio: audioBase64 });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 10. Gemini Video Analysis (Video Understanding for Live Selling Replay)
app.post('/api/ai/video-analysis', async (req, res) => {
  const { prompt, videoBase64, mimeType } = req.body;
  try {
    const analysis = await analyzeLiveVideoContent(
      prompt || 'Inspect this live selling segment, identify garment item codes, host verbal prices and confirmations.',
      videoBase64,
      mimeType
    );
    res.json({ success: true, analysis });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 11. Gemini Audio Transcription (Speech-to-Text for Host Calls)
app.post('/api/ai/transcribe', async (req, res) => {
  const { audioBase64, mimeType } = req.body;
  if (!audioBase64) {
    return res.status(400).json({ error: 'audioBase64 is required' });
  }

  try {
    const result = await transcribeHostSpeech(audioBase64, mimeType);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ==================== VITE MIDDLEWARE / STATIC SERVE ==================== */

async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, port: PORT, host: '0.0.0.0' },
      appType: 'spa',
    });
    app.use(vite.middlewares as any);
  } else {
    app.use(express.static(path.resolve(ROOT_DIR, 'dist')) as any);
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(ROOT_DIR, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT} (Express + WebSocket Live API)`);
  });
}

if (!process.env.VERCEL) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

export default app;
