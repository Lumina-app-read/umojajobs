'use client';

import {
  type AiGenerationOptions,
  type AiGenerationResponse,
  type AiPricesResponse,
  ERROR_CODES,
} from '@opportinities/shared';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { randomUuid } from '@/lib/uuid';

interface StudioAi {
  /** Tarifs fixés par le serveur pour ce document (null tant qu'ils ne sont pas chargés). */
  prices: AiPricesResponse | null;
  /** Solde après la dernière opération payante. */
  setBalance: (balance: number) => void;
  /** Toutes les modifications sont enregistrées : l'IA travaille sur le document enregistré. */
  saved: boolean;
  /** Style demandé à l'IA (ton et longueur). */
  options: Required<AiGenerationOptions>;
  setOptions: (options: Required<AiGenerationOptions>) => void;
}

const DEFAULT_OPTIONS: Required<AiGenerationOptions> = { tone: 'formal', length: 'standard' };

const StudioAiContext = createContext<StudioAi>({
  prices: null,
  setBalance: () => undefined,
  saved: false,
  options: DEFAULT_OPTIONS,
  setOptions: () => undefined,
});

/** Tarifs de l'IA, solde et style, partagés par toutes les actions IA de l'éditeur. */
export function StudioAiProvider({
  documentId,
  saved,
  children,
}: {
  documentId: string;
  saved: boolean;
  children: ReactNode;
}) {
  const [prices, setPrices] = useState<AiPricesResponse | null>(null);
  const [options, setOptions] = useState(DEFAULT_OPTIONS);

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
    <StudioAiContext.Provider value={{ prices, setBalance, saved, options, setOptions }}>
      {children}
    </StudioAiContext.Provider>
  );
}

export function useStudioAi(): StudioAi {
  return useContext(StudioAiContext);
}

/** La réponse n'a pas pu être vérifiée (réseau coupé trop longtemps). */
export class GenerationLostError extends Error {
  constructor() {
    super('generation_lost');
    this.name = 'GenerationLostError';
  }
}

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

/**
 * Opération IA payante avec une clé unique. Si la réponse n'arrive pas (réseau coupé, passerelle),
 * l'état réel est d'abord vérifié par la clé, sans jamais relancer ni débiter une seconde fois.
 * Une erreur métier (solde insuffisant, informations manquantes) est renvoyée telle quelle :
 * dans ce cas, rien n'a été débité.
 */
export async function runAiOperation(
  documentId: string,
  path: 'generate' | 'sections' | 'improve',
  body: Record<string, unknown>,
  onChecking?: () => void,
): Promise<AiGenerationResponse> {
  const key = randomUuid();
  const base = `/me/career-documents/${documentId}/ai`;
  try {
    return await api.post<AiGenerationResponse>(`${base}/${path}`, {
      ...body,
      idempotencyKey: key,
    });
  } catch (error) {
    const uncertain =
      error instanceof ApiError &&
      (error.code === 'NETWORK' ||
        (error.status >= 500 && error.code === ERROR_CODES.INTERNAL_ERROR));
    if (!uncertain) throw error;
    onChecking?.();
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await wait(2_000);
      try {
        const status = await api.get<AiGenerationResponse>(`${base}/generations/${key}`);
        if (status.status !== 'pending') return status;
      } catch (check) {
        // Aucune génération enregistrée pour cette clé : rien n'a été débité.
        if (check instanceof ApiError && check.status === 404) throw error;
      }
    }
    throw new GenerationLostError();
  }
}
