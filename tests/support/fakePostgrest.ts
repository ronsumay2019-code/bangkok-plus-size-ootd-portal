// Local stand-in for the parts of Supabase's REST API (PostgREST) the portal uses, so tests can run
// several server copies against one shared database without network access.
import http from 'http';

const KEYS: Record<string, string[]> = {
  portal_records: ['collection', 'id'],
  portal_kv: ['key'],
  portal_staff: ['id'],
  portal_sessions: ['token_hash'],
};

type Row = Record<string, any>;

function parseFilter(raw: string): (v: any) => boolean {
  if (raw.startsWith('eq.')) {
    const want = raw.slice(3);
    return (v) => String(v) === want;
  }
  if (raw.startsWith('in.(') && raw.endsWith(')')) {
    const inner = raw.slice(4, -1);
    const values: string[] = [];
    const re = /"((?:[^"\\]|\\.)*)"|([^,]+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(inner))) values.push(m[1] !== undefined ? m[1].replace(/\\"/g, '"') : m[2]);
    return (v) => values.includes(String(v));
  }
  throw new Error(`Unsupported filter ${raw}`);
}

export interface FakeDb {
  url: string;
  tables: Record<string, Row[]>;
  /** Supabase Storage stand-in: "bucket/path" -> bytes */
  objects: Map<string, Buffer>;
  requests: number;
  /** Every request as "METHOD path?query", in order. */
  log: string[];
  close(): Promise<void>;
}

export async function startFakePostgrest(seed: Partial<Record<string, Row[]>> = {}): Promise<FakeDb> {
  const tables: Record<string, Row[]> = { portal_records: [], portal_kv: [], portal_staff: [], portal_sessions: [] };
  for (const [t, rows] of Object.entries(seed)) tables[t] = JSON.parse(JSON.stringify(rows));
  const db: FakeDb = { url: '', tables, objects: new Map(), requests: 0, log: [], close: async () => {} };

  const server = http.createServer((req, res) => {
    db.requests++;
    db.log.push(`${req.method} ${decodeURIComponent(req.url || '')}`);
    let body = '';
    const chunks: Buffer[] = [];
    req.on('data', (c) => {
      chunks.push(Buffer.from(c));
      body += c;
    });
    req.on('end', () => {
      try {
        const u = new URL(req.url || '/', 'http://localhost');
        if (u.pathname.startsWith('/storage/v1/')) {
          if (req.headers.apikey !== 'test-service-key') return void res.writeHead(401).end('{}');
          const rest = u.pathname.slice('/storage/v1/'.length);
          if (rest === 'bucket') return void res.writeHead(200).end('{}');
          if (rest.startsWith('object/sign/')) {
            const key = rest.slice('object/sign/'.length);
            if (!db.objects.has(key)) return void res.writeHead(404).end('{}');
            return void res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ signedURL: `/object/sign/${key}?token=t` }));
          }
          if (rest.startsWith('object/')) {
            db.objects.set(rest.slice('object/'.length), Buffer.concat(chunks));
            return void res.writeHead(200).end('{}');
          }
          return void res.writeHead(404).end('{}');
        }
        const table = u.pathname.replace('/rest/v1/', '');
        const rows = tables[table];
        if (!rows) {
          res.writeHead(404).end(JSON.stringify({ message: `unknown table ${table}` }));
          return;
        }
        if (req.headers.apikey !== 'test-service-key') {
          res.writeHead(401).end(JSON.stringify({ message: 'bad key' }));
          return;
        }
        const filters: Array<[string, (v: any) => boolean]> = [];
        let limit = Infinity;
        for (const [k, v] of u.searchParams) {
          if (k === 'select' || k === 'order' || k === 'on_conflict') continue;
          if (k === 'limit') limit = Number(v);
          else filters.push([k, parseFilter(v)]);
        }
        const matches = (r: Row) => filters.every(([k, f]) => f(r[k]));

        if (req.method === 'GET') {
          let out = rows.filter(matches);
          const range = req.headers.range;
          if (range) {
            const [from, to] = String(range).split('-').map(Number);
            out = out.slice(from, to + 1);
          }
          out = out.slice(0, limit);
          const select = u.searchParams.get('select') || '*';
          if (select !== '*') {
            const cols = select.split(',');
            out = out.map((r) => Object.fromEntries(cols.map((c) => [c, r[c]])));
          }
          res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(out));
          return;
        }
        if (req.method === 'POST') {
          const incoming: Row[] = JSON.parse(body || '[]');
          // Same rule as the real table: portal_kv.value is NOT NULL
          if (table === 'portal_kv' && incoming.some((r) => r.value === null)) {
            res.writeHead(400).end(JSON.stringify({ message: 'null value in column "value" violates not-null constraint' }));
            return;
          }
          const keys = KEYS[table];
          const merge = String(req.headers.prefer || '').includes('merge-duplicates');
          for (const r of incoming) {
            const idx = rows.findIndex((x) => keys.every((k) => x[k] === r[k]));
            if (idx >= 0) {
              if (!merge) {
                res.writeHead(409).end(JSON.stringify({ message: 'duplicate key' }));
                return;
              }
              rows[idx] = { ...rows[idx], ...r };
            } else rows.push({ updated_at: new Date().toISOString(), ...r });
          }
          res.writeHead(201).end();
          return;
        }
        if (req.method === 'PATCH') {
          const patch = JSON.parse(body || '{}');
          rows.forEach((r, i) => matches(r) && (rows[i] = { ...r, ...patch }));
          res.writeHead(204).end();
          return;
        }
        if (req.method === 'DELETE') {
          if (!filters.length) throw new Error('refusing unfiltered delete');
          tables[table] = rows.filter((r) => !matches(r));
          // keep the same array object for callers holding a reference
          rows.length = 0;
          rows.push(...tables[table]);
          tables[table] = rows;
          res.writeHead(204).end();
          return;
        }
        res.writeHead(405).end();
      } catch (err: any) {
        res.writeHead(400).end(JSON.stringify({ message: err.message }));
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;
  db.url = `http://127.0.0.1:${port}`;
  db.close = () => new Promise((resolve) => server.close(() => resolve()));
  return db;
}
