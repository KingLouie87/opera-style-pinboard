'use client';

import { FormEvent, useState } from 'react';
import { ImagePlus, Save, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';
import { RemoteImage } from './RemoteImage';
import { Board, Pin } from '@/lib/types';

async function compressCover(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / bitmap.width);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cover konnte nicht verarbeitet werden.');
  ctx.drawImage(bitmap, 0, 0, width, height);
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('WebP-Konvertierung fehlgeschlagen.')), 'image/webp', .84));
}

export function BoardSettingsPanel({ board, pins, onClose, onSaved }: { board: Board; pins: Pin[]; onClose: () => void; onSaved: (board: Board) => void }) {
  const [title, setTitle] = useState(board.title);
  const [description, setDescription] = useState(board.description ?? '');
  const [coverUrl, setCoverUrl] = useState(board.cover_url ?? '');
  const [coverPath, setCoverPath] = useState(board.cover_path ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const supabase = createClient();
  const pinImages = pins.map(pin => pin.image_url).filter(Boolean).slice(0, 18) as string[];

  async function uploadCover(file: File) {
    setError('');
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    try {
      const blob = await compressCover(file);
      const path = `${userData.user.id}/board-${board.id}-${crypto.randomUUID()}.webp`;
      const { error: uploadError } = await supabase.storage.from('pin-images').upload(path, blob, { contentType: 'image/webp', cacheControl: '31536000' });
      if (uploadError) throw new Error(uploadError.message);
      setCoverUrl(`/api/images/${path}`);
      setCoverPath(path);
    } catch (event) {
      setError(event instanceof Error ? event.message : 'Cover konnte nicht hochgeladen werden.');
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    const { data, error: saveError } = await supabase.from('boards').update({ title: title.trim() || 'Unbenanntes Board', description: description.trim() || null, cover_url: coverUrl || null, cover_path: coverPath || null }).eq('id', board.id).select('*').single();
    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    if (data) onSaved(data as Board);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/62 p-3 backdrop-blur-2xl md:p-6">
      <form onSubmit={save} className="ml-auto flex h-full w-full max-w-2xl flex-col overflow-hidden rounded-[12px] border border-[var(--line-strong)] bg-[var(--panel-strong)] shadow-2xl">
        <header className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
          <div><p className="font-mono text-[10px] uppercase tracking-[0.34em] text-[var(--accent)]">Board Einstellungen</p><h2 className="mt-1 text-2xl font-semibold tracking-[-0.05em]">Darstellung und Details</h2></div>
          <button type="button" onClick={onClose} className="btn-ghost h-10 w-10"><X size={18} /></button>
        </header>
        <main className="board-scroll flex-1 space-y-5 overflow-y-auto p-5">
          <div className="grid min-h-64 place-items-center overflow-hidden rounded-[8px] border border-dashed border-[var(--line)] bg-black/20">
            {coverUrl ? <RemoteImage src={coverUrl} alt="Board Cover" className="h-full min-h-64 w-full object-cover" /> : <div className="text-center text-sm text-[var(--muted)]"><ImagePlus className="mx-auto mb-2" /> Kein Board-Cover</div>}
          </div>
          <div className="grid gap-2 sm:grid-cols-2"><label className="btn-ghost cursor-pointer px-3 py-3 text-center text-sm font-semibold">Cover hochladen<input type="file" accept="image/*" className="hidden" onChange={event => event.target.files?.[0] && uploadCover(event.target.files[0])} /></label><button type="button" onClick={() => { setCoverUrl(''); setCoverPath(''); }} className="btn-ghost px-3 py-3 text-sm font-semibold">Cover entfernen</button></div>
          {!!pinImages.length && <section><p className="mb-2 text-sm font-semibold text-[var(--text-soft)]">Aus Pin-Bildern wählen</p><div className="grid grid-cols-6 gap-2">{pinImages.map(image => <button key={image} type="button" onClick={() => { setCoverUrl(image); setCoverPath(''); }} className="h-16 overflow-hidden rounded-[6px] border border-[var(--line)]"><RemoteImage src={image} alt="" className="h-full w-full object-cover" /></button>)}</div></section>}
          <label className="block text-sm font-medium text-[var(--text-soft)]">Titel<input value={title} onChange={event => setTitle(event.target.value)} className="field mt-2" /></label>
          <label className="block text-sm font-medium text-[var(--text-soft)]">Beschreibung<textarea value={description} onChange={event => setDescription(event.target.value)} className="field mt-2 min-h-24 resize-y" /></label>
          {error && <p className="rounded-[8px] border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
        </main>
        <footer className="flex justify-end gap-2 border-t border-[var(--line)] p-4"><button type="button" onClick={onClose} className="btn-ghost px-4 py-3 text-sm font-semibold">Abbrechen</button><button className="btn-primary px-5 py-3 text-sm" disabled={saving}><Save size={16} /> Speichern</button></footer>
      </form>
    </div>
  );
}
