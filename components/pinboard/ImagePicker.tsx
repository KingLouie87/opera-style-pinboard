'use client';

import { Check, Image as ImageIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { sameImageReference } from '@/lib/remote-image';
import { RemoteImage } from './RemoteImage';

export function ImagePicker({ images, selected, pageUrl, disabled, onSelect }: { images: string[]; selected: string; pageUrl?: string | null; disabled?: boolean; onSelect: (url: string) => void }) {
  const [broken, setBroken] = useState<Set<string>>(() => new Set());
  const unique = useMemo(() => Array.from(new Set(images)).filter(Boolean).slice(0, 60), [images]);
  const visible = unique.filter(image => !broken.has(image));

  if (!unique.length) {
    return <div className="image-picker-empty rounded-[8px] border border-dashed border-[var(--line)] bg-white/[0.035] p-4 text-sm text-[var(--muted)]">Keine geeigneten Website-Bilder gefunden.</div>;
  }

  if (!visible.length) {
    return <div className="image-picker-empty rounded-[8px] border border-dashed border-[var(--line)] bg-white/[0.035] p-4 text-sm text-[var(--muted)]">Die Website liefert Bildadressen, blockiert aber die Vorschau. Du kannst weiterhin ein eigenes Cover hochladen.</div>;
  }

  return (
    <div className="image-picker-panel rounded-[8px] border border-[var(--line)] bg-black/20 p-3">
      <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-[var(--text-soft)]">
          <ImageIcon size={16} />
          <span className="truncate">Cover-Auswahl</span>
          <span className="shrink-0 text-[var(--muted)]">{visible.length} Bilder</span>
        </div>
      </div>
      <div className="image-picker-grid board-scroll" role="listbox" aria-label="Cover-Bild auswählen">
        {visible.map((image) => {
          const isSelected = sameImageReference(selected, image);
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
              <span className="image-picker-loading" aria-hidden="true" />
              <RemoteImage
                src={image}
                pageUrl={pageUrl}
                alt=""
                loading="lazy"
                hideUntilLoaded
                onBroken={() => setBroken(current => new Set(current).add(image))}
              />
              <span className="image-picker-state">{isSelected ? <><Check size={13} /> Ausgewählt</> : 'Verwenden'}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
