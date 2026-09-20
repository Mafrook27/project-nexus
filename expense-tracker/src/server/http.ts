import 'server-only';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { UnauthorizedError } from '@/features/auth/session';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string) => new HttpError(400, msg);
export const notFound = (msg = 'Not found') => new HttpError(404, msg);

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

/**
 * Wraps a route handler so every feature gets the same error shape:
 *   { error: string, fields?: Record<string, string> }
 */
export function route<A extends unknown[]>(
  handler: (...args: A) => Promise<Response>,
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
      }
      if (err instanceof ZodError) {
        const fields: Record<string, string> = {};
        for (const issue of err.issues) fields[issue.path.join('.') || '_'] = issue.message;
        return NextResponse.json({ error: 'Please check the form', fields }, { status: 422 });
      }
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      const message = err instanceof Error ? err.message : 'Unexpected error';
      console.error('[api]', message, err);
      const missingDb = message.includes('DATABASE_URL') || message.includes('AUTH_SECRET');
      return NextResponse.json(
        { error: missingDb ? message : 'Something went wrong on the server' },
        { status: missingDb ? 503 : 500 },
      );
    }
  };
}

/** Reads and parses a JSON body, tolerating an empty one. */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

export function searchParams(req: Request): URLSearchParams {
  return new URL(req.url).searchParams;
}
