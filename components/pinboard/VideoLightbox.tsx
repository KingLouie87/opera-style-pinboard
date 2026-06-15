'use client';

import { X } from 'lucide-react';
import { youtubeEmbed } from '@/lib/media';
import { Pin } from '@/lib/types';

export function VideoLightbox({ pin, onClose }: { pin: Pin | null; onClose: () => void }) {
  if (!pin) return null;
  const embed = youtubeEmbed(pin.url);
  const fileUrl = pin.file_path ? `/api/files/${pin.file_path}` : null;
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/78 p-4 backdrop-blur-2xl" onClick={onClose}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(138,164,255,.18),transparent_60%)] hue-rotate-15" />
      <section className="relative z-10 w-full max-w-[min(66vw,1180px)] min-w-[320px] overflow-hidden rounded-[12px] border border-white/14 bg-black shadow-2xl" onClick={event => event.stopPropagation()}>
        <button onClick={onClose} className="btn-ghost absolute right-3 top-3 z-20 h-10 w-10 bg-black/55"><X size={18} /></button>
        <div className="aspect-video w-full bg-black">
          {embed ? (
            <iframe src={embed} className="h-full w-full" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen title={pin.title ?? 'Video'} />
          ) : fileUrl ? (
            <video src={fileUrl} controls autoPlay className="h-full w-full" />
          ) : (
            <div className="grid h-full place-items-center text-[var(--muted)]">Kein Videoplayer verfügbar.</div>
          )}
        </div>
      </section>
    </div>
  );
}
