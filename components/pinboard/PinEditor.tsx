'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { ImagePlus, Link as LinkIcon, Loader2, Save, X } from 'lucide-react';
import { BoardSection, LinkPreview, Pin } from '@/lib/types';
import { createClient } from '@/lib/supabase/browser';
import { nextPosition } from '@/lib/position';
import { ImagePicker } from './ImagePicker';

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


function normalizeOptionalUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

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
    const url = normalizeOptionalUrl(draft.url);
    if (!url) {
      setPreview(null);
      return;
    }
    setLoadingPreview(true);
    setError('');
    setPreview(null);
    try {
      const response = await fetch('/api/link-preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url })
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
    if (!imageUrl) {
      setDraft(current => ({ ...current, image_url: '', image_path: '' }));
      return;
    }
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
    event.target.value = '';
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
      url: normalizeOptionalUrl(draft.url) || null,
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
      if (draft.image_path) await supabase.from('pin_images').update({ pin_id: data.id }).eq('storage_path', draft.image_path);
      onSaved(data as Pin);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 p-3 backdrop-blur-md md:p-6" role="dialog" aria-modal="true">
      <div className="ml-auto flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-[24px] border border-[var(--line-strong)] bg-[var(--panel-strong)] shadow-2xl">
        <header className="flex items-center justify-between border-b border-[var(--line)] p-5">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-[var(--accent)]">{existingPin ? 'Pin bearbeiten' : 'Neuer Pin'}</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em]">{section.title}</h2>
          </div>
          <button type="button" onClick={onClose} className="btn-ghost h-10 w-10"><X size={18} /></button>
        </header>

        <form onSubmit={savePin} className="board-scroll flex-1 space-y-5 overflow-y-auto p-5">
          <section className="rounded-[18px] border border-[var(--line)] bg-white/[0.035] p-4">
            <p className="mb-3 text-sm font-semibold text-[var(--text-soft)]">Link und Website-Bilder</p>
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <input value={draft.url} onChange={event => setField('url', event.target.value)} placeholder="Link optional einfügen" className="field" />
              <button type="button" onClick={loadPreview} disabled={loadingPreview || !draft.url.trim()} className="btn-ghost px-4 py-3 text-sm font-semibold disabled:opacity-50">
                {loadingPreview ? <Loader2 className="animate-spin" size={18} /> : <LinkIcon size={18} />} Bilder laden
              </button>
            </div>
            {preview && <div className="mt-4"><ImagePicker images={preview.images} selected={draft.image_url} onSelect={chooseRemoteImage} disabled={uploading} /></div>}
          </section>

          <div className="grid gap-5 md:grid-cols-[240px_1fr]">
            <aside className="space-y-3">
              <div className="grid min-h-56 place-items-center overflow-hidden rounded-[18px] border border-dashed border-[var(--line)] bg-white/[0.035]">
                {draft.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={draft.image_url} alt="Pin Bild" className="h-full min-h-56 w-full object-cover" />
                ) : (
                  <div className="text-center text-sm text-[var(--muted)]"><ImagePlus className="mx-auto mb-2" /> Kein Bild</div>
                )}
              </div>
              <label className="btn-ghost block cursor-pointer px-4 py-3 text-center text-sm font-semibold">
                {uploading ? 'Bild wird verarbeitet ...' : 'Eigenes Bild hochladen'}
                <input type="file" accept="image/*" onChange={uploadOwnImage} className="hidden" />
              </label>
              {draft.image_url && <button type="button" onClick={() => setDraft(current => ({ ...current, image_url: '', image_path: '' }))} className="btn-ghost w-full px-4 py-2 text-sm font-semibold text-[var(--danger)]">Bild entfernen</button>}
            </aside>

            <section className="space-y-4">
              <label className="block text-sm font-medium text-[var(--text-soft)]">
                Überschrift
                <input value={draft.title} onChange={event => setField('title', event.target.value)} placeholder="Kurzer, prägnanter Titel" className="field mt-2 text-lg font-semibold" />
              </label>
              <label className="block text-sm font-medium text-[var(--text-soft)]">
                Beschreibung
                <textarea value={draft.description} onChange={event => setField('description', event.target.value)} placeholder="Beschreibung oder kurzer Kontext" rows={5} className="field mt-2 resize-none leading-6" />
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block text-sm font-medium text-[var(--text-soft)]">
                  Tags
                  <input value={draft.tags} onChange={event => setField('tags', event.target.value)} placeholder="Design, Recherche, Wichtig" className="field mt-2" />
                </label>
                <label className="block text-sm font-medium text-[var(--text-soft)]">
                  Status
                  <input value={draft.status} onChange={event => setField('status', event.target.value)} placeholder="Offen, Wichtig, Erledigt" className="field mt-2" />
                </label>
              </div>
              <label className="block text-sm font-medium text-[var(--text-soft)]">
                Dezente Akzentfarbe
                <input value={draft.color} onChange={event => setField('color', event.target.value)} placeholder="#7aa7ff oder leer lassen" className="field mt-2" />
              </label>
              <label className="block text-sm font-medium text-[var(--text-soft)]">
                Interne Notiz
                <textarea value={draft.notes} onChange={event => setField('notes', event.target.value)} placeholder="Nur für dich. Wird auf der Karte gedimmt und kursiv dargestellt." rows={4} className="field mt-2 resize-none italic leading-6" />
              </label>
            </section>
          </div>

          {error && <p className="rounded-[14px] border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}

          <footer className="flex items-center justify-end gap-3 border-t border-[var(--line)] pt-5">
            <button type="button" onClick={onClose} className="btn-ghost px-4 py-3 text-sm font-semibold">Abbrechen</button>
            <button disabled={saving || uploading} className="btn-primary px-5 py-3 disabled:opacity-60">
              {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Speichern
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
