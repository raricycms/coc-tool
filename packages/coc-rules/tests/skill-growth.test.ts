import { describe, it, expect } from 'vitest';
import { judgeSkillGrowth } from '../src/skill-growth.js';

/**
 * skill-growth 调用 rollDie(100) 然后（成功时）rollDie(10)。
 * 注入的随机源按 (v - 0.5) / sides 公式映射，规避浮点误差。
 */
function makeRng(d100Val: number, d10Val: number = 1): () => number {
  const seq = [
    (d100Val - 0.5) / 100,
    (d10Val  - 0.5) / 10,
  ];
  let i = 0;
  return () => seq[i++ % seq.length];
}

describe('skill-growth', () => {
  it('succeeds when dice <= skillValue and applies +1d10 growth', () => {
    // d100 → 30（<= 50 成功），d10 → 5
    const r = judgeSkillGrowth({ skillValue: 50, random: makeRng(30, 5) });
    expect(r.dice).toBe(30);
    expect(r.succeeded).toBe(true);
    expect(r.growth).toBe(5);
    expect(r.newSkillValue).toBe(55);
  });

  it('fails when dice > skillValue, no growth', () => {
    const r = judgeSkillGrowth({ skillValue: 50, random: makeRng(67) });
    expect(r.dice).toBe(67);
    expect(r.succeeded).toBe(false);
    expect(r.growth).toBe(0);
    expect(r.newSkillValue).toBe(50);
  });

  it('fails automatically at hardCap (95)', () => {
    const r = judgeSkillGrowth({ skillValue: 95, random: makeRng(1) });
    expect(r.succeeded).toBe(false);
    expect(r.growth).toBe(0);
    expect(r.newSkillValue).toBe(95);
  });

  it('throws on invalid skillValue', () => {
    expect(() => judgeSkillGrowth({ skillValue: -1 })).toThrow();
    expect(() => judgeSkillGrowth({ skillValue: 200 })).toThrow();
  });
});