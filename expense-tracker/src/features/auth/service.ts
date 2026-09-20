import 'server-only';
import bcrypt from 'bcryptjs';
import type { ClientSession } from 'mongodb';
import { categories, newId, people, users } from '@/server/db/mongo';
import { DEFAULT_CATEGORIES } from '@/lib/constants';
import { HttpError } from '@/server/http';
import type { LoginInput, RegisterInput } from './schema';
import type { SessionUser } from './session';

function allowed(email: string): boolean {
  const list = (process.env.ALLOWED_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.length === 0 || list.includes(email.toLowerCase());
}

export async function registerUser(input: RegisterInput): Promise<SessionUser> {
  const email = input.email.toLowerCase().trim();
  if (!allowed(email)) {
    throw new HttpError(403, 'This email is not on the invite list for this instance');
  }
  if (await users().findOne({ email })) {
    throw new HttpError(409, 'An account with that email already exists');
  }

  const id = newId();
  const name = input.name.trim();
  try {
    await users().insertOne({
      _id: id,
      email,
      name,
      password_hash: await bcrypt.hash(input.password, 10),
      currency: 'INR',
      settings: {},
      created_at: new Date(),
    });
  } catch (err) {
    // The unique index is the real guard against two simultaneous signups.
    if ((err as { code?: number }).code === 11000) {
      throw new HttpError(409, 'An account with that email already exists');
    }
    throw err;
  }

  await seedNewUser(id, name);
  return { id, email, name };
}

/** Gives a brand-new account people and categories so nothing is empty. */
export async function seedNewUser(
  userId: string,
  name: string,
  session?: ClientSession,
): Promise<void> {
  const now = new Date();

  await people().insertMany(
    [
      { name: name || 'Me', relation: 'self', color: '#4C6EF5' },
      { name: 'Mother', relation: 'mother', color: '#E8590C' },
      { name: 'Father', relation: 'father', color: '#0CA678' },
    ].map((p) => ({ _id: newId(), user_id: userId, ...p, created_at: now })),
    { session, ordered: false },
  );

  await categories().insertMany(
    DEFAULT_CATEGORIES.map((c) => ({
      _id: newId(),
      user_id: userId,
      name: c.name,
      kind: c.kind,
      bucket: c.bucket,
      default_need_level: c.need,
      icon: c.icon,
      color: c.color,
      created_at: now,
    })),
    { session, ordered: false },
  );
}

export async function verifyLogin(input: LoginInput): Promise<SessionUser> {
  const email = input.email.toLowerCase().trim();
  const user = await users().findOne({ email });
  // Compare regardless, so a missing user and a wrong password cost the same
  // time and the endpoint does not leak which emails are registered.
  const hash =
    user?.password_hash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
  const okPassword = await bcrypt.compare(input.password, hash);
  if (!user || !okPassword) throw new HttpError(401, 'Email or password is incorrect');
  return { id: user._id, email: user.email, name: user.name };
}
