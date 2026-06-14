'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { ImagePlus, Link as LinkIcon, Loader2, Save, X } from 'lucide-react';
import { BoardSection, LinkPreview, Pin } from '@/lib/types';
import { createClient } from '@/lib/supabase/browser';
import { nextPosition } from '@/lib/position';

type Draft = {
  title: string;
  description: string;
  url: string;
  image_url: string;
  image_path: string;
  notes: string;
  tags: string;
  status: string;
  color: string;
};

function pinToDraft(pin?: Pin | null): Draft {
  return {
    title: pin?.title ?? '',
    description: pin?.description ?? '',
    url: pin?.url ?? '',
    image_url: pin?.image_url ?? '',
    image_path: pin?.image_path ?? '',
    notes: pin?.notes ?? '',
    tags: (pin?.tags ?? []).join(', '),
    status: pin?.status ?? '',
    color: pin?.color ?? ''
  };
}

export function PinEditor({
  boardId,
  section,
  existingPin,
  existingPins,
  onClose,
  onSaved
}: {
  boardId: string;
  section: BoardSection;
  existingPin?: Pin | null;
  existingPins: Pin[];
  onClose: () => void;
  onSaved: (pin: Pin) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => pinToDraft(existingPin));
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => setDraft(pinToDraft(existingPin)), [existingPin]);

  function setField<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft(current => ({ ...current, [key]: value }));
  }

  async function loadPreview() {
    if (!draft.url.trim()) return;
    setLoadingPreview(true);
    setError('');
    setPreview(null);
    try {
      const response = await fetch('/api/link-preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: draft.url })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? 'Preview konnte nicht geladen werden.');
      setPreview(json);
      setDraft(current => ({
        ...current,
        title: current.title || json.title || '',
        description: current.description || json.description || ''
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview konnte nicht geladen werden.');
    } finally {
      setLoadingPreview(false);
    }
  }

  async function chooseRemoteImage(imageUrl: string) {
    setUploading(true);
    setError('');
    try {
      const response = await fetch('/api/cache-image', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ imageUrl })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? 'Bild konnte nicht gespeichert werden.');
      setDraft(current => ({ ...current, image_url: json.imageUrl, image_path: json.path }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bild konnte nicht gespeichert werden.');
    } finally {
      setUploading(false);
    }
  }

  async function uploadOwnImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Bitte wähle eine Bilddatei aus.');
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      setError('Das Bild ist zu groß. Maximal 6 MB.');
      return;
    }

    setUploading(true);
    setError('');
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setError('Nicht angemeldet.');
      setUploading(false);
      return;
    }

    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${userData.user.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from('pin-images').upload(path, file, {
      contentType: file.type,
      upsert: false,
      cacheControl: '31536000'
    });

    if (uploadError) {
      setError(uploadError.message);
    } else {
      await supabase.from('pin_images').insert({
        user_id: userData.user.id,
        source_type: 'upload',
        storage_path: path,
        mime_type: file.type,
        size_bytes: file.size
      });
      setDraft(current => ({ ...current, image_url: `/api/images/${path}`, image_path: path }));
    }
    setUploading(false);
  }

  async function savePin(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setError('Nicht angemeldet.');
      setSaving(false);
      return;
    }

    const payload = {
      board_id: boardId,
      section_id: section.id,
      user_id: userData.user.id,
      title: draft.title.trim() || null,
      description: draft.description.trim() || null,
      url: draft.url.trim() || null,
      image_url: draft.image_url || null,
      image_path: draft.image_path || null,
      notes: draft.notes.trim() || null,
      tags: draft.tags.split(',').map(tag => tag.trim()).filter(Boolean),
      status: draft.status.trim() || null,
      color: draft.color.trim() || null
    };

    const query = existingPin
      ? supabase.from('pins').update(payload).eq('id', existingPin.id).select('*').single()
      : supabase.from('pins').insert({ ...payload, position: nextPosition(existingPins.filter(pin => pin.section_id === section.id)) }).select('*').single();

    const { data, error: saveError } = await query;
    setSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }
    if (data) {
      if (draft.image_path) {
        await supabase.from('pin_images').update({ pin_id: data.id }).eq('storage_path', draft.image_path);
      }
      onSaved(data as Pin);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/35 p-3 backdrop-blur-sm md:p-6" role="dialog" aria-modal="true">
      <div className="ml-auto flex h-full w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] bg-[var(--panel-strong)] shadow-2xl backdrop-blur-2xl">
        <header className="flex items-center justify-between border-b border-[var(--line)] p-5">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--accent)]">{existingPin ? 'Pin bearbeiten' : 'Neuer Pin'}</p>
            <h2 className="text-2xl font-semibold tracking-tight">{section.title}</h2>
          </div>
          <button onClick={onClose} className="rounded-2xl p-2 hover:bg-black/5 dark:hover:bg-white/10"><X /></button>
        </header>

        <form onSubmit={savePin} className="board-scroll flex-1 space-y-5 overflow-y-auto p-5">
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <input value={draft.url} onChange={event => setField('url', event.target.value)} placeholder="Link einfügen" className="rounded-2xl border border-[var(--line)] bg-white/70 px-4 py-3 outline-none focus:border-[var(--accent)] dark:bg-white/10" />
            <button type="button" onClick={loadPreview} disabled={loadingPreview || !draft.url.trim()} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--line)] px-4 py-3 font-medium hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/10">
              {loadingPreview ? <Loader2 className="animate-spin" size={18} /> : <LinkIcon size={18} />} Preview laden
            </button>
          </div>

          {preview && (
            <div className="rounded-[1.5rem] border border-[var(--line)] bg-white/40 p-4 dark:bg-white/10">
              <p className="mb-3 text-sm font-medium">Bild auswählen</p>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {preview.images.map(image => (
                  <button key={image} type="button" onClick={() => chooseRemoteImage(image)} className="overflow-hidden rounded-2xl border border-[var(--line)] bg-black/5 transition hover:scale-[1.02] hover:border-[var(--accent)]" title={image}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image} alt="" className="h-28 w-full object-cover" />
                  </button>
                ))}
              </div>
              {!preview.images.length && <p className="text-sm text-[var(--muted)]">Keine Bilder gefunden. Du kannst ein eigenes Bild hochladen.</p>}
            </div>
          )}

          <div className="grid gap-5 md:grid-cols-[220px_1fr]">
            <div className="space-y-3">
              <div className="grid min-h-52 place-items-center overflow-hidden rounded-[1.5rem] border border-dashed border-[var(--line)] bg-white/40 dark:bg-white/10">
                {draft.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={draft.image_url} alt="Pin Bild" className="h-full min-h-52 w-full object-cover" />
                ) : (
                  <div className="text-center text-sm text-[var(--muted)]"><ImagePlus className="mx-auto mb-2" /> Kein Bild</div>
                )}
              </div>
              <label className="block cursor-pointer rounded-2xl border border-[var(--line)] px-4 py-3 text-center text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10">
                {uploading ? 'Bild wird verarbeitet ...' : 'Eigenes Bild hochladen'}
                <input type="file" accept="image/*" onChange={uploadOwnImage} className="hidden" />
              </label>
              {draft.image_url && <button type="button" onClick={() => setDraft(current => ({ ...current, image_url: '', image_path: '' }))} className="w-full rounded-2xl px-4 py-2 text-sm text-red-500 hover:bg-red-500/10">Bild entfernen</button>}
            </div>

            <div className="space-y-3">
              <input value={draft.title} onChange={event => setField('title', event.target.value)} placeholder="Überschrift optional" className="w-full rounded-2xl border border-[var(--line)] bg-white/70 px-4 py-3 outline-none focus:border-[var(--accent)] dark:bg-white/10" />
              <textarea value={draft.description} onChange={event => setField('description', event.target.value)} placeholder="Beschreibung optional" rows={4} className="w-full resize-none rounded-2xl border border-[var(--line)] bg-white/70 px-4 py-3 outline-none focus:border-[var(--accent)] dark:bg-white/10" />
              <textarea value={draft.notes} onChange={event => setField('notes', event.target.value)} placeholder="Interne Notiz optional" rows={4} className="w-full resize-none rounded-2xl border border-[var(--line)] bg-white/70 px-4 py-3 outline-none focus:border-[var(--accent)] dark:bg-white/10" />
              <input value={draft.tags} onChange={event => setField('tags', event.target.value)} placeholder="Tags, durch Komma getrennt" className="w-full rounded-2xl border border-[var(--line)] bg-white/70 px-4 py-3 outline-none focus:border-[var(--accent)] dark:bg-white/10" />
              <input value={draft.status} onChange={event => setField('status', event.target.value)} placeholder="Status optional, z. B. Wichtig" className="w-full rounded-2xl border border-[var(--line)] bg-white/70 px-4 py-3 outline-none focus:border-[var(--accent)] dark:bg-white/10" />
            </div>
          </div>

          {error && <p className="rounded-2xl bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300">{error}</p>}

          <footer className="sticky bottom-0 -mx-5 -mb-5 flex justify-end gap-3 border-t border-[var(--line)] bg-[var(--panel-strong)] p-5 backdrop-blur-2xl">
            <button type="button" onClick={onClose} className="rounded-2xl border border-[var(--line)] px-5 py-3 font-medium hover:bg-black/5 dark:hover:bg-white/10">Abbrechen</button>
            <button disabled={saving || uploading} className="inline-flex items-center gap-2 rounded-2xl bg-[var(--accent)] px-5 py-3 font-semibold text-white disabled:opacity-60">
              {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Speichern
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
