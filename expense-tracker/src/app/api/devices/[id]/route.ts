import { requireUser } from '@/features/auth/session';
import { revokeDevice } from '@/features/devices/service';
import { notFound, ok, route } from '@/server/http';

export const runtime = 'nodejs';

/** Revoking keeps the row, so you can still see what it synced and when. */
export const DELETE = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const revoked = await revokeDevice(user.id, id);
  if (!revoked) throw notFound('Device not found, or already revoked');
  return ok({ ok: true });
});
