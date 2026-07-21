/**
 * CoC 投骰辅助 API（v0.1）。
 *
 * GET /api/coc/roll?expr=1d10    → { expression: "1d10", value: 7 }
 * GET /api/coc/roll?d=N&s=M      → 投 N 个 M 面骰求和（d 是数量，s 是面数）
 *                                  例如 d=3, s=6 表示 3d6
 *
 * 历史行为：之前把 s 当作"单次投骰的面数"、忽略 d（只用 `rollDie(d)`），
 * 这导致 `?d=3&s=6` 实际投的是单颗 d3，与 expression 字符串不一致。
 * 修复后两个参数都参与投骰，结果与 expression 字段一致。
 */

import { NextRequest } from 'next/server';
import { ok, fail, handleError } from '@/lib/api';
import { rollDice, rollExpression } from '@coc-tools/coc-rules';

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
    // d 是骰子数量，s 是每个骰的面数；total 为所有骰之和
    const rolls = rollDice(d, s);
    const total = rolls.reduce((a, b) => a + b, 0);
    return ok({ expression: `${d}d${s}`, value: total, rolls });
  } catch (e) {
    return handleError(e);
  }
}