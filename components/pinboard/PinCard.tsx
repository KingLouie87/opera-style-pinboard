'use client';

import { CSS } from '@dnd-kit/utilities';
import { useSortable } from '@dnd-kit/sortable';
import { Archive, Copy, Download, ExternalLink, FileText, GripVertical, Pencil, Play, Trash2 } from 'lucide-react';
import { formatBytes, youtubeEmbed } from '@/lib/media';
import { Pin } from '@/lib/types';

export function PinOverlay({ pin }: { pin: Pin }) {
  return (
    <div className="pin-card pointer-events-none w-[250px] overflow-hidden" style={{ '--pin-accent': pin.color || pin.dominant_color || '#8aa4ff' } as React.CSSProperties}>
      {pin.image_url && <div className="h-36 overflow-hidden"><img src={pin.image_url} alt="" className="h-full w-full object-cover" /></div>}
      <div className="space-y-2 p-3">
        <h3 className="line-clamp-2 text-base font-semibold tracking-[-0.035em]">{pin.title || 'Unbenannter Pin'}</h3>
        {pin.description && <p className="line-clamp-2 text-xs text-[var(--muted)]">{pin.description}</p>}
      </div>
    </div>
  );
}

export function PinCard({ pin, onEdit, onDelete, onDuplicate, onArchive, onPlay }: { pin: Pin; onEdit?: (pin: Pin) => void; onDelete?: (pin: Pin) => void; onDuplicate?: (pin: Pin) => void; onArchive?: (pin: Pin) => void; onPlay?: (pin: Pin) => void }) {
  const sortable = useSortable({ id: `pin:${pin.id}` });
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable;
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    '--pin-accent': pin.color || pin.dominant_color || '#8aa4ff'
  } as React.CSSProperties;
  const isVideo = pin.media_kind === 'video' || Boolean(youtubeEmbed(pin.url));
  const hasFile = Boolean(pin.file_path);

  return (
    <article ref={setNodeRef} style={style} className={`pin-card group relative transition duration-200 ${isDragging ? 'scale-[1.025] opacity-40 shadow-2xl' : ''}`}>
      <div className="absolute left-0 top-0 h-full w-[3px] bg-[var(--pin-accent)] opacity-80" />
      {pin.image_url && (
        <div className="relative overflow-hidden bg-black/35" style={{ aspectRatio: pin.aspect_ratio ? `${pin.aspect_ratio}` : '4 / 3' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pin.image_url} alt="" className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.035]" />
          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          <div className="absolute inset-x-2 bottom-2 rounded-[7px] border border-white/12 bg-black/34 p-2.5 text-white backdrop-blur-2xl">
            <p className="line-clamp-2 text-[1rem] font-semibold leading-5 tracking-[-0.035em]">{pin.title || 'Unbenannter Pin'}</p>
            {pin.source && <p className="mt-1 truncate text-[11px] text-white/62">{pin.source}</p>}
          </div>
          {isVideo && (
            <button type="button" onClick={() => onPlay?.(pin)} className="absolute left-1/2 top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[12px] border border-white/20 bg-black/45 text-white shadow-2xl backdrop-blur-xl transition hover:scale-105">
              <Play size={22} fill="currentColor" />
            </button>
          )}
        </div>
      )}

      <div className="space-y-3 p-3.5 pl-4">
        <div className="flex items-start gap-2">
          {<button {...attributes} {...listeners} className="touch-none rounded-[6px] p-1 text-[var(--muted)] hover:bg-white/10 hover:text-white" aria-label="Pin verschieben"><GripVertical size={15} /></button>}
          <div className="min-w-0 flex-1">
            {!pin.image_url && <h3 className="break-words text-[1.04rem] font-semibold leading-6 tracking-[-0.035em]">{pin.title || 'Unbenannter Pin'}</h3>}
            <div className="mt-1 flex flex-wrap gap-1.5">
              {pin.media_kind && <span className="tag-chip uppercase">{pin.media_kind}</span>}
              {pin.category && <span className="tag-chip">{pin.category}</span>}
            </div>
          </div>
        </div>

        {pin.description && <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--text-soft)]">{pin.description}</p>}

        {!!pin.tags?.length && (
          <div className="flex flex-wrap gap-1.5">
            {pin.tags.slice(0, 7).map(tag => <span key={tag} className="tag-chip">#{tag}</span>)}
          </div>
        )}

        {pin.notes && <div className="rounded-[7px] border border-[var(--line)] bg-black/20 px-3 py-2 text-xs italic leading-5 text-[var(--muted)]">{pin.notes}</div>}

        {pin.url && (
          <a href={pin.url} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 rounded-[7px] border border-[var(--line)] bg-black/18 px-2.5 py-2 text-xs text-[var(--text-soft)] transition hover:border-[var(--pin-accent)] hover:text-[var(--text)]">
            <ExternalLink size={13} /><span className="truncate">{pin.source || pin.url}</span>
          </a>
        )}

        {hasFile && (
          <a href={`/api/files/${pin.file_path}`} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 rounded-[7px] border border-[var(--line)] bg-white/[0.045] px-2.5 py-2 text-xs text-[var(--text-soft)] transition hover:text-[var(--text)]">
            <FileText size={14} /><span className="truncate">{pin.file_name || 'Datei'}</span><span className="ml-auto shrink-0 text-[var(--muted)]">{formatBytes(pin.file_size_bytes)}</span><Download size={13} />
          </a>
        )}

        {(
          <div className="flex items-center justify-between pt-1 text-[11px] text-[var(--faint)]">
            <span>{new Date(pin.created_at).toLocaleDateString('de-DE')}</span>
            <div className="flex items-center gap-1 opacity-60 transition group-hover:opacity-100">
              <button onClick={() => onEdit?.(pin)} className="rounded-[6px] p-1.5 hover:bg-white/10 hover:text-[var(--text)]" aria-label="Bearbeiten"><Pencil size={14} /></button>
              <button onClick={() => onDuplicate?.(pin)} className="rounded-[6px] p-1.5 hover:bg-white/10 hover:text-[var(--text)]" aria-label="Duplizieren"><Copy size={14} /></button>
              <button onClick={() => onArchive?.(pin)} className="rounded-[6px] p-1.5 hover:bg-white/10 hover:text-[var(--text)]" aria-label="Archivieren"><Archive size={14} /></button>
              <button onClick={() => onDelete?.(pin)} className="rounded-[6px] p-1.5 hover:bg-red-500/10 hover:text-red-300" aria-label="Löschen"><Trash2 size={14} /></button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
