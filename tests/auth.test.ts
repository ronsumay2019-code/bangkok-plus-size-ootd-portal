import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PortalAuth, sha256 } from '../server/auth';
import { MemoryBackend } from '../server/portalStore';

test('sign-in is off without an owner code or without the database', () => {
  assert.equal(new PortalAuth(new MemoryBackend(), '').enabled, false);
  assert.equal(new PortalAuth(null, 'OWNER-1').enabled, false);
  assert.equal(new PortalAuth(new MemoryBackend(), 'OWNER-1').enabled, true);
});

test('owner signs in with the owner code; wrong codes are refused', async () => {
  const db = new MemoryBackend();
  const auth = new PortalAuth(db, 'Owner-Code-1');
  assert.equal(await auth.login('nope', {}), null);
  const ok = await auth.login(' owner-code-1 ', { deviceType: 'mobile' });
  assert.ok(ok);
  assert.equal(ok!.user.role, 'owner');
  assert.deepEqual(await auth.userForToken(ok!.token), ok!.user);
  // only a hash of the token is stored
  assert.ok(db.sessions.has(sha256(ok!.token)));
  assert.ok(![...db.sessions.keys()].includes(ok!.token));
});

test('owner creates an admin code; the old code stops working when a new one is made', async () => {
  const db = new MemoryBackend();
  const auth = new PortalAuth(db, 'OWNER');
  const first = await auth.issueCode('admin1', false);
  const adminLogin = await auth.login(first.code, {});
  assert.equal(adminLogin!.user.role, 'admin');
  assert.equal(adminLogin!.user.staffId, 'admin1');

  const second = await auth.issueCode('admin1', false);
  assert.equal(await auth.login(first.code, {}), null, 'old code no longer works');
  assert.ok(await auth.userForToken(adminLogin!.token), 'phone already signed in stays signed in');
  assert.ok(await auth.login(second.code, {}));

  await auth.issueCode('admin1', true);
  assert.equal(await auth.userForToken(adminLogin!.token), null, 'revokeSessions signs old phones out');
});

test('revoking an admin signs them out and disables their code', async () => {
  const db = new MemoryBackend();
  const auth = new PortalAuth(db, 'OWNER');
  const { code } = await auth.issueCode('admin2', false);
  const s = await auth.login(code, {});
  await auth.revoke('admin2');
  assert.equal(await auth.userForToken(s!.token), null);
  assert.equal(await auth.login(code, {}), null);
});

test('expired sessions are refused; the owner cannot be issued an admin code', async () => {
  const db = new MemoryBackend();
  const auth = new PortalAuth(db, 'OWNER');
  const s = await auth.login('OWNER', {});
  db.sessions.get(sha256(s!.token))!.expires_at = new Date(Date.now() - 1000).toISOString();
  assert.equal(await auth.userForToken(s!.token), null);
  await assert.rejects(auth.issueCode('owner', false));
});

test('the co-owner gets owner access from an owner-issued code; admin 3 is an admin', async () => {
  const db = new MemoryBackend();
  const auth = new PortalAuth(db, 'OWNER');
  const coOwner = await auth.login((await auth.issueCode('owner2', false)).code, {});
  assert.equal(coOwner!.user.role, 'owner');
  assert.equal(coOwner!.user.staffId, 'owner2');
  const admin3 = await auth.login((await auth.issueCode('admin3', false)).code, {});
  assert.equal(admin3!.user.role, 'admin');

  await auth.revoke('owner2');
  assert.equal(await auth.userForToken(coOwner!.token), null, 'the co-owner seat can be revoked');
  await auth.revoke('owner');
  assert.ok(await auth.login('OWNER', {}), 'the primary owner can never be revoked');
});
