import { NextRequest } from 'next/server';
import { ok, handleError } from '@/lib/api';
import { clearSession } from '@/lib/auth';

export async function POST(_req: NextRequest) {
  try {
    await clearSession();
    return ok({});
  } catch (e) {
    return handleError(e);
  }
}