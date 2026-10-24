// Staff sign-in for the portal.
//
// The owner signs in with PORTAL_OWNER_CODE (a Vercel environment variable). The owner then
// creates phone sign-in links for the admins from "Admin Phone QR". Codes and session tokens
// are stored only as SHA-256 hashes. Sign-in is enforced only when PORTAL_OWNER_CODE and the
// database are both configured, so a deploy without them keeps working as before.

import crypto from 'crypto';
import type { PortalBackend, SessionRow, StaffRow } from './portalStore';

export type PortalRole = 'owner' | 'admin' | 'staff';

export interface PortalUser {
  staffId: string;
  name: string;
  role: PortalRole;
}

export const SESSION_HEADER = 'x-portal-session';
const SESSION_DAYS = 60;

export const DEFAULT_STAFF: Array<{ id: string; name: string; role: PortalRole }> = [
  { id: 'owner', name: 'Pola (Shop Owner)', role: 'owner' },
  { id: 'admin1', name: 'Admin 1 (Staff Lead)', role: 'admin' },
  { id: 'admin2', name: 'Admin 2 (Inventory Lead)', role: 'admin' },
];

export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

export function newSecret(bytes = 24): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

/** Short, easy-to-type access code for admins (e.g. "K7QM-2XRP-9TDA"). */
export function newAccessCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(12);
  let out = '';
  for (let i = 0; i < 12; i++) {
    out += alphabet[bytes[i] % alphabet.length];
    if (i % 4 === 3 && i < 11) out += '-';
  }
  return out;
}

function normalizeCode(code: string): string {
  return String(code || '').trim().toUpperCase().replace(/\s+/g, '');
}

export class PortalAuth {
  constructor(private backend: PortalBackend | null, private ownerCode: string) {}

  get enabled(): boolean {
    return !!this.backend && !!this.ownerCode;
  }

  /** Exchanges an access code for a session token. Returns null when the code is wrong. */
  async login(code: string, device: { deviceType?: string; deviceName?: string }): Promise<{ token: string; user: PortalUser } | null> {
    if (!this.backend) return null;
    const clean = normalizeCode(code);
    if (!clean) return null;

    let staff: StaffRow | undefined;
    const ownerDefault = DEFAULT_STAFF[0];
    if (this.ownerCode && safeEqual(sha256(clean), sha256(normalizeCode(this.ownerCode)))) {
      const existing = (await this.backend.listStaff()).find((s) => s.id === ownerDefault.id);
      staff = existing || { id: ownerDefault.id, name: ownerDefault.name, role: 'owner', code_hash: null };
      if (!existing) await this.backend.upsertStaff(staff);
    } else {
      const hash = sha256(clean);
      staff = (await this.backend.listStaff()).find((s) => !s.revoked_at && s.code_hash && safeEqual(s.code_hash, hash));
    }
    if (!staff) return null;

    const token = newSecret(32);
    const now = new Date();
    const row: SessionRow = {
      token_hash: sha256(token),
      staff_id: staff.id,
      name: staff.name,
      role: staff.role,
      device_type: device.deviceType || null,
      device_name: device.deviceName || null,
      created_at: now.toISOString(),
      last_seen_at: now.toISOString(),
      expires_at: new Date(now.getTime() + SESSION_DAYS * 24 * 3600 * 1000).toISOString(),
    };
    await this.backend.insertSession(row);
    return { token, user: { staffId: staff.id, name: staff.name, role: staff.role } };
  }

  /** Looks up the signed-in user for a session token, or null if it is missing/expired/revoked. */
  async userForToken(token: string | undefined): Promise<PortalUser | null> {
    if (!this.backend || !token) return null;
    const hash = sha256(token);
    const session = await this.backend.findSession(hash);
    if (!session) return null;
    if (new Date(session.expires_at).getTime() < Date.now()) return null;
    const lastSeen = session.last_seen_at ? new Date(session.last_seen_at).getTime() : 0;
    if (Date.now() - lastSeen > 5 * 60 * 1000) {
      await this.backend.touchSession(hash, new Date().toISOString()).catch(() => {});
    }
    return { staffId: session.staff_id, name: session.name, role: session.role };
  }

  /**
   * Creates a fresh access code for an admin (owner only). The previous code stops working;
   * phones already signed in stay signed in unless revokeSessions is true.
   */
  async issueCode(staffId: string, revokeSessions: boolean): Promise<{ code: string; staff: StaffRow }> {
    if (!this.backend) throw new Error('Database is not configured');
    const def = DEFAULT_STAFF.find((s) => s.id === staffId);
    if (!def || def.role === 'owner') throw new Error('Unknown admin');
    const existing = (await this.backend.listStaff()).find((s) => s.id === staffId);
    const code = newAccessCode();
    const staff: StaffRow = {
      id: staffId,
      name: existing?.name || def.name,
      role: def.role,
      code_hash: sha256(normalizeCode(code)),
      revoked_at: null,
    };
    await this.backend.upsertStaff(staff);
    if (revokeSessions) await this.backend.deleteSessionsForStaff(staffId);
    return { code, staff };
  }

  /** Signs every phone of this admin out and disables their code (owner only). */
  async revoke(staffId: string): Promise<void> {
    if (!this.backend) return;
    const existing = (await this.backend.listStaff()).find((s) => s.id === staffId);
    if (!existing || existing.role === 'owner') return;
    await this.backend.upsertStaff({ ...existing, code_hash: null, revoked_at: new Date().toISOString() });
    await this.backend.deleteSessionsForStaff(staffId);
  }

  async listSessions() {
    if (!this.backend) return [];
    return (await this.backend.listSessions()).filter((s) => new Date(s.expires_at).getTime() > Date.now());
  }
}
