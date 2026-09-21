import { requireUser } from '@/features/auth/session';
import { deviceSchema } from '@/features/devices/schema';
import { listDevices, pairDevice } from '@/features/devices/service';
import { ok, readJson, route } from '@/server/http';

export const runtime = 'nodejs';

export const GET = route(async () => {
  const user = await requireUser();
  return ok(await listDevices(user.id));
});

/** Returns the plaintext token exactly once. It is never stored or shown again. */
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const input = deviceSchema.parse(await readJson(req));
  return ok(await pairDevice(user.id, input), 201);
});
