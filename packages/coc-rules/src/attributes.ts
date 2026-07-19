/**
 * CoC 调查员属性派生计算。
 *
 * 公式以 CoC 7e 常见「十位制」为基础：
 *   HP_max  = ceil((CON + SIZ) / 10)
 *   MP_max  = ceil(POW / 5)
 *   SAN_max = POW * 5
 *   MOV     = DEX（基础）；STR < SIZ 时 -1；按年龄逐级 -1
 *   build   = STR + SIZ
 *   DB      = 根据 build 查表（伤害加成）
 *
 * 注意：
 *   - 所有公式中"十位制"与"个位制"按 CoC 7e 主流占位。
 *   - 实际游戏中 HP 也可能是 (CON+SIZ)/2（个位制）。本项目选择十位制；
 *     如规则书另有规定请改。
 */

export interface PrimaryStats {
  str: number;
  con: number;
  siz: number;
  dex: number;
  app: number;
  int: number;
  pow: number;
  edu: number;
  luck: number;
}

export interface DerivedStats {
  hpMax: number;
  mpMax: number;
  sanMax: number;
  mov: number;
  build: number;
  damageBonus: string;
}

/** MOV 计算：DEX 基础 + STR<SIZ 减一 + 年龄修正 */
export function computeMov(dex: number, str: number, siz: number, age: number): number {
  let mov = dex;
  if (str < siz) mov -= 1;
  if (age >= 80) mov -= 5;
  else if (age >= 70) mov -= 4;
  else if (age >= 60) mov -= 3;
  else if (age >= 50) mov -= 2;
  else if (age >= 40) mov -= 1;
  return Math.max(1, mov);
}

/** 伤害加成表（CoC 7e 占位） */
export function lookupDamageBonus(build: number): string {
  if (build <= 64) return '-2';
  if (build <= 84) return '-1';
  if (build <= 124) return '0';
  if (build <= 164) return '+1d4';
  return '+1d6';
}

export function derive(primary: PrimaryStats, age: number): DerivedStats {
  const build = primary.str + primary.siz;
  const hpMax = Math.ceil((primary.con + primary.siz) / 10);
  const mpMax = Math.ceil(primary.pow / 5);
  const sanMax = primary.pow * 5;
  const mov = computeMov(primary.dex, primary.str, primary.siz, age);
  const damageBonus = lookupDamageBonus(build);
  return { hpMax, mpMax, sanMax, mov, build, damageBonus };
}

/** 八维默认值（3D6 / (2D6+6) / EDU = (2D6+6)*3 占位生成） */
export const DEFAULT_OCCUPATION_POINTS = (edu: number): number => edu * 4;
export const DEFAULT_INTEREST_POINTS = (int: number): number => int * 2;

/**
 * CoC 默认技能初始值（仅给出最常用；其余需要查规则书 TODO(规则书)）
 */
export const DEFAULT_SKILLS: Record<string, number> = {
  '侦查': 25,
  '聆听': 20,
  '潜行': 20,
  '说服': 10,
  '心理学': 10,
  '神秘学': 0,        // 默认 0
  '图书馆使用': 20,
  '急救': 30,
  '攀爬': 20,
  '游泳': 20,
  '跳跃': 20,
  '投掷': 20,
  '驾驶': 20,
  '机械维修': 10,
  '电子学': 0,
  '锁匠': 0,
  '撬锁': 0,
  '格斗': 25,
  '手枪': 20,
  '步枪': 25,
  '霰弹枪': 25,
  '弓术': 15,
  '机枪': 10,
  '重武器': 0,
  '母语': Math.floor(((Math.floor(Math.random() * 6) + Math.floor(Math.random() * 6) + 6) * 5 * 3)), // 占位（运行时注入）
  '法律': 5,
  '会计': 5,
  '人类学': 0,
  '考古学': 0,
  'Cthulhu Mythos': 0,
};

/**
 * 验证八维值合法（CoC 7e 范围）
 */
export function isValidPrimary(p: PrimaryStats): boolean {
  const fields: (keyof PrimaryStats)[] = ['str', 'con', 'siz', 'dex', 'app', 'int', 'pow', 'edu', 'luck'];
  for (const f of fields) {
    if (!Number.isInteger(p[f]) || p[f] < 1 || p[f] > 100) return false;
  }
  return true;
}