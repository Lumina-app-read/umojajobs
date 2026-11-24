import { type ReactNode } from 'react';
import { StudioMessages } from '@/features/studio/studio-messages';

/** Section servie avec les messages du Career Studio et des dossiers. */
export default function Layout({ children }: { children: ReactNode }) {
  return <StudioMessages>{children}</StudioMessages>;
}
