import { describe, it, expect } from 'vitest';
import {
  computeMov,
  lookupDamageBonus,
  derive,
  isValidPrimary,
  type PrimaryStats,
} from '../src/attributes.js';

const STATS_FULL: PrimaryStats = {
  str: 60, con: 70, siz: 50, dex: 60,
  app: 50, int: 65, pow: 50, edu: 70, luck: 50,
};

describe('attributes', () => {
  describe('computeMov', () => {
    it('basic DEX only for young', () => {
      expect(computeMov(60, 60, 50, 30)).toBe(60);
    });
    it('STR < SIZ reduces mov by 1', () => {
      expect(computeMov(60, 30, 60, 30)).toBe(59);
    });
    it('age 40 reduces by 1', () => {
      expect(computeMov(60, 60, 60, 40)).toBe(59);
    });
    it('age 50 reduces by 2', () => {
      expect(computeMov(60, 60, 60, 50)).toBe(58);
    });
    it('age 80 reduces by 5', () => {
      expect(computeMov(60, 60, 60, 80)).toBe(55);
    });
    it('never below 1', () => {
      expect(computeMov(0, 0, 100, 90)).toBe(1);
    });
  });

  describe('lookupDamageBonus', () => {
    it('correct ranges', () => {
      expect(lookupDamageBonus(2)).toBe('-2');
      expect(lookupDamageBonus(64)).toBe('-2');
      expect(lookupDamageBonus(65)).toBe('-1');
      expect(lookupDamageBonus(84)).toBe('-1');
      expect(lookupDamageBonus(85)).toBe('0');
      expect(lookupDamageBonus(124)).toBe('0');
      expect(lookupDamageBonus(125)).toBe('+1d4');
      expect(lookupDamageBonus(164)).toBe('+1d4');
      expect(lookupDamageBonus(165)).toBe('+1d6');
      expect(lookupDamageBonus(204)).toBe('+1d6');
    });
  });

  describe('derive', () => {
    it('computes all derived stats correctly', () => {
      const d = derive(STATS_FULL, 30);
      expect(d.hpMax).toBe(12);          // ceil((70+50)/10) = 12
      expect(d.mpMax).toBe(10);          // ceil(50/5) = 10
      expect(d.sanMax).toBe(250);        // 50 * 5
      expect(d.build).toBe(110);         // 60 + 50
      expect(d.damageBonus).toBe('0');   // 110 in [85, 124]
      expect(d.mov).toBe(60);
    });

    it('edge: extreme stats', () => {
      const d = derive({ ...STATS_FULL, str: 1, con: 1, siz: 1 }, 20);
      expect(d.hpMax).toBe(1);
      expect(d.mpMax).toBe(10);
      expect(d.build).toBe(2);
      expect(d.damageBonus).toBe('-2');
    });

    it('edge: high stats', () => {
      const d = derive({ ...STATS_FULL, str: 90, con: 90, siz: 90, dex: 90, pow: 90 }, 30);
      expect(d.hpMax).toBe(18);
      expect(d.mpMax).toBe(18);
      expect(d.sanMax).toBe(450);
      expect(d.build).toBe(180);
      expect(d.damageBonus).toBe('+1d6');
    });
  });

  describe('isValidPrimary', () => {
    it('valid', () => {
      expect(isValidPrimary(STATS_FULL)).toBe(true);
    });
    it('rejects out-of-range', () => {
      expect(isValidPrimary({ ...STATS_FULL, str: 0 })).toBe(false);
      expect(isValidPrimary({ ...STATS_FULL, str: 101 })).toBe(false);
    });
    it('rejects non-integer', () => {
      expect(isValidPrimary({ ...STATS_FULL, str: 50.5 })).toBe(false);
    });
  });
});