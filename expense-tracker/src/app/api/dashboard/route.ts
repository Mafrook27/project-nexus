import { requireUser } from '@/features/auth/session';
import { getDashboard } from '@/features/dashboard/service';
import { ok, route, searchParams } from '@/server/http';
import { monthKey } from '@/lib/date';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (req: Request) => {
  const user = await requireUser();
  const month = searchParams(req).get('month') ?? monthKey();
  return ok(await getDashboard(user.id, month));
});
