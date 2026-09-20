import { registerSchema } from '@/features/auth/schema';
import { registerUser } from '@/features/auth/service';
import { startSession } from '@/features/auth/session';
import { ok, readJson, route } from '@/server/http';

export const runtime = 'nodejs';

export const POST = route(async (req: Request) => {
  const input = registerSchema.parse(await readJson(req));
  const user = await registerUser(input);
  await startSession(user);
  return ok(user, 201);
});
