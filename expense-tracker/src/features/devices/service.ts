import 'server-only';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { devices, newId } from '@/server/db/mongo';
import { HttpError } from '@/server/http';

/**
 * A phone gets its own credential, never your password. The token is shown
 * once at pairing and only its hash is stored, so a database dump cannot be
 * replayed against the sync endpoint.
 */

const PREFIX = 'paisa_dev';

const hash = (secret: string) => createHash('sha256').update(secret).digest('hex');

export type PairedDevice = { id: string; name: string; token: string };

export async function pairDevice(
  userId: string,
  input: { name: string; platform: string },
): Promise<PairedDevice> {
  const secret = randomBytes(32).toString('base64url');
  const id = newId();
  await devices().insertOne({
    _id: id,
    user_id: userId,
    name: input.name,
    platform: input.platform,
    token_hash: hash(secret),
    last_seen_at: null,
    synced_count: 0,
    revoked_at: null,
    created_at: new Date(),
  });
  // The id travels with the token so verification is a single indexed lookup.
  return { id, name: input.name, token: `${PREFIX}_${id}.${secret}` };
}

export type DeviceIdentity = { deviceId: string; userId: string; deviceName: string };

export async function verifyDeviceToken(header: string | null): Promise<DeviceIdentity | null> {
  const raw = header?.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!raw || !raw.startsWith(`${PREFIX}_`)) return null;

  const [idPart, secret] = raw.slice(PREFIX.length + 1).split('.');
  if (!idPart || !secret) return null;
  if (!/^[0-9a-f-]{36}$/i.test(idPart)) return null;

  const device = await devices().findOne({ _id: idPart, revoked_at: null });
  if (!device) return null;

  const expected = Buffer.from(device.token_hash, 'hex');
  const actual = Buffer.from(hash(secret), 'hex');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  return { deviceId: device._id, userId: device.user_id, deviceName: device.name };
}

export async function recordDeviceSync(deviceId: string, created: number): Promise<void> {
  await devices().updateOne(
    { _id: deviceId },
    { $set: { last_seen_at: new Date() }, $inc: { synced_count: created } },
  );
}

export async function listDevices(userId: string) {
  return devices()
    .aggregate([
      { $match: { user_id: userId } },
      { $addFields: { __active: { $cond: [{ $eq: ['$revoked_at', null] }, 0, 1] } } },
      { $sort: { __active: 1, created_at: -1 } },
      { $project: { token_hash: 0, __active: 0 } },
    ])
    .toArray();
}

export async function revokeDevice(userId: string, deviceId: string): Promise<boolean> {
  const result = await devices().updateOne(
    { _id: deviceId, user_id: userId, revoked_at: null },
    { $set: { revoked_at: new Date() } },
  );
  return result.modifiedCount > 0;
}

/** Only used so the pairing route can report a clear failure. */
export const pairingFailure = () => new HttpError(500, 'Could not pair that device');
