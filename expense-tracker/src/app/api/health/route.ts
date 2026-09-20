import { NextResponse } from 'next/server';
import { one } from '@/server/db/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Used by Render's health check and for debugging a fresh deploy. */
export async function GET() {
  const checks = {
    app: true,
    database: false,
    auth_secret: Boolean(process.env.AUTH_SECRET),
  };
  try {
    await one('SELECT 1 AS ok');
    checks.database = true;
  } catch {
    checks.database = false;
  }
  const healthy = checks.app && checks.database && checks.auth_secret;
  return NextResponse.json({ status: healthy ? 'ok' : 'degraded', checks }, {
    status: healthy ? 200 : 503,
  });
}
