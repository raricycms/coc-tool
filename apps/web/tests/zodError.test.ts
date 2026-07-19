/**
 * 测试 Zod 报错的中文格式化 + 字段级错误。
 *
 * 涵盖：
 *   - 单个属性超界 → "属性 STR：不能大于 100"
 *   - 字符串必填 → "姓名：不能为空"
 *   - 数组元素的子字段：在 ctx.root 下用条目真名替代「第 N 项」
 *   - 邮箱格式 → "邮箱：格式不正确"
 *   - 多个 issue 时合并展示，最多 3 条
 *   - handleError 集成：fields 列表 + 中文 message
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ZodError, z } from 'zod';
import {
  formatZodIssue,
  formatZodError,
  buildFieldErrors,
  CharacterCreateSchema,
} from '@coc-tools/shared';
import { handleError } from '@/lib/api';
import { resetCookies } from './helpers';

describe('formatZodIssue', () => {
  it('属性 STR 超界时给出「属性 STR：不能大于 100」', () => {
    const r = CharacterCreateSchema.safeParse({
      name: '林远',
      primary: {
        str: 150, con: 50, siz: 50, dex: 50,
        app: 50, int: 50, pow: 50, edu: 50, luck: 50,
      },
      skills: [],
    });
    expect(r.success).toBe(false);
    const issue = (r.error as ZodError).issues.find((i) => i.path[0] === 'primary')!;
    expect(formatZodIssue(issue)).toBe('属性 STR：不能大于 100');
  });

  it('字符串必填时报「姓名：不能为空」', () => {
    const r = CharacterCreateSchema.safeParse({
      name: '',
      primary: {
        str: 50, con: 50, siz: 50, dex: 50,
        app: 50, int: 50, pow: 50, edu: 50, luck: 50,
      },
      skills: [],
    });
    expect(r.success).toBe(false);
    const issue = (r.error as ZodError).issues[0];
    expect(issue.path).toEqual(['name']);
    expect(formatZodIssue(issue)).toBe('姓名：不能为空');
  });

  it('不带 ctx.root 时数组下标用「第 N 项」', () => {
    const r = CharacterCreateSchema.safeParse({
      name: '林远',
      primary: {
        str: 50, con: 50, siz: 50, dex: 50,
        app: 50, int: 50, pow: 50, edu: 50, luck: 50,
      },
      skills: [
        { name: '侦查', value: 25 },
        { name: '聆听', value: 200 },
      ],
    });
    expect(r.success).toBe(false);
    const issue = (r.error as ZodError).issues[0];
    expect(formatZodIssue(issue)).toBe('第 2 项技能的值：不能大于 100');
  });

  it('传入 ctx.root 后数组下标替换为条目真名', () => {
    const body = {
      name: '林远',
      primary: {
        str: 50, con: 50, siz: 50, dex: 50,
        app: 50, int: 50, pow: 50, edu: 50, luck: 50,
      },
      skills: [
        { name: '侦查', value: 25 },
        { name: '聆听', value: 200 },
      ],
    };
    const r = CharacterCreateSchema.safeParse(body);
    expect(r.success).toBe(false);
    const issue = (r.error as ZodError).issues[0];
    expect(formatZodIssue(issue, { root: body })).toBe('聆听的值：不能大于 100');
  });

  it('weapons / equipment 也走同一条替换路径', () => {
    const body = {
      name: '林远',
      primary: {
        str: 50, con: 50, siz: 50, dex: 50,
        app: 50, int: 50, pow: 50, edu: 50, luck: 50,
      },
      skills: [],
      weapons: [
        { name: '撬棍', skill: '格斗', damage: '1d6', range: '' },
      ],
      equipment: [
        { name: '手电筒', quantity: 5 },
      ],
    };
    const badBody = {
      ...body,
      // weapon damage 字段是 .max(20)，放个 21 字符让它超界
      weapons: [{ ...body.weapons[0], damage: 'X'.repeat(21) }],
      equipment: [{ ...body.equipment[0], quantity: 0 }],
    };
    const r = CharacterCreateSchema.safeParse(badBody);
    expect(r.success).toBe(false);
    const labels = (r.error as ZodError).issues.map((i) => formatZodIssue(i, { root: badBody }));
    expect(labels.some((l) => l.includes('撬棍'))).toBe(true);
    expect(labels.some((l) => l.includes('手电筒'))).toBe(true);
    // 不应再出现「第 N 项」
    expect(labels.some((l) => l.includes('第'))).toBe(false);
  });

  it('邮箱格式错误 → 「邮箱：格式不正确」', () => {
    const EmailSchema = z.object({ email: z.string().email() });
    const r = EmailSchema.safeParse({ email: 'not-an-email' });
    expect(r.success).toBe(false);
    const issue = (r.error as ZodError).issues[0];
    expect(formatZodIssue(issue)).toBe('邮箱：格式不正确');
  });

  it('多个 issue 时合并展示，最多 3 条', () => {
    const r = CharacterCreateSchema.safeParse({
      name: '林远',
      primary: {
        str: 0, con: 0, siz: 0, dex: 0,
        app: 0, int: 0, pow: 0, edu: 0, luck: 0,
      },
      skills: [],
    });
    expect(r.success).toBe(false);
    const out = formatZodError(r.error as ZodError);
    const lines = out.split('\n');
    expect(lines.length).toBe(4);
    expect(lines[3]).toMatch(/还有 6 项错误未显示/);
  });
});

describe('buildFieldErrors', () => {
  it('返回 [{key, label, message}] 三元组', () => {
    const r = CharacterCreateSchema.safeParse({
      name: '',
      primary: {
        str: 50, con: 50, siz: 50, dex: 50,
        app: 50, int: 50, pow: 50, edu: 50, luck: 50,
      },
      skills: [],
    });
    expect(r.success).toBe(false);
    const fields = buildFieldErrors(r.error as ZodError);
    const nameField = fields.find((f) => f.key === 'name')!;
    expect(nameField.label).toBe('姓名');
    expect(nameField.message).toBe('不能为空');
  });

  it('primary.str 的 key 是 "primary.str"，label 是 "属性 STR"', () => {
    const r = CharacterCreateSchema.safeParse({
      name: '林远',
      primary: {
        str: 200, con: 50, siz: 50, dex: 50,
        app: 50, int: 50, pow: 50, edu: 50, luck: 50,
      },
      skills: [],
    });
    expect(r.success).toBe(false);
    const fields = buildFieldErrors(r.error as ZodError);
    const f = fields.find((x) => x.key === 'primary.str')!;
    expect(f.label).toBe('属性 STR');
    expect(f.message).toBe('不能大于 100');
  });

  it('传入 ctx.root 后 skills.<i>.value 的 label 用条目名', () => {
    const body = {
      name: '林远',
      primary: {
        str: 50, con: 50, siz: 50, dex: 50,
        app: 50, int: 50, pow: 50, edu: 50, luck: 50,
      },
      skills: [
        { name: '侦查', value: 25 },
        { name: '聆听', value: 999 },
      ],
    };
    const r = CharacterCreateSchema.safeParse(body);
    expect(r.success).toBe(false);
    const fields = buildFieldErrors(r.error as ZodError, { root: body });
    const f = fields.find((x) => x.key === 'skills.1.value')!;
    // label 是用户友好的字段路径，包含条目真名
    expect(f.label).toBe('聆听的值');
    expect(f.message).toBe('不能大于 100');
  });
});

describe('handleError 集成', () => {
  beforeEach(() => {
    resetCookies();
  });

  it('ZodError 通过 handleError 返回中文 message 而非英文原串', () => {
    const r = CharacterCreateSchema.safeParse({
      primary: {
        str: 200, con: 50, siz: 50, dex: 50,
        app: 50, int: 50, pow: 50, edu: 50, luck: 50,
      },
      skills: [],
    });
    expect(r.success).toBe(false);
    const res = handleError(r.error);
    return res.json().then((body: any) => {
      expect(res.status).toBe(400);
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('invalid_input');
      expect(body.error.message).toContain('不能为空');
      expect(body.error.message).not.toMatch(/must|less than|greater than|Number/);
    });
  });

  it('handleError 把 fields 列表附在 error.fields', () => {
    const r = CharacterCreateSchema.safeParse({
      primary: {
        str: 200, con: 50, siz: 50, dex: 50,
        app: 50, int: 50, pow: 50, edu: 50, luck: 50,
      },
      skills: [],
    });
    expect(r.success).toBe(false);
    const res = handleError(r.error);
    return res.json().then((body: any) => {
      expect(Array.isArray(body.error.fields)).toBe(true);
      expect(body.error.fields.length).toBeGreaterThan(0);
      expect(body.error.fields[0]).toMatchObject({
        key: expect.any(String),
        label: expect.any(String),
        message: expect.any(String),
        path: expect.any(Array),
      });
    });
  });
});