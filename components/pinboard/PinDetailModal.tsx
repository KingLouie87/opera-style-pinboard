'use client';

import { useEffect } from 'react';
import { CalendarDays, Download, ExternalLink, Play, X } from 'lucide-react';
import { formatBytes, youtubeEmbed } from '@/lib/media';
import { Pin } from '@/lib/types';
import { proxiedImageUrl } from '@/lib/remote-image';

export function PinDetailModal({ pin, onClose, onEdit, onPlay }: { pin: Pin; onClose: () => void; onEdit?: (pin: Pin) => void; onPlay?: (pin: Pin) => void }) {
  const isVideo = pin.media_kind === 'video' || Boolean(youtubeEmbed(pin.url));
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const hasImage = Boolean(pin.image_url);

  return (
    <div className="modal-backdrop z-[70]" onMouseDown={onClose} role="dialog" aria-modal="true">
      <article className={`pin-detail-card ${hasImage ? 'pin-detail-card-with-image' : 'pin-detail-card-no-image'}`} onMouseDown={event => event.stopPropagation()} style={{ '--pin-accent': pin.color || pin.dominant_color || '#858585' } as React.CSSProperties}>
        <button type="button" onClick={onClose} className="detail-close" aria-label="Schließen"><X size={18} /></button>
        <div className={`detail-grid min-h-0 ${hasImage ? 'detail-grid-with-image' : 'detail-grid-no-image'}`}>
          {hasImage && (
            <div className="detail-media">
              <img src={proxiedImageUrl(pin.image_url)} alt="" referrerPolicy="no-referrer" style={{ objectPosition: `${pin.cover_focus_x ?? 50}% ${pin.cover_focus_y ?? 50}%` }} />
              {isVideo && <button type="button" onClick={() => onPlay?.(pin)} className="detail-play"><Play size={21} fill="currentColor" /> Video abspielen</button>}
            </div>
          )}
          <div className="detail-content board-scroll">
            <p className="detail-kicker">{pin.source || pin.media_kind || 'Pinboard'}</p>
            <h2>{pin.title || 'Unbenannter Pin'}</h2>
            {pin.description && <p className="detail-description">{pin.description}</p>}
            {!!pin.tags?.length && <div className="detail-tags">{pin.tags.map(tag => <span key={tag}>#{tag}</span>)}</div>}
            <div className="detail-meta">
              <span><CalendarDays size={15} /> {new Date(pin.created_at).toLocaleDateString('de-DE')}</span>
              {pin.category && <span>{pin.category}</span>}
              {pin.media_kind && <span>{pin.media_kind}</span>}
            </div>
            {pin.notes && <div className="detail-note"><strong>Interne Notiz</strong><p>{pin.notes}</p></div>}
            <div className="detail-links">
              {pin.url && <a href={pin.url} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Link öffnen</a>}
              {pin.file_path && <a href={`/api/files/${pin.file_path}`} target="_blank" rel="noreferrer"><Download size={15} /> {pin.file_name || 'Datei'} <em>{formatBytes(pin.file_size_bytes)}</em></a>}
            </div>
            <div className="mt-7 flex justify-end gap-2 border-t border-[var(--line)] pt-4">
              <button type="button" onClick={() => { onClose(); window.setTimeout(() => onEdit?.(pin), 0); }} className="btn-ghost px-4 py-2 text-sm font-semibold">Bearbeiten</button>
              <button type="button" onClick={onClose} className="btn-primary px-4 py-2 text-sm">Schließen</button>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
