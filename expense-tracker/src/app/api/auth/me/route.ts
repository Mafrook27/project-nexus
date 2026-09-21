import { users } from '@/server/db/mongo';
import { requireUser } from '@/features/auth/session';
import { profileSchema } from '@/features/settings/schema';
import { ok, readJson, route } from '@/server/http';

export const runtime = 'nodejs';

export const GET = route(async () => {
  const session = await requireUser();
  const user = await users().findOne(
    { _id: session.id },
    { projection: { password_hash: 0 } },
  );
  return ok(user ? { ...user, id: user._id } : null);
});

export const PATCH = route(async (req: Request) => {
  const session = await requireUser();
  const input = profileSchema.parse(await readJson(req));

  const set: Record<string, unknown> = {};
  if (input.name) set.name = input.name;
  if (input.currency) set.currency = input.currency;
  // Settings merge field by field, so saving one slider does not wipe the rest.
  for (const [key, value] of Object.entries(input.settings ?? {})) {
    if (value !== undefined) set[`settings.${key}`] = value;
  }

  const user = await users().findOneAndUpdate(
    { _id: session.id },
    { $set: set },
    { returnDocument: 'after', projection: { password_hash: 0 } },
  );
  return ok(user ? { ...user, id: user._id } : null);
});
