/**
 * 把 Zod 校验失败的 issue 翻译成用户可读的中文报错。
 *
 * 多个 app（web / realtime）共用此工具。
 * 输出形如：
 *   - "姓名：不能为空"
 *   - "属性 STR：不能大于 100"
 *   - "聆听技能的值：不能大于 100"
 *   - "邮箱：格式不正确"
 *
 * 同时导出 buildFieldErrors，用于驱动前端输入框的字段级错误标红。
 */

import type { ZodError, ZodIssue } from 'zod';

const FIELD_LABELS: Record<string, string> = {
  // character base
  name: '姓名',
  gender: '性别',
  age: '年龄',
  birthplace: '出生地',
  residence: '住址',
  nationality: '国籍',
  occupation: '职业',
  era: '时代',
  background: '背景',
  notes: '备注',
  // character primary stats
  primary: '属性',
  str: 'STR',
  con: 'CON',
  siz: 'SIZ',
  dex: 'DEX',
  app: 'APP',
  int: 'INT',
  pow: 'POW',
  edu: 'EDU',
  luck: '幸运',
  // character array children
  skills: '技能',
  weapons: '武器',
  equipment: '装备',
  value: '值',
  isMythos: '是否克苏鲁神话',
  skill: '关联技能',
  damage: '伤害',
  range: '射程',
  ammo: '弹药',
  quantity: '数量',
  // auth
  email: '邮箱',
  password: '密码',
  username: '用户名',
  captchaToken: '验证码令牌',
  captchaAnswer: '验证码答案',
  // recruitment
  scenario: '剧情简介',
  expectedHours: '预计时长',
  minPlayers: '最少人数',
  maxPlayers: '最多人数',
  title: '标题',
  summary: '摘要',
  startAt: '开始时间',
  visibility: '可见性',
  reviewNote: '审核备注',
  // settlement
  amount: '数量',
  delta: '变动量',
  deltaMinutes: '变动分钟',
  bonusDice: '奖励骰',
  difficulty: '难度',
  scMin: '成功阈值下限',
  scMax: '成功阈值上限',
  inGameDate: '游戏内日期',
  inGameTime: '游戏内时间',
  message: '消息',
  reason: '原因',
  judgmentId: '判定 ID',
  characterId: '角色 ID',
  targetCharacterId: '目标角色 ID',
  skillName: '技能名',
  action: '动作',
  kind: '类型',
  type: '类型',
  content: '内容',
  rate: '速率',
};

/** 路径中遇到数组下标 + 命中已知容器时，从原数据里取条目的 name 作为前缀。 */
function containerItemName(
  path: (string | number)[],
  root: unknown,
): string | null {
  if (path.length < 2) return null;
  const container = path[0];
  if (container !== 'skills' && container !== 'weapons' && container !== 'equipment') {
    return null;
  }
  const idx = path[1];
  if (typeof idx !== 'number') return null;
  const items = (root as any)?.[container];
  if (!Array.isArray(items) || !items[idx]) return null;
  const name = items[idx]?.name;
  return typeof name === 'string' && name.trim() ? name.trim() : null;
}

/**
 * 把 issue.path 转成中文标签。ctx.root 是原始输入体，传入后数组下标
 * 会被替换成对应条目的 name（skills/weapons/equipment）。
 */
function formatPath(path: (string | number)[], ctx?: FormatCtx): string {
  if (path.length === 0) return '请求体';

  const itemName =
    ctx?.root !== undefined ? containerItemName(path, ctx.root) : null;

  const labels: string[] = [];
  for (let i = 0; i < path.length; i++) {
    const seg = path[i];

    if (typeof seg === 'number') {
      // 容器数组（skills/weapons/equipment）下标命中且拿到原条目名时，
      // 直接用条目名替换 "技能/武器/装备" 这一标签，避免「第 2 项技能」这种空泛表达。
      if (i === 1 && itemName && labels.length > 0) {
        labels.pop();
        labels.push(itemName);
        continue;
      }
      const prev = labels.pop() ?? '字段';
      labels.push(`第 ${seg + 1} 项${prev}`);
      continue;
    }
    labels.push(FIELD_LABELS[seg] ?? seg);
  }

  if (labels.length === 1) return labels[0];

  const [head, ...rest] = labels;
  const tail = rest.join('的');

  const isAbbr = (s: string) => /^[A-Z]{2,4}$/.test(s);
  if (rest.length === 1 && isAbbr(rest[0])) return `${head} ${rest[0]}`;

  return `${head}的${tail}`;
}

function describeIssue(issue: ZodIssue): string {
  switch (issue.code) {
    case 'invalid_type':
      if (issue.received === 'undefined' || issue.received === 'null') {
        return '不能为空';
      }
      return `类型应为 ${issue.expected}，收到 ${issue.received}`;

    case 'too_small': {
      const min = issue.minimum;
      if (issue.type === 'string') {
        return min === 1 ? '不能为空' : `至少 ${min} 个字符`;
      }
      if (issue.type === 'array') return `至少需要 ${min} 项`;
      if (issue.type === 'number') {
        return min === 0 ? '不能为负数' : `不能小于 ${min}`;
      }
      return `不能小于 ${min}`;
    }

    case 'too_big': {
      const max = issue.maximum;
      if (issue.type === 'string') return `最多 ${max} 个字符`;
      if (issue.type === 'array') return `最多 ${max} 项`;
      if (issue.type === 'number') return `不能大于 ${max}`;
      return `不能大于 ${max}`;
    }

    case 'invalid_string': {
      return '格式不正确';
    }

    case 'invalid_enum_value':
      return `取值应为 ${issue.options.join(' / ')} 之一`;

    case 'unrecognized_keys':
      return `存在未知字段：${issue.keys.join(', ')}`;

    case 'invalid_literal':
      return `取值必须为 ${issue.expected}`;

    case 'invalid_date':
      return '日期格式不正确';

    case 'not_multiple_of':
      return `必须是 ${issue.multipleOf} 的倍数`;

    case 'custom':
      return issue.message || '不合法';

    default:
      return issue.message || '不合法';
  }
}

export interface FormatCtx {
  /** 原始请求体，用于在数组下标处取条目名（如 skills.0.value → 聆听技能的值）。 */
  root?: unknown;
}

/** 格式化单个 issue 为「字段名：描述」。 */
export function formatZodIssue(issue: ZodIssue, ctx?: FormatCtx): string {
  return `${formatPath(issue.path, ctx)}：${describeIssue(issue)}`;
}

/** 格式化整个 ZodError；多条时换行展示，最多展示前 3 条避免过长。 */
export function formatZodError(err: ZodError, ctx?: FormatCtx): string {
  if (!err.issues?.length) return '请求数据不合法';
  const lines = err.issues.slice(0, 3).map((i) => formatZodIssue(i, ctx));
  if (err.issues.length > 3) {
    lines.push(`（还有 ${err.issues.length - 3} 项错误未显示）`);
  }
  return lines.join('\n');
}

/** 字段级错误：供前端把 path 映射到具体输入框。 */
export interface FieldError {
  /** 点串形式的字段 key，如 'primary.str' / 'skills.0.value'。 */
  key: string;
  /** 字段中文标签（不含错误描述）。 */
  label: string;
  /** 错误描述（不含字段标签）。 */
  message: string;
  /** 原始 path 数组。 */
  path: (string | number)[];
}

export function buildFieldErrors(err: ZodError, ctx?: FormatCtx): FieldError[] {
  if (!err.issues?.length) return [];
  return err.issues.map((issue) => {
    const fullPath = issue.path;
    const label = formatPath(fullPath, ctx);
    return {
      key: fullPath.map(String).join('.'),
      label,
      message: describeIssue(issue),
      path: fullPath,
    };
  });
}