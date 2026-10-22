import express from 'express';
import http from 'http';
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
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

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATE_FILE_PATH = process.env.VERCEL
  ? '/tmp/runtime-state.json'
  : path.resolve(__dirname, 'runtime-state.json');

const app = express();
const server = http.createServer(app);
const PORT = 3000;

app.use(express.json({ limit: '50mb' }) as any);
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
  lastStatusCheck: (process.env.FB_PAGE_ACCESS_TOKEN || process.env.META_PAGE_ACCESS_TOKEN)
    ? 'Live Graph API v22.0 Token Detected — Ready to sync morning broadcast'
    : 'Awaiting Facebook Live Video ID / Page Access Token or Meta Webhook events',
  mode: (process.env.FB_PAGE_ACCESS_TOKEN || process.env.META_PAGE_ACCESS_TOKEN) ? 'live_graph_api' : 'awaiting_credentials',
};

function saveRuntimeState() {
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
  try {
    if (fs.existsSync(STATE_FILE_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(STATE_FILE_PATH, 'utf8'));
      if (Array.isArray(parsed.lives) && parsed.lives.length) lives = parsed.lives;
      if (Array.isArray(parsed.inventory) && parsed.inventory.length) inventory = parsed.inventory;
      if (Array.isArray(parsed.orders) && parsed.orders.length) orders = parsed.orders;
      if (Array.isArray(parsed.amendments)) amendments = parsed.amendments;
      if (Array.isArray(parsed.preOrders)) preOrders = parsed.preOrders;
      if (Array.isArray(parsed.messengerThreads) && parsed.messengerThreads.length) {
        messengerThreads = parsed.messengerThreads;
      }
      if (typeof parsed.phpPerThbRate === 'number') phpPerThbRate = parsed.phpPerThbRate;
    }
  } catch (e) {
    console.warn('[State] Failed to load persisted state, using seed data.');
  }
}

loadRuntimeState();

// Run initial reconciliation on boot for active session
const activeLive = lives[0];

function performInventorySync(targetLiveId?: string): InventorySyncResult {
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
  performInventorySync(activeLive.id);
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
function parseLiveSellingClaim(rawComment: string): { isClaim: boolean; code: string; size: string; colour: string; quantity: number; price?: number } | null {
  if (!rawComment) return null;
  const text = rawComment.toUpperCase();
  const claimWords = ['MINE', 'STEAL', 'GRAB', 'GET', 'BUY', 'TAKE', 'CLAIM'];
  const hasClaimWord = claimWords.some((w) => text.includes(w));
  if (!hasClaimWord) return null;

  const codeMatch = text.match(/\b([A-Z]{1,4}\s*[-#]?\s*\d{1,4})\b/i);
  const code = codeMatch ? codeMatch[1].replace(/[\s-#]/g, '').toUpperCase() : 'BP01';

  const sizeMatch = text.match(/\b(10XL|9XL|8XL|7XL|6XL|5XL|4XL|3XL|2XL|XL|XXL|XXXL|FREE|PLUS)\b/i);
  const size = sizeMatch ? sizeMatch[1].toUpperCase() : '3XL';

  const colours = ['MAROON', 'BLACK', 'EMERALD', 'NAVY', 'ROSE', 'WHITE', 'OLIVE', 'KHAKI', 'RED', 'BLUE', 'YELLOW', 'PURPLE', 'PINK'];
  const foundColour = colours.find((c) => text.includes(c)) || 'MAROON';

  const qtyMatch = text.match(/\b(\d+)\s*(?:PCS?|PIECES?|X)?\b/i);
  const quantity = qtyMatch && Number(qtyMatch[1]) > 0 && Number(qtyMatch[1]) < 20 ? Number(qtyMatch[1]) : 1;

  return {
    isClaim: true,
    code,
    size,
    colour: foundColour,
    quantity,
    price: 1890,
  };
}

/* ==================== API ENDPOINTS ==================== */

// 1. Get full state
app.get('/api/state', (_req, res) => {
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
  });
});

// 1b. Reset runtime state back to clean seed data
app.post('/api/state/reset', (_req, res) => {
  lives = JSON.parse(JSON.stringify(SEED_LIVE_SESSIONS));
  inventory = JSON.parse(JSON.stringify(SEED_INVENTORY_ITEMS));
  orders = JSON.parse(JSON.stringify(SEED_BUYER_ORDERS));
  amendments = JSON.parse(JSON.stringify(SEED_AMENDMENTS));
  preOrders = JSON.parse(JSON.stringify(SEED_PRE_ORDERS));
  messengerThreads = JSON.parse(JSON.stringify(SEED_MESSENGER_THREADS));
  phpPerThbRate = 1.62;
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
app.post('/api/reconciliation/trigger-auto', (req, res) => {
  const { liveId, phpRate, supplierPaidThb, triggerType } = req.body;
  const targetLive = lives.find((l) => l.id === (liveId || activeLive.id)) || lives[0];
  
  if (phpRate && Number(phpRate) > 0) {
    phpPerThbRate = Number(phpRate);
  }

  const liveOrders = orders.filter((o) => o.liveId === targetLive.id);
  const liveInventory = inventory.filter((i) => i.liveId === targetLive.id);

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

  res.json({
    success: true,
    summary: latestSummary,
    targetLive,
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
    statedUnitPricePhp: statedPrice ? Number(statedPrice) : 1890,
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

  res.json({ success: true, order: newOrder, summary: latestSummary });
});

// 3b. Update order details (manual review & adjustment)
app.post('/api/orders/update', (req, res) => {
  const { orderId, updates } = req.body;
  const order = orders.find((o) => o.id === orderId);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

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

  res.json({ success: true, order, summary: latestSummary });
});

// 3c. Approve order (confirm claim)
app.post('/api/orders/approve', (req, res) => {
  const { orderId } = req.body;
  const order = orders.find((o) => o.id === orderId);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
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

  res.json({ success: true, order, summary: latestSummary });
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
    price: price !== undefined && price !== '' ? Number(price) : 1890,
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
  const live = lives.find((l) => l.id === (liveId || activeLive.id)) || lives[0];

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

  res.json({ success: true, live, summary: latestSummary });
});

// 8. Generate Official Final Invoices (Strictly Gated to Reconciled Items Only!)
app.post('/api/invoices/generate', (req, res) => {
  const { buyerNames } = req.body;
  if (!latestSummary) {
    return res.status(400).json({ error: 'No reconciled summary available. Please reconcile first.' });
  }

  const generatedInvoices: Array<{
    invoiceNumber: string;
    buyerName: string;
    totalAmountPhp: number;
    itemsCount: number;
    generatedAt: string;
  }> = [];

  const eligibleBags = latestSummary.buyerBags.filter((b) => b.totalPiecesGot > 0);
  const targetBags = buyerNames && Array.isArray(buyerNames)
    ? eligibleBags.filter((b) => buyerNames.includes(b.buyerName))
    : eligibleBags;

  targetBags.forEach((bag, idx) => {
    const invNum = `INV-LIVE-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(idx + 1).padStart(3, '0')}`;
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

    generatedInvoices.push({
      invoiceNumber: invNum,
      buyerName: bag.buyerName,
      totalAmountPhp: bag.subtotalPhp,
      itemsCount: bag.totalPiecesGot,
      generatedAt: new Date().toISOString(),
    });
  });

  res.json({
    success: true,
    generatedInvoices,
    summary: latestSummary,
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
app.post('/api/meta/webhook', (req, res) => {
  const isPortalSimulator = req.headers['x-portal-simulator'] === 'true';
  const appSecret = process.env.META_APP_SECRET;
  const signatureHeader = req.headers['x-hub-signature-256'] as string | undefined;

  // Verify Meta HMAC-SHA256 signature when META_APP_SECRET is configured (unless called from internal portal simulator)
  if (appSecret && !isPortalSimulator && signatureHeader) {
    const expectedSig =
      'sha256=' + crypto.createHmac('sha256', appSecret).update(JSON.stringify(req.body)).digest('hex');
    if (signatureHeader !== expectedSig) {
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
          const senderPsid = msgEvent.sender?.id || `psid_${Date.now()}`;
          const senderName = msgEvent.sender?.name || 'Messenger Buyer';
          const mid = msgEvent.message?.mid || `mid_${Date.now()}`;
          const text = msgEvent.message?.text || '';

          if (!text || seenMessageIds.has(mid)) continue;
          seenMessageIds.add(mid);

          eventType = 'pages_messaging';
          const intent = detectMessengerIntent(text, senderName);
          eventDetails = `Business Messenger DM from ${senderName}: "${text}"${intent ? ` [Auto-Triage: ${intent.type.toUpperCase()}]` : ''}`;

          let thread = messengerThreads.find(
            (t) => t.psid === senderPsid || t.buyerName.toLowerCase() === senderName.toLowerCase()
          );
          const linkedOrder = orders.find((o) => o.buyerName.toLowerCase() === senderName.toLowerCase());

          if (!thread) {
            thread = {
              id: `msg_th_${Date.now()}`,
              psid: senderPsid,
              buyerName: senderName,
              buyerHandle: `fb.com/${senderName.toLowerCase().replace(/\s+/g, '.')}`,
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

            const targetLive = lives.find((l) => l.fbVideoId === videoId || l.status === 'live') || lives[0];

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
            const parsed = parseLiveSellingClaim(message);
            if (parsed && parsed.isClaim) {
              const existingSameBuyerSpec = orders.some(
                (o) =>
                  o.liveId === targetLive.id &&
                  o.buyerName.toLowerCase() === sender.toLowerCase() &&
                  o.itemCode === parsed.code &&
                  o.size === (parsed.size || '3XL')
              );

              const newOrder: BuyerOrder = {
                id: `ord_wh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                liveId: targetLive.id,
                buyerName: sender,
                channel: 'live_chat',
                sourceCommentId: commentId,
                itemCode: parsed.code,
                itemName: parsed.code,
                size: parsed.size || '3XL',
                colour: parsed.colour || 'MAROON',
                quantity: parsed.quantity || 1,
                statedUnitPricePhp: parsed.price || 1890,
                orderedAt: nowIso,
                status: 'pending',
                invoiced: false,
                lane: 'live',
                version: 1,
                isDuplicateFlagged: existingSameBuyerSpec,
                duplicateReason: existingSameBuyerSpec
                  ? 'Repeat comment for same item/size detected during live stream'
                  : undefined,
                overrideHistory: [],
              };
              orders.push(newOrder);
              targetLive.totalComments = (targetLive.totalComments || 0) + 1;
              targetLive.totalMined = (targetLive.totalMined || 0) + 1;

              performInventorySync(targetLive.id);
            }
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
  const targetLive = lives.find((l) => l.id === (liveId || activeLive.id)) || lives[0];
  const nowIso = new Date().toISOString();

  if (fbVideoId && String(fbVideoId).trim()) {
    const cleanVid = String(fbVideoId).trim().replace(/.*\/videos\/(\d+).*/, '$1');
    targetLive.fbVideoId = cleanVid;
    graphSyncStats.onAirVideoId = cleanVid;
  }

  const fbToken = (accessToken && String(accessToken).trim()) || process.env.FB_PAGE_ACCESS_TOKEN || process.env.META_PAGE_ACCESS_TOKEN;
  const pageId = (fbPageId && String(fbPageId).trim()) || process.env.FB_PAGE_ID || process.env.META_PAGE_ID || 'me';

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
              const parsed = parseLiveSellingClaim(c.message || '');
              if (parsed && parsed.isClaim) {
                orders.push({
                  id: `ord_graph_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
                  liveId: targetLive.id,
                  buyerName: c.from?.name || (c.from?.id ? `FB Buyer ${String(c.from.id).slice(-4)}` : 'FB Live Buyer'),
                  channel: 'live_chat',
                  sourceCommentId: c.id,
                  itemCode: parsed.code,
                  itemName: parsed.code,
                  size: parsed.size || '3XL',
                  colour: parsed.colour || 'MAROON',
                  quantity: parsed.quantity || 1,
                  statedUnitPricePhp: parsed.price || 1890,
                  orderedAt: c.created_time || nowIso,
                  status: 'pending',
                  invoiced: false,
                  lane: 'live',
                  version: 1,
                  overrideHistory: [],
                });
                backfilledComments++;
              }
            }
          }
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
          const buyerParticipant = conv.participants?.data?.[0];
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

          const existingIdx = messengerThreads.findIndex((t) => t.id === conv.id || t.psid === psid);
          const threadObj: MessengerThread = {
            id: conv.id,
            psid,
            buyerName,
            buyerHandle: `fb.com/${psid}`,
            windowExpiresAt: new Date(new Date(conv.updated_time || nowIso).getTime() + 24 * 3600 * 1000).toISOString(),
            unreadCount: 1,
            linkedOrderId: linkedOrder?.id,
            detectedIntent: intent,
            messages: mappedMessages,
          };
          if (existingIdx >= 0) messengerThreads[existingIdx] = threadObj;
          else messengerThreads.push(threadObj);
          syncedThreadsCount++;
        }
      }
    } catch (err: any) {
      graphError = err?.message || 'Network error contacting graph.facebook.com';
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
      performInventorySync(targetLive.id);
    }
  }

  graphSyncStats.lastStatusCheck = graphError
    ? `Graph API Error: ${graphError}`
    : fbToken
    ? `Synced Graph API v22.0 at ${new Date().toLocaleTimeString()} (${totalCommentsFetched} comments scanned, +${backfilledComments} claims mined, ${syncedThreadsCount} Messenger threads)`
    : `Checked at ${new Date().toLocaleTimeString()} — Enter FB Live Video ID & Page Access Token to pull morning live data`;

  saveRuntimeState();
  res.json({
    success: !graphError,
    graphError,
    graphSyncStats,
    targetLive,
    orders,
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

    const parsed = parseLiveSellingClaim(commentText);
    if (parsed && parsed.isClaim) {
      orders.push({
        id: `ord_imp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        liveId: targetLive.id,
        buyerName,
        channel: 'live_chat',
        itemCode: parsed.code,
        itemName: parsed.code,
        size: parsed.size || '3XL',
        colour: parsed.colour || 'MAROON',
        quantity: parsed.quantity || 1,
        statedUnitPricePhp: parsed.price || 1890,
        orderedAt: nowIso,
        status: 'pending',
        invoiced: false,
        lane: 'live',
        version: 1,
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
  const { threadId, text } = req.body;
  if (!threadId || !text) {
    return res.status(400).json({ error: 'threadId and text are required' });
  }

  const thread = messengerThreads.find((t) => t.id === threadId);
  if (!thread) {
    return res.status(404).json({ error: 'Messenger thread not found' });
  }

  // Check Meta 24-hour standard messaging window
  const windowRemainingMs = new Date(thread.windowExpiresAt).getTime() - Date.now();
  if (windowRemainingMs <= 0) {
    return res.status(400).json({
      error: 'Meta 24-Hour Standard Messaging Window has expired for this buyer. Buyer must message first or use a Human-Agent tag.',
    });
  }

  // If FB_PAGE_ACCESS_TOKEN or META_PAGE_ACCESS_TOKEN is configured, dispatch real outbound Graph API v22.0 Send API request
  const fbToken = process.env.FB_PAGE_ACCESS_TOKEN || process.env.META_PAGE_ACCESS_TOKEN;
  if (fbToken && thread.psid) {
    try {
      await fetch(`https://graph.facebook.com/v22.0/me/messages?access_token=${encodeURIComponent(fbToken)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_type: 'RESPONSE',
          recipient: { id: thread.psid },
          message: { text },
        }),
      });
    } catch (e) {
      console.warn('[Messenger Send API] Local fallback:', e);
    }
  }

  const newMsg = {
    id: `m_reply_${Date.now()}`,
    sender: 'page_agent' as const,
    text: text.trim(),
    timestamp: new Date().toISOString(),
  };

  thread.messages.push(newMsg);
  thread.unreadCount = 0;
  saveRuntimeState();

  res.json({ success: true, thread, message: newMsg });
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
  const { liveId, role, reviewedBy, action, notes } = req.body;

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
  const { orderId, isPreOrder, role, author, reason, overrides } = req.body;

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
    statedUnitPricePhp: statedUnitPricePhp ? Number(statedUnitPricePhp) : 1890,
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
    app.use(express.static(path.resolve(__dirname, 'dist')) as any);
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
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
