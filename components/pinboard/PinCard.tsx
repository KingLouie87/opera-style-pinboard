'use client';

import { CSS } from '@dnd-kit/utilities';
import { useSortable } from '@dnd-kit/sortable';
import { Archive, Copy, Download, ExternalLink, FileText, MoreHorizontal, Pencil, Play, Trash2 } from 'lucide-react';
import { formatBytes, youtubeEmbed } from '@/lib/media';
import { Pin } from '@/lib/types';

type PinActions = {
  onOpen?: (pin: Pin) => void;
  onEdit?: (pin: Pin) => void;
  onDelete?: (pin: Pin) => void;
  onDuplicate?: (pin: Pin) => void;
  onArchive?: (pin: Pin) => void;
  onPlay?: (pin: Pin) => void;
  onContext?: (pin: Pin, point: { x: number; y: number }) => void;
};

function stop(event: React.SyntheticEvent) {
  event.stopPropagation();
}

export function PinVisual({ pin, floating = false }: { pin: Pin; floating?: boolean }) {
  const isVideo = pin.media_kind === 'video' || Boolean(youtubeEmbed(pin.url));
  const title = pin.title || pin.source || pin.file_name || 'Unbenannter Pin';
  const description = pin.description?.trim();
  const accent = pin.color || pin.dominant_color || '#7f858d';
  const hasLongDescription = Boolean(description && description.split(/\s+/).length > 34);

  return (
    <div
      className={`pin-visual ${floating ? 'pin-floating' : ''}`}
      style={{ '--pin-accent': accent } as React.CSSProperties}
    >
      <div className="pin-accent-edge" />
      <div className={`pin-cover ${pin.image_url ? '' : 'pin-cover-empty'}`} style={{ aspectRatio: pin.aspect_ratio ? `${Math.max(0.62, Math.min(Number(pin.aspect_ratio), 1.65))}` : '4 / 5' }}>
        {pin.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pin.image_url} alt="" className="pin-cover-img" />
        ) : (
          <div className="pin-cover-placeholder">
            <FileText size={28} />
            <span>{pin.media_kind || 'pin'}</span>
          </div>
        )}

        <div className="pin-cover-shade" />
        {isVideo && <div className="pin-type-badge"><Play size={12} fill="currentColor" /> Video</div>}

        <div className="pin-glass-band">
          <p className="pin-source">{pin.source || pin.category || pin.media_kind || 'Pinboard'}</p>
          <h3 className="pin-title">{title}</h3>
          {description && (
            <p className={`pin-description ${hasLongDescription ? 'pin-description-fade' : ''}`}>{description}</p>
          )}
          {!!pin.tags?.length && (
            <div className="pin-tags">
              {pin.tags.slice(0, 7).map(tag => <span key={tag}>#{tag}</span>)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function PinOverlay({ pin }: { pin: Pin }) {
  return (
    <div className="pointer-events-none w-[248px] animate-[pin-float_.16s_ease-out]">
      <PinVisual pin={pin} floating />
    </div>
  );
}

export function PinCard({ pin, onOpen, onEdit, onDelete, onDuplicate, onArchive, onPlay, onContext }: { pin: Pin } & PinActions) {
  const sortable = useSortable({ id: `pin:${pin.id}` });
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable;
  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  } as React.CSSProperties;
  const isVideo = pin.media_kind === 'video' || Boolean(youtubeEmbed(pin.url));
  const hasFile = Boolean(pin.file_path);

  function openContext(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    onContext?.(pin, { x: event.clientX, y: event.clientY });
  }

  return (
    <article
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onContextMenu={openContext}
      onDoubleClick={() => onOpen?.(pin)}
      className={`pin-card group relative touch-none select-none transition duration-200 ${isDragging ? 'pin-card-placeholder' : ''}`}
    >
      <PinVisual pin={pin} />

      <div className="pin-actions">
        {isVideo && (
          <button type="button" onPointerDown={stop} onClick={(event) => { stop(event); onPlay?.(pin); }} className="pin-action" aria-label="Video abspielen"><Play size={15} fill="currentColor" /></button>
        )}
        <button type="button" onPointerDown={stop} onClick={(event) => { stop(event); onContext?.(pin, { x: event.currentTarget.getBoundingClientRect().right, y: event.currentTarget.getBoundingClientRect().bottom }); }} className="pin-action" aria-label="Menü"><MoreHorizontal size={15} /></button>
      </div>

      <div className="pin-meta-panel">
        {pin.url && (
          <a onPointerDown={stop} onClick={stop} href={pin.url} target="_blank" rel="noreferrer" className="pin-link">
            <ExternalLink size={13} /><span>{pin.source || pin.url}</span>
          </a>
        )}
        {hasFile && (
          <a onPointerDown={stop} onClick={stop} href={`/api/files/${pin.file_path}`} target="_blank" rel="noreferrer" className="pin-link">
            <Download size={13} /><span>{pin.file_name || 'Datei'}</span><em>{formatBytes(pin.file_size_bytes)}</em>
          </a>
        )}
        <div className="pin-footer-row">
          <span>{new Date(pin.created_at).toLocaleDateString('de-DE')}</span>
          <div className="pin-inline-actions">
            <button onPointerDown={stop} onClick={(event) => { stop(event); onOpen?.(pin); }} aria-label="Öffnen"><ExternalLink size={13} /></button>
            <button onPointerDown={stop} onClick={(event) => { stop(event); onEdit?.(pin); }} aria-label="Bearbeiten"><Pencil size={13} /></button>
            <button onPointerDown={stop} onClick={(event) => { stop(event); onDuplicate?.(pin); }} aria-label="Duplizieren"><Copy size={13} /></button>
            <button onPointerDown={stop} onClick={(event) => { stop(event); onArchive?.(pin); }} aria-label="Archivieren"><Archive size={13} /></button>
            <button onPointerDown={stop} onClick={(event) => { stop(event); onDelete?.(pin); }} aria-label="Löschen"><Trash2 size={13} /></button>
          </div>
        </div>
      </div>
    </article>
  );
}
