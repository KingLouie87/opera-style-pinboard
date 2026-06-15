'use client';

import { CSS } from '@dnd-kit/utilities';
import { useSortable } from '@dnd-kit/sortable';
import { Archive, Copy, ExternalLink, GripVertical, Pencil, Trash2 } from 'lucide-react';
import { Pin } from '@/lib/types';

export function PinCard({ pin, onEdit, onDelete, onDuplicate, onArchive }: { pin: Pin; onEdit: (pin: Pin) => void; onDelete: (pin: Pin) => void; onDuplicate: (pin: Pin) => void; onArchive: (pin: Pin) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `pin:${pin.id}` });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  const accentStyle = pin.color ? { borderTopColor: pin.color } : undefined;

  return (
    <article
      ref={setNodeRef}
      style={{ ...style, ...accentStyle }}
      className={`pin-card group overflow-hidden border-t-[3px] border-t-[var(--accent)] transition hover:-translate-y-0.5 ${isDragging ? 'scale-[1.01] opacity-40' : ''}`}
    >
      {pin.image_url && (
        <div className="relative h-40 overflow-hidden bg-black/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pin.image_url} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.035]" />
          <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/70 to-transparent" />
        </div>
      )}

      <div className="space-y-3 p-3.5">
        <div className="flex items-start gap-2">
          <button {...attributes} {...listeners} className="touch-none rounded-[6px] p-1 text-[var(--muted)] hover:bg-white/10 hover:text-white" aria-label="Pin verschieben">
            <GripVertical size={15} />
          </button>
          <div className="min-w-0 flex-1">
            {pin.status && <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">{pin.status}</p>}
            <h3 className="break-words text-[1.02rem] font-semibold leading-6 tracking-[-0.026em] text-white">
              {pin.title || 'Unbenannter Pin'}
            </h3>
          </div>
        </div>

        {pin.description && <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--text-soft)]">{pin.description}</p>}

        {!!pin.tags?.length && (
          <div className="flex flex-wrap gap-1.5">
            {pin.tags.map(tag => (
              <span key={tag} className="tag-chip">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {pin.notes && (
          <div className="rounded-[7px] border border-white/10 bg-black/22 px-3 py-2 text-xs italic leading-5 text-[var(--muted)]">
            {pin.notes}
          </div>
        )}

        {pin.url && (
          <a href={pin.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 truncate rounded-[7px] border border-[var(--line)] bg-black/20 px-3 py-2 text-xs text-[var(--text-soft)] hover:border-[var(--accent)] hover:text-white">
            <ExternalLink size={13} /> <span className="truncate">{pin.url}</span>
          </a>
        )}

        <div className="flex items-center justify-end gap-1 pt-1 opacity-70 transition group-hover:opacity-100">
          <button onClick={() => onEdit(pin)} className="rounded-[6px] p-1.5 text-[var(--muted)] hover:bg-white/10 hover:text-white" aria-label="Bearbeiten"><Pencil size={15} /></button>
          <button onClick={() => onDuplicate(pin)} className="rounded-[6px] p-1.5 text-[var(--muted)] hover:bg-white/10 hover:text-white" aria-label="Duplizieren"><Copy size={15} /></button>
          <button onClick={() => onArchive(pin)} className="rounded-[6px] p-1.5 text-[var(--muted)] hover:bg-white/10 hover:text-white" aria-label="Archivieren"><Archive size={15} /></button>
          <button onClick={() => onDelete(pin)} className="rounded-[6px] p-1.5 text-[var(--muted)] hover:bg-red-500/10 hover:text-red-300" aria-label="Löschen"><Trash2 size={15} /></button>
        </div>
      </div>
    </article>
  );
}
