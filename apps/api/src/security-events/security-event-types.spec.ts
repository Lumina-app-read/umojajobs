import { SECURITY_EVENT_TYPES } from '@opportinities/shared';
import { SecurityEventType } from '../generated/prisma/client';

describe('types d’événements de sécurité', () => {
  it('la liste partagée correspond exactement à l’énumération de la base', () => {
    expect([...SECURITY_EVENT_TYPES].sort()).toEqual(Object.values(SecurityEventType).sort());
  });
});
