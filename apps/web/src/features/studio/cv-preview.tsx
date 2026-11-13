'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';
import { A4_HEIGHT, A4_WIDTH } from './templates';

/**
 * Aperçu A4 fidèle d'un document du Studio : la page est dessinée à taille réelle (comme dans le
 * PDF), puis réduite à la largeur disponible.
 */
export function A4Preview({
  label,
  children,
}: {
  /** Nom accessible de l'aperçu. */
  label: string;
  children: ReactNode;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [height, setHeight] = useState(A4_HEIGHT);

  useEffect(() => {
    const frame = frameRef.current;
    const page = pageRef.current;
    if (!frame || !page) return undefined;
    const update = () => {
      // Aperçu masqué (onglet Saisie sur mobile) : largeur nulle, on garde la dernière échelle.
      if (frame.clientWidth === 0) return;
      setScale(Math.min(1, frame.clientWidth / A4_WIDTH));
      setHeight(Math.max(A4_HEIGHT, page.scrollHeight));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(frame);
    observer.observe(page);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={frameRef} className="w-full" role="region" aria-label={label}>
      <div className="relative mx-auto" style={{ width: A4_WIDTH * scale, height: height * scale }}>
        <div
          ref={pageRef}
          className="absolute top-0 left-0 origin-top-left overflow-hidden rounded-[3px] bg-white shadow-[0_1px_3px_rgb(15_23_42/0.12),0_8px_28px_rgb(15_23_42/0.10)] ring-1 ring-black/5"
          style={{ width: A4_WIDTH, minHeight: A4_HEIGHT, transform: `scale(${scale})` }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
