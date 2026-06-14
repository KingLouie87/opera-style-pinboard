'use client';

import { ChangeEvent, useMemo, useState } from 'react';
import { ImagePlus, Loader2, Trash2, Upload, X } from 'lucide-react';
import { Board, Pin } from '@/lib/types';
import { createClient } from '@/lib/supabase/browser';

export function BoardSettingsPanel({ board, pins, onClose, onBoardSaved }: { board: Board; pins: Pin[]; onClose: () => void; onBoardSaved: (board: Board) => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [title, setTitle] = useState(board.title);
  const [description, setDescription] = useState(board.description ?? '');
  const [coverUrl, setCoverUrl] = useState(board.cover_url ?? '');
  const [coverPath, setCoverPath] = useState(board.cover_path ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const pinImages = useMemo(() => pins.filter(pin => pin.image_url).slice(0, 18), [pins]);

  async function uploadCover(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Bitte wähle eine Bilddatei.');
      return;
    }

    setSaving(true);
    setError('');
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setError('Nicht angemeldet.');
      setSaving(false);
      return;
    }

    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${userData.user.id}/boards/${board.id}-${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from('pin-images').upload(path, file, {
      contentType: file.type,
      upsert: false,
      cacheControl: '31536000'
    });

    setSaving(false);
    if (uploadError) {
      setError(uploadError.message);
      return;
    }

    setCoverUrl(`/api/images/${path}`);
    setCoverPath(path);
  }

  async function save() {
    if (!title.trim()) {
      setError('Der Board-Name darf nicht leer sein.');
      return;
    }
    setSaving(true);
    setError('');
    const { data, error: saveError } = await supabase
      .from('boards')
      .update({ title: title.trim(), description: description.trim() || null, cover_url: coverUrl || null, cover_path: coverPath || null })
      .eq('id', board.id)
      .select('*')
      .single();
    setSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }
    if (data) {
      onBoardSaved(data as Board);
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 p-3 backdrop-blur-md md:p-6" role="dialog" aria-modal="true">
      <div className="ml-auto flex h-full w-full max-w-xl flex-col overflow-hidden rounded-[24px] border border-[var(--line-strong)] bg-[var(--panel-strong)] shadow-2xl">
        <header className="flex items-center justify-between border-b border-[var(--line)] p-5">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-[var(--accent)]">Board Settings</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em]">Board bearbeiten</h2>
          </div>
          <button onClick={onClose} className="btn-ghost h-10 w-10"><X size={18} /></button>
        </header>

        <div className="board-scroll flex-1 space-y-5 overflow-y-auto p-5">
          <label className="block text-sm font-medium text-[var(--text-soft)]">
            Board-Name
            <input value={title} onChange={event => setTitle(event.target.value)} className="field mt-2" />
          </label>
          <label className="block text-sm font-medium text-[var(--text-soft)]">
            Beschreibung
            <textarea value={description} onChange={event => setDescription(event.target.value)} rows={4} className="field mt-2 resize-none" />
          </label>

          <div>
            <p className="mb-2 text-sm font-medium text-[var(--text-soft)]">Titelbild</p>
            <div className="grid min-h-48 place-items-center overflow-hidden rounded-[18px] border border-dashed border-[var(--line)] bg-white/[0.04]">
              {coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coverUrl} alt="Board Titelbild" className="h-full min-h-48 w-full object-cover" />
              ) : (
                <div className="text-center text-sm text-[var(--muted)]"><ImagePlus className="mx-auto mb-2" /> Kein Titelbild gewählt</div>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <label className="btn-ghost cursor-pointer px-4 py-2 text-sm font-semibold">
                <Upload size={16} /> Bild hochladen
                <input type="file" accept="image/*" onChange={uploadCover} className="hidden" />
              </label>
              {coverUrl && (
                <button onClick={() => { setCoverUrl(''); setCoverPath(''); }} className="btn-ghost px-4 py-2 text-sm font-semibold text-[var(--danger)]">
                  <Trash2 size={16} /> Entfernen
                </button>
              )}
            </div>
          </div>

          {!!pinImages.length && (
            <div>
              <p className="mb-3 text-sm font-medium text-[var(--text-soft)]">Aus vorhandenen Pin-Bildern wählen</p>
              <div className="grid grid-cols-3 gap-2">
                {pinImages.map(pin => (
                  <button key={pin.id} onClick={() => { setCoverUrl(pin.image_url ?? ''); setCoverPath(pin.image_path ?? ''); }} className="overflow-hidden rounded-[14px] border border-[var(--line)] bg-white/[0.04] transition hover:border-[var(--accent)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={pin.image_url ?? ''} alt="" className="h-24 w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && <p className="rounded-[14px] border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-[var(--line)] p-5">
          <button onClick={onClose} className="btn-ghost px-4 py-3 text-sm font-semibold">Abbrechen</button>
          <button onClick={save} disabled={saving} className="btn-primary px-5 py-3 disabled:opacity-60">
            {saving ? <Loader2 className="animate-spin" size={18} /> : null} Speichern
          </button>
        </footer>
      </div>
    </div>
  );
}
