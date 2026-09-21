import { NextResponse } from 'next/server';
import { getSessionUser } from '@/features/auth/session';
import { recordDeviceSync, verifyDeviceToken } from '@/features/devices/service';
import { ingestBatch } from '@/features/transactions/intelligence/sync';
import { syncPayloadSchema } from '@/features/transactions/intelligence/schema';
import { ok, readJson, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The one endpoint the Android companion needs.
 *
 * Authenticated by a device token, not by your login, so the phone never holds
 * credentials that could read or change anything else. A browser session is
 * accepted too, which is what makes this testable from the web app.
 *
 * Takes one event or a batch of up to 100, so a phone that has been offline
 * can flush its queue in a single request.
 */
export const POST = route(async (req: Request) => {
  const device = await verifyDeviceToken(req.headers.get('authorization'));
  const session = device ? null : await getSessionUser();
  const userId = device?.userId ?? session?.id;

  if (!userId) {
    return NextResponse.json(
      { error: 'Pair this device in Settings, then send its token as a Bearer header' },
      { status: 401 },
    );
  }

  const payload = syncPayloadSchema.parse(await readJson(req));
  const events = 'events' in payload ? payload.events : [payload];

  const summary = await ingestBatch(userId, events);
  if (device) await recordDeviceSync(device.deviceId, summary.created);

  return ok(summary, 201);
});
