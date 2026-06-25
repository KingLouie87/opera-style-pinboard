'use client';

import { FormEvent, type ClipboardEvent, type DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Eye, FileUp, ImagePlus, Link as LinkIcon, Loader2, Pipette, Sparkles, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';
import { autoTags, COLOR_PRESETS, inferMediaKind, normalizeOptionalUrl } from '@/lib/media';
import { proxiedImageUrl } from '@/lib/remote-image';
import { sanitizeTags } from '@/lib/tags';
import { nextPosition } from '@/lib/position';
import { Board, BoardSection, LinkPreview, Pin } from '@/lib/types';
import { ImagePicker } from './ImagePicker';
import { PinDestinationSelector } from './PinDestinationSelector';

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
  cover_focus_x: number | null;
  cover_focus_y: number | null;
  section_id: string | null;
};

function fromPin(pin?: Pin | null, initialUrl?: string, targetSectionId?: string | null, initialTitle?: string, initialDescription?: string, initialImageUrl?: string): Draft {
  return {
    title: pin?.title ?? initialTitle ?? '',
    description: pin?.description ?? initialDescription ?? '',
    url: pin?.url ?? initialUrl ?? '',
    image_url: pin?.image_url ?? initialImageUrl ?? '',
    image_path: pin?.image_path ?? '',
    notes: pin?.notes ?? '',
    tags: (pin?.tags ?? []).join(', '),
    category: pin?.category ?? '',
    source: pin?.source ?? '',
    color: pin?.color ?? COLOR_PRESETS[0],
    dominant_color: pin?.dominant_color ?? '',
    media_kind: pin?.media_kind ?? (initialImageUrl && !initialUrl ? 'image' : 'webpage'),
    content_type: pin?.content_type ?? '',
    file_path: pin?.file_path ?? '',
    file_name: pin?.file_name ?? '',
    file_mime_type: pin?.file_mime_type ?? '',
    file_size_bytes: pin?.file_size_bytes ?? null,
    aspect_ratio: pin?.aspect_ratio ?? null,
    cover_focus_x: pin?.cover_focus_x ?? 50,
    cover_focus_y: pin?.cover_focus_y ?? 50,
    section_id: pin?.section_id ?? targetSectionId ?? null
  };
}

type ProcessedCover = { blob: Blob; width: number; height: number; color: string; focusX: number; focusY: number };

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 50;
  return Math.max(8, Math.min(92, Math.round(value)));
}

function analyzeCanvasFocus(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const sampleWidth = Math.max(24, Math.min(96, width));
  const sampleHeight = Math.max(24, Math.min(96, height));
  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = sampleWidth;
  sampleCanvas.height = sampleHeight;
  const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
  if (!sampleCtx) return { x: 50, y: 50 };
  sampleCtx.drawImage(ctx.canvas, 0, 0, sampleWidth, sampleHeight);
  const pixels = sampleCtx.getImageData(0, 0, sampleWidth, sampleHeight).data;
  let weightedX = 0;
  let weightedY = 0;
  let total = 0;

  const luminanceAt = (x: number, y: number) => {
    const index = (y * sampleWidth + x) * 4;
    return 0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2];
  };

  for (let y = 1; y < sampleHeight - 1; y += 1) {
    for (let x = 1; x < sampleWidth - 1; x += 1) {
      const index = (y * sampleWidth + x) * 4;
      const r = pixels[index];
      const g = pixels[index + 1];
      const b = pixels[index + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const saturation = max - min;
      const edge = Math.abs(luminanceAt(x + 1, y) - luminanceAt(x - 1, y)) + Math.abs(luminanceAt(x, y + 1) - luminanceAt(x, y - 1));
      const nx = x / (sampleWidth - 1);
      const ny = y / (sampleHeight - 1);
      const centerBias = 1 - Math.min(0.72, Math.hypot(nx - 0.5, ny - 0.42));
      const upperProductBias = 1 + Math.max(0, 0.55 - ny) * 0.22;
      const score = Math.max(0, edge * 1.15 + saturation * 0.32) * Math.max(0.35, centerBias) * upperProductBias;
      if (score > 0) {
        weightedX += nx * score;
        weightedY += ny * score;
        total += score;
      }
    }
  }

  if (total <= 0) return { x: 50, y: 50 };
  return { x: clampPercent((weightedX / total) * 100), y: clampPercent((weightedY / total) * 100) };
}

async function compressImageToWebp(file: File): Promise<ProcessedCover> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / bitmap.width);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Bild konnte nicht verarbeitet werden.');
  ctx.drawImage(bitmap, 0, 0, width, height);
  const focus = analyzeCanvasFocus(ctx, width, height);
  const sample = ctx.getImageData(Math.floor(width / 2), Math.floor(height / 2), 1, 1).data;
  const color = `#${[sample[0], sample[1], sample[2]].map(v => v.toString(16).padStart(2, '0')).join('')}`;
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error('WebP-Konvertierung fehlgeschlagen.')), 'image/webp', 0.82));
  return { blob, width, height, color, focusX: focus.x, focusY: focus.y };
}

export function PinEditor({ boardId, boards = [], sections, allSections, targetSectionId, existingPin, existingPins, allPins, initialUrl, initialTitle, initialDescription, initialImageUrl, allowBoardChange = false, onDestinationChange, onClose, onSaved }: {
  boardId: string;
  boards?: Board[];
  sections: BoardSection[];
  allSections?: BoardSection[];
  targetSectionId?: string | null;
  existingPin?: Pin | null;
  existingPins: Pin[];
  allPins?: Pin[];
  initialUrl?: string;
  initialTitle?: string;
  initialDescription?: string;
  initialImageUrl?: string;
  allowBoardChange?: boolean;
  onDestinationChange?: (boardId: string, sectionId: string | null) => void;
  onClose: () => void;
  onSaved: (pin: Pin) => void;
}) {
  const [selectedBoardId, setSelectedBoardId] = useState(existingPin?.board_id ?? boardId);
  const [draft, setDraft] = useState<Draft>(() => fromPin(existingPin, initialUrl, targetSectionId, initialTitle, initialDescription, initialImageUrl));
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expert, setExpert] = useState(false);
  const [error, setError] = useState('');
  const [coverDragActive, setCoverDragActive] = useState(false);
  const supabase = createClient();
  const lastAnalyzedUrl = useRef('');
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const availableBoards = useMemo(() => boards.length ? boards : [], [boards]);
  const destinationSections = useMemo(() => (allSections ?? sections).filter(section => section.board_id === selectedBoardId), [allSections, sections, selectedBoardId]);
  const destinationPins = useMemo(() => (allPins ?? existingPins).filter(pin => pin.board_id === selectedBoardId), [allPins, existingPins, selectedBoardId]);
  const tagList = useMemo(() => sanitizeTags(draft.tags), [draft.tags]);
  const sectionTitle = destinationSections.find(section => section.id === draft.section_id)?.title ?? 'Ohne Bereich';
  const LAST_BOARD_KEY = 'pinboard-last-capture-board';
  const sectionKey = (nextBoardId: string) => `pinboard-last-capture-section:${nextBoardId}`;

  function setField<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft(current => ({ ...current, [key]: value }));
  }

  function chooseDestinationBoard(nextBoardId: string) {
    if (!nextBoardId || nextBoardId === selectedBoardId) return;
    setSelectedBoardId(nextBoardId);
    let nextSectionId: string | null = null;
    try {
      const stored = localStorage.getItem(sectionKey(nextBoardId));
      if (stored && (allSections ?? sections).some(section => section.id === stored && section.board_id === nextBoardId)) nextSectionId = stored;
    } catch {}
    setField('section_id', nextSectionId);
    onDestinationChange?.(nextBoardId, nextSectionId);
  }

  function chooseDestinationSection(sectionId: string | null) {
    const valid = sectionId ? destinationSections.some(section => section.id === sectionId) : true;
    const next = valid ? sectionId : null;
    setField('section_id', next);
    onDestinationChange?.(selectedBoardId, next);
  }

  useEffect(() => {
    if (!existingPin && boardId && boardId !== selectedBoardId) setSelectedBoardId(boardId);
  }, [boardId, existingPin, selectedBoardId]);

  useEffect(() => {
    if (!selectedBoardId) return;
    const validSection = !draft.section_id || destinationSections.some(section => section.id === draft.section_id);
    if (!validSection) setField('section_id', null);
  }, [selectedBoardId, destinationSections, draft.section_id]);

  function handleUrlChange(value: string) {
    setField('url', value);
  }

  function handleUrlPaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData('text');
    const normalized = normalizeOptionalUrl(pasted);
    if (!normalized) return;
    event.preventDefault();
    if (previewTimer.current) clearTimeout(previewTimer.current);
    setField('url', normalized);
    void loadPreview(normalized);
  }

  async function cacheRemoteImage(imageUrl: string) {
    try {
      const response = await fetch('/api/cache-image', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ imageUrl }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Bild konnte nicht gespeichert werden.');
      setDraft(current => ({
        ...current,
        image_url: json.image_url || current.image_url || imageUrl,
        image_path: json.image_path || current.image_path,
        dominant_color: json.dominant_color || current.dominant_color,
        color: json.dominant_color || current.color,
        aspect_ratio: json.aspect_ratio || current.aspect_ratio,
        cover_focus_x: json.cover_focus_x ?? current.cover_focus_x ?? 50,
        cover_focus_y: json.cover_focus_y ?? current.cover_focus_y ?? 50
      }));
    } catch {
      setDraft(current => current.image_url ? current : { ...current, image_url: proxiedImageUrl(imageUrl), image_path: '' });
    }
  }

  async function loadPreview(urlOverride?: string) {
    const normalized = normalizeOptionalUrl(urlOverride ?? draft.url);
    if (!normalized) return;
    lastAnalyzedUrl.current = normalized;
    setLoadingPreview(true);
    setError('');
    try {
      const response = await fetch('/api/link-preview', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: normalized }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Preview fehlgeschlagen.');
      const data = json as LinkPreview;
      const previewImages = Array.from(new Set([...(Array.isArray(data.images) ? data.images : []), ...(initialImageUrl ? [initialImageUrl] : [])]));
      const nextPreview = { ...data, images: previewImages };
      setPreview(nextPreview);
      const tags = sanitizeTags([...(tagList.length ? tagList : []), ...(data.suggestedTags ?? [])]);
      setDraft(current => ({
        ...current,
        url: data.url,
        title: current.title || data.title || '',
        description: current.description || data.description || '',
        source: current.source || data.source || '',
        media_kind: data.mediaKind,
        content_type: data.contentType || '',
        tags: current.tags || (tags.length ? tags.join(', ') : sanitizeTags(autoTags(`${data.title ?? ''} ${data.description ?? ''}`)).join(', ')),
        image_url: current.image_url || (previewImages[0] ? proxiedImageUrl(previewImages[0]) : '') || current.image_url
      }));
      if (previewImages[0] && !draft.image_url) void cacheRemoteImage(previewImages[0]);
    } catch (event) {
      const fallbackDomain = (() => {
        try { return new URL(normalized).hostname.replace(/^www\./, ''); } catch { return ''; }
      })();
      setDraft(current => ({
        ...current,
        url: normalized,
        source: current.source || fallbackDomain,
        title: current.title || fallbackDomain || current.title
      }));
      setError(event instanceof Error ? `${event.message} Der Pin kann trotzdem gespeichert werden.` : 'Preview fehlgeschlagen. Der Pin kann trotzdem gespeichert werden.');
    } finally {
      setLoadingPreview(false);
    }
  }

  useEffect(() => {
    const normalized = normalizeOptionalUrl(draft.url);
    if (!normalized || normalized === lastAnalyzedUrl.current) return;
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => {
      void loadPreview(normalized);
    }, 550);
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
  }, [draft.url]);

  async function chooseRemoteImage(imageUrl: string) {
    setUploading(true);
    setError('');
    try {
      const response = await fetch('/api/cache-image', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ imageUrl }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Bild konnte nicht gespeichert werden.');
      setDraft(current => ({ ...current, image_url: json.image_url, image_path: json.image_path, dominant_color: json.dominant_color || current.dominant_color, color: current.color || json.dominant_color || current.color, aspect_ratio: json.aspect_ratio || current.aspect_ratio, cover_focus_x: json.cover_focus_x ?? current.cover_focus_x ?? 50, cover_focus_y: json.cover_focus_y ?? current.cover_focus_y ?? 50 }));
    } catch (event) {
      // Some sites block server-side image caching even though the image can be
      // displayed in the browser. Do not lose the user's selected cover.
      setDraft(current => ({ ...current, image_url: proxiedImageUrl(imageUrl), image_path: '', cover_focus_x: current.cover_focus_x ?? 50, cover_focus_y: current.cover_focus_y ?? 50 }));
      setError(event instanceof Error ? `${event.message} Das Bild wird vorerst direkt als Cover verwendet.` : 'Bild konnte nicht zwischengespeichert werden. Es wird direkt als Cover verwendet.');
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
        setDraft(current => ({ ...current, image_url: `/api/images/${path}`, image_path: path, dominant_color: processed.color, color: current.color || processed.color, media_kind: 'image', aspect_ratio: processed.width / processed.height, cover_focus_x: processed.focusX, cover_focus_y: processed.focusY }));
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

  async function uploadCoverImage(file: File) {
    if (!file.type.startsWith('image/')) {
      setError('Lege bitte eine PNG-, JPG-, WEBP- oder andere Bilddatei in den Coverbereich.');
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
    try {
      const processed = await compressImageToWebp(file);
      const path = `${userData.user.id}/${crypto.randomUUID()}.webp`;
      const { error: uploadError } = await supabase.storage.from('pin-images').upload(path, processed.blob, { contentType: 'image/webp', cacheControl: '31536000' });
      if (uploadError) throw new Error(uploadError.message);
      await supabase.from('pin_images').insert({ user_id: userData.user.id, source_type: 'upload', storage_path: path, mime_type: 'image/webp', size_bytes: processed.blob.size });
      setDraft(current => ({
        ...current,
        image_url: `/api/images/${path}`,
        image_path: path,
        dominant_color: processed.color,
        color: current.color || processed.color,
        aspect_ratio: processed.width / processed.height,
        cover_focus_x: processed.focusX,
        cover_focus_y: processed.focusY
      }));
    } catch (event) {
      setError(event instanceof Error ? event.message : 'Cover konnte nicht hochgeladen werden.');
    } finally {
      setUploading(false);
    }
  }

  async function handleCoverDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setCoverDragActive(false);
    const file = Array.from(event.dataTransfer.files || []).find(item => item.type.startsWith('image/'));
    if (!file) {
      setError('Lege bitte eine PNG-, JPG-, WEBP- oder andere Bilddatei in den Coverbereich.');
      return;
    }
    await uploadCoverImage(file);
  }

  function handleCoverDrag(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (event.type === 'dragenter' || event.type === 'dragover') setCoverDragActive(true);
    if (event.type === 'dragleave') setCoverDragActive(false);
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
      board_id: selectedBoardId,
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
      aspect_ratio: draft.aspect_ratio,
      cover_focus_x: draft.cover_focus_x ?? 50,
      cover_focus_y: draft.cover_focus_y ?? 50
    };

    const boardExists = !availableBoards.length || availableBoards.some(board => board.id === selectedBoardId);
    if (!selectedBoardId || !boardExists) {
      setError('Wähle ein gültiges Board aus.');
      setSaving(false);
      return;
    }
    if (draft.section_id && !destinationSections.some(section => section.id === draft.section_id && section.board_id === selectedBoardId)) {
      setError('Wähle einen gültigen Bereich für dieses Board aus.');
      setSaving(false);
      return;
    }

    const scopePins = destinationPins.filter(pin => pin.id !== existingPin?.id && (pin.section_id ?? null) === (draft.section_id || null));
    const movedDestination = Boolean(existingPin && (existingPin.board_id !== selectedBoardId || (existingPin.section_id ?? null) !== (draft.section_id || null)));
    const query = existingPin
      ? supabase.from('pins').update({ ...payload, ...(movedDestination ? { position: nextPosition(scopePins) } : {}) }).eq('id', existingPin.id).select('*').single()
      : supabase.from('pins').insert({ ...payload, position: nextPosition(scopePins) }).select('*').single();

    const { data, error: saveError } = await query;
    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    if (data) {
      if (draft.image_path) await supabase.from('pin_images').update({ pin_id: data.id }).eq('storage_path', draft.image_path);
      try {
        localStorage.setItem(LAST_BOARD_KEY, selectedBoardId);
        if (draft.section_id) localStorage.setItem(sectionKey(selectedBoardId), draft.section_id);
      } catch {}
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
            <div
              className={`cover-dropzone grid min-h-[320px] place-items-center overflow-hidden rounded-[8px] border border-dashed border-[var(--line)] bg-black/22 ${coverDragActive ? 'cover-dropzone-active' : ''}`}
              onDragEnter={handleCoverDrag}
              onDragOver={handleCoverDrag}
              onDragLeave={handleCoverDrag}
              onDrop={handleCoverDrop}
            >
              {draft.image_url ? <img src={proxiedImageUrl(draft.image_url)} alt="Pin Vorschau" referrerPolicy="no-referrer" className="h-full min-h-[320px] w-full object-cover" style={{ objectPosition: `${draft.cover_focus_x ?? 50}% ${draft.cover_focus_y ?? 50}%` }} draggable={false} /> : <div className="text-center text-sm text-[var(--muted)]"><ImagePlus className="mx-auto mb-2" /> Bild hier ablegen oder Datei hochladen</div>}
              {coverDragActive && <div className="cover-dropzone-overlay"><ImagePlus /> Bild hier ablegen</div>}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="btn-ghost cursor-pointer px-3 py-3 text-center text-sm font-semibold">
                <FileUp size={16} /> {uploading ? 'Upload läuft ...' : 'Datei hochladen'}
                <input type="file" accept="image/*,video/*,audio/*,.pdf,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx,text/*" className="hidden" onChange={event => event.target.files?.[0] && uploadFile(event.target.files[0])} />
              </label>
              <button type="button" onClick={() => setDraft(current => ({ ...current, image_url: '', image_path: '', cover_focus_x: 50, cover_focus_y: 50 }))} className="btn-ghost px-3 py-3 text-sm font-semibold">Cover entfernen</button>
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
            <PinDestinationSelector
              boards={availableBoards}
              sections={allSections ?? sections}
              selectedBoardId={selectedBoardId}
              selectedSectionId={draft.section_id}
              onBoardChange={chooseDestinationBoard}
              onSectionChange={chooseDestinationSection}
              disabled={saving || uploading || (Boolean(existingPin) && !allowBoardChange && availableBoards.length <= 1)}
            />

            <section className="rounded-[8px] border border-[var(--line)] bg-white/[0.035] p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text-soft)]"><LinkIcon size={16} /> Link-Import</div>
              <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                <input value={draft.url} onChange={event => handleUrlChange(event.target.value)} onPaste={handleUrlPaste} placeholder="Link einfügen, Analyse startet automatisch" className="field" />
                <button type="button" onClick={() => loadPreview()} disabled={loadingPreview || !draft.url.trim()} className="btn-ghost px-4 py-3 text-sm font-semibold disabled:opacity-50">{loadingPreview ? <Loader2 className="animate-spin" size={17} /> : <Sparkles size={17} />} Erneut</button>
              </div>
              <p className="mt-2 text-xs text-[var(--muted)]">{loadingPreview ? 'Analyse läuft automatisch ...' : 'Beim Einfügen einer gültigen URL startet die Analyse automatisch.'}</p>
              {preview && <div className="image-picker-scroll mt-4"><ImagePicker images={preview.images} selected={draft.image_url} onSelect={chooseRemoteImage} disabled={uploading} /></div>}
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium text-[var(--text-soft)] md:col-span-2">Kategorie<input value={draft.category} onChange={event => setField('category', event.target.value)} placeholder="Design, Blender, Hotel ..." className="field mt-2" /></label>
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
