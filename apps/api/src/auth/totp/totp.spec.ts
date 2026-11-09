import { base32Decode, base32Encode } from './base32';
import { generateTotpSecret, hotp, timeStep, totp, totpUri, verifyTotp } from './totp';

// Secret des vecteurs de test RFC 4226 / RFC 6238 (SHA-1) : « 12345678901234567890 ».
const RFC_SECRET = Buffer.from('12345678901234567890', 'ascii');
const RFC_SECRET_BASE32 = base32Encode(RFC_SECRET);

describe('Base32 (RFC 4648)', () => {
  it.each([
    ['', ''],
    ['f', 'MY'],
    ['fo', 'MZXQ'],
    ['foo', 'MZXW6'],
    ['foob', 'MZXW6YQ'],
    ['fooba', 'MZXW6YTB'],
    ['foobar', 'MZXW6YTBOI'],
  ])('encode « %s » en « %s » et décode à l’identique', (plain, encoded) => {
    expect(base32Encode(Buffer.from(plain))).toBe(encoded);
    expect(base32Decode(encoded).toString()).toBe(plain);
  });

  it('refuse un caractère invalide', () => {
    expect(() => base32Decode('MZ1W')).toThrow();
  });
});

describe('HOTP (vecteurs RFC 4226, annexe D)', () => {
  const expected = [
    '755224',
    '287082',
    '359152',
    '969429',
    '338314',
    '254676',
    '287922',
    '162583',
    '399871',
    '520489',
  ];
  it.each(expected.map((code, counter) => [counter, code]))('compteur %i → %s', (counter, code) => {
    expect(hotp(RFC_SECRET, counter)).toBe(code);
  });
});

describe('TOTP (vecteurs RFC 6238, annexe B, SHA-1 tronqués à 6 chiffres)', () => {
  it.each([
    [59, '287082'],
    [1111111109, '081804'],
    [1111111111, '050471'],
    [1234567890, '005924'],
    [2000000000, '279037'],
  ])('instant %i s → %s', (seconds, code) => {
    expect(totp(RFC_SECRET_BASE32, seconds * 1000)).toBe(code);
  });
});

describe('verifyTotp', () => {
  const now = 1_800_000_000_000;

  it('accepte le code courant et renvoie son pas de temps', () => {
    expect(verifyTotp(RFC_SECRET_BASE32, totp(RFC_SECRET_BASE32, now), now)).toBe(timeStep(now));
  });

  it('tolère un pas de décalage, pas deux', () => {
    expect(
      verifyTotp(RFC_SECRET_BASE32, totp(RFC_SECRET_BASE32, now - 30_000), now),
    ).not.toBeNull();
    expect(
      verifyTotp(RFC_SECRET_BASE32, totp(RFC_SECRET_BASE32, now + 30_000), now),
    ).not.toBeNull();
    expect(verifyTotp(RFC_SECRET_BASE32, totp(RFC_SECRET_BASE32, now - 60_000), now)).toBeNull();
  });

  it('refuse un format invalide', () => {
    expect(verifyTotp(RFC_SECRET_BASE32, '12345', now)).toBeNull();
    expect(verifyTotp(RFC_SECRET_BASE32, 'abcdef', now)).toBeNull();
  });
});

describe('secret et URI', () => {
  it('génère un secret de 160 bits', () => {
    expect(base32Decode(generateTotpSecret())).toHaveLength(20);
  });

  it('produit une URI otpauth complète', () => {
    const uri = totpUri('JBSWY3DPEHPK3PXP', 'awa@example.test', 'OPPORTINITIES');
    expect(uri).toBe(
      'otpauth://totp/OPPORTINITIES%3Aawa%40example.test?secret=JBSWY3DPEHPK3PXP&issuer=OPPORTINITIES&algorithm=SHA1&digits=6&period=30',
    );
  });
});
