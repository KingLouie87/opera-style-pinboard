'use client';

import { ChevronLeft, ChevronRight, ImagePlus } from 'lucide-react';
import { useMemo, useState } from 'react';

export function ImagePicker({ images, selected, onSelect, disabled }: { images: string[]; selected: string; onSelect: (url: string) => void; disabled?: boolean }) {
  const [index, setIndex] = useState(0);
  const safeImages = useMemo(() => Array.from(new Set(images)).filter(Boolean), [images]);
  const current = safeImages[index] ?? '';

  if (!safeImages.length) {
    return <div className="rounded-[18px] border border-dashed border-[var(--line)] bg-white/[0.035] p-6 text-center text-sm text-[var(--muted)]"><ImagePlus className="mx-auto mb-2" />Keine Website-Bilder gefunden.</div>;
  }

  function move(direction: number) {
    setIndex(currentIndex => (currentIndex + direction + safeImages.length) % safeImages.length);
  }

  return (
    <div className="rounded-[18px] border border-[var(--line)] bg-white/[0.04] p-3">
      <div className="relative overflow-hidden rounded-[14px] bg-black/30">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={current} alt="Website-Bild Vorschau" className="h-56 w-full object-cover" />
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent p-3 text-xs text-white/75">
          <span>{index + 1} / {safeImages.length}</span>
          <span className="max-w-[60%] truncate">{current}</span>
        </div>
        <button type="button" onClick={() => move(-1)} className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur hover:bg-black/65" aria-label="Vorheriges Bild"><ChevronLeft size={20} /></button>
        <button type="button" onClick={() => move(1)} className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur hover:bg-black/65" aria-label="Nächstes Bild"><ChevronRight size={20} /></button>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <button type="button" disabled={disabled} onClick={() => onSelect(current)} className="btn-primary flex-1 px-4 py-2.5 text-sm disabled:opacity-60">
          Dieses Bild verwenden
        </button>
        <button type="button" onClick={() => onSelect('')} className="btn-ghost px-4 py-2.5 text-sm font-semibold">
          Kein Bild
        </button>
      </div>
      <div className="board-scroll mt-3 flex gap-2 overflow-x-auto pb-1">
        {safeImages.map((image, imageIndex) => (
          <button key={image} type="button" onClick={() => setIndex(imageIndex)} className={`h-16 w-20 shrink-0 overflow-hidden rounded-[10px] border ${selected === image || imageIndex === index ? 'border-[var(--accent)]' : 'border-[var(--line)]'} bg-black/30`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}
