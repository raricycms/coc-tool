import { describe, it, expect } from 'vitest';
import { rollDie, rollDice, rollD10, parseDiceExpression, rollExpression, rollExpressionDetailed, randomInt } from '../src/dice.js';

describe('dice', () => {
  describe('rollDie', () => {
    it('returns integer in [1, sides]', () => {
      for (let i = 0; i < 100; i++) {
        const r = rollDie(6);
        expect(Number.isInteger(r)).toBe(true);
        expect(r).toBeGreaterThanOrEqual(1);
        expect(r).toBeLessThanOrEqual(6);
      }
    });

    it('injected rand is used', () => {
      expect(rollDie(6, () => 0.0)).toBe(1);     // floor(0 * 6) + 1 = 1
      expect(rollDie(6, () => 0.999)).toBe(6);
    });

    it('throws on sides < 1', () => {
      expect(() => rollDie(0)).toThrow();
    });
  });

  describe('rollDice', () => {
    it('returns N integers in range', () => {
      const r = rollDice(5, 20);
      expect(r).toHaveLength(5);
      for (const v of r) {
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(20);
      }
    });
  });

  describe('parseDiceExpression', () => {
    it('parses "1d10"', () => {
      const r = parseDiceExpression('1d10');
      expect(r).toHaveLength(1);
    });
    it('parses "2d6+3"', () => {
      expect(parseDiceExpression('2d6+3')).toEqual([0, 0, 3]);
    });
    it('parses "1d6+1d4"', () => {
      expect(parseDiceExpression('1d6+1d4')).toEqual([0, 0]);
    });
    it('rejects bad input', () => {
      expect(parseDiceExpression('')).toBe(null);
      expect(parseDiceExpression('abc')).toBe(null);
      expect(parseDiceExpression('1d')).toBe(null);
    });
    it('handles spaces', () => {
      expect(parseDiceExpression('2d6 + 3')).toEqual([0, 0, 3]);
    });
  });

  describe('rollExpression', () => {
    it('rolls total of expression', () => {
      const total = rollExpression('2d6+3', () => 0.5);  // 4+4+3 = 11
      expect(total).toBe(11);
    });
    it('handles constants', () => {
      expect(rollExpression('5', () => 0)).toBe(5);
    });
  });

  describe('randomInt', () => {
    it('returns integer in range', () => {
      for (let i = 0; i < 50; i++) {
        const r = randomInt(3, 7);
        expect(r).toBeGreaterThanOrEqual(3);
        expect(r).toBeLessThanOrEqual(7);
      }
    });
    it('throws on bad range', () => {
      expect(() => randomInt(5, 3)).toThrow();
    });
  });

  describe('rollExpressionDetailed', () => {
    it('returns total + individual rolls + cleaned expr', () => {
      const r = rollExpressionDetailed('1d6+1d3', () => 0); // 1d6 → 1, 1d3 → 1 → total 2
      expect(r.total).toBe(2);
      expect(r.rolls).toEqual([1, 1]);
      expect(r.expr).toBe('1d6+1d3');
    });

    it('expands multi-dice: 2d6 → 2 entries', () => {
      const r = rollExpressionDetailed('2d6+3', () => 0.5); // 4+4+3 = 11
      expect(r.total).toBe(11);
      expect(r.rolls).toHaveLength(3); // [4, 4, 3]
      expect(r.rolls[0]).toBe(4);
      expect(r.rolls[1]).toBe(4);
      expect(r.rolls[2]).toBe(3);
    });

    it('handles plain number', () => {
      expect(rollExpressionDetailed('5', () => 0)).toEqual({ total: 5, rolls: [5], expr: '5' });
    });

    it('strips whitespace and lowercases', () => {
      const r = rollExpressionDetailed(' 1D6 ', () => 0);
      expect(r.expr).toBe('1d6');
      expect(r.total).toBe(1);
    });

    it('throws on empty / bad token', () => {
      expect(() => rollExpressionDetailed('', () => 0)).toThrow();
      expect(() => rollExpressionDetailed('abc', () => 0)).toThrow();
      expect(() => rollExpressionDetailed('1d', () => 0)).toThrow();
    });
  });
});