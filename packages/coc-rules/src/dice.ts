/**
 * 骰子工具：与 CoC 规则无关的随机数 + 解析工具。
 *
 * NOTE: 使用 Math.random 的版本在测试中可注入确定性源。
 */

export type RandomFn = () => number;

const defaultRandom: RandomFn = () => Math.random();

/** 投 1dN */
export function rollDie(sides: number, rand: RandomFn = defaultRandom): number {
  if (sides < 1) throw new Error('sides must be >= 1');
  return Math.floor(rand() * sides) + 1;
}

/** 投 NdN（可投多个骰子） */
export function rollDice(count: number, sides: number, rand: RandomFn = defaultRandom): number[] {
  if (count < 1) throw new Error('count must be >= 1');
  if (sides < 1) throw new Error('sides must be >= 1');
  return Array.from({ length: count }, () => rollDie(sides, rand));
}

/** 投 1d10（CoC 基础骰） */
export function rollD10(rand: RandomFn = defaultRandom): number {
  return rollDie(10, rand);
}

/**
 * 解析骰子表达式：
 *   "1d10"     → [10]
 *   "2d6+1"    → [6, 6, 1]
 *   "1d6+1d4"  → [4, 3]
 *   "3"        → [3]
 * 失败返回 null。
 */
export function parseDiceExpression(expr: string): number[] | null {
  if (!expr || typeof expr !== 'string') return null;
  const cleaned = expr.replace(/\s+/g, '').toLowerCase();
  if (!cleaned) return null;
  const flat: number[] = [];
  // 支持 N 或 N+M 或 N+M 或 N+dN 或 NdN+M+... 等
  const tokens = cleaned.split('+');
  for (const t of tokens) {
    if (t.includes('d')) {
      const m = t.match(/^(\d+)d(\d+)$/);
      if (!m) return null;
      const count = parseInt(m[1], 10);
      const sides = parseInt(m[2], 10);
      if (count < 1 || count > 1000) return null;
      if (sides < 1 || sides > 1000) return null;
      for (let i = 0; i < count; i++) flat.push(0); // 占位（具体值由调用方掷）
    } else if (/^\d+$/.test(t)) {
      flat.push(parseInt(t, 10));
    } else {
      return null;
    }
  }
  return flat;
}

/**
 * 投一个骰子表达式，返回总和。
 * 例：rollExpression("2d6+3") = 投两个 6 面骰 + 3。
 */
export function rollExpression(expr: string, rand: RandomFn = defaultRandom): number {
  const tokens = expr.replace(/\s+/g, '').toLowerCase().split('+');
  let total = 0;
  for (const t of tokens) {
    if (t.includes('d')) {
      const m = t.match(/^(\d+)d(\d+)$/);
      if (!m) throw new Error(`bad dice token: ${t}`);
      total += rollDice(parseInt(m[1], 10), parseInt(m[2], 10), rand).reduce((a, b) => a + b, 0);
    } else if (/^\d+$/.test(t)) {
      total += parseInt(t, 10);
    } else {
      throw new Error(`bad dice token: ${t}`);
    }
  }
  return total;
}

/**
 * 同 rollExpression，但额外返回每一次投骰的个体值，便于日志展示。
 *
 *   rollExpressionDetailed("1d6+1d3")  → { total: 6, rolls: [4, 2], expr: "1d6+1d3" }
 *   rollExpressionDetailed("3")        → { total: 3, rolls: [3],     expr: "3" }
 *
 * 表达式解析失败时抛 Error（让上层决定怎么处理）。
 */
export interface DiceRollResult {
  total: number;
  rolls: number[];
  expr: string;
}
export function rollExpressionDetailed(expr: string, rand: RandomFn = defaultRandom): DiceRollResult {
  const cleaned = expr.replace(/\s+/g, '').toLowerCase();
  if (!cleaned) throw new Error('empty dice expression');
  const tokens = cleaned.split('+');
  const rolls: number[] = [];
  let total = 0;
  for (const t of tokens) {
    if (t.includes('d')) {
      const m = t.match(/^(\d+)d(\d+)$/);
      if (!m) throw new Error(`bad dice token: ${t}`);
      const count = parseInt(m[1], 10);
      const sides = parseInt(m[2], 10);
      if (count < 1 || count > 1000) throw new Error(`bad dice count: ${count}`);
      if (sides < 1 || sides > 1000) throw new Error(`bad dice sides: ${sides}`);
      const r = rollDice(count, sides, rand);
      rolls.push(...r);
      total += r.reduce((a, b) => a + b, 0);
    } else if (/^\d+$/.test(t)) {
      const v = parseInt(t, 10);
      rolls.push(v);
      total += v;
    } else {
      throw new Error(`bad dice token: ${t}`);
    }
  }
  return { total, rolls, expr: cleaned };
}

/** 整数范围内随机（含 min / max） */
export function randomInt(min: number, max: number, rand: RandomFn = defaultRandom): number {
  if (max < min) throw new Error('max must be >= min');
  return Math.floor(rand() * (max - min + 1)) + min;
}

/** SHA-256（Web Crypto API） */
export async function sha256(text: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('Web Crypto API is unavailable');
  const buf = await subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}