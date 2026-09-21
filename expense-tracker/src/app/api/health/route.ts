import { NextResponse } from 'next/server';
import { getDb } from '@/server/db/mongo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Used by the host's health check and for debugging a fresh deploy. */
export async function GET() {
  const checks = {
    app: true,
    database: false,
    /** Transactions and the dedup guarantee both need a replica set. */
    replica_set: false,
    auth_secret: Boolean(process.env.AUTH_SECRET),
  };
  try {
    const info = await getDb().admin().command({ hello: 1 });
    checks.database = true;
    checks.replica_set = Boolean(info.setName);
  } catch {
    checks.database = false;
  }
  const healthy = checks.app && checks.database && checks.auth_secret;
  return NextResponse.json(
    { status: healthy ? 'ok' : 'degraded', checks },
    { status: healthy ? 200 : 503 },
  );
}
