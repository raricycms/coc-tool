/**
 * CoC 调查员属性派生计算。
 *
 * 公式以项目自带教程 `docs/技能.md`（简易版）为准：
 *   HP_max  = (CON + SIZ) // 10       （整除）
 *   MP_max  = POW // 5                （整除）
 *   SAN_max = POW                     （与教程一致；不采用 CoC 7e 的 POW×5）
 *   MOV     = 8                       （人类固定；与教程一致）
 *   build   = STR + SIZ
 *   DB      = 根据 build 查表（伤害加成）
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

/** MOV 计算（按教程：人类固定 8）。参数保留以兼容旧调用；忽略。 */
export function computeMov(_dex: number, _str: number, _siz: number, _age: number): number {
  return 8;
}

/** 伤害加成表（教程占位） */
export function lookupDamageBonus(build: number): string {
  if (build <= 64) return '-2';
  if (build <= 84) return '-1';
  if (build <= 124) return '0';
  if (build <= 164) return '+1d4';
  return '+1d6';
}

export function derive(primary: PrimaryStats, _age: number): DerivedStats {
  const build = primary.str + primary.siz;
  const hpMax = Math.floor((primary.con + primary.siz) / 10);
  const mpMax = Math.floor(primary.pow / 5);
  const sanMax = primary.pow;
  const mov = 8;
  const damageBonus = lookupDamageBonus(build);
  return { hpMax, mpMax, sanMax, mov, build, damageBonus };
}

/** 八维默认值（3D6 / (2D6+6) / EDU = (2D6+6)*3 占位生成） */
export const DEFAULT_OCCUPATION_POINTS = (edu: number): number => edu * 4;
export const DEFAULT_INTEREST_POINTS = (int: number): number => int * 2;

/**
 * CoC 默认技能初始值。
 *
 * 来源：`docs/技能.md`（教程）。基础值与教程一致；带「＊」的为父技能
 * （格斗＊、射击＊、科学＊），其下子技能需玩家自行添加。
 *
 * 标记的特殊项（值由公式在调用方注入，不在表中）：
 *   - 母语  = EDU
 *   - 闪避  = DEX / 2
 *   - 克苏鲁知识 初始 0，仅职业允许时可分配
 */
export const DEFAULT_SKILLS: Record<string, number> = {
  '会计': 5,
  '人类学': 1,
  '估价': 5,
  '考古学': 1,
  '技艺（手艺）': 5,
  '魅惑': 15,
  '攀爬': 20,
  '信用评级（财产）': 0,
  '克苏鲁知识': 0,                 // 默认 0，不可分配（除非职业允许）
  '乔装': 5,
  '闪避': 0,                       // 运行时 = DEX / 2，由调用方注入
  '汽车驾驶': 20,
  '电气维修': 10,
  '话术': 5,
  '格斗': 25,                      // 格斗＊：徒手 / 小刀等；其余冷兵器需各自分配
  '射击': 20,                      // 射击＊：手枪 / 步枪/霰弹枪 / 弓弩等需各自分配
  '急救': 30,
  '历史': 5,
  '外语': 1,
  '母语': 0,                       // 运行时 = EDU，由调用方注入
  '法律': 5,
  '图书馆使用': 20,
  '聆听': 20,
  '锁匠': 1,
  '机械维修': 10,
  '医学': 1,
  '博物学': 10,
  '导航': 10,
  '神秘学': 5,
  '操作重型机械': 1,
  '说服': 10,
  '驾驶（专业载具）': 1,
  '精神分析': 1,
  '心理学': 10,
  '骑术': 5,
  '科学': 1,                       // 科学＊：不同学科需各自分配
  '妙手': 10,
  '侦察': 25,
  '潜行': 20,
  '生存': 10,
  '游泳': 20,
  '投掷': 20,
  '追踪': 10,
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