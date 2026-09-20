import 'server-only';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { one, query } from '@/server/db/client';
import { HttpError } from '@/server/http';

/**
 * A phone gets its own credential, never your password. The token is shown
 * once at pairing and only its hash is stored, so a database dump cannot be
 * replayed against the sync endpoint. Revoking a device is one UPDATE.
 */

const PREFIX = 'paisa_dev';

const hash = (secret: string) => createHash('sha256').update(secret).digest('hex');

export type PairedDevice = { id: string; name: string; token: string };

export async function pairDevice(
  userId: string,
  input: { name: string; platform: string },
): Promise<PairedDevice> {
  const secret = randomBytes(32).toString('base64url');
  const device = await one<{ id: string; name: string }>(
    `INSERT INTO devices (user_id, name, platform, token_hash)
     VALUES ($1, $2, $3, $4) RETURNING id, name`,
    [userId, input.name, input.platform, hash(secret)],
  );
  if (!device) throw new HttpError(500, 'Could not pair that device');
  // The id travels with the token so verification is a single indexed lookup.
  return { id: device.id, name: device.name, token: `${PREFIX}_${device.id}.${secret}` };
}

export type DeviceIdentity = { deviceId: string; userId: string; deviceName: string };

/**
 * Verifies an `Authorization: Bearer <token>` header from the companion app.
 * Returns null rather than throwing so the caller decides the status code.
 */
export async function verifyDeviceToken(header: string | null): Promise<DeviceIdentity | null> {
  const raw = header?.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!raw || !raw.startsWith(`${PREFIX}_`)) return null;

  const [idPart, secret] = raw.slice(PREFIX.length + 1).split('.');
  if (!idPart || !secret) return null;
  if (!/^[0-9a-f-]{36}$/i.test(idPart)) return null;

  const device = await one<{ id: string; user_id: string; name: string; token_hash: string }>(
    `SELECT id, user_id, name, token_hash FROM devices
     WHERE id = $1 AND revoked_at IS NULL`,
    [idPart],
  );
  if (!device) return null;

  const expected = Buffer.from(device.token_hash, 'hex');
  const actual = Buffer.from(hash(secret), 'hex');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  return { deviceId: device.id, userId: device.user_id, deviceName: device.name };
}

export async function recordDeviceSync(deviceId: string, created: number): Promise<void> {
  await query(
    `UPDATE devices SET last_seen_at = now(), synced_count = synced_count + $2 WHERE id = $1`,
    [deviceId, created],
  );
}

export async function listDevices(userId: string) {
  return query(
    `SELECT id, name, platform, last_seen_at, synced_count, revoked_at, created_at
     FROM devices WHERE user_id = $1 ORDER BY revoked_at NULLS FIRST, created_at DESC`,
    [userId],
  );
}

export async function revokeDevice(userId: string, deviceId: string): Promise<boolean> {
  const row = await one(
    `UPDATE devices SET revoked_at = now()
     WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL RETURNING id`,
    [deviceId, userId],
  );
  return Boolean(row);
}
