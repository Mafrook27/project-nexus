import { loginSchema } from '@/features/auth/schema';
import { verifyLogin } from '@/features/auth/service';
import { startSession } from '@/features/auth/session';
import { ok, readJson, route } from '@/server/http';

export const runtime = 'nodejs';

export const POST = route(async (req: Request) => {
  const input = loginSchema.parse(await readJson(req));
  const user = await verifyLogin(input);
  await startSession(user);
  return ok(user);
});
