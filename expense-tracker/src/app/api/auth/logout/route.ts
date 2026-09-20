import { endSession } from '@/features/auth/session';
import { ok, route } from '@/server/http';

export const runtime = 'nodejs';

export const POST = route(async () => {
  await endSession();
  return ok({ ok: true });
});
