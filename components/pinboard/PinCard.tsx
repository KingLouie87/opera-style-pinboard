'use client';

import { CSS } from '@dnd-kit/utilities';
import { useSortable } from '@dnd-kit/sortable';
import { FileText, GripVertical, MoreHorizontal, Play, Tag } from 'lucide-react';
import { youtubeEmbed } from '@/lib/media';
import { Pin } from '@/lib/types';
import { proxiedImageUrl } from '@/lib/remote-image';

type PinActions = {
  onOpen?: (pin: Pin) => void;
  onEdit?: (pin: Pin) => void;
  onDelete?: (pin: Pin) => void;
  onDuplicate?: (pin: Pin) => void;
  onArchive?: (pin: Pin) => void;
  onPlay?: (pin: Pin) => void;
  onContext?: (pin: Pin, point: { x: number; y: number }) => void;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelected?: (pin: Pin) => void;
};

type PinMode = 'standard' | 'detailed' | 'compact';

function stop(event: React.SyntheticEvent) {
  event.stopPropagation();
}

export function displayDomain(value: string | null | undefined) {
  if (!value) return 'Pinboard';
  try {
    const url = value.includes('://') ? new URL(value) : new URL(`https://${value}`);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return value.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].split('?')[0] || 'Pinboard';
  }
}

function formatSource(pin: Pin) {
  if (pin.source) return displayDomain(pin.source);
  if (pin.url) return displayDomain(pin.url);
  return pin.category || pin.media_kind || 'Pinboard';
}

function titleForPin(pin: Pin) {
  return pin.title || pin.source || pin.file_name || 'Unbenannter Pin';
}

export function PinVisual({ pin, floating = false, mode = 'standard', sectionTitle }: { pin: Pin; floating?: boolean; mode?: PinMode; sectionTitle?: string }) {
  const title = titleForPin(pin);
  const accent = pin.color || pin.dominant_color || '#8f8a80';
  const source = formatSource(pin);
  const focusStyle = { objectPosition: `${pin.cover_focus_x ?? 50}% ${pin.cover_focus_y ?? 50}%` } as React.CSSProperties;

  return (
    <div
      className={`pin-visual pin-visual-${mode} ${floating ? 'pin-floating' : ''}`}
      style={{ '--pin-accent': accent } as React.CSSProperties}
    >
      <div
        className={`pin-cover ${pin.image_url ? '' : 'pin-cover-empty'}`}
        style={{ aspectRatio: mode === 'compact' ? '16 / 9' : pin.aspect_ratio ? `${Math.max(0.78, Math.min(Number(pin.aspect_ratio), 1.16))}` : '4 / 5' }}
      >
        {pin.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={proxiedImageUrl(pin.image_url)} alt="" referrerPolicy="no-referrer" className="pin-cover-img" style={focusStyle} draggable={false} />
        ) : (
          <div className="pin-cover-placeholder">
            <FileText size={28} />
            <span>{pin.media_kind || 'pin'}</span>
          </div>
        )}

        <div className="pin-image-vignette" />
        <div className="pin-title-blur" />
        <div className="pin-liquid-shine" />

        {sectionTitle && mode === 'detailed' && <div className="pin-section-chip"><Tag size={11} /> {sectionTitle}</div>}

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
    <div className="pointer-events-none w-[250px] max-w-[72vw] animate-[pin-float_.18s_cubic-bezier(.2,.8,.2,1)]">
      <PinVisual pin={pin} floating />
    </div>
  );
}

export function PinCard({ pin, onOpen, onPlay, onContext, mode = 'standard', sectionTitle, selectionMode = false, selected = false, onToggleSelected }: { pin: Pin; mode?: PinMode; sectionTitle?: string } & PinActions) {
  const sortable = useSortable({ id: `pin:${pin.id}` });
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable;
  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  } as React.CSSProperties;
  const isVideo = pin.media_kind === 'video' || Boolean(youtubeEmbed(pin.url));
  const domain = displayDomain(pin.url || pin.source);

  function openContext(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    onContext?.(pin, { x: event.clientX, y: event.clientY });
  }

  function activate() {
    if (selectionMode) onToggleSelected?.(pin);
    else onOpen?.(pin);
  }

  if (mode === 'compact') {
    return (
      <article
        ref={setNodeRef}
        style={style}
        onClick={activate}
        onContextMenu={openContext}
        className={`pin-card pin-card-compact group relative select-none transition duration-200 ${isDragging ? 'pin-card-placeholder' : ''} ${selected ? 'pin-card-selected' : ''}`}
        aria-label={pin.title || 'Pin'}
      >
        {selectionMode && <span className={`pin-select-indicator ${selected ? 'selected' : ''}`} aria-hidden="true">{selected ? '✓' : ''}</span>}
        <div className="compact-thumb">
          {pin.image_url ? <img src={proxiedImageUrl(pin.image_url)} alt="" referrerPolicy="no-referrer" style={{ objectPosition: `${pin.cover_focus_x ?? 50}% ${pin.cover_focus_y ?? 50}%` }} draggable={false} /> : <FileText size={18} />}
        </div>
        <div className="compact-pin-copy">
          <strong>{pin.title || pin.file_name || 'Unbenannter Pin'}</strong>
          <span>{domain}</span>
        </div>
        <div className="pin-actions pin-actions-compact">
          <button type="button" {...attributes} {...listeners} onClick={stop} className="pin-action pin-drag-handle" aria-label="Pin verschieben" title="Pin verschieben"><GripVertical size={14} /></button>
          <button type="button" onPointerDown={stop} onClick={(event) => { stop(event); onContext?.(pin, { x: event.currentTarget.getBoundingClientRect().right, y: event.currentTarget.getBoundingClientRect().bottom }); }} className="pin-action" aria-label="Menü"><MoreHorizontal size={14} /></button>
        </div>
      </article>
    );
  }

  return (
    <article
      ref={setNodeRef}
      style={style}
      onClick={activate}
      onContextMenu={openContext}
      className={`pin-card group relative select-none transition duration-200 ${isDragging ? 'pin-card-placeholder' : ''} ${selected ? 'pin-card-selected' : ''}`}
      aria-label={pin.title || 'Pin'}
    >
      {selectionMode && <span className={`pin-select-indicator ${selected ? 'selected' : ''}`} aria-hidden="true">{selected ? '✓' : ''}</span>}
      <PinVisual pin={pin} mode={mode} sectionTitle={sectionTitle} />

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
