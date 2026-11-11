import { type ReactNode } from 'react';

/** Rejoué à chaque navigation : le contenu apparaît en douceur (désactivé si mouvement réduit). */
export default function Template({ children }: { children: ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
