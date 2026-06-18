'use client';

import { Check, Image as ImageIcon } from 'lucide-react';
import { useMemo } from 'react';

export function ImagePicker({ images, selected, disabled, onSelect }: { images: string[]; selected: string; disabled?: boolean; onSelect: (url: string) => void }) {
  const unique = useMemo(() => Array.from(new Set(images)).slice(0, 60), [images]);

  if (!unique.length) {
    return <div className="image-picker-empty rounded-[8px] border border-dashed border-[var(--line)] bg-white/[0.035] p-4 text-sm text-[var(--muted)]">Keine geeigneten Website-Bilder gefunden.</div>;
  }

  return (
    <div className="image-picker-panel rounded-[8px] border border-[var(--line)] bg-black/20 p-3">
      <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-[var(--text-soft)]">
          <ImageIcon size={16} />
          <span className="truncate">Cover-Auswahl</span>
          <span className="shrink-0 text-[var(--muted)]">{unique.length} Bilder</span>
        </div>
      </div>
      <div className="image-picker-grid board-scroll" role="listbox" aria-label="Cover-Bild auswählen">
        {unique.map((image) => {
          const isSelected = selected === image;
          return (
            <button
              key={image}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(image)}
              className={`image-picker-tile group ${isSelected ? 'is-selected' : ''}`}
              title={isSelected ? 'Ausgewähltes Cover' : 'Als Cover verwenden'}
              aria-pressed={isSelected}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt="" loading="lazy" />
              <span className="image-picker-state">{isSelected ? <><Check size={13} /> Ausgewählt</> : 'Verwenden'}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
