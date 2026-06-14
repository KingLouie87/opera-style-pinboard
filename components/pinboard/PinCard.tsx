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

  const tags = pin.tags ?? [];

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`group overflow-hidden rounded-[1.45rem] border border-[var(--line)] bg-white/85 shadow-sm transition dark:bg-white/10 ${isDragging ? 'scale-[1.02] opacity-60 shadow-soft' : 'hover:-translate-y-0.5 hover:shadow-soft'}`}
    >
      {pin.image_url && (
        <button onClick={() => onEdit(pin)} className="block w-full overflow-hidden bg-black/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pin.image_url} alt="" className="h-44 w-full object-cover transition duration-500 group-hover:scale-[1.03]" loading="lazy" />
        </button>
      )}
      <div className="p-4">
        <div className="mb-3 flex items-start justify-between gap-2">
          <button onClick={() => onEdit(pin)} className="text-left">
            <h3 className="line-clamp-2 font-semibold tracking-tight">{pin.title || 'Ohne Titel'}</h3>
          </button>
          <button {...attributes} {...listeners} className="touch-none rounded-xl p-1 text-[var(--muted)] opacity-60 transition hover:bg-black/5 group-hover:opacity-100 dark:hover:bg-white/10" aria-label="Pin verschieben">
            <GripVertical size={17} />
          </button>
        </div>
        {pin.description && <p className="line-clamp-4 text-sm leading-6 text-[var(--muted)]">{pin.description}</p>}
        {pin.url && (
          <a href={pin.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex max-w-full items-center gap-1 truncate text-sm font-medium text-[var(--accent)]">
            <ExternalLink size={14} /> <span className="truncate">{pin.url}</span>
          </a>
        )}
        {tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tags.map(tag => <span key={tag} className="rounded-full bg-black/5 px-2 py-1 text-xs text-[var(--muted)] dark:bg-white/10">#{tag}</span>)}
          </div>
        )}
        <div className="mt-4 flex justify-end gap-1 opacity-60 transition group-hover:opacity-100">
          <button onClick={() => onDuplicate(pin)} className="rounded-xl p-2 hover:bg-black/5 dark:hover:bg-white/10" aria-label="Duplizieren"><Copy size={16} /></button>
          <button onClick={() => onArchive(pin)} className="rounded-xl p-2 hover:bg-black/5 dark:hover:bg-white/10" aria-label="Archivieren"><Archive size={16} /></button>
          <button onClick={() => onEdit(pin)} className="rounded-xl p-2 hover:bg-black/5 dark:hover:bg-white/10" aria-label="Bearbeiten"><Pencil size={16} /></button>
          <button onClick={() => onDelete(pin)} className="rounded-xl p-2 text-red-500 hover:bg-red-500/10" aria-label="Löschen"><Trash2 size={16} /></button>
        </div>
      </div>
    </article>
  );
}
