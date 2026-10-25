// End-to-end: two separate server processes (like two Vercel copies) share one database.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, ChildProcess } from 'child_process';
import crypto from 'crypto';
import path from 'path';
import { startFakePostgrest, FakeDb } from './support/fakePostgrest';

const OWNER_CODE = 'OWNER-TEST-CODE';
const APP_SECRET = 'test-app-secret';
const LIVE_ID = 'live_2026_10_22_morning';

let db: FakeDb;
const copies: ChildProcess[] = [];

function seedRows() {
  const live = { id: LIVE_ID, title: 'NEW SHOP · 2026-10-22', fbVideoId: 'vid22', status: 'ended', storeDate: '2026-10-22', startedAt: '2026-10-22T01:00:00.000Z', endedAt: '2026-10-22T02:48:00.000Z', storeName: 'Pratunam', lineup: [], totalComments: 0, totalMined: 2, reconciledAt: null, reconciliationStatus: 'awaiting_owner_review' };
  const order = (id: string, price: number, code = 'RUSTANS') => ({ id, liveId: LIVE_ID, buyerName: 'Vera Santos', channel: 'live_chat', itemCode: code, itemName: code, size: 'FREE SIZE (PLUS)', colour: 'PINK', quantity: 1, statedUnitPricePhp: price, orderedAt: '2026-10-22T07:00:00.000Z', status: 'pending', invoiced: false, lane: 'live', version: 1, overrideHistory: [] });
  return {
    portal_records: [
      { collection: 'lives', id: LIVE_ID, data: live },
      { collection: 'orders', id: 'ord_live_1', data: order('ord_live_1', 550) },
      { collection: 'orders', id: 'ord_live_2', data: order('ord_live_2', 450, 'LU PANTS') },
    ],
    portal_kv: [{ key: 'phpPerThbRate', value: 1.62 }],
  };
}

async function startCopy(port: number, extraEnv: Record<string, string> = {}): Promise<string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined && !/^(META_|FB_|FACEBOOK_|PAGE_|SUPABASE_|PORTAL_|BRIDGE_)/.test(k)) env[k] = v;
  }
  Object.assign(env, {
    VERCEL: '1',
    NODE_ENV: 'production',
    TEST_PORT: String(port),
    SUPABASE_URL: db.url,
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
    PORTAL_OWNER_CODE: OWNER_CODE,
    ...extraEnv,
  });
  for (const [k, v] of Object.entries(env)) if (v === '') delete env[k];
  const child = spawn(process.execPath, ['--import', 'tsx', path.join(__dirname, 'support/serverCopy.ts')], {
    env,
    cwd: path.join(__dirname, '..'),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  copies.push(child);
  let logs = '';
  child.stdout!.on('data', (d) => (logs += d));
  child.stderr!.on('data', (d) => (logs += d));
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`${base}/api/auth/status`);
      if (r.ok) return base;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`server copy on ${port} did not start:\n${logs}`);
}

async function call(base: string, p: string, opts: { method?: string; token?: string; body?: any; headers?: Record<string, string> } = {}) {
  const res = await fetch(`${base}${p}`, {
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { 'x-portal-session': opts.token } : {}),
      ...(opts.headers || {}),
    },
    body: opts.body !== undefined ? (typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)) : undefined,
  });
  const data: any = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

let A: string;
let B: string;
let ownerToken: string;

before(async () => {
  db = await startFakePostgrest(seedRows());
  [A, B] = await Promise.all([startCopy(4311), startCopy(4312)]);
});

after(async () => {
  for (const c of copies) c.kill('SIGKILL');
  await db.close().catch(() => {});
});

test('the portal refuses data until someone signs in', async () => {
  const r = await call(A, '/api/state');
  assert.equal(r.status, 401);
  assert.equal(r.data.authRequired, true);
  const bad = await call(A, '/api/auth/login', { body: { code: 'WRONG' } });
  assert.equal(bad.status, 401);
});

test('owner signs in on one copy and the session works on the other copy', async () => {
  const r = await call(A, '/api/auth/login', { body: { code: OWNER_CODE, deviceType: 'desktop' } });
  assert.equal(r.status, 200);
  assert.equal(r.data.user.role, 'owner');
  ownerToken = r.data.token;
  const state = await call(B, '/api/state', { token: ownerToken });
  assert.equal(state.status, 200);
  assert.equal(state.data.lives[0].id, LIVE_ID, 'the stored live keeps its id (no new id from today’s date)');
  assert.equal(state.data.orders.filter((o: any) => o.liveId === LIVE_ID).length, 2);
  assert.ok(state.data.activeSessions.every((s: any) => !s.token), 'no passcodes or tokens sent to the browser');
});

test('a Messenger DM received by copy A can be answered from copy B, exactly once', async () => {
  const psid = '7012345678901234';
  const wh = await call(A, '/api/meta/webhook', {
    body: { object: 'page', entry: [{ messaging: [{ sender: { id: psid }, recipient: { id: '109603071381200' }, timestamp: Date.now(), message: { mid: 'm_test_1', text: 'Hi po, palit ko 3XL' } }] }] },
  });
  assert.equal(wh.status, 200);
  // the same delivery twice (Meta retries) must not duplicate the message
  await call(B, '/api/meta/webhook', {
    body: { object: 'page', entry: [{ messaging: [{ sender: { id: psid }, recipient: { id: '109603071381200' }, timestamp: Date.now(), message: { mid: 'm_test_1', text: 'Hi po, palit ko 3XL' } }] }] },
  });

  const stateB = await call(B, '/api/state', { token: ownerToken });
  const thread = stateB.data.messengerThreads.find((t: any) => t.psid === psid);
  assert.ok(thread, 'copy B sees the conversation copy A received');
  assert.equal(thread.messages.length, 1);
  assert.ok(new Date(thread.windowExpiresAt).getTime() > Date.now(), '24h window counted from the buyer message');

  const clientMessageId = 'm_reply_test_abc123';
  const reply = await call(B, '/api/meta/messenger/reply', {
    token: ownerToken,
    body: { threadId: thread.id, text: 'Sige po, 3XL na', clientMessageId },
  });
  assert.equal(reply.status, 200);
  assert.equal(reply.data.message.id, clientMessageId, 'server keeps the browser id so the bubble is not duplicated');
  assert.equal(reply.data.message.deliveryStatus, 'not_sent', 'no Page token configured in this test');
  assert.match(reply.data.metaApiDetail, /No Meta Page Access Token/);

  const stateA = await call(A, '/api/state', { token: ownerToken });
  const threadA = stateA.data.messengerThreads.find((t: any) => t.psid === psid);
  assert.equal(threadA.messages.filter((m: any) => m.sender === 'page_agent').length, 1, 'reply stored once, visible on copy A');
});

test('replies and new buyer DMs arriving at the same moment on different copies are all kept', async () => {
  const psid = '7012345678901234';
  const s0 = await call(A, '/api/state', { token: ownerToken });
  const thread = s0.data.messengerThreads.find((t: any) => t.psid === psid);
  const before = thread.messages.length;
  const jobs: Promise<any>[] = [];
  for (let i = 0; i < 6; i++) {
    jobs.push(call(B, '/api/meta/messenger/reply', { token: ownerToken, body: { threadId: thread.id, text: `reply ${i}`, clientMessageId: `m_reply_race_${i}x` } }));
    jobs.push(call(A, '/api/meta/webhook', { body: { object: 'page', entry: [{ messaging: [{ sender: { id: psid }, recipient: { id: '1' }, timestamp: Date.now(), message: { mid: `m_race_${i}`, text: `buyer ${i}` } }] }] } }));
  }
  const results = await Promise.all(jobs);
  assert.ok(results.every((r) => r.status === 200));
  const s1 = await call(B, '/api/state', { token: ownerToken });
  const t1 = s1.data.messengerThreads.find((t: any) => t.psid === psid);
  assert.equal(t1.messages.length, before + 12, 'no message lost or duplicated');
});

test('the same live comment delivered to two copies at once creates one order', async () => {
  const comment = { object: 'page', entry: [{ changes: [{ field: 'feed', value: { item: 'comment', verb: 'add', comment_id: 'cmt_dup_1', post_id: '109603071381200_vid22', message: 'Mine rustans pink', from: { id: '1', name: 'Joy Tuazon' } } }] }] };
  await Promise.all([call(A, '/api/meta/webhook', { body: comment }), call(B, '/api/meta/webhook', { body: comment })]);
  const s = await call(A, '/api/state', { token: ownerToken });
  const made = s.data.orders.filter((o: any) => o.sourceCommentId === 'cmt_dup_1');
  assert.equal(made.length, 1);
  assert.equal(made[0].buyerName, 'Joy Tuazon', 'name kept as written');
});

test('only real order comments on the live become orders, pending and with no made-up price', async () => {
  const feed = (value: any) => ({ object: 'page', entry: [{ changes: [{ field: 'feed', value: { verb: 'add', post_id: '109603071381200_vid22', ...value } }] }] });
  const events = [
    feed({ item: 'reaction', reaction_type: 'like', from: { id: '2', name: 'Liker' } }),
    feed({ item: 'comment', comment_id: 'q1', message: 'how much', from: { id: '3', name: 'Asker' } }),
    feed({ item: 'comment', comment_id: 'q2', message: 'Mgkano', from: { id: '4', name: 'Asker Two' } }),
    feed({ item: 'comment', comment_id: 'e1', message: '', from: { id: '5', name: 'Sticker Only' } }),
    { object: 'page', entry: [{ id: 'page_1', changes: [{ field: 'feed', value: { item: 'comment', verb: 'add', post_id: 'page_1_vid22', comment_id: 'p1', message: 'Mine T1', from: { id: 'page_1', name: 'Bangkok Plus Size OOTD' } } }] }] },
    feed({ item: 'comment', comment_id: 'o1', post_id: '109603071381200_otherpost', message: 'Mine T2', from: { id: '6', name: 'Other Post' } }),
    feed({ item: 'comment', comment_id: 'n1', message: 'Mine T3', from: { id: '7' } }),
    feed({ item: 'comment', comment_id: 'm1', message: 'mine T4 2XL', from: { id: '8', name: 'Real Buyer' } }),
    feed({ item: 'comment', comment_id: 'm2', message: 'D3 po', from: { id: '9', name: 'Code Only' } }),
  ];
  for (const e of events) assert.equal((await call(A, '/api/meta/webhook', { body: e })).status, 200);
  const s = await call(B, '/api/state', { token: ownerToken });
  const made = s.data.orders.filter((o: any) => ['q1', 'q2', 'e1', 'p1', 'o1', 'n1', 'm1', 'm2'].includes(o.sourceCommentId));
  assert.deepEqual(made.map((o: any) => o.buyerName).sort(), ['Code Only', 'Name needed', 'Real Buyer'], 'reactions, questions, empty, the Page and other posts are not orders; a nameless order is kept');
  const nameless = made.find((o: any) => o.sourceCommentId === 'n1');
  assert.match(nameless.reviewNotes, /facebook\.com\/n1/, 'links to the comment so staff can see who wrote it');
  // Facebook gives the name later (e.g. the webhook): the order picks it up
  await call(B, '/api/meta/webhook', { body: feed({ item: 'comment', comment_id: 'n1', message: 'Mine T3', from: { id: '7', name: 'Late Name' } }) });
  const after = await call(A, '/api/state', { token: ownerToken });
  assert.equal(after.data.orders.find((o: any) => o.sourceCommentId === 'n1').buyerName, 'Late Name');
  assert.equal(after.data.orders.filter((o: any) => o.sourceCommentId === 'n1').length, 1, 'still one order');
  for (const o of made) {
    assert.equal(o.status, 'pending', 'waits for review');
    assert.equal(o.statedUnitPricePhp, null, 'no price until the host price is added');
    assert.equal(o.liveId, LIVE_ID, 'a replay comment on the live video stays with that live');
  }
});

test('approving an order on one copy is saved for every copy', async () => {
  const r = await call(A, '/api/orders/approve', { token: ownerToken, body: { orderId: 'ord_live_1' } });
  assert.equal(r.status, 200);
  const s = await call(B, '/api/state', { token: ownerToken });
  assert.equal(s.data.orders.find((o: any) => o.id === 'ord_live_1').status, 'confirmed');
});

test('orders added on two copies at the same time are all kept', async () => {
  const adds = Array.from({ length: 8 }, (_, i) =>
    call(i % 2 ? A : B, '/api/orders/add', { token: ownerToken, body: { liveId: LIVE_ID, buyerName: `Buyer ${i}`, itemCode: 'RUSTANS', statedPrice: 550 } })
  );
  const results = await Promise.all(adds);
  assert.ok(results.every((r) => r.status === 200));
  const s = await call(A, '/api/state', { token: ownerToken });
  const added = s.data.orders.filter((o: any) => /^Buyer \d$/.test(o.buyerName));
  assert.equal(added.length, 8);
});

test('owner creates admin and co-owner links; admins cannot create links or see or change the token', async () => {
  const inv = await call(B, '/api/auth/invite', { token: ownerToken, body: { staffId: 'admin1' } });
  assert.equal(inv.status, 200);
  const login = await call(A, '/api/auth/login', { body: { code: inv.data.code, deviceType: 'mobile' } });
  assert.equal(login.status, 200);
  assert.equal(login.data.user.role, 'admin');
  const adminToken = login.data.token;

  assert.equal((await call(A, '/api/auth/invite', { token: adminToken, body: { staffId: 'admin2' } })).status, 403);
  assert.equal((await call(A, '/api/meta/token', { token: adminToken, body: { token: 'x' } })).status, 403, 'admins cannot change the Page token');
  const seen = await call(A, '/api/meta/token', { token: adminToken });
  assert.equal(seen.status, 200);
  assert.equal(seen.data.maskedToken, null, 'admins never see the token, even masked');
  assert.equal(seen.data.canManage, false);
  const sync = await call(B, '/api/facebook/live-sync', { token: adminToken, body: { accessToken: 'x' } });
  assert.equal(sync.status, 403, 'admins cannot slip a token in through the live sync');

  const co = await call(B, '/api/auth/invite', { token: ownerToken, body: { staffId: 'owner2' } });
  const coLogin = await call(A, '/api/auth/login', { body: { code: co.data.code } });
  assert.equal(coLogin.data.user.role, 'owner', 'the co-owner has owner access');
  assert.equal((await call(A, '/api/auth/invite', { token: coLogin.data.token, body: { staffId: 'admin3' } })).status, 200, 'the co-owner can create admin links');
  const override = await call(B, '/api/owner/order-override', { token: adminToken, body: { orderId: 'ord_live_2', role: 'staff', reason: 'size fix', overrides: { size: '3XL' } } });
  assert.equal(override.status, 200, 'the role comes from the sign-in, not from the request body');
  const noReason = await call(B, '/api/owner/order-override', { token: ownerToken, body: { orderId: 'ord_live_2', overrides: { size: '4XL' } } });
  assert.equal(noReason.status, 200, 'the owner overrides without giving a reason');
});

test('reset is disabled once data lives in the database', async () => {
  const r = await call(A, '/api/state/reset', { token: ownerToken, body: {} });
  assert.equal(r.status, 410);
});

test('starting a live after an earlier day’s live ended opens a new live session', async () => {
  const r = await call(A, '/api/live/toggle', { token: ownerToken, body: { liveId: LIVE_ID, action: 'start' } });
  assert.equal(r.status, 200);
  assert.notEqual(r.data.live.id, LIVE_ID);
  assert.equal(r.data.lives[0].id, r.data.live.id);
  const s = await call(B, '/api/state', { token: ownerToken });
  assert.equal(s.data.lives[0].id, r.data.live.id, 'the new live is the active one on every copy');
  assert.equal(s.data.lives.length, 2, 'the earlier live and its orders are kept');
  assert.equal(s.data.orders.filter((o: any) => o.liveId === LIVE_ID).length, 14, 'the 11 earlier orders plus the 3 order comments from the replay');
});

test('webhook signature is checked over the exact bytes Meta sent', async () => {
  const C = await startCopy(4313, { META_APP_SECRET: APP_SECRET });
  const raw = JSON.stringify({ object: 'page', entry: [{ messaging: [{ sender: { id: '7099999999999999' }, recipient: { id: '1' }, message: { mid: 'm_sig_1', text: 'Escobiñas: mine po 💜' } }] }] }).replace(/ñ/g, '\\u00f1');
  const sig = 'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(raw).digest('hex');
  const good = await call(C, '/api/meta/webhook', { body: raw, headers: { 'x-hub-signature-256': sig } });
  assert.equal(good.status, 200, 'valid signature accepted even with escaped characters');
  const bad = await call(C, '/api/meta/webhook', { body: raw, headers: { 'x-hub-signature-256': 'sha256=deadbeef' } });
  assert.equal(bad.status, 401);
  const missing = await call(C, '/api/meta/webhook', { body: raw });
  assert.equal(missing.status, 401, 'unsigned events are refused when the app secret is set');
});

test('without PORTAL_OWNER_CODE the portal stays open (sign-in not set up yet) but still saves to the database', async () => {
  const D = await startCopy(4314, { PORTAL_OWNER_CODE: '' });
  const s = await call(D, '/api/state');
  assert.equal(s.status, 200);
  assert.ok(s.data.orders.length >= 10);
  const st = await call(D, '/api/auth/status');
  assert.equal(st.data.authEnabled, false);
  assert.equal(st.data.databaseEnabled, true);
});

test('without the database settings the portal still starts (old in-memory behaviour)', async () => {
  const E = await startCopy(4315, { SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '' });
  const s = await call(E, '/api/state');
  assert.equal(s.status, 200);
  const st = await call(E, '/api/auth/status');
  assert.equal(st.data.databaseEnabled, false);
  assert.equal(st.data.authEnabled, false);
});

test('sending an invoice photo records it in the conversation with Messenger\'s answer', async () => {
  const psid = '24000000000000099';
  await call(A, '/api/meta/webhook', { body: { object: 'page', entry: [{ messaging: [{ sender: { id: psid }, recipient: { id: '1' }, timestamp: Date.now(), message: { mid: 'm_photo_buyer_1', text: 'invoice po' } }] }] } });
  const s = await call(B, '/api/state', { token: ownerToken });
  const thread = s.data.messengerThreads.find((t: any) => t.psid === psid);
  assert.ok(thread);

  const tiny = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';
  const r = await call(A, '/api/meta/messenger/send-photo', { token: ownerToken, body: { threadId: thread.id, imageDataUrl: tiny, clientMessageId: 'm_photo_test_1' } });
  assert.equal(r.status, 200);
  assert.equal(r.data.message.text, '📷 Photo');
  assert.equal(r.data.message.deliveryStatus, 'not_sent', 'no Page token in tests, so it is reported, not faked');

  const bad = await call(A, '/api/meta/messenger/send-photo', { token: ownerToken, body: { threadId: thread.id, imageDataUrl: 'not-a-photo' } });
  assert.equal(bad.data.success, false);
  const after = await call(B, '/api/state', { token: ownerToken });
  const saved = after.data.messengerThreads.find((t: any) => t.psid === psid).messages.find((m: any) => m.id === 'm_photo_test_1');
  assert.ok(saved, 'the photo message is saved for every copy');
  assert.equal((await call(A, '/api/meta/messenger/send-photo', { body: { threadId: thread.id, imageDataUrl: tiny } })).status, 401, 'signed-in staff only');
});


test('invoices count 24 hours from being sent; a payment needs its photo and moves the invoice to Paid', async () => {
  const add = await call(A, '/api/orders/add', { token: ownerToken, body: { liveId: LIVE_ID, buyerName: 'Payer One', itemCode: 'T9', statedPrice: 500 } });
  assert.equal(add.status, 200);
  const st = await call(A, '/api/state', { token: ownerToken });
  const order = st.data.orders.find((o: any) => o.buyerName === 'Payer One');
  await call(A, '/api/orders/approve', { token: ownerToken, body: { orderId: order.id } });
  const inv = await call(B, '/api/invoices/generate', { token: ownerToken, body: { buyerNames: ['Payer One'], liveId: LIVE_ID } });
  assert.equal(inv.status, 200);
  const invoiceNumber = inv.data.generatedInvoices[0].invoiceNumber;
  let s = await call(A, '/api/state', { token: ownerToken });
  let mine = s.data.orders.find((o: any) => o.id === order.id);
  assert.ok(mine.invoicedAt);
  assert.equal(mine.paymentStatus, 'unpaid');
  assert.equal(mine.invoiceSentAt, undefined, 'no Messenger delivery in tests, so the clock has not started');

  assert.equal((await call(A, '/api/invoices/mark-sent', { token: ownerToken, body: { invoiceNumber } })).status, 200);
  s = await call(B, '/api/state', { token: ownerToken });
  mine = s.data.orders.find((o: any) => o.id === order.id);
  assert.ok(mine.invoiceSentAt, 'marking it sent starts the 24 hours');

  const noProof = await call(A, '/api/payments/record', { token: ownerToken, body: { invoiceNumber } });
  assert.equal(noProof.status, 400, 'no proof means not paid');
  const tiny = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2Q==';
  const paid = await call(B, '/api/payments/record', { token: ownerToken, body: { invoiceNumber, photoDataUrl: tiny, reference: 'GCash 1234', amountPhp: 500 } });
  assert.equal(paid.status, 200);
  s = await call(A, '/api/state', { token: ownerToken });
  mine = s.data.orders.find((o: any) => o.id === order.id);
  assert.equal(mine.paymentStatus, 'paid');
  assert.equal(mine.paymentProof.reference, 'GCash 1234');
  assert.ok(db.objects.size >= 1, 'the photo is stored privately');
  const proof = await call(A, `/api/payments/proof?invoiceNumber=${encodeURIComponent(invoiceNumber)}`, { token: ownerToken });
  assert.equal(proof.status, 200);
  assert.match(proof.data.url, /\/storage\/v1\/object\/sign\//);
});

test('owner can start fresh from one Facebook live; admins cannot; Messenger chats are kept', async () => {
  const before = await call(A, '/api/state', { token: ownerToken });
  const threadsBefore = before.data.messengerThreads.length;
  const inv = await call(B, '/api/auth/invite', { token: ownerToken, body: { staffId: 'admin2' } });
  const admin = await call(A, '/api/auth/login', { body: { code: inv.data.code } });
  const denied = await call(A, '/api/admin/start-fresh', { token: admin.data.token, body: { confirm: 'START FRESH', fbVideo: '3310662652470857' } });
  assert.equal(denied.status, 403);
  assert.equal((await call(A, '/api/admin/start-fresh', { token: ownerToken, body: { fbVideo: '3310662652470857' } })).status, 400, 'needs the typed confirmation');

  const r = await call(B, '/api/admin/start-fresh', {
    token: ownerToken,
    body: { confirm: 'START FRESH', fbVideo: 'https://www.facebook.com/bangkokplussizeootd/videos/3310662652470857/' },
  });
  assert.equal(r.status, 200);
  const s = await call(A, '/api/state', { token: ownerToken });
  assert.equal(s.data.orders.length, 0);
  assert.equal(s.data.lives.length, 1);
  assert.equal(s.data.lives[0].fbVideoId, '3310662652470857', 'the video id is read from the link');
  assert.equal(s.data.lives[0].status, 'live');
  assert.equal(s.data.messengerThreads.length, threadsBefore, 'Messenger chats are kept');
});

test('if the database is down the portal says so and changes nothing', async () => {
  const before = JSON.stringify(db.tables.portal_records);
  const url = db.url;
  await db.close();
  const r = await call(A, '/api/orders/add', { token: ownerToken, body: { buyerName: 'X', itemCode: 'Y' } });
  assert.equal(r.status, 503);
  assert.equal(JSON.stringify(db.tables.portal_records), before);
  assert.ok(url);
});
