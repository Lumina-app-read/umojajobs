import { describe, expect, it } from 'vitest';
import { describeDevice } from './device';

describe('describeDevice', () => {
  it('reconnaît le navigateur et le système', () => {
    expect(
      describeDevice(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 Edg/140.0',
      ),
    ).toEqual({ label: 'Edge · Windows', mobile: false });
    expect(
      describeDevice(
        'Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36',
      ),
    ).toEqual({ label: 'Chrome · Android', mobile: true });
  });

  it('renvoie un libellé vide si le User-Agent est absent ou inconnu', () => {
    expect(describeDevice(null)).toEqual({ label: null, mobile: false });
    expect(describeDevice('curl/8.0')).toEqual({ label: null, mobile: false });
  });
});
