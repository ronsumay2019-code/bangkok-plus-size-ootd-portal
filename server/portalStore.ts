// Durable storage for the portal's server state.
//
// Vercel runs the API as many short-lived copies that share no memory, so every request
// loads the portal's state from Supabase first and writes back only what changed before
// the response is sent. Without SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY the server keeps
// its previous in-memory behaviour (useful for local development).

export interface StoredRecord {
  collection: string;
  id: string;
  data: any;
}

export interface StoredKv {
  key: string;
  value: any;
}

export interface StaffRow {
  id: string;
  name: string;
  role: 'owner' | 'admin' | 'staff';
  code_hash: string | null;
  created_at?: string;
  revoked_at?: string | null;
}

export interface SessionRow {
  token_hash: string;
  staff_id: string;
  name: string;
  role: 'owner' | 'admin' | 'staff';
  device_type?: string | null;
  device_name?: string | null;
  created_at?: string;
  last_seen_at?: string;
  expires_at: string;
}

export interface PortalBackend {
  /** Only the named collections when given; side collections (raw comments, transcripts) stay out of every request. */
  loadRecords(collections?: string[]): Promise<StoredRecord[]>;
  getRecord(collection: string, id: string): Promise<StoredRecord | null>;
  /** The stored rows among these ids (missing ids are left out). */
  getRecords(collection: string, ids: string[]): Promise<StoredRecord[]>;
  loadKv(): Promise<StoredKv[]>;
  upsertRecords(rows: StoredRecord[]): Promise<void>;
  deleteRecords(collection: string, ids: string[]): Promise<void>;
  upsertKv(entries: StoredKv[]): Promise<void>;
  deleteKv(keys: string[]): Promise<void>;
  listStaff(): Promise<StaffRow[]>;
  upsertStaff(row: StaffRow): Promise<void>;
  findSession(tokenHash: string): Promise<SessionRow | null>;
  insertSession(row: SessionRow): Promise<void>;
  touchSession(tokenHash: string, lastSeenAt: string): Promise<void>;
  deleteSessionsForStaff(staffId: string): Promise<void>;
  listSessions(): Promise<SessionRow[]>;
}

export function storeConfigFromEnv(env: NodeJS.ProcessEnv = process.env): { url: string; key: string } | null {
  const url = (env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = (env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || '').trim();
  if (!url || !key) return null;
  return { url, key };
}

const PAGE_SIZE = 1000;

/** Supabase (PostgREST) backend. Uses plain fetch so no extra dependency is needed. */
export class SupabaseBackend implements PortalBackend {
  constructor(private url: string, private key: string, private fetchImpl: typeof fetch = fetch) {}

  private async request(path: string, init: RequestInit = {}, extraHeaders: Record<string, string> = {}) {
    const res = await this.fetchImpl(`${this.url}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: this.key,
        Authorization: `Bearer ${this.key}`,
        'Content-Type': 'application/json',
        ...extraHeaders,
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Database request failed (${res.status}) on ${path.split('?')[0]}: ${body.slice(0, 300)}`);
    }
    return res;
  }

  private async selectAll<T>(table: string, select: string, filter = ''): Promise<T[]> {
    const out: T[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const res = await this.request(`${table}?select=${select}${filter}&order=updated_at.asc`, {}, {
        Range: `${from}-${from + PAGE_SIZE - 1}`,
        'Range-Unit': 'items',
      });
      const page = (await res.json()) as T[];
      out.push(...page);
      if (page.length < PAGE_SIZE) return out;
    }
  }

  loadRecords(collections?: string[]) {
    const filter = collections?.length ? `&collection=in.(${collections.map(encodeURIComponent).join(',')})` : '';
    return this.selectAll<StoredRecord>('portal_records', 'collection,id,data', filter);
  }

  async getRecord(collection: string, id: string) {
    const res = await this.request(`portal_records?select=collection,id,data&collection=eq.${encodeURIComponent(collection)}&id=eq.${encodeURIComponent(id)}`);
    const rows = (await res.json()) as StoredRecord[];
    return rows[0] || null;
  }

  async getRecords(collection: string, ids: string[]) {
    const out: StoredRecord[] = [];
    for (let i = 0; i < ids.length; i += 100) {
      const list = ids.slice(i, i + 100).map((id) => `"${id.replace(/"/g, '\\"')}"`).join(',');
      const res = await this.request(`portal_records?select=collection,id,data&collection=eq.${encodeURIComponent(collection)}&id=in.(${encodeURIComponent(list)})`);
      out.push(...((await res.json()) as StoredRecord[]));
    }
    return out;
  }

  loadKv() {
    return this.selectAll<StoredKv>('portal_kv', 'key,value');
  }

  async upsertRecords(rows: StoredRecord[]) {
    if (!rows.length) return;
    const now = new Date().toISOString();
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500).map((r) => ({ ...r, updated_at: now }));
      await this.request('portal_records?on_conflict=collection,id', { method: 'POST', body: JSON.stringify(chunk) }, {
        Prefer: 'resolution=merge-duplicates,return=minimal',
      });
    }
  }

  async deleteRecords(collection: string, ids: string[]) {
    for (let i = 0; i < ids.length; i += 100) {
      const list = ids.slice(i, i + 100).map((id) => `"${id.replace(/"/g, '\\"')}"`).join(',');
      await this.request(
        `portal_records?collection=eq.${encodeURIComponent(collection)}&id=in.(${encodeURIComponent(list)})`,
        { method: 'DELETE' },
        { Prefer: 'return=minimal' }
      );
    }
  }

  async upsertKv(entries: StoredKv[]) {
    if (!entries.length) return;
    const now = new Date().toISOString();
    await this.request('portal_kv?on_conflict=key', {
      method: 'POST',
      body: JSON.stringify(entries.map((e) => ({ ...e, updated_at: now }))),
    }, { Prefer: 'resolution=merge-duplicates,return=minimal' });
  }

  async deleteKv(keys: string[]) {
    if (!keys.length) return;
    const list = keys.map((k) => `"${k}"`).join(',');
    await this.request(`portal_kv?key=in.(${encodeURIComponent(list)})`, { method: 'DELETE' }, { Prefer: 'return=minimal' });
  }

  async listStaff() {
    const res = await this.request('portal_staff?select=*&order=created_at.asc');
    return (await res.json()) as StaffRow[];
  }

  async upsertStaff(row: StaffRow) {
    await this.request('portal_staff?on_conflict=id', { method: 'POST', body: JSON.stringify([row]) }, {
      Prefer: 'resolution=merge-duplicates,return=minimal',
    });
  }

  async findSession(tokenHash: string) {
    const res = await this.request(`portal_sessions?select=*&token_hash=eq.${encodeURIComponent(tokenHash)}&limit=1`);
    const rows = (await res.json()) as SessionRow[];
    return rows[0] || null;
  }

  async insertSession(row: SessionRow) {
    await this.request('portal_sessions', { method: 'POST', body: JSON.stringify([row]) }, { Prefer: 'return=minimal' });
  }

  async touchSession(tokenHash: string, lastSeenAt: string) {
    await this.request(`portal_sessions?token_hash=eq.${encodeURIComponent(tokenHash)}`, {
      method: 'PATCH',
      body: JSON.stringify({ last_seen_at: lastSeenAt }),
    }, { Prefer: 'return=minimal' });
  }

  async deleteSessionsForStaff(staffId: string) {
    await this.request(`portal_sessions?staff_id=eq.${encodeURIComponent(staffId)}`, { method: 'DELETE' }, { Prefer: 'return=minimal' });
  }

  async listSessions() {
    const res = await this.request('portal_sessions?select=*&order=last_seen_at.desc');
    return (await res.json()) as SessionRow[];
  }
}

/** In-memory backend with the same behaviour, used by the automated tests. */
export class MemoryBackend implements PortalBackend {
  records = new Map<string, StoredRecord>();
  kv = new Map<string, any>();
  staff = new Map<string, StaffRow>();
  sessions = new Map<string, SessionRow>();
  failNextLoad = false;

  private clone<T>(v: T): T {
    return JSON.parse(JSON.stringify(v));
  }

  async loadRecords(collections?: string[]) {
    if (this.failNextLoad) {
      this.failNextLoad = false;
      throw new Error('Simulated database outage');
    }
    const all = [...this.records.values()];
    return this.clone(collections?.length ? all.filter((r) => collections.includes(r.collection)) : all);
  }
  async getRecord(collection: string, id: string) {
    const hit = [...this.records.values()].find((r) => r.collection === collection && r.id === id);
    return hit ? this.clone(hit) : null;
  }
  async getRecords(collection: string, ids: string[]) {
    return this.clone([...this.records.values()].filter((r) => r.collection === collection && ids.includes(r.id)));
  }
  async loadKv() {
    return [...this.kv.entries()].map(([key, value]) => this.clone({ key, value }));
  }
  async upsertRecords(rows: StoredRecord[]) {
    for (const r of rows) this.records.set(`${r.collection}:${r.id}`, this.clone(r));
  }
  async deleteRecords(collection: string, ids: string[]) {
    for (const id of ids) this.records.delete(`${collection}:${id}`);
  }
  async upsertKv(entries: StoredKv[]) {
    if (entries.some((e) => e.value === null)) throw new Error('portal_kv.value cannot be null');
    for (const e of entries) this.kv.set(e.key, this.clone(e.value));
  }
  async deleteKv(keys: string[]) {
    for (const k of keys) this.kv.delete(k);
  }
  async listStaff() {
    return this.clone([...this.staff.values()]);
  }
  async upsertStaff(row: StaffRow) {
    this.staff.set(row.id, this.clone(row));
  }
  async findSession(tokenHash: string) {
    const s = this.sessions.get(tokenHash);
    return s ? this.clone(s) : null;
  }
  async insertSession(row: SessionRow) {
    this.sessions.set(row.token_hash, this.clone(row));
  }
  async touchSession(tokenHash: string, lastSeenAt: string) {
    const s = this.sessions.get(tokenHash);
    if (s) s.last_seen_at = lastSeenAt;
  }
  async deleteSessionsForStaff(staffId: string) {
    for (const [k, s] of this.sessions) if (s.staff_id === staffId) this.sessions.delete(k);
  }
  async listSessions() {
    return this.clone([...this.sessions.values()]);
  }
}

type Accessor<T> = { get: () => T; set: (value: T) => void };

export interface StateBindings {
  /** Arrays of objects with an `id`, saved one row per object. */
  collections: Record<string, Accessor<Array<{ id: string }>>>;
  /** Single values, saved one row per key. Missing keys keep their in-memory default. */
  values: Record<string, Accessor<any>>;
}

/**
 * Loads the bound state from the backend and saves only what changed.
 * One instance per server process; requests must be serialized (see withStateLock).
 */
export class StateSync {
  private recordSnapshot = new Map<string, string>();
  private kvSnapshot = new Map<string, string>();
  private defaults = new Map<string, string>();
  loaded = false;

  constructor(private backend: PortalBackend, private bindings: StateBindings) {
    for (const [key, acc] of Object.entries(bindings.values)) this.defaults.set(key, JSON.stringify(acc.get()));
  }

  async load() {
    const [records, kv] = await Promise.all([this.backend.loadRecords(Object.keys(this.bindings.collections)), this.backend.loadKv()]);
    const byCollection = new Map<string, any[]>();
    for (const name of Object.keys(this.bindings.collections)) byCollection.set(name, []);
    this.recordSnapshot.clear();
    for (const r of records) {
      const list = byCollection.get(r.collection);
      if (!list) continue;
      list.push(r.data);
      this.recordSnapshot.set(`${r.collection}\u0000${r.id}`, JSON.stringify(r.data));
    }
    for (const [name, acc] of Object.entries(this.bindings.collections)) acc.set(byCollection.get(name) || []);

    this.kvSnapshot.clear();
    const kvMap = new Map(kv.map((e) => [e.key, e.value]));
    for (const [key, acc] of Object.entries(this.bindings.values)) {
      if (kvMap.has(key)) {
        acc.set(kvMap.get(key));
        this.kvSnapshot.set(key, JSON.stringify(kvMap.get(key)));
      } else {
        acc.set(JSON.parse(this.defaults.get(key) as string));
      }
    }
    this.loaded = true;
  }

  /** Writes changed/new rows, deletes rows that were removed. Returns how many rows were written. */
  async save(): Promise<number> {
    if (!this.loaded) return 0;
    const upserts: StoredRecord[] = [];
    const deletes = new Map<string, string[]>();
    const seen = new Set<string>();

    for (const [name, acc] of Object.entries(this.bindings.collections)) {
      for (const item of acc.get() || []) {
        if (!item || typeof item.id !== 'string' || !item.id) continue;
        const key = `${name}\u0000${item.id}`;
        if (seen.has(key)) continue; // duplicate ids: first one wins
        seen.add(key);
        const json = JSON.stringify(item);
        if (this.recordSnapshot.get(key) !== json) {
          upserts.push({ collection: name, id: item.id, data: JSON.parse(json) });
          this.recordSnapshot.set(key, json);
        }
      }
    }
    for (const key of [...this.recordSnapshot.keys()]) {
      if (seen.has(key)) continue;
      const [collection, id] = key.split('\u0000');
      if (!deletes.has(collection)) deletes.set(collection, []);
      deletes.get(collection)!.push(id);
      this.recordSnapshot.delete(key);
    }

    const kvUpserts: StoredKv[] = [];
    const kvDeletes: string[] = [];
    for (const [key, acc] of Object.entries(this.bindings.values)) {
      const value = acc.get();
      if (value === undefined) continue;
      const json = JSON.stringify(value);
      if (this.kvSnapshot.get(key) === json) continue;
      // The database keeps no empty (null) values: the row is removed and loading falls back to the default
      if (value === null) {
        if (this.kvSnapshot.has(key)) kvDeletes.push(key);
        this.kvSnapshot.delete(key);
        continue;
      }
      kvUpserts.push({ key, value: JSON.parse(json) });
      this.kvSnapshot.set(key, json);
    }

    await this.backend.upsertRecords(upserts);
    for (const [collection, ids] of deletes) await this.backend.deleteRecords(collection, ids);
    await this.backend.upsertKv(kvUpserts);
    if (kvDeletes.length) await this.backend.deleteKv(kvDeletes);
    return upserts.length + kvUpserts.length + kvDeletes.length + [...deletes.values()].reduce((n, ids) => n + ids.length, 0);
  }
}

/** Runs async work one at a time (Vercel can send several requests to the same copy at once). */
export class AsyncLock {
  private tail: Promise<void> = Promise.resolve();

  acquire(): Promise<() => void> {
    let release!: () => void;
    const next = new Promise<void>((resolve) => (release = resolve));
    const ready = this.tail.then(() => release);
    this.tail = this.tail.then(() => next);
    return ready;
  }
}

/** Private photo storage (Supabase Storage) for payment proofs. Photos are never public; staff get short-lived links. */
export class ProofStore {
  private bucketReady = false;
  constructor(private url: string, private key: string, private bucket = 'payment-proofs', private fetchImpl: typeof fetch = fetch) {}

  private headers(extra: Record<string, string> = {}) {
    return { apikey: this.key, Authorization: `Bearer ${this.key}`, ...extra };
  }

  private async ensureBucket() {
    if (this.bucketReady) return;
    const res = await this.fetchImpl(`${this.url}/storage/v1/bucket`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ id: this.bucket, name: this.bucket, public: false }),
    });
    // "already exists" comes back as 400/409
    if (!res.ok && res.status !== 400 && res.status !== 409) throw new Error(`Photo storage unavailable (${res.status})`);
    this.bucketReady = true;
  }

  async upload(path: string, bytes: Buffer, contentType: string): Promise<void> {
    await this.ensureBucket();
    const res = await this.fetchImpl(`${this.url}/storage/v1/object/${this.bucket}/${path}`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': contentType, 'x-upsert': 'true' }),
      body: new Uint8Array(bytes),
    });
    if (!res.ok) throw new Error(`Could not save the photo (${res.status})`);
  }

  async signedUrl(path: string, seconds = 600): Promise<string> {
    const res = await this.fetchImpl(`${this.url}/storage/v1/object/sign/${this.bucket}/${path}`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ expiresIn: seconds }),
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok || !data.signedURL) throw new Error(`Could not open the photo (${res.status})`);
    return `${this.url}/storage/v1${data.signedURL}`;
  }
}
