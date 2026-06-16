'use client';

import { CSS } from '@dnd-kit/utilities';
import { useSortable } from '@dnd-kit/sortable';
import { FileText, GripVertical, MoreHorizontal, Play } from 'lucide-react';
import { youtubeEmbed } from '@/lib/media';
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

function formatSource(pin: Pin) {
  if (pin.source) return pin.source.replace(/^www\./, '');
  if (!pin.url) return pin.category || pin.media_kind || 'Pinboard';
  try {
    return new URL(pin.url).hostname.replace(/^www\./, '');
  } catch {
    return pin.url;
  }
}

function titleForPin(pin: Pin) {
  return pin.title || pin.source || pin.file_name || 'Unbenannter Pin';
}

export function PinVisual({ pin, floating = false }: { pin: Pin; floating?: boolean }) {
  const isVideo = pin.media_kind === 'video' || Boolean(youtubeEmbed(pin.url));
  const title = titleForPin(pin);
  const accent = pin.color || pin.dominant_color || '#8f8a80';
  const source = formatSource(pin);

  return (
    <div
      className={`pin-visual ${floating ? 'pin-floating' : ''}`}
      style={{ '--pin-accent': accent } as React.CSSProperties}
    >
      <div
        className={`pin-cover ${pin.image_url ? '' : 'pin-cover-empty'}`}
        style={{ aspectRatio: pin.aspect_ratio ? `${Math.max(0.72, Math.min(Number(pin.aspect_ratio), 1.12))}` : '4 / 5' }}
      >
        {pin.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pin.image_url} alt="" className="pin-cover-img" draggable={false} />
        ) : (
          <div className="pin-cover-placeholder">
            <FileText size={28} />
            <span>{pin.media_kind || 'pin'}</span>
          </div>
        )}

        <div className="pin-image-vignette" />
        <div className="pin-liquid-shine" />

        {isVideo && <div className="pin-type-badge"><Play size={12} fill="currentColor" /> Video</div>}

        <div className="pin-content-glass">
          <p className="pin-source">{source}</p>
          <h3 className="pin-title">{title}</h3>
        </div>
      </div>
    </div>
  );
}

export function PinOverlay({ pin }: { pin: Pin }) {
  return (
    <div className="pointer-events-none w-[260px] max-w-[72vw] animate-[pin-float_.18s_cubic-bezier(.2,.8,.2,1)]">
      <PinVisual pin={pin} floating />
    </div>
  );
}

export function PinCard({ pin, onOpen, onPlay, onContext }: { pin: Pin } & PinActions) {
  const sortable = useSortable({ id: `pin:${pin.id}` });
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable;
  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  } as React.CSSProperties;
  const isVideo = pin.media_kind === 'video' || Boolean(youtubeEmbed(pin.url));

  function openContext(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    onContext?.(pin, { x: event.clientX, y: event.clientY });
  }

  return (
    <article
      ref={setNodeRef}
      style={style}
      onClick={() => onOpen?.(pin)}
      onContextMenu={openContext}
      className={`pin-card group relative select-none transition duration-200 ${isDragging ? 'pin-card-placeholder' : ''}`}
      aria-label={pin.title || 'Pin'}
    >
      <PinVisual pin={pin} />

      <div className="pin-actions">
        <button
          type="button"
          {...attributes}
          {...listeners}
          onClick={stop}
          className="pin-action pin-drag-handle"
          aria-label="Pin verschieben"
          title="Pin verschieben"
        >
          <GripVertical size={15} />
        </button>
        {isVideo && (
          <button type="button" onPointerDown={stop} onClick={(event) => { stop(event); onPlay?.(pin); }} className="pin-action" aria-label="Video abspielen"><Play size={15} fill="currentColor" /></button>
        )}
        <button type="button" onPointerDown={stop} onClick={(event) => { stop(event); onContext?.(pin, { x: event.currentTarget.getBoundingClientRect().right, y: event.currentTarget.getBoundingClientRect().bottom }); }} className="pin-action" aria-label="Menü"><MoreHorizontal size={15} /></button>
      </div>
    </article>
  );
}
