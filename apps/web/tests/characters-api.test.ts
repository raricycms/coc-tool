/**
 * 集成测试：角色 CRUD API（route handler 直调）。
 *
 * 覆盖：
 *   - POST 创建：派生属性正确入库；skills/weapons/equipment 一并写入
 *   - GET 列表：仅返回当前用户的车卡
 *   - GET 详情：403 / 404 路径
 *   - PATCH：派生属性随 primary 改变；age/era 等基本字段
 *   - DELETE：软删（status=RETIRED, retiredReason='user_request'）
 *   - POST 字段越界 → 400 invalid_input（中文 fields）
 *   - 未登录 → 401
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@coc-tools/db';
import { callRoute, resetCookies, loginAs } from './helpers';
import { createCaptcha } from '@/lib/captcha';

import * as registerRoute from '@/app/api/auth/register/route';
import * as charactersRoute from '@/app/api/characters/route';
import * as characterByIdRoute from '@/app/api/characters/[id]/route';

const VALID_PRIMARY = {
  str: 60, con: 70, siz: 50, dex: 60,
  app: 50, int: 65, pow: 50, edu: 70, luck: 50,
};

async function register(username: string): Promise<{ id: string; username: string }> {
  const c = createCaptcha();
  await callRoute(registerRoute.POST, {
    url: 'http://localhost/api/auth/register', method: 'POST',
    body: { username, password: 'longpassword123', captchaToken: c.token, captchaAnswer: c.answer },
  });
  const u = await prisma.user.findUnique({ where: { username } });
  return { id: u!.id, username: u!.username };
}

async function makeChar(ownerId: string, name = '林远'): Promise<string> {
  const c = await prisma.character.create({
    data: {
      ownerId, name, era: 'modern',
      ...VALID_PRIMARY,
      hpMax: 12, mpMax: 10, sanMax: 50, mov: 8, build: 110, damageBonus: '0',
      hpCurrent: 12, mpCurrent: 10, sanCurrent: 250, luckCurrent: 50,
      skills: { create: [{ name: '侦察', value: 60 }] },
    },
  });
  return c.id;
}

describe('characters API', () => {
  beforeEach(() => {
    resetCookies();
  });

  it('POST 创建车卡并正确计算派生属性', async () => {
    const u = await register('char-create');
    await loginAs(u.id, u.username);

    const res = await callRoute(charactersRoute.POST, {
      url: 'http://localhost/api/characters', method: 'POST',
      body: {
        name: '林远',
        age: 30,
        era: '1920s',
        primary: VALID_PRIMARY,
        skills: [
          { name: '侦察', value: 60 },
          { name: '聆听', value: 55 },
        ],
        weapons: [{ name: '撬棍', skill: '格斗', damage: '1d6' }],
        equipment: [{ name: '手电', quantity: 1 }],
      },
    });
    expect(res.status).toBe(200);
    expect(res.data.ok).toBe(true);
    const ch = res.data.data;
    expect(ch.name).toBe('林远');
    expect(ch.hpMax).toBe(12);
    expect(ch.mpMax).toBe(10);
    expect(ch.sanMax).toBe(50);
    expect(ch.build).toBe(110);
    expect(ch.damageBonus).toBe('0');
    expect(ch.skills).toHaveLength(2);
    expect(ch.weapons).toHaveLength(1);
    expect(ch.equipment).toHaveLength(1);
  });

  it('POST 字段超界 → 400 + invalid_input + fields', async () => {
    const u = await register('char-bad');
    await loginAs(u.id, u.username);

    const res = await callRoute(charactersRoute.POST, {
      url: 'http://localhost/api/characters', method: 'POST',
      body: {
        name: '林远',
        primary: { ...VALID_PRIMARY, str: 200 },  // 越界
        skills: [],
      },
    });
    expect(res.status).toBe(400);
    expect(res.data.error.code).toBe('invalid_input');
    expect(res.data.error.fields.some((f: any) => f.key === 'primary.str')).toBe(true);
  });

  it('POST 未登录 → 401', async () => {
    const res = await callRoute(charactersRoute.POST, {
      url: 'http://localhost/api/characters', method: 'POST',
      body: { name: '林远', primary: VALID_PRIMARY, skills: [] },
    });
    expect(res.status).toBe(401);
  });

  it('GET 列表只返回当前用户的车卡', async () => {
    const alice = await register('char-alice');
    const bob = await register('char-bob');
    await makeChar(alice.id, 'A 卡');
    await makeChar(alice.id, 'A 卡 2');
    await makeChar(bob.id, 'B 卡');

    await loginAs(alice.id, alice.username);
    const res = await callRoute(charactersRoute.GET, { url: 'http://localhost/api/characters' });
    expect(res.status).toBe(200);
    expect(res.data.data).toHaveLength(2);
    expect(res.data.data.every((c: any) => c.name.startsWith('A'))).toBe(true);
  });

  it('GET 别人的车卡 → 403', async () => {
    const owner = await register('char-owner');
    const other = await register('char-other');
    const charId = await makeChar(owner.id);

    await loginAs(other.id, other.username);
    const res = await callRoute(characterByIdRoute.GET, {
      url: `http://localhost/api/characters/${charId}`,
    });
    expect(res.status).toBe(403);
  });

  it('GET 不存在 → 404', async () => {
    const u = await register('char-404');
    await loginAs(u.id, u.username);
    const res = await callRoute(characterByIdRoute.GET, {
      url: 'http://localhost/api/characters/does-not-exist',
    });
    expect(res.status).toBe(404);
  });

  it('PATCH 修改 name/era，且重新派生属性（primary 改时）', async () => {
    const u = await register('char-patch');
    await loginAs(u.id, u.username);
    const charId = await makeChar(u.id);

    // 仅改 name + era（不改 primary），不影响派生
    const res1 = await callRoute(characterByIdRoute.PATCH, {
      url: `http://localhost/api/characters/${charId}`, method: 'PATCH',
      body: { name: '改后', era: 'victorian' },
    });
    expect(res1.status).toBe(200);
    expect(res1.data.data.name).toBe('改后');
    expect(res1.data.data.era).toBe('victorian');
    expect(res1.data.data.hpMax).toBe(12);  // 未触发 derive

    // 改 primary：CON 从 70 → 80，hpMax 应重算为 floor((80+50)/10)=13
    const res2 = await callRoute(characterByIdRoute.PATCH, {
      url: `http://localhost/api/characters/${charId}`, method: 'PATCH',
      body: { primary: { ...VALID_PRIMARY, con: 80 } },
    });
    expect(res2.status).toBe(200);
    expect(res2.data.data.hpMax).toBe(13);

    // 改 skills → deleteMany + create
    const res3 = await callRoute(characterByIdRoute.PATCH, {
      url: `http://localhost/api/characters/${charId}`, method: 'PATCH',
      body: { skills: [{ name: '神秘学', value: 5 }, { name: '图书馆使用', value: 30 }] },
    });
    expect(res3.status).toBe(200);
    expect(res3.data.data.skills).toHaveLength(2);
    expect(res3.data.data.skills.find((s: any) => s.name === '侦察')).toBeUndefined();
  });

  it('DELETE 软删：status=RETIRED, retiredReason=user_request', async () => {
    const u = await register('char-del');
    await loginAs(u.id, u.username);
    const charId = await makeChar(u.id);

    const del = await callRoute(characterByIdRoute.DELETE, {
      url: `http://localhost/api/characters/${charId}`, method: 'DELETE',
    });
    expect(del.status).toBe(200);

    const ch = await prisma.character.findUnique({ where: { id: charId } });
    expect(ch?.status).toBe('RETIRED');
    expect(ch?.retiredReason).toBe('user_request');
    expect(ch?.retiredAt).toBeInstanceOf(Date);
  });

  it('DELETE 别人的车卡 → 403', async () => {
    const owner = await register('char-del-owner');
    const other = await register('char-del-other');
    const charId = await makeChar(owner.id);
    await loginAs(other.id, other.username);
    const res = await callRoute(characterByIdRoute.DELETE, {
      url: `http://localhost/api/characters/${charId}`, method: 'DELETE',
    });
    expect(res.status).toBe(403);
  });
});
