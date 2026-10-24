import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AsyncLock, MemoryBackend, StateSync, SupabaseBackend } from '../server/portalStore';
import { startFakePostgrest } from './support/fakePostgrest';

/** One "server copy": its own in-memory variables, bound to a shared backend. */
function makeCopy(backend: MemoryBackend | SupabaseBackend) {
  const state = { orders: [] as any[], threads: [] as any[], rate: 1.62 };
  const sync = new StateSync(backend, {
    collections: {
      orders: { get: () => state.orders, set: (v) => (state.orders = v) },
      messenger_threads: { get: () => state.threads, set: (v) => (state.threads = v) },
    },
    values: { phpPerThbRate: { get: () => state.rate, set: (v) => (state.rate = v) } },
  });
  return { state, sync };
}

test('a change saved by one server copy is seen by another copy', async () => {
  const db = new MemoryBackend();
  const a = makeCopy(db);
  const b = makeCopy(db);

  await a.sync.load();
  a.state.orders.push({ id: 'o1', buyerName: 'Ana', status: 'pending' });
  a.state.rate = 1.7;
  await a.sync.save();

  await b.sync.load();
  assert.equal(b.state.orders.length, 1);
  assert.equal(b.state.orders[0].buyerName, 'Ana');
  assert.equal(b.state.rate, 1.7);
});

test('only changed rows are written, and removed rows are deleted', async () => {
  const db = new MemoryBackend();
  const a = makeCopy(db);
  await a.sync.load();
  a.state.orders.push({ id: 'o1', status: 'pending' }, { id: 'o2', status: 'pending' });
  assert.equal(await a.sync.save(), 3, 'two orders + the default exchange rate on first save');

  await a.sync.load();
  assert.equal(await a.sync.save(), 0, 'nothing changed, nothing written');

  a.state.orders[0].status = 'confirmed';
  a.state.orders = a.state.orders.filter((o) => o.id !== 'o2');
  assert.equal(await a.sync.save(), 2, 'one update + one delete');
  assert.deepEqual([...db.records.keys()], ['orders:o1']);
  assert.equal(db.records.get('orders:o1')!.data.status, 'confirmed');
});

test('two copies editing different orders at the same time do not overwrite each other', async () => {
  const db = new MemoryBackend();
  const seed = makeCopy(db);
  await seed.sync.load();
  seed.state.orders.push({ id: 'o1', status: 'pending' }, { id: 'o2', status: 'pending' });
  await seed.sync.save();

  const a = makeCopy(db);
  const b = makeCopy(db);
  await Promise.all([a.sync.load(), b.sync.load()]);
  a.state.orders.find((o) => o.id === 'o1').status = 'confirmed';
  b.state.orders.find((o) => o.id === 'o2').status = 'cancelled';
  b.state.orders.push({ id: 'o3', status: 'pending' });
  await Promise.all([a.sync.save(), b.sync.save()]);

  const check = makeCopy(db);
  await check.sync.load();
  const byId = Object.fromEntries(check.state.orders.map((o) => [o.id, o.status]));
  assert.deepEqual(byId, { o1: 'confirmed', o2: 'cancelled', o3: 'pending' });
});

test('a failed load keeps the default values and never deletes data', async () => {
  const db = new MemoryBackend();
  const a = makeCopy(db);
  await a.sync.load();
  a.state.orders.push({ id: 'o1' });
  await a.sync.save();

  db.failNextLoad = true;
  await assert.rejects(a.sync.load());
  assert.equal(db.records.size, 1);
});

test('values missing from the database fall back to their defaults', async () => {
  const db = new MemoryBackend();
  const a = makeCopy(db);
  a.state.rate = 99; // stale value from an earlier request in the same copy
  await a.sync.load();
  assert.equal(a.state.rate, 1.62);
});

test('AsyncLock runs work one at a time in order', async () => {
  const lock = new AsyncLock();
  const order: string[] = [];
  await Promise.all(
    ['a', 'b', 'c'].map(async (name, i) => {
      const release = await lock.acquire();
      order.push(`start ${name}`);
      await new Promise((r) => setTimeout(r, 20 - i * 5));
      order.push(`end ${name}`);
      release();
    })
  );
  assert.deepEqual(order, ['start a', 'end a', 'start b', 'end b', 'start c', 'end c']);
});

test('SupabaseBackend speaks the REST API: paging, upsert, delete by id list', async () => {
  const fake = await startFakePostgrest();
  try {
    const backend = new SupabaseBackend(fake.url, 'test-service-key');
    const rows = Array.from({ length: 1205 }, (_, i) => ({ collection: 'orders', id: `o"${i}`, data: { n: i } }));
    await backend.upsertRecords(rows);
    const loaded = await backend.loadRecords();
    assert.equal(loaded.length, 1205, 'reads past the 1000-row page size');
    await backend.deleteRecords('orders', ['o"0', 'o"1', 'o"2']);
    assert.equal((await backend.loadRecords()).length, 1202);
    await backend.upsertKv([{ key: 'phpPerThbRate', value: 1.7 }]);
    assert.deepEqual(await backend.loadKv(), [{ key: 'phpPerThbRate', value: 1.7 }]);
  } finally {
    await fake.close();
  }
});
