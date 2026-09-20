import { one } from '@/server/db/client';
import { requireUser } from '@/features/auth/session';
import { profileSchema } from '@/features/settings/schema';
import { ok, readJson, route } from '@/server/http';

export const runtime = 'nodejs';

export const GET = route(async () => {
  const session = await requireUser();
  const user = await one(
    'SELECT id, email, name, currency, settings, created_at FROM users WHERE id = $1',
    [session.id],
  );
  return ok(user);
});

export const PATCH = route(async (req: Request) => {
  const session = await requireUser();
  const input = profileSchema.parse(await readJson(req));
  const user = await one(
    `UPDATE users SET
       name     = COALESCE($2, name),
       currency = COALESCE($3, currency),
       settings = CASE WHEN $4::jsonb IS NULL THEN settings ELSE settings || $4::jsonb END
     WHERE id = $1
     RETURNING id, email, name, currency, settings`,
    [session.id, input.name ?? null, input.currency ?? null, input.settings ? JSON.stringify(input.settings) : null],
  );
  return ok(user);
});
