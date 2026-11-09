'use client';

import { useSyncExternalStore } from 'react';
import { THEME_BOOTSTRAP_SCRIPT } from '@/lib/theme';

const noopSubscribe = () => () => undefined;

/**
 * Script anti-flash du thème, exécuté dans le <head> avant le premier affichage.
 * Il n'existe que dans le HTML du serveur (et pendant l'hydratation, pour que le DOM corresponde).
 * Quand la mise en page racine est rendue à nouveau côté navigateur (changement de langue,
 * rechargement à chaud), il n'est pas recréé : React n'exécuterait pas ce script et le signalerait.
 * Le thème est alors déjà appliqué, puis maintenu par le sélecteur de thème.
 */
export function ThemeScript() {
  const serverOrHydrating = useSyncExternalStore(
    noopSubscribe,
    () => false,
    () => true,
  );
  if (!serverOrHydrating) return null;
  return <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />;
}
