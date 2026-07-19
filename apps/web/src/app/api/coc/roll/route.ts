/**
 * CoC 投骰辅助 API（v0.1）。
 *
 * GET /api/coc/roll?expr=1d10  → { value: 7 }
 * GET /api/coc/roll?d=N&s=M    → { value: ... }
 */

import { NextRequest } from 'next/server';
import { ok, fail, handleError } from '@/lib/api';
import { rollDie, rollExpression } from '@coc-tools/coc-rules';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const expr = url.searchParams.get('expr');
    if (expr) {
      const value = rollExpression(expr);
      return ok({ expression: expr, value });
    }
    const d = parseInt(url.searchParams.get('d') ?? '10', 10);
    const s = parseInt(url.searchParams.get('s') ?? '1', 10);
    if (s < 1 || s > 100) return fail(400, 'invalid_sides');
    if (d < 1 || d > 100) return fail(400, 'invalid_count');
    const value = rollDie(d);
    return ok({ expression: `${d}d${s}`, value });
  } catch (e) {
    return handleError(e);
  }
}