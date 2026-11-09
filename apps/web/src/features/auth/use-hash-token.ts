'use client';

import { useSyncExternalStore } from 'react';

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,200}$/;

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

function readToken(): string | null {
  const value = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token');
  return value && TOKEN_PATTERN.test(value) ? value : null;
}

/**
 * Jeton transmis dans le fragment de l'URL (#token=…). Le fragment n'est jamais envoyé aux
 * serveurs : le jeton n'apparaît dans aucun journal d'accès.
 * Valeurs : undefined pendant le rendu serveur et l'hydratation, null si absent.
 */
export function useHashToken(): string | null | undefined {
  return useSyncExternalStore<string | null | undefined>(subscribe, readToken, () => undefined);
}

/** Retire le jeton de la barre d'adresse et de l'historique, une fois utilisé. */
export function clearHashToken(): void {
  if (window.location.hash) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}
