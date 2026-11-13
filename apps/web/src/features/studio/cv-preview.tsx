'use client';

import { type CvContent } from '@opportinities/shared';
import { useEffect, useRef, useState } from 'react';
import { type CvLabels } from './cv-format';
import { A4_HEIGHT, A4_WIDTH, CvDocument } from './templates';

const PAGE_WIDTH = A4_WIDTH;
const PAGE_HEIGHT = A4_HEIGHT;

/** Aperçu fidèle du CV : même rendu que le futur PDF, à l'échelle du conteneur. */
export function CvPreview({
  content,
  templateKey,
  labels,
  countryName,
  label,
}: {
  content: CvContent;
  templateKey: string;
  labels: CvLabels;
  countryName: string;
  /** Nom accessible de l'aperçu. */
  label: string;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [height, setHeight] = useState(PAGE_HEIGHT);

  useEffect(() => {
    const frame = frameRef.current;
    const page = pageRef.current;
    if (!frame || !page) return undefined;
    const update = () => {
      setScale(Math.min(1, frame.clientWidth / PAGE_WIDTH));
      setHeight(Math.max(PAGE_HEIGHT, page.scrollHeight));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(frame);
    observer.observe(page);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={frameRef} className="w-full" role="region" aria-label={label}>
      <div
        className="relative mx-auto"
        style={{ width: PAGE_WIDTH * scale, height: height * scale }}
      >
        <div
          ref={pageRef}
          className="absolute top-0 left-0 origin-top-left overflow-hidden rounded-[3px] bg-white shadow-[0_1px_3px_rgb(15_23_42/0.12),0_8px_28px_rgb(15_23_42/0.10)] ring-1 ring-black/5"
          style={{ width: PAGE_WIDTH, minHeight: PAGE_HEIGHT, transform: `scale(${scale})` }}
        >
          <CvDocument
            templateKey={templateKey}
            content={content}
            labels={labels}
            countryName={countryName}
          />
        </div>
      </div>
    </div>
  );
}
