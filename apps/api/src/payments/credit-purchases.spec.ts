import { extractOrderRef, extractSaleId } from './credit-purchases.service';

describe('lecture des Pulses Chariow', () => {
  it('reconnaît l’identifiant de vente réel et celui de la documentation', () => {
    expect(extractSaleId({ sale: { id: 'SALE467UWGZC9NYMSBG' } })).toBe('SALE467UWGZC9NYMSBG');
    expect(extractSaleId({ data: { sale: { id: 'sal_abc123' } } })).toBe('sal_abc123');
    expect(extractSaleId({ data: { id: 'SALE467UWGZC9NYMSBG' } })).toBe('SALE467UWGZC9NYMSBG');
  });

  it('refuse un identifiant douteux et se replie sur la référence de commande', () => {
    expect(extractSaleId({ sale: { id: '../../admin' } })).toBeNull();
    expect(extractSaleId({})).toBeNull();
    expect(extractOrderRef({ custom_metadata: { order_ref: 'CR-20261112-C8189646' } })).toBe(
      'CR-20261112-C8189646',
    );
    expect(extractOrderRef({ custom_metadata: { order_ref: 'autre' } })).toBeNull();
  });
});
