/**
 * 集成测试：CoC 投骰 API（/api/coc/roll）。
 *
 * 覆盖：
 *   - expr= 模式：合法表达式 + 非法表达式
 *   - d/s 模式：默认 d=10,s=1，超界拒绝
 *   - 不需要登录（公开辅助接口）
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { callRoute, resetCookies } from './helpers';
import * as cocRollRoute from '@/app/api/coc/roll/route';

describe('/api/coc/roll', () => {
  beforeEach(() => {
    resetCookies();
  });

  it('expr=2d6+3 在 [5, 15]', async () => {
    const res = await callRoute(cocRollRoute.GET, {
      url: 'http://localhost/api/coc/roll?expr=2d6%2B3',
    });
    expect(res.status).toBe(200);
    expect(res.data.ok).toBe(true);
    expect(res.data.data.expression).toBe('2d6+3');
    expect(res.data.data.value).toBeGreaterThanOrEqual(5);   // 2+3
    expect(res.data.data.value).toBeLessThanOrEqual(15);     // 12+3
  });

  it('expr=1d10 在 [1, 10]', async () => {
    for (let i = 0; i < 20; i++) {
      const res = await callRoute(cocRollRoute.GET, {
        url: 'http://localhost/api/coc/roll?expr=1d10',
      });
      expect(res.data.data.value).toBeGreaterThanOrEqual(1);
      expect(res.data.data.value).toBeLessThanOrEqual(10);
    }
  });

  it('非法表达式 → 500（抛错被 handleError 收）', async () => {
    const res = await callRoute(cocRollRoute.GET, {
      url: 'http://localhost/api/coc/roll?expr=abc',
    });
    // parseDiceExpression 返回 null → rollExpression 抛错 → handleError 500
    expect(res.status).toBe(500);
    expect(res.data.error.code).toBe('internal_error');
  });

  it('d= 默认 10，s= 默认 1：返回 10d1（投 10 个 d1，结果固定 10）', async () => {
    const res = await callRoute(cocRollRoute.GET, {
      url: 'http://localhost/api/coc/roll',
    });
    expect(res.status).toBe(200);
    expect(res.data.data.expression).toBe('10d1');
    // d1 骰永远 = 1，所以 10d1 总和固定为 10
    expect(res.data.data.value).toBe(10);
    expect(res.data.data.rolls).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
  });

  it('显式 d=3, s=6 → 返回 3d6（在 [3, 18]）', async () => {
    const res = await callRoute(cocRollRoute.GET, {
      url: 'http://localhost/api/coc/roll?d=3&s=6',
    });
    expect(res.status).toBe(200);
    expect(res.data.data.value).toBeGreaterThanOrEqual(3);
    expect(res.data.data.value).toBeLessThanOrEqual(18);
    expect(res.data.data.rolls).toHaveLength(3);
  });

  it('s 超界（>100）→ 400', async () => {
    const res = await callRoute(cocRollRoute.GET, {
      url: 'http://localhost/api/coc/roll?d=3&s=200',
    });
    expect(res.status).toBe(400);
    expect(res.data.error.code).toBe('invalid_sides');
  });

  it('d 超界（>100）→ 400', async () => {
    const res = await callRoute(cocRollRoute.GET, {
      url: 'http://localhost/api/coc/roll?d=200&s=6',
    });
    expect(res.status).toBe(400);
    expect(res.data.error.code).toBe('invalid_count');
  });
});
