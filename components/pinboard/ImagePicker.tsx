'use client';

import { ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react';
import { useMemo, useState } from 'react';

export function ImagePicker({ images, selected, disabled, onSelect }: { images: string[]; selected: string; disabled?: boolean; onSelect: (url: string) => void }) {
  const unique = useMemo(() => Array.from(new Set(images)).slice(0, 60), [images]);
  const [index, setIndex] = useState(0);
  const active = unique[index];

  if (!unique.length) {
    return <div className="rounded-[8px] border border-dashed border-[var(--line)] bg-white/[0.035] p-4 text-sm text-[var(--muted)]">Keine geeigneten Website-Bilder gefunden.</div>;
  }

  return (
    <div className="image-picker-panel rounded-[8px] border border-[var(--line)] bg-black/20 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-soft)]"><ImageIcon size={16} /> Cover-Auswahl <span className="text-[var(--muted)]">{index + 1}/{unique.length}</span></div>
        <div className="flex gap-1">
          <button type="button" onClick={() => setIndex(current => Math.max(0, current - 1))} disabled={index === 0} className="btn-ghost h-8 w-8 disabled:opacity-40"><ChevronLeft size={16} /></button>
          <button type="button" onClick={() => setIndex(current => Math.min(unique.length - 1, current + 1))} disabled={index === unique.length - 1} className="btn-ghost h-8 w-8 disabled:opacity-40"><ChevronRight size={16} /></button>
        </div>
      </div>
      <button type="button" disabled={disabled || !active} onClick={() => active && onSelect(active)} className={`group relative h-48 w-full overflow-hidden rounded-[8px] border md:h-56 ${selected === active ? 'border-[var(--accent)]' : 'border-[var(--line)]'}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={active} alt="Cover Kandidat" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.035]" />
        <span className="absolute inset-x-3 bottom-3 rounded-[7px] border border-white/15 bg-black/50 px-3 py-2 text-xs font-semibold text-white backdrop-blur-xl">{selected === active ? 'Ausgewählt' : 'Als Cover verwenden'}</span>
      </button>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 board-scroll">
        {unique.map((image, imageIndex) => (
          <button key={image} type="button" onClick={() => setIndex(imageIndex)} className={`h-14 w-20 shrink-0 overflow-hidden rounded-[6px] border ${imageIndex === index ? 'border-[var(--accent)]' : 'border-[var(--line)] opacity-70 hover:opacity-100'}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}
