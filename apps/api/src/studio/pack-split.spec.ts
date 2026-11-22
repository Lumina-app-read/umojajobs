import { Prisma } from '../generated/prisma/client';
import { splitPack } from './pack-split';

const usd = (value: string) => new Prisma.Decimal(value);

describe('splitPack', () => {
  it('répartit au prorata des tarifs séparés', () => {
    const [cv, letter] = splitPack(25, usd('2.5'), 15, 10);
    expect([cv.credits, letter.credits]).toEqual([15, 10]);
    expect([cv.valueUsd.toString(), letter.valueUsd.toString()]).toEqual(['1.5', '1']);
  });

  it('répartit à parts égales si un tarif manque', () => {
    const [cv, letter] = splitPack(20, usd('2'), null, 10);
    expect([cv.credits, letter.credits]).toEqual([10, 10]);
  });

  it.each([
    [2, '0.2', 100, 1],
    [7, '0.700001', 15, 10],
    [23, '3.333333', 1, 30],
  ])('conserve exactement %i crédits et %s USD', (credits, value, cvCost, letterCost) => {
    const [cv, letter] = splitPack(credits, usd(value), cvCost, letterCost);
    expect(cv.credits).toBeGreaterThanOrEqual(1);
    expect(letter.credits).toBeGreaterThanOrEqual(1);
    expect(cv.credits + letter.credits).toBe(credits);
    expect(cv.valueUsd.add(letter.valueUsd).eq(usd(value))).toBe(true);
  });

  it('refuse un pack de moins de deux crédits', () => {
    expect(() => splitPack(1, usd('0.1'), 15, 10)).toThrow(RangeError);
  });
});
