'use client';

import Link from 'next/link';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import {
  closestCorners,
  pointerWithin,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  DragOverEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import { rectSortingStrategy, SortableContext, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { ArrowLeft, ChevronDown, ChevronRight, Filter, Grid2X2, Layers3, LogOut, Moon, Plus, RotateCcw, Search, Settings, Sun, UploadCloud } from 'lucide-react';
import { Board, BoardSection, Pin } from '@/lib/types';
import { createClient } from '@/lib/supabase/browser';
import { nextPosition, normalizePositions } from '@/lib/position';
import { PinCard, PinOverlay } from './PinCard';
import { PinEditor } from './PinEditor';
import { BoardSettingsPanel } from './BoardSettingsPanel';
import { MobileNav } from './MobileNav';
import { VideoLightbox } from './VideoLightbox';
import { ContextMenu, pinMenuIcons } from './ContextMenu';
import { ConfirmDialog } from './ConfirmDialog';
import { PinDetailModal } from './PinDetailModal';

type EditorState = null | { sectionId?: string | null; pin?: Pin | null; initialUrl?: string };
type UndoState = { pins: Pin[]; label: string } | null;
type DisplayGroup = { id: string | null; title: string; description?: string | null; color?: string | null; collapsed?: boolean; pins: Pin[]; isInbox?: boolean };
type PinContext = null | { pin: Pin; x: number; y: number };
type ConfirmState = null | { title: string; message: string; confirmLabel?: string; onConfirm: () => void };
type CollisionDetectionArgs = Parameters<typeof pointerWithin>[0];

function parseId(id: string) {
  const [type, ...rest] = id.split(':');
  return { type, value: rest.join(':') };
}

function SectionDropButton({ id, label, count, active }: { id: string | null; label: string; count: number; active?: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: `nav-section:${id ?? 'inbox'}` });
  return (
    <a
      ref={setNodeRef}
      href={`#section-${id ?? 'inbox'}`}
      className={`flex w-full items-center justify-between rounded-[7px] border px-3 py-2 text-left text-sm transition ${isOver || active ? 'border-[var(--accent)] bg-white/[0.09] text-[var(--text)]' : 'border-transparent text-[var(--text-soft)] hover:bg-white/[0.055]'}`}
    >
      <span className="truncate">{label}</span>
      <span className="text-xs text-[var(--muted)]">{count}</span>
    </a>
  );
}

function BoardSectionPanel({ group, onAdd, onToggle, activeTarget, children }: { group: DisplayGroup; onAdd: (sectionId: string | null) => void; onToggle?: () => void; activeTarget?: boolean; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `section:${group.id ?? 'inbox'}` });
  const preview = group.pins.slice(0, 4).filter(pin => pin.image_url);

  return (
    <section id={`section-${group.id ?? 'inbox'}`} ref={setNodeRef} className={`section-panel transition ${group.collapsed ? 'section-panel-collapsed' : ''} ${isOver || activeTarget ? 'section-panel-over' : ''}`}>
      <header className="section-header">
        <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-3 text-left" disabled={group.isInbox}>
          {group.isInbox ? <Layers3 size={17} className="text-[var(--accent)]" /> : group.collapsed ? <ChevronRight size={17} /> : <ChevronDown size={17} />}
          <span className="min-w-0">
            <span className="block truncate text-lg font-semibold tracking-[-0.04em]">{group.title}</span>
            <span className="mt-0.5 block text-xs text-[var(--muted)]">{group.pins.length} Pins{group.description ? ` · ${group.description}` : ''}</span>
          </span>
        </button>
        <div className="hidden items-center gap-1 md:flex">
          {group.collapsed && preview.map(pin => <img key={pin.id} src={pin.image_url!} alt="" className="h-8 w-8 rounded-[5px] border border-white/10 object-cover" />)}
        </div>
        <button type="button" onClick={() => onAdd(group.id)} className="btn-ghost h-9 px-3 text-sm"><Plus size={15} /> Pin</button>
      </header>

      {group.collapsed ? (
        <div className="collapsed-drop-zone" onClick={() => group.id && onToggle?.()}>
          <span>{activeTarget || isOver ? 'Hier ablegen' : 'Minimierter Teilbereich'}</span>
          <strong>{group.pins.length}</strong>
        </div>
      ) : (
        <div className="section-body">
          {children}
          {!group.pins.length && (
            <button type="button" onClick={() => onAdd(group.id)} className="empty-drop-zone">
              <Plus size={18} /> Pin hinzufügen oder Link hier ablegen
            </button>
          )}
        </div>
      )}
    </section>
  );
}

export function PinboardClient({ board, initialSections, initialPins, userEmail }: { board: Board; initialSections: BoardSection[]; initialPins: Pin[]; userEmail: string }) {
  const [currentBoard, setCurrentBoard] = useState(board);
  const [sections, setSections] = useState(initialSections);
  const [pins, setPins] = useState(initialPins);
  const [editor, setEditor] = useState<EditorState>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [mediaFilter, setMediaFilter] = useState('all');
  const [sort, setSort] = useState<'position' | 'newest' | 'oldest'>('position');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [undo, setUndo] = useState<UndoState>(null);
  const [playing, setPlaying] = useState<Pin | null>(null);
  const [detailPin, setDetailPin] = useState<Pin | null>(null);
  const [pinContext, setPinContext] = useState<PinContext>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [draggingOver, setDraggingOver] = useState(false);
  const [overSectionId, setOverSectionId] = useState<string | null | 'inbox'>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 10 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 190, tolerance: 9 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const visiblePins = useMemo(() => {
    const q = search.toLowerCase().trim();
    let result = pins.filter(pin => {
      const haystack = [pin.title, pin.description, pin.url, pin.source, pin.category, pin.file_name, ...(pin.tags ?? [])].filter(Boolean).join(' ').toLowerCase();
      const matchesSearch = !q || haystack.includes(q);
      const matchesMedia = mediaFilter === 'all' || pin.media_kind === mediaFilter;
      return matchesSearch && matchesMedia && !pin.archived_at && !pin.deleted_at;
    });
    result = [...result].sort((a, b) => {
      if (sort === 'newest') return +new Date(b.created_at) - +new Date(a.created_at);
      if (sort === 'oldest') return +new Date(a.created_at) - +new Date(b.created_at);
      return a.position - b.position;
    });
    return result;
  }, [pins, search, mediaFilter, sort]);

  const groups = useMemo<DisplayGroup[]>(() => {
    const inboxPins = visiblePins.filter(pin => !pin.section_id);
    const normalGroups: DisplayGroup[] = sections.map(section => ({
      id: section.id,
      title: section.title,
      description: section.description,
      color: section.color,
      collapsed: Boolean(section.is_collapsed),
      pins: visiblePins.filter(pin => pin.section_id === section.id)
    }));
    return [{ id: null, title: 'Schnell gesammelt', description: 'Pins ohne Teilbereich', pins: inboxPins, isInbox: true }, ...normalGroups];
  }, [sections, visiblePins]);

  const mediaKinds = useMemo(() => Array.from(new Set(pins.map(pin => pin.media_kind).filter(Boolean))) as string[], [pins]);
  const activePin = activeId?.startsWith('pin:') ? pins.find(pin => pin.id === activeId.slice(4)) : null;

  const collisionDetection = (args: CollisionDetectionArgs) => {
    const pointerHits = pointerWithin(args);
    if (pointerHits.length) return pointerHits;
    return closestCorners(args);
  };

  function sectionIdFromOverId(overId: string | null | undefined) {
    if (!overId) return null;
    const parsed = parseId(String(overId));
    if (parsed.type === 'section') return parsed.value === 'inbox' ? 'inbox' : parsed.value;
    if (parsed.type === 'pin') {
      const pin = pins.find(item => item.id === parsed.value);
      return pin?.section_id ?? 'inbox';
    }
    return null;
  }

  async function addSection() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data } = await supabase
      .from('board_sections')
      .insert({ board_id: currentBoard.id, user_id: userData.user.id, title: `Bereich ${sections.length + 1}`, position: nextPosition(sections), is_collapsed: false })
      .select('*')
      .single();
    if (data) setSections(current => [...current, data as BoardSection]);
  }

  async function toggleSection(sectionId: string) {
    const section = sections.find(item => item.id === sectionId);
    if (!section) return;
    const next = !section.is_collapsed;
    setSections(current => current.map(item => item.id === sectionId ? { ...item, is_collapsed: next } : item));
    await supabase.from('board_sections').update({ is_collapsed: next }).eq('id', sectionId);
  }

  function requestDeletePin(pin: Pin) {
    setConfirm({
      title: 'Pin wirklich löschen?',
      message: 'Der Pin wird aus dem aktiven Board entfernt. Diese Aktion kann nur über die Datenbank rückgängig gemacht werden.',
      confirmLabel: 'Pin löschen',
      onConfirm: () => deletePin(pin)
    });
  }

  async function deletePin(pin: Pin) {
    setConfirm(null);
    setUndo({ pins, label: 'Pin gelöscht' });
    setPins(current => current.filter(item => item.id !== pin.id));
    await supabase.from('pins').update({ deleted_at: new Date().toISOString() }).eq('id', pin.id);
  }

  async function archivePin(pin: Pin) {
    setUndo({ pins, label: 'Pin archiviert' });
    setPins(current => current.filter(item => item.id !== pin.id));
    await supabase.from('pins').update({ archived_at: new Date().toISOString() }).eq('id', pin.id);
  }

  async function duplicatePin(pin: Pin) {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { id, created_at, updated_at, ...rest } = pin;
    const scopePins = pins.filter(item => (item.section_id ?? null) === (pin.section_id ?? null));
    const { data } = await supabase.from('pins').insert({ ...rest, user_id: userData.user.id, title: `${pin.title ?? 'Pin'} Kopie`, position: nextPosition(scopePins), archived_at: null, deleted_at: null }).select('*').single();
    if (data) setPins(current => [data as Pin, ...current]);
  }

  async function undoLast() {
    if (!undo) return;
    const previous = undo.pins;
    setPins(previous);
    setUndo(null);
    await Promise.all(previous.map(pin => supabase.from('pins').update({ section_id: pin.section_id, position: pin.position, deleted_at: pin.deleted_at, archived_at: pin.archived_at }).eq('id', pin.id)));
  }

  function onSaved(pin: Pin) {
    setPins(current => current.some(item => item.id === pin.id) ? current.map(item => item.id === pin.id ? pin : item) : [pin, ...current]);
    setEditor(null);
    if (detailPin?.id === pin.id) setDetailPin(pin);
  }

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
    setOverSectionId(sectionIdFromOverId(String(event.active.id)));
  }

  function onDragOver(event: DragOverEvent) {
    setOverSectionId(sectionIdFromOverId(event.over?.id ? String(event.over.id) : null));
  }

  function edgeAutoScroll(event: React.DragEvent) {
    const element = scrollRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const y = event.clientY - rect.top;
    const zone = 96;
    if (y < zone) element.scrollBy({ top: -Math.max(2, (zone - y) / 4), behavior: 'smooth' });
    if (rect.height - y < zone) element.scrollBy({ top: Math.max(2, (zone - (rect.height - y)) / 4), behavior: 'smooth' });
  }

  async function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const fallbackOverSectionId = overSectionId;
    setOverSectionId(null);
    if (!event.over && !fallbackOverSectionId) return;
    const active = parseId(String(event.active.id));
    const over = event.over ? parseId(String(event.over.id)) : { type: 'section', value: fallbackOverSectionId === 'inbox' ? 'inbox' : String(fallbackOverSectionId) };
    if (active.type !== 'pin') return;
    const moving = pins.find(pin => pin.id === active.value);
    if (!moving) return;
    setUndo({ pins, label: 'Verschiebung' });

    let targetSectionId: string | null = moving.section_id ?? null;
    if (over.type === 'section') targetSectionId = over.value === 'inbox' ? null : over.value;
    if (over.type === 'pin') targetSectionId = pins.find(pin => pin.id === over.value)?.section_id ?? null;

    const withoutMoving = pins.filter(pin => pin.id !== moving.id);
    const targetPins = withoutMoving.filter(pin => (pin.section_id ?? null) === targetSectionId).sort((a, b) => a.position - b.position);
    let insertIndex = targetPins.length;
    if (over.type === 'pin') {
      const overIndex = targetPins.findIndex(pin => pin.id === over.value);
      if (overIndex >= 0) insertIndex = overIndex;
    }

    const moved = { ...moving, section_id: targetSectionId };
    const normalized = normalizePositions([...targetPins.slice(0, insertIndex), moved, ...targetPins.slice(insertIndex)]);
    const nextPins = [...withoutMoving.filter(pin => (pin.section_id ?? null) !== targetSectionId), ...normalized];
    setPins(nextPins);
    await Promise.all(normalized.map(pin => supabase.from('pins').update({ section_id: pin.section_id, position: pin.position }).eq('id', pin.id)));
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', current);
    localStorage.setItem('pinboard-theme', current);
  }

  function extractUrlFromDrop(event: React.DragEvent) {
    const uri = event.dataTransfer.getData('text/uri-list') || event.dataTransfer.getData('text/plain');
    const match = uri.match(/https?:\/\/[^\s]+/);
    return match?.[0] || '';
  }

  function onExternalDrop(event: React.DragEvent, sectionId?: string | null) {
    event.preventDefault();
    setDraggingOver(false);
    const url = extractUrlFromDrop(event);
    if (url) setEditor({ sectionId: sectionId ?? null, initialUrl: url });
  }

  return (
    <main className="app-shell flex h-dvh overflow-hidden">
      <aside className="hidden w-[292px] shrink-0 border-r border-[var(--line)] bg-black/24 p-3 backdrop-blur-2xl lg:flex lg:flex-col">
        <Link href="/boards" className="btn-ghost mb-3 h-10 justify-start px-3 text-sm"><ArrowLeft size={16} /> Alle Boards</Link>
        <div className="mb-4 overflow-hidden rounded-[8px] border border-[var(--line)] bg-white/[0.035]">
          {currentBoard.cover_url && <img src={currentBoard.cover_url} alt="" className="h-32 w-full object-cover" />}
          <div className="p-3"><p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--accent)]">Pinboard</p><h1 className="mt-1 line-clamp-2 text-xl font-semibold tracking-[-0.05em]">{currentBoard.title}</h1></div>
        </div>
        <div className="space-y-1">
          {groups.map(group => <SectionDropButton key={group.id ?? 'inbox'} id={group.id} label={group.title} count={group.pins.length} />)}
        </div>
        <button onClick={addSection} className="btn-ghost mt-3 px-3 py-2 text-sm"><Plus size={15} /> Teilbereich</button>
        <div className="mt-auto space-y-2 pt-4"><button onClick={toggleTheme} className="btn-ghost w-full justify-start px-3 py-2 text-sm"><Moon size={15} /><Sun size={15} className="opacity-50" /> Theme</button><button onClick={signOut} className="btn-ghost w-full justify-start px-3 py-2 text-sm"><LogOut size={15} /> {userEmail}</button></div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="z-20 flex min-h-[74px] shrink-0 flex-col gap-3 border-b border-[var(--line)] bg-[var(--bg)]/76 px-3 py-3 backdrop-blur-2xl md:flex-row md:items-center md:justify-between md:px-5">
          <div className="flex min-w-0 items-center gap-3"><Link href="/boards" className="btn-ghost h-10 w-10 lg:hidden"><ArrowLeft size={17} /></Link><div className="min-w-0"><div className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--muted)]"><Grid2X2 size={13} /> {visiblePins.length} Pins · {sections.length} Bereiche</div><h2 className="truncate text-2xl font-semibold tracking-[-0.055em]">{currentBoard.title}</h2></div></div>
          <div className="flex min-w-0 flex-wrap items-center gap-2 md:flex-nowrap">
            <label className="field flex min-w-[220px] flex-1 items-center gap-2 p-0 px-3 md:w-[360px]"><Search size={16} className="text-[var(--muted)]" /><input ref={searchRef} value={search} onChange={event => setSearch(event.target.value)} placeholder="Titel, Tags, URL, Dateien ..." className="h-10 min-w-0 flex-1 bg-transparent outline-none" /></label>
            <select value={mediaFilter} onChange={event => setMediaFilter(event.target.value)} className="field w-auto py-2"><option value="all">Alle Typen</option>{mediaKinds.map(kind => <option key={kind} value={kind}>{kind}</option>)}</select>
            <select value={sort} onChange={event => setSort(event.target.value as typeof sort)} className="field w-auto py-2"><option value="position">Manuell</option><option value="newest">Neueste</option><option value="oldest">Älteste</option></select>
            {undo && <button onClick={undoLast} className="btn-ghost h-10 px-3 text-sm"><RotateCcw size={15} /> Rückgängig</button>}
            <button onClick={() => setSettingsOpen(true)} className="btn-ghost h-10 w-10"><Settings size={17} /></button>
            <button onClick={() => setEditor({ sectionId: null })} className="btn-primary h-10 px-4 text-sm"><Plus size={17} /> Pin</button>
          </div>
        </header>

        <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} autoScroll>
          <div
            ref={scrollRef}
            onDragOver={event => { event.preventDefault(); setDraggingOver(true); edgeAutoScroll(event); }}
            onDragLeave={() => setDraggingOver(false)}
            onDrop={event => onExternalDrop(event, null)}
            className="board-scroll relative flex-1 overflow-y-auto px-3 py-4 pb-28 md:px-5 md:pb-6"
          >
            <div className={`pointer-events-none absolute inset-4 z-10 grid place-items-center rounded-[10px] border border-dashed border-[var(--accent)] bg-[var(--accent)]/10 text-sm font-semibold text-[var(--text)] backdrop-blur-xl transition ${draggingOver ? 'opacity-100' : 'opacity-0'}`}><UploadCloud size={28} /> Link hier ablegen und als Pin importieren</div>
            <div className="space-y-4">
              {groups.map(group => (
                <BoardSectionPanel key={group.id ?? 'inbox'} group={group} activeTarget={overSectionId === (group.id ?? 'inbox')} onAdd={sectionId => setEditor({ sectionId })} onToggle={group.id ? () => toggleSection(group.id!) : undefined}>
                  <SortableContext items={group.pins.map(pin => `pin:${pin.id}`)} strategy={rectSortingStrategy}>
                    <div className="pin-grid">
                      {group.pins.map(pin => <PinCard key={pin.id} pin={pin} onOpen={setDetailPin} onEdit={pin => setEditor({ sectionId: pin.section_id, pin })} onDelete={requestDeletePin} onDuplicate={duplicatePin} onArchive={archivePin} onPlay={setPlaying} onContext={(pin, point) => setPinContext({ pin, ...point })} />)}
                    </div>
                  </SortableContext>
                </BoardSectionPanel>
              ))}
            </div>
            {!visiblePins.length && <div className="mt-4 grid min-h-[45vh] place-items-center rounded-[10px] border border-dashed border-[var(--line)] text-center"><div><Filter className="mx-auto mb-3 text-[var(--muted)]" /><h3 className="text-xl font-semibold tracking-[-0.04em]">Noch keine Pins sichtbar</h3><p className="mt-2 text-sm text-[var(--muted)]">Füge einen Pin hinzu oder ziehe einen Link aus dem Browser hier hinein.</p></div></div>}
          </div>
          <DragOverlay dropAnimation={{ duration: 230, easing: 'cubic-bezier(.2,.8,.2,1)' }}>{activePin ? <PinOverlay pin={activePin} /> : null}</DragOverlay>
        </DndContext>
      </section>

      <MobileNav onAdd={() => setEditor({ sectionId: null })} onFocusSearch={() => searchRef.current?.focus()} />
      {pinContext && <ContextMenu x={pinContext.x} y={pinContext.y} onClose={() => setPinContext(null)} items={[
        { label: 'Öffnen', icon: pinMenuIcons.ExternalLink, onSelect: () => setDetailPin(pinContext.pin) },
        { label: 'Bearbeiten', icon: pinMenuIcons.Pencil, onSelect: () => setEditor({ sectionId: pinContext.pin.section_id, pin: pinContext.pin }) },
        { label: 'Verschieben', icon: pinMenuIcons.FolderInput, onSelect: () => setEditor({ sectionId: pinContext.pin.section_id, pin: pinContext.pin }) },
        { label: 'Duplizieren', icon: pinMenuIcons.Copy, onSelect: () => duplicatePin(pinContext.pin) },
        { label: 'Archivieren', icon: pinMenuIcons.Archive, onSelect: () => archivePin(pinContext.pin) },
        { label: 'Löschen', icon: pinMenuIcons.Trash2, danger: true, onSelect: () => requestDeletePin(pinContext.pin) }
      ]} />}
      {editor && <PinEditor boardId={currentBoard.id} sections={sections} targetSectionId={editor.sectionId ?? null} existingPin={editor.pin} existingPins={pins} initialUrl={editor.initialUrl} onClose={() => setEditor(null)} onSaved={onSaved} />}
      {settingsOpen && <BoardSettingsPanel board={currentBoard} pins={pins} onClose={() => setSettingsOpen(false)} onSaved={board => { setCurrentBoard(board); setSettingsOpen(false); }} />}
      {detailPin && <PinDetailModal pin={detailPin} onClose={() => setDetailPin(null)} onEdit={pin => setEditor({ sectionId: pin.section_id, pin })} onPlay={setPlaying} />}
      {confirm && <ConfirmDialog title={confirm.title} message={confirm.message} confirmLabel={confirm.confirmLabel} onCancel={() => setConfirm(null)} onConfirm={confirm.onConfirm} />}
      <VideoLightbox pin={playing} onClose={() => setPlaying(null)} />
    </main>
  );
}
