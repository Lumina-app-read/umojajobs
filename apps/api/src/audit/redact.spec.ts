import { redact } from './redact';

describe('redact', () => {
  it('masque les secrets à tout niveau et garde le reste', () => {
    expect(
      redact({
        reason: 'Signalements vérifiés',
        password: 'x',
        nested: { accountNumber: '123', payoutReference: 'REF-1', items: [{ otpCode: '1' }] },
      }),
    ).toEqual({
      reason: 'Signalements vérifiés',
      password: '[masqué]',
      nested: {
        accountNumber: '[masqué]',
        payoutReference: 'REF-1',
        items: [{ otpCode: '[masqué]' }],
      },
    });
  });

  it('borne la taille des textes, des listes et de la profondeur', () => {
    expect((redact('a'.repeat(600)) as string).length).toBe(501);
    expect((redact(Array.from({ length: 80 }, (_, index) => index)) as number[]).length).toBe(50);
    expect(redact({ a: { b: { c: { d: { e: 1 } } } } })).toEqual({ a: { b: { c: { d: '[…]' } } } });
  });
});
