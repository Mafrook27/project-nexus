import 'server-only';
import bcrypt from 'bcryptjs';
import { one, query, transaction } from '@/server/db/client';
import { DEFAULT_CATEGORIES } from '@/lib/constants';
import { HttpError } from '@/server/http';
import type { LoginInput, RegisterInput } from './schema';
import type { SessionUser } from './session';

type UserRow = { id: string; email: string; name: string; password_hash: string };

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
  const existing = await one<{ id: string }>('SELECT id FROM users WHERE email = $1', [email]);
  if (existing) throw new HttpError(409, 'An account with that email already exists');

  const hash = await bcrypt.hash(input.password, 10);
  return transaction(async (q) => {
    const [user] = await q<UserRow>(
      `INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3)
       RETURNING id, email, name, password_hash`,
      [email, input.name.trim(), hash],
    );
    await seedNewUser(q, user.id, user.name);
    return { id: user.id, email: user.email, name: user.name };
  });
}

/** Gives a brand-new account people + categories so nothing is empty on day one. */
export async function seedNewUser(
  q: typeof query,
  userId: string,
  name: string,
): Promise<void> {
  await q(
    `INSERT INTO people (user_id, name, relation, color) VALUES
       ($1, $2, 'self', '#4C6EF5'),
       ($1, 'Mother', 'mother', '#E8590C'),
       ($1, 'Father', 'father', '#0CA678')
     ON CONFLICT (user_id, name) DO NOTHING`,
    [userId, name || 'Me'],
  );

  const values: unknown[] = [userId];
  const tuples = DEFAULT_CATEGORIES.map((c) => {
    const base = values.length;
    values.push(c.name, c.kind, c.bucket, c.icon, c.color, c.need);
    return `($1, $${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`;
  });
  await q(
    `INSERT INTO categories (user_id, name, kind, bucket, icon, color, default_need_level)
     VALUES ${tuples.join(', ')}
     ON CONFLICT (user_id, name, kind) DO NOTHING`,
    values,
  );
}

export async function verifyLogin(input: LoginInput): Promise<SessionUser> {
  const email = input.email.toLowerCase().trim();
  const user = await one<UserRow>(
    'SELECT id, email, name, password_hash FROM users WHERE email = $1',
    [email],
  );
  // Compare regardless so a missing user and a wrong password cost the same time.
  const hash = user?.password_hash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
  const okPassword = await bcrypt.compare(input.password, hash);
  if (!user || !okPassword) throw new HttpError(401, 'Email or password is incorrect');
  return { id: user.id, email: user.email, name: user.name };
}
