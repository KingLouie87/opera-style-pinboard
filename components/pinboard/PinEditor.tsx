'use client';

import { FormEvent, useMemo, useState } from 'react';
import { Eye, FileUp, ImagePlus, Link as LinkIcon, Loader2, Pipette, Sparkles, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';
import { autoTags, COLOR_PRESETS, inferMediaKind, normalizeOptionalUrl } from '@/lib/media';
import { sanitizeTags } from '@/lib/tags';
import { nextPosition } from '@/lib/position';
import { BoardSection, LinkPreview, Pin } from '@/lib/types';
import { ImagePicker } from './ImagePicker';

type Draft = {
  title: string;
  description: string;
  url: string;
  image_url: string;
  image_path: string;
  notes: string;
  tags: string;
  category: string;
  source: string;
  color: string;
  dominant_color: string;
  media_kind: string;
  content_type: string;
  file_path: string;
  file_name: string;
  file_mime_type: string;
  file_size_bytes: number | null;
  aspect_ratio: number | null;
  section_id: string | null;
};

function fromPin(pin?: Pin | null, initialUrl?: string, targetSectionId?: string | null): Draft {
  return {
    title: pin?.title ?? '',
    description: pin?.description ?? '',
    url: pin?.url ?? initialUrl ?? '',
    image_url: pin?.image_url ?? '',
    image_path: pin?.image_path ?? '',
    notes: pin?.notes ?? '',
    tags: (pin?.tags ?? []).join(', '),
    category: pin?.category ?? '',
    source: pin?.source ?? '',
    color: pin?.color ?? COLOR_PRESETS[0],
    dominant_color: pin?.dominant_color ?? '',
    media_kind: pin?.media_kind ?? 'webpage',
    content_type: pin?.content_type ?? '',
    file_path: pin?.file_path ?? '',
    file_name: pin?.file_name ?? '',
    file_mime_type: pin?.file_mime_type ?? '',
    file_size_bytes: pin?.file_size_bytes ?? null,
    aspect_ratio: pin?.aspect_ratio ?? null,
    section_id: pin?.section_id ?? targetSectionId ?? null
  };
}

async function compressImageToWebp(file: File): Promise<{ blob: Blob; width: number; height: number; color: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / bitmap.width);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Bild konnte nicht verarbeitet werden.');
  ctx.drawImage(bitmap, 0, 0, width, height);
  const sample = ctx.getImageData(Math.floor(width / 2), Math.floor(height / 2), 1, 1).data;
  const color = `#${[sample[0], sample[1], sample[2]].map(v => v.toString(16).padStart(2, '0')).join('')}`;
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error('WebP-Konvertierung fehlgeschlagen.')), 'image/webp', 0.82));
  return { blob, width, height, color };
}

export function PinEditor({ boardId, sections, targetSectionId, existingPin, existingPins, initialUrl, onClose, onSaved }: {
  boardId: string;
  sections: BoardSection[];
  targetSectionId?: string | null;
  existingPin?: Pin | null;
  existingPins: Pin[];
  initialUrl?: string;
  onClose: () => void;
  onSaved: (pin: Pin) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => fromPin(existingPin, initialUrl, targetSectionId));
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expert, setExpert] = useState(false);
  const [error, setError] = useState('');
  const supabase = createClient();

  const tagList = useMemo(() => sanitizeTags(draft.tags), [draft.tags]);
  const sectionTitle = sections.find(section => section.id === draft.section_id)?.title ?? 'Ohne Bereich';

  function setField<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft(current => ({ ...current, [key]: value }));
  }

  async function loadPreview() {
    const normalized = normalizeOptionalUrl(draft.url);
    if (!normalized) return;
    setLoadingPreview(true);
    setError('');
    try {
      const response = await fetch('/api/link-preview', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: normalized }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Preview fehlgeschlagen.');
      const data = json as LinkPreview;
      setPreview(data);
      const tags = sanitizeTags([...(tagList.length ? tagList : []), ...data.suggestedTags]);
      setDraft(current => ({
        ...current,
        url: data.url,
        title: current.title || data.title || '',
        description: current.description || data.description || '',
        source: current.source || data.source || '',
        media_kind: data.mediaKind,
        content_type: data.contentType || '',
        tags: tags.length ? tags.join(', ') : sanitizeTags(autoTags(`${data.title ?? ''} ${data.description ?? ''}`)).join(', '),
        image_url: current.image_url || data.images[0] || current.image_url
      }));
    } catch (event) {
      setError(event instanceof Error ? event.message : 'Preview fehlgeschlagen. Der Pin kann trotzdem gespeichert werden.');
    } finally {
      setLoadingPreview(false);
    }
  }

  async function chooseRemoteImage(imageUrl: string) {
    setUploading(true);
    setError('');
    try {
      const response = await fetch('/api/cache-image', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ imageUrl }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Bild konnte nicht gespeichert werden.');
      setDraft(current => ({ ...current, image_url: json.image_url, image_path: json.image_path, dominant_color: json.dominant_color || current.dominant_color, color: current.color || json.dominant_color || current.color, aspect_ratio: json.aspect_ratio || current.aspect_ratio }));
    } catch (event) {
      setError(event instanceof Error ? event.message : 'Bild konnte nicht gespeichert werden.');
    } finally {
      setUploading(false);
    }
  }

  async function uploadFile(file: File) {
    setUploading(true);
    setError('');
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setError('Nicht angemeldet.');
      setUploading(false);
      return;
    }

    try {
      if (file.type.startsWith('image/')) {
        const processed = await compressImageToWebp(file);
        const path = `${userData.user.id}/${crypto.randomUUID()}.webp`;
        const { error: uploadError } = await supabase.storage.from('pin-images').upload(path, processed.blob, { contentType: 'image/webp', cacheControl: '31536000' });
        if (uploadError) throw new Error(uploadError.message);
        await supabase.from('pin_images').insert({ user_id: userData.user.id, source_type: 'upload', storage_path: path, mime_type: 'image/webp', size_bytes: processed.blob.size });
        setDraft(current => ({ ...current, image_url: `/api/images/${path}`, image_path: path, dominant_color: processed.color, color: current.color || processed.color, media_kind: 'image', aspect_ratio: processed.width / processed.height }));
      } else {
        const extension = file.name.split('.').pop()?.toLowerCase() || 'bin';
        const path = `${userData.user.id}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from('pin-files').upload(path, file, { contentType: file.type || 'application/octet-stream', cacheControl: '31536000' });
        if (uploadError) throw new Error(uploadError.message);
        setDraft(current => ({ ...current, file_path: path, file_name: file.name, file_mime_type: file.type || 'application/octet-stream', file_size_bytes: file.size, media_kind: inferMediaKind(null, file.type, file.name) }));
      }
    } catch (event) {
      setError(event instanceof Error ? event.message : 'Upload fehlgeschlagen.');
    } finally {
      setUploading(false);
    }
  }

  async function useEyeDropper() {
    const win = window as Window & { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } };
    if (!win.EyeDropper) {
      setError('Die Pipette wird in diesem Browser nicht unterstützt. Nutze alternativ den HEX-Code.');
      return;
    }
    const result = await new win.EyeDropper().open();
    setField('color', result.sRGBHex);
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

    const normalizedUrl = normalizeOptionalUrl(draft.url);
    const hasContent = draft.title.trim() || draft.description.trim() || normalizedUrl || draft.image_url || draft.file_path;
    if (!hasContent) {
      setError('Gib mindestens einen Titel, einen Link, ein Bild oder eine Datei an.');
      setSaving(false);
      return;
    }

    const payload = {
      board_id: boardId,
      section_id: draft.section_id || null,
      user_id: userData.user.id,
      title: draft.title.trim() || null,
      description: draft.description.trim() || null,
      url: normalizedUrl || null,
      image_url: draft.image_url || null,
      image_path: draft.image_path || null,
      notes: draft.notes.trim() || null,
      tags: sanitizeTags(draft.tags),
      category: draft.category.trim() || null,
      source: draft.source.trim() || null,
      color: draft.color.trim() || null,
      dominant_color: draft.dominant_color.trim() || null,
      media_kind: (draft.media_kind || inferMediaKind(normalizedUrl, draft.file_mime_type, draft.file_name)) as Pin['media_kind'],
      content_type: draft.content_type.trim() || null,
      file_path: draft.file_path || null,
      file_name: draft.file_name || null,
      file_mime_type: draft.file_mime_type || null,
      file_size_bytes: draft.file_size_bytes,
      aspect_ratio: draft.aspect_ratio
    };

    const scopePins = existingPins.filter(pin => (pin.section_id ?? null) === (draft.section_id || null));
    const query = existingPin
      ? supabase.from('pins').update(payload).eq('id', existingPin.id).select('*').single()
      : supabase.from('pins').insert({ ...payload, position: nextPosition(scopePins) }).select('*').single();

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
    <div className="modal-backdrop z-50 p-3 md:p-5" role="dialog" aria-modal="true">
      <div className="editor-glass-panel mx-auto my-auto flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-[9px] border border-[var(--line-strong)] shadow-2xl">
        <header className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.34em] text-[var(--accent)]">{existingPin ? 'Pin bearbeiten' : 'Pin hinzufügen'}</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.05em]">{sectionTitle}</h2>
          </div>
          <button type="button" onClick={onClose} className="btn-ghost h-10 w-10"><X size={18} /></button>
        </header>

        <form onSubmit={savePin} className="board-scroll grid flex-1 gap-0 overflow-y-auto lg:grid-cols-[minmax(360px,420px)_1fr]">
          <aside className="border-b border-[var(--line)] p-4 lg:border-b-0 lg:border-r">
            <div className="grid min-h-[320px] place-items-center overflow-hidden rounded-[8px] border border-dashed border-[var(--line)] bg-black/22">
              {draft.image_url ? <img src={draft.image_url} alt="Pin Vorschau" className="h-full min-h-[320px] w-full object-cover" /> : <div className="text-center text-sm text-[var(--muted)]"><ImagePlus className="mx-auto mb-2" /> Kein Cover ausgewählt</div>}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="btn-ghost cursor-pointer px-3 py-3 text-center text-sm font-semibold">
                <FileUp size={16} /> {uploading ? 'Upload läuft ...' : 'Datei hochladen'}
                <input type="file" accept="image/*,video/*,audio/*,.pdf,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx,text/*" className="hidden" onChange={event => event.target.files?.[0] && uploadFile(event.target.files[0])} />
              </label>
              <button type="button" onClick={() => setDraft(current => ({ ...current, image_url: '', image_path: '' }))} className="btn-ghost px-3 py-3 text-sm font-semibold">Cover entfernen</button>
            </div>

            <section className="mt-5 space-y-3">
              <div className="flex items-center justify-between"><p className="text-sm font-semibold text-[var(--text-soft)]">Farbe</p><button type="button" onClick={() => setExpert(!expert)} className="text-xs text-[var(--muted)] hover:text-[var(--text)]">Expertenmodus</button></div>
              <div className="grid grid-cols-10 gap-1.5">
                {COLOR_PRESETS.map(color => <button key={color} type="button" onClick={() => setField('color', color)} className={`h-6 rounded-[5px] border ${draft.color === color ? 'border-white' : 'border-white/10'}`} style={{ background: color }} aria-label={color} />)}
              </div>
              {expert && <div className="grid grid-cols-[auto_1fr_auto] gap-2"><input type="color" value={draft.color || '#8aa4ff'} onChange={event => setField('color', event.target.value)} className="h-10 w-12 rounded-[6px] border border-[var(--line)] bg-transparent" /><input value={draft.color} onChange={event => setField('color', event.target.value)} className="field" placeholder="#8aa4ff" /><button type="button" onClick={useEyeDropper} className="btn-ghost h-10 w-10"><Pipette size={16} /></button></div>}
            </section>
          </aside>

          <main className="space-y-5 p-4 md:p-5">
            <section className="rounded-[8px] border border-[var(--line)] bg-white/[0.035] p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text-soft)]"><LinkIcon size={16} /> Link-Import</div>
              <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                <input value={draft.url} onChange={event => setField('url', event.target.value)} placeholder="Link optional einfügen oder aus dem Browser hineinziehen" className="field" />
                <button type="button" onClick={loadPreview} disabled={loadingPreview || !draft.url.trim()} className="btn-ghost px-4 py-3 text-sm font-semibold disabled:opacity-50">{loadingPreview ? <Loader2 className="animate-spin" size={17} /> : <Sparkles size={17} />} Analysieren</button>
              </div>
              {preview && <div className="mt-4"><ImagePicker images={preview.images} selected={draft.image_url} onSelect={chooseRemoteImage} disabled={uploading} /></div>}
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium text-[var(--text-soft)]">Bereich<select value={draft.section_id ?? ''} onChange={event => setField('section_id', event.target.value || null)} className="field app-select mt-2"><option value="">Ohne Bereich / Inbox</option>{sections.map(section => <option key={section.id} value={section.id}>{section.title}</option>)}</select></label>
              <label className="block text-sm font-medium text-[var(--text-soft)]">Kategorie<input value={draft.category} onChange={event => setField('category', event.target.value)} placeholder="Design, Blender, Hotel ..." className="field mt-2" /></label>
              <label className="block text-sm font-medium text-[var(--text-soft)] md:col-span-2">Überschrift<input value={draft.title} onChange={event => setField('title', event.target.value)} placeholder="Titel des Pins" className="field mt-2 text-lg font-semibold" /></label>
              <label className="block text-sm font-medium text-[var(--text-soft)] md:col-span-2">Beschreibung<textarea value={draft.description} onChange={event => setField('description', event.target.value)} placeholder="Kurzer Kontext, warum dieser Pin wichtig ist" className="field mt-2 min-h-28 resize-y" /></label>
              <label className="block text-sm font-medium text-[var(--text-soft)]">Quelle<input value={draft.source} onChange={event => setField('source', event.target.value)} placeholder="z. B. youtube.com" className="field mt-2" /></label>
              <label className="block text-sm font-medium text-[var(--text-soft)]">Typ<select value={draft.media_kind} onChange={event => setField('media_kind', event.target.value)} className="field app-select mt-2"><option value="webpage">Webseite</option><option value="image">Bild</option><option value="video">Video</option><option value="pdf">PDF</option><option value="audio">Audio</option><option value="file">Datei</option></select></label>
              <label className="block text-sm font-medium text-[var(--text-soft)] md:col-span-2">Tags<input value={draft.tags} onChange={event => setField('tags', event.target.value)} placeholder="3 bis 7 Tags, kommagetrennt" className="field mt-2" /><span className="mt-1 block text-xs text-[var(--muted)]">Aktuell: {tagList.length} Tags. Vorschläge werden beim Link-Import automatisch ergänzt.</span></label>
              <label className="block text-sm font-medium text-[var(--text-soft)] md:col-span-2">Interne Notiz<textarea value={draft.notes} onChange={event => setField('notes', event.target.value)} placeholder="Nur für dich sichtbar, z. B. nächster Schritt oder Kontext" className="field mt-2 min-h-20 resize-y italic" /></label>
            </section>

            {error && <p className="rounded-[8px] border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
            <footer className="flex justify-end gap-2 border-t border-[var(--line)] pt-4"><button type="button" onClick={onClose} className="btn-ghost px-4 py-3 text-sm font-semibold">Abbrechen</button><button disabled={saving || uploading} className="btn-primary px-5 py-3 text-sm">{saving ? 'Speichern ...' : 'Pin speichern'} <Eye size={16} /></button></footer>
          </main>
        </form>
      </div>
    </div>
  );
}
