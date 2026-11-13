'use client';

import { type AiPricesResponse } from '@opportinities/shared';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '@/lib/api/client';

interface StudioAi {
  /** Tarifs fixés par le serveur pour ce document (null tant qu'ils ne sont pas chargés). */
  prices: AiPricesResponse | null;
  /** Solde après la dernière opération payante. */
  setBalance: (balance: number) => void;
}

const StudioAiContext = createContext<StudioAi>({ prices: null, setBalance: () => undefined });

/** Tarifs de l'IA et solde de l'utilisateur, partagés par les actions IA de l'éditeur. */
export function StudioAiProvider({
  documentId,
  children,
}: {
  documentId: string;
  children: ReactNode;
}) {
  const [prices, setPrices] = useState<AiPricesResponse | null>(null);

  useEffect(() => {
    let active = true;
    api
      .get<AiPricesResponse>(`/me/career-documents/${documentId}/ai/prices`)
      .then((value) => active && setPrices(value))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [documentId]);

  const setBalance = useCallback(
    (balance: number) => setPrices((current) => (current ? { ...current, balance } : current)),
    [],
  );

  return (
    <StudioAiContext.Provider value={{ prices, setBalance }}>{children}</StudioAiContext.Provider>
  );
}

export function useStudioAi(): StudioAi {
  return useContext(StudioAiContext);
}
