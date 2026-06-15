'use client';

import { CSS } from '@dnd-kit/utilities';
import { useSortable } from '@dnd-kit/sortable';
import { FileText, MoreHorizontal, Play } from 'lucide-react';
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

export function PinVisual({ pin, floating = false }: { pin: Pin; floating?: boolean }) {
  const isVideo = pin.media_kind === 'video' || Boolean(youtubeEmbed(pin.url));
  const title = pin.title || pin.source || pin.file_name || 'Unbenannter Pin';
  const description = pin.description?.trim();
  const accent = pin.color || pin.dominant_color || '#8f8a80';
  const tags = (pin.tags ?? []).slice(0, 5);
  const hasLongDescription = Boolean(description && description.split(/\s+/).length > 30);
  const source = formatSource(pin);

  return (
    <div
      className={`pin-visual ${floating ? 'pin-floating' : ''}`}
      style={{ '--pin-accent': accent } as React.CSSProperties}
    >
      <div className={`pin-cover ${pin.image_url ? '' : 'pin-cover-empty'}`} style={{ aspectRatio: pin.aspect_ratio ? `${Math.max(0.72, Math.min(Number(pin.aspect_ratio), 1.35))}` : '4 / 5' }}>
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
        {isVideo && <div className="pin-type-badge"><Play size={12} fill="currentColor" /> Video</div>}

        <div className="pin-content-glass">
          <p className="pin-source">{source}</p>
          <h3 className="pin-title">{title}</h3>
          {description && (
            <p className={`pin-description ${hasLongDescription ? 'pin-description-fade' : ''}`}>{description}</p>
          )}
          {!!tags.length && (
            <div className="pin-tags">
              {tags.map(tag => <span key={tag}>#{tag}</span>)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function PinOverlay({ pin }: { pin: Pin }) {
  return (
    <div className="pointer-events-none w-[252px] animate-[pin-float_.16s_ease-out]">
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
      {...attributes}
      {...listeners}
      onContextMenu={openContext}
      onDoubleClick={() => onOpen?.(pin)}
      className={`pin-card group relative touch-none select-none transition duration-200 ${isDragging ? 'pin-card-placeholder' : ''}`}
      aria-label={pin.title || 'Pin'}
    >
      <PinVisual pin={pin} />

      <div className="pin-actions">
        {isVideo && (
          <button type="button" onPointerDown={stop} onClick={(event) => { stop(event); onPlay?.(pin); }} className="pin-action" aria-label="Video abspielen"><Play size={15} fill="currentColor" /></button>
        )}
        <button type="button" onPointerDown={stop} onClick={(event) => { stop(event); onContext?.(pin, { x: event.currentTarget.getBoundingClientRect().right, y: event.currentTarget.getBoundingClientRect().bottom }); }} className="pin-action" aria-label="Menü"><MoreHorizontal size={15} /></button>
      </div>
    </article>
  );
}
