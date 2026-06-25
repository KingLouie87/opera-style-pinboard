'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  closestCorners,
  rectIntersection,
  pointerWithin,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  DragOverEvent,
  type CollisionDetection,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import { rectSortingStrategy, SortableContext, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Archive, ArrowDown, ArrowLeft, ArrowUp, CheckSquare, ChevronDown, ChevronRight, Filter, FolderInput, Grid2X2, Layers3, List, ListTree, LogOut, Moon, Plus, RotateCcw, Search, Settings, SlidersHorizontal, Sun, Trash2, UploadCloud, X } from 'lucide-react';
import { Board, BoardSection, Pin } from '@/lib/types';
import { createClient } from '@/lib/supabase/browser';
import { nextPosition, normalizePositions } from '@/lib/position';
import { RemoteImage } from './RemoteImage';
import { PinCard, PinOverlay } from './PinCard';
import { PinEditor } from './PinEditor';
import { BoardSettingsPanel } from './BoardSettingsPanel';
import { MobileNav } from './MobileNav';
import { VideoLightbox } from './VideoLightbox';
import { ContextMenu, pinMenuIcons } from './ContextMenu';
import { ConfirmDialog } from './ConfirmDialog';
import { RenameDialog } from './RenameDialog';
import { PinDetailModal } from './PinDetailModal';

type EditorState = null | { sectionId?: string | null; pin?: Pin | null; initialUrl?: string };
type UndoState = { pins: Pin[]; sections?: BoardSection[]; label: string } | null;
type DisplayGroup = { id: string | null; title: string; description?: string | null; color?: string | null; collapsed?: boolean; pins: Pin[]; isInbox?: boolean };
type PinContext = null | { pin: Pin; x: number; y: number };
type SectionContext = null | { group: DisplayGroup; x: number; y: number };
type PinMoveState = null | { pin: Pin };
type BulkMoveState = null | { kind: 'pins' };
type ConfirmState = null | { title: string; message: string; confirmLabel?: string; onConfirm: () => void };
type RenameState = null | { kind: 'pin'; pin: Pin } | { kind: 'section'; group: DisplayGroup };
type ViewMode = 'detailed' | 'standard' | 'compact';

function parseId(id: string) {
  const [type, ...rest] = id.split(':');
  return { type, value: rest.join(':') };
}

function SectionNavItem({ group, active, onContext }: { group: DisplayGroup; active?: boolean; onContext: (group: DisplayGroup, point: { x: number; y: number }) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `nav-section:${group.id ?? 'inbox'}` });
  return (
    <a
      ref={setNodeRef}
      href={`#section-${group.id ?? 'inbox'}`}
      onContextMenu={event => { event.preventDefault(); onContext(group, { x: event.clientX, y: event.clientY }); }}
      className={`section-nav-pill ${isOver || active ? 'section-nav-pill-active' : ''}`}
    >
      <span className="truncate">{group.title}</span>
      <span>{group.pins.length}</span>
    </a>
  );
}

function ViewModeButton({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`view-mode-button ${active ? 'active' : ''}`}>{icon}<span>{label}</span></button>;
}


function PinMoveDialog({ pin, groups, currentSectionId, onMove, onClose }: {
  pin: Pin;
  groups: DisplayGroup[];
  currentSectionId: string | null;
  onMove: (sectionId: string | null) => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop z-[78]" onMouseDown={onClose} role="dialog" aria-modal="true">
      <article className="move-dialog" onMouseDown={event => event.stopPropagation()}>
        <button type="button" onClick={onClose} className="move-dialog-close" aria-label="Schließen"><X size={16} /></button>
        <p>Pin verschieben</p>
        <h2>{pin.title || pin.file_name || 'Unbenannter Pin'}</h2>
        <div className="move-target-columns move-target-columns-single">
          <section>
            <h3>Teilbereich wählen</h3>
            {groups.map(group => {
              const targetId = group.id ?? null;
              const active = (currentSectionId ?? null) === targetId;
              return (
                <button key={group.id ?? 'inbox'} type="button" disabled={active} className={active ? 'active' : ''} onClick={() => onMove(targetId)}>
                  <FolderInput size={14} />
                  <span>{group.title}</span>
                  {active && <em>Aktuell</em>}
                </button>
              );
            })}
          </section>
        </div>
      </article>
    </div>
  );
}


function BulkMoveDialog({ count, groups, onMove, onClose }: {
  count: number;
  groups: DisplayGroup[];
  onMove: (sectionId: string | null) => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop z-[78]" onMouseDown={onClose} role="dialog" aria-modal="true">
      <article className="move-dialog" onMouseDown={event => event.stopPropagation()}>
        <button type="button" onClick={onClose} className="move-dialog-close" aria-label="Schließen"><X size={16} /></button>
        <p>Mehrfachauswahl</p>
        <h2>{count} Pins verschieben</h2>
        <div className="move-target-columns move-target-columns-single">
          <section>
            <h3>Zielbereich wählen</h3>
            {groups.map(group => (
              <button key={group.id ?? 'inbox'} type="button" onClick={() => onMove(group.id ?? null)}>
                <FolderInput size={14} />
                <span>{group.title}</span>
              </button>
            ))}
          </section>
        </div>
      </article>
    </div>
  );
}

function BoardSectionPanel({ group, onAdd, onToggle, onRename, onContext, activeTarget, selectionMode = false, selected = false, onToggleSelected, children }: {
  group: DisplayGroup;
  onAdd: (sectionId: string | null) => void;
  onToggle?: () => void;
  onRename?: (sectionId: string, title: string) => void;
  onContext: (group: DisplayGroup, point: { x: number; y: number }) => void;
  activeTarget?: boolean;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelected?: (group: DisplayGroup) => void;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `section:${group.id ?? 'inbox'}` });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(group.title);
  const preview = group.pins.slice(0, 4).filter(pin => pin.image_url);
  const isDropTarget = isOver || activeTarget;

  function submitRename() {
    const next = draft.trim();
    if (group.id && next && next !== group.title) onRename?.(group.id, next);
    setEditing(false);
  }

  function cancelRename() {
    setDraft(group.title);
    setEditing(false);
  }

  function openOptions(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    onContext(group, { x: event.clientX, y: event.clientY });
  }

  return (
    <section id={`section-${group.id ?? 'inbox'}`} ref={setNodeRef} onContextMenu={openOptions} className={`section-panel transition ${group.collapsed ? 'section-panel-collapsed' : ''} ${isDropTarget ? 'section-panel-over' : ''}`}>
      <header className="section-header">
        {selectionMode && !group.isInbox && <button type="button" onClick={(event) => { event.stopPropagation(); onToggleSelected?.(group); }} className={`section-select-button ${selected ? 'selected' : ''}`} aria-label="Teilbereich auswählen">{selected ? '✓' : ''}</button>}
        <button type="button" onClick={onToggle} className="section-title-button" disabled={group.isInbox || editing}>
          {group.isInbox ? <Layers3 size={17} className="text-[var(--accent)]" /> : group.collapsed ? <ChevronRight size={17} /> : <ChevronDown size={17} />}
          {editing ? (
            <span className="section-rename-wrap" onClick={event => event.stopPropagation()}>
              <input
                autoFocus
                value={draft}
                onChange={event => setDraft(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') submitRename();
                  if (event.key === 'Escape') cancelRename();
                }}
                className="section-rename-input"
              />
            </span>
          ) : (
            <span className="min-w-0">
              <span className="section-title-text">{group.title}</span>
              <span className="section-subtitle">{group.pins.length} Pins{group.description ? ` · ${group.description}` : ''}</span>
            </span>
          )}
        </button>

        {editing ? (
          <div className="section-edit-actions">
            <button type="button" onClick={submitRename} className="section-icon-button" aria-label="Namen speichern">OK</button>
            <button type="button" onClick={cancelRename} className="section-icon-button" aria-label="Umbenennen abbrechen"><X size={15} /></button>
          </div>
        ) : (
          <>
            <div className="hidden items-center gap-1 md:flex">
              {group.collapsed && preview.map(pin => <RemoteImage key={pin.id} src={pin.image_url} pageUrl={pin.url} alt="" className="h-8 w-8 rounded-[5px] border border-white/10 object-cover" />)}
            </div>
            {!group.isInbox && <button type="button" onClick={openOptions} className="section-icon-button section-options-button" aria-label="Teilbereich Optionen"><Settings size={15} /></button>}
            <button type="button" onClick={() => onAdd(group.id)} className="btn-ghost h-9 px-3 text-sm"><Plus size={15} /> Pin</button>
          </>
        )}
      </header>

      {group.collapsed ? (
        <div className="collapsed-drop-zone" onClick={() => group.id && onToggle?.()}>
          <span>{isDropTarget ? 'Hier ablegen' : 'Minimierter Teilbereich'}</span>
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
  const [destinationBoards, setDestinationBoards] = useState<Board[]>([board]);
  const [destinationSections, setDestinationSections] = useState<BoardSection[]>(initialSections);
  const [destinationPins, setDestinationPins] = useState<Pin[]>(initialPins);
  const [editor, setEditor] = useState<EditorState>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [mediaFilter, setMediaFilter] = useState('all');
  const [sort, setSort] = useState<'position' | 'newest' | 'oldest'>('position');
  const [viewMode, setViewMode] = useState<ViewMode>('standard');
  const [sectionFilter, setSectionFilter] = useState<string>('all');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [undo, setUndo] = useState<UndoState>(null);
  const [playing, setPlaying] = useState<Pin | null>(null);
  const [detailPin, setDetailPin] = useState<Pin | null>(null);
  const [pinContext, setPinContext] = useState<PinContext>(null);
  const [movePin, setMovePin] = useState<PinMoveState>(null);
  const [bulkMove, setBulkMove] = useState<BulkMoveState>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedPinIds, setSelectedPinIds] = useState<string[]>([]);
  const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>([]);
  const [sectionContext, setSectionContext] = useState<SectionContext>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [rename, setRename] = useState<RenameState>(null);
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameError, setRenameError] = useState('');
  const [draggingOver, setDraggingOver] = useState(false);
  const [overSectionId, setOverSectionId] = useState<string | null | 'inbox'>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const searchRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    let mounted = true;
    async function loadDestinations() {
      const { data: userData } = await supabase.auth.getUser();
      if (!mounted || !userData.user) return;
      const [{ data: boardsData }, { data: sectionsData }, { data: pinsData }] = await Promise.all([
        supabase.from('boards').select('*').eq('user_id', userData.user.id).is('archived_at', null).is('deleted_at', null).order('board_position', { ascending: true }).order('updated_at', { ascending: false }),
        supabase.from('board_sections').select('*').eq('user_id', userData.user.id).order('position'),
        supabase.from('pins').select('*').eq('user_id', userData.user.id).is('deleted_at', null).is('archived_at', null).order('position')
      ]);
      if (!mounted) return;
      setDestinationBoards(boardsData?.length ? boardsData as Board[] : [currentBoard]);
      setDestinationSections(sectionsData?.length ? sectionsData as BoardSection[] : sections);
      setDestinationPins(pinsData?.length ? pinsData as Pin[] : pins);
    }
    void loadDestinations();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('pinboard-theme') === 'light' ? 'light' : 'dark';
    setTheme(stored);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 7 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 8 } }),
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
    const normalGroups: DisplayGroup[] = sections
      .slice()
      .sort((a, b) => a.position - b.position)
      .map(section => ({
        id: section.id,
        title: section.title,
        description: section.description,
        color: section.color,
        collapsed: Boolean(section.is_collapsed),
        pins: visiblePins.filter(pin => pin.section_id === section.id)
      }));
    return [{ id: null, title: 'Ohne Teilbereich', description: 'Pins ohne Teilbereich', pins: inboxPins, isInbox: true }, ...normalGroups];
  }, [sections, visiblePins]);

  const detailedPins = useMemo(() => sectionFilter === 'all' ? visiblePins : visiblePins.filter(pin => (pin.section_id ?? 'inbox') === sectionFilter), [visiblePins, sectionFilter]);
  const mediaKinds = useMemo(() => Array.from(new Set(pins.map(pin => pin.media_kind).filter(Boolean))) as string[], [pins]);
  const activePin = activeId?.startsWith('pin:') ? pins.find(pin => pin.id === activeId.slice(4)) : null;
  const sectionById = useMemo(() => new Map(sections.map(section => [section.id, section])), [sections]);
  const selectedPins = useMemo(() => pins.filter(pin => selectedPinIds.includes(pin.id) && !pin.archived_at && !pin.deleted_at), [pins, selectedPinIds]);
  const selectedSections = useMemo(() => sections.filter(section => selectedSectionIds.includes(section.id)), [sections, selectedSectionIds]);

  const collisionDetection: CollisionDetection = (args) => {
    const isSectionHit = (id: unknown) => {
      const value = String(id);
      return value.startsWith('section:') || value.startsWith('nav-section:');
    };
    const pointerHits = pointerWithin(args);
    const pointerSectionHits = pointerHits.filter(hit => isSectionHit(hit.id));
    if (pointerSectionHits.length) return pointerSectionHits;
    const rectHits = rectIntersection(args);
    const rectSectionHits = rectHits.filter(hit => isSectionHit(hit.id));
    if (rectSectionHits.length) return rectSectionHits;
    if (pointerHits.length) return pointerHits;
    return closestCorners(args);
  };

  function sectionIdFromOverId(overId: string | null | undefined) {
    if (!overId) return null;
    const parsed = parseId(String(overId));
    if (parsed.type === 'section' || parsed.type === 'nav-section') return parsed.value === 'inbox' ? 'inbox' : parsed.value;
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

  async function renameSection(sectionId: string, title: string) {
    setSections(current => current.map(item => item.id === sectionId ? { ...item, title } : item));
    await supabase.from('board_sections').update({ title }).eq('id', sectionId);
  }

  function requestRenameSection(group: DisplayGroup) {
    if (!group.id) return;
    setRenameError('');
    setRename({ kind: 'section', group });
  }

  async function toggleSection(sectionId: string) {
    const section = sections.find(item => item.id === sectionId);
    if (!section) return;
    const next = !section.is_collapsed;
    setSections(current => current.map(item => item.id === sectionId ? { ...item, is_collapsed: next } : item));
    await supabase.from('board_sections').update({ is_collapsed: next }).eq('id', sectionId);
  }

  async function moveSection(sectionId: string, direction: -1 | 1) {
    const ordered = sections.slice().sort((a, b) => a.position - b.position);
    const index = ordered.findIndex(section => section.id === sectionId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    const normalized = ordered.map((section, position) => ({ ...section, position }));
    setSections(normalized);
    await Promise.all(normalized.map(section => supabase.from('board_sections').update({ position: section.position }).eq('id', section.id)));
  }

  async function sortSectionsAlphabetically() {
    const normalized = sections.slice().sort((a, b) => a.title.localeCompare(b.title, 'de')).map((section, position) => ({ ...section, position }));
    setSections(normalized);
    await Promise.all(normalized.map(section => supabase.from('board_sections').update({ position: section.position }).eq('id', section.id)));
  }

  function requestDeleteSection(group: DisplayGroup) {
    if (!group.id) return;
    setConfirm({
      title: 'Teilbereich löschen?',
      message: `„${group.title}“ wird gelöscht. Die enthaltenen Pins werden nicht gelöscht, sondern in „Ohne Teilbereich“ verschoben.`,
      confirmLabel: 'Teilbereich löschen',
      onConfirm: () => deleteSection(group.id!)
    });
  }

  async function deleteSection(sectionId: string) {
    setConfirm(null);
    setUndo({ pins, sections, label: 'Teilbereich gelöscht' });
    setPins(current => current.map(pin => pin.section_id === sectionId ? { ...pin, section_id: null } : pin));
    setSections(current => current.filter(section => section.id !== sectionId));
    await supabase.from('pins').update({ section_id: null }).eq('section_id', sectionId);
    await supabase.from('board_sections').delete().eq('id', sectionId);
  }

  function requestDeletePin(pin: Pin) {
    setConfirm({
      title: 'Pin wirklich löschen?',
      message: 'Der Pin wird aus dem aktiven Board entfernt. Diese Aktion kann über das Archiv nicht mehr sichtbar gemacht werden.',
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

  async function renamePin(pin: Pin, title: string) {
    const next = title.trim().slice(0, 120);
    if (!next) return;
    setRenameSaving(true);
    setRenameError('');
    const previous = pins;
    setPins(current => current.map(item => item.id === pin.id ? { ...item, title: next } : item));
    const { error } = await supabase.from('pins').update({ title: next }).eq('id', pin.id);
    setRenameSaving(false);
    if (error) {
      setPins(previous);
      setRenameError(error.message);
      return;
    }
    setRename(null);
  }

  async function submitRename(value: string) {
    if (!rename) return;
    const next = value.trim().slice(0, 120);
    if (!next) return;
    if (rename.kind === 'section' && rename.group.id) {
      setRenameSaving(true);
      setRenameError('');
      const previous = sections;
      setSections(current => current.map(item => item.id === rename.group.id ? { ...item, title: next } : item));
      const { error } = await supabase.from('board_sections').update({ title: next }).eq('id', rename.group.id);
      setRenameSaving(false);
      if (error) {
        setSections(previous);
        setRenameError(error.message);
        return;
      }
      setRename(null);
      return;
    }
    if (rename.kind === 'pin') await renamePin(rename.pin, next);
  }

  async function movePinToSection(pin: Pin, sectionId: string | null) {
    setMovePin(null);
    setUndo({ pins, label: 'Pin verschoben' });
    const scopePins = pins.filter(item => item.id !== pin.id && (item.section_id ?? null) === (sectionId ?? null) && !item.archived_at && !item.deleted_at);
    const position = nextPosition(scopePins);
    setPins(current => current.map(item => item.id === pin.id ? { ...item, section_id: sectionId, position } : item));
    await supabase.from('pins').update({ section_id: sectionId, position }).eq('id', pin.id);
  }


  function toggleSelectionMode() {
    setSelectionMode(current => {
      const next = !current;
      if (!next) {
        setSelectedPinIds([]);
        setSelectedSectionIds([]);
      }
      return next;
    });
  }

  function togglePinSelection(pin: Pin) {
    setSelectedPinIds(current => current.includes(pin.id) ? current.filter(id => id !== pin.id) : [...current, pin.id]);
  }

  function toggleSectionSelection(group: DisplayGroup) {
    if (!group.id) return;
    setSelectedSectionIds(current => current.includes(group.id!) ? current.filter(id => id !== group.id) : [...current, group.id!]);
  }

  function clearSelection() {
    setSelectedPinIds([]);
    setSelectedSectionIds([]);
    setSelectionMode(false);
  }

  async function archiveSelectedPins() {
    const ids = selectedPinIds;
    if (!ids.length) return;
    const archivedAt = new Date().toISOString();
    setUndo({ pins, label: 'Auswahl archiviert' });
    setPins(current => current.map(pin => ids.includes(pin.id) ? { ...pin, archived_at: archivedAt } : pin));
    clearSelection();
    await supabase.from('pins').update({ archived_at: archivedAt }).in('id', ids);
  }

  function requestDeleteSelection() {
    const pinCount = selectedPinIds.length;
    const sectionCount = selectedSectionIds.length;
    if (!pinCount && !sectionCount) return;
    setConfirm({
      title: 'Auswahl löschen?',
      message: `${pinCount} Pins und ${sectionCount} Bereiche werden entfernt. Pins aus gelöschten Bereichen werden in „Ohne Teilbereich“ verschoben.`,
      confirmLabel: 'Auswahl löschen',
      onConfirm: deleteSelection
    });
  }

  async function deleteSelection() {
    const pinIds = selectedPinIds;
    const sectionIds = selectedSectionIds;
    setConfirm(null);
    setUndo({ pins, sections, label: 'Auswahl gelöscht' });
    const deletedAt = new Date().toISOString();
    setPins(current => current
      .filter(pin => !pinIds.includes(pin.id))
      .map(pin => sectionIds.includes(pin.section_id ?? '') ? { ...pin, section_id: null } : pin));
    setSections(current => current.filter(section => !sectionIds.includes(section.id)));
    clearSelection();
    if (pinIds.length) await supabase.from('pins').update({ deleted_at: deletedAt }).in('id', pinIds);
    if (sectionIds.length) {
      await supabase.from('pins').update({ section_id: null }).in('section_id', sectionIds);
      await supabase.from('board_sections').delete().in('id', sectionIds);
    }
  }

  async function moveSelectedPinsToSection(sectionId: string | null) {
    const ids = selectedPinIds;
    if (!ids.length) return;
    setBulkMove(null);
    setUndo({ pins, label: 'Auswahl verschoben' });
    const scopePins = pins.filter(pin => !ids.includes(pin.id) && (pin.section_id ?? null) === (sectionId ?? null) && !pin.archived_at && !pin.deleted_at);
    let position = nextPosition(scopePins);
    const updates = pins.filter(pin => ids.includes(pin.id)).map(pin => ({ ...pin, section_id: sectionId, position: position++ }));
    setPins(current => current.map(pin => updates.find(item => item.id === pin.id) ?? pin));
    clearSelection();
    await Promise.all(updates.map(pin => supabase.from('pins').update({ section_id: sectionId, position: pin.position }).eq('id', pin.id)));
  }

  async function undoLast() {
    if (!undo) return;
    const previousPins = undo.pins;
    setPins(previousPins);
    if (undo.sections) setSections(undo.sections);
    setUndo(null);
    await Promise.all(previousPins.map(pin => supabase.from('pins').update({ section_id: pin.section_id, position: pin.position, deleted_at: pin.deleted_at, archived_at: pin.archived_at }).eq('id', pin.id)));
  }

  function onSaved(pin: Pin) {
    setDestinationPins(current => current.some(item => item.id === pin.id) ? current.map(item => item.id === pin.id ? pin : item) : [pin, ...current]);
    setPins(current => {
      if (pin.board_id !== currentBoard.id) return current.filter(item => item.id !== pin.id);
      return current.some(item => item.id === pin.id) ? current.map(item => item.id === pin.id ? pin : item) : [pin, ...current];
    });
    setEditor(null);
    if (detailPin?.id === pin.id) setDetailPin(pin.board_id === currentBoard.id ? pin : null);
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
    if (over.type === 'section' || over.type === 'nav-section') targetSectionId = over.value === 'inbox' ? null : over.value;
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
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('pinboard-theme', next);
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

  function sectionTitleForPin(pin: Pin) {
    return pin.section_id ? sectionById.get(pin.section_id)?.title ?? 'Teilbereich' : 'Ohne Teilbereich';
  }

  function renderPin(pin: Pin, mode: ViewMode) {
    return <PinCard key={pin.id} pin={pin} mode={mode === 'compact' ? 'compact' : mode === 'detailed' ? 'detailed' : 'standard'} sectionTitle={sectionTitleForPin(pin)} selectionMode={selectionMode} selected={selectedPinIds.includes(pin.id)} onToggleSelected={togglePinSelection} onOpen={setDetailPin} onPlay={setPlaying} onContext={(item, point) => setPinContext({ pin: item, ...point })} />;
  }

  function openSectionContext(group: DisplayGroup, point: { x: number; y: number }) {
    setSectionContext({ group, ...point });
  }

  return (
    <main className="app-shell board-detail-shell flex h-dvh overflow-hidden">
      <aside className="hidden w-[286px] shrink-0 p-4 lg:flex lg:flex-col">
        <div className="side-glass flex min-h-0 flex-1 flex-col">
          <Link href="/boards" className="top-back-link mb-3"><ArrowLeft size={16} /> Alle Boards</Link>
          <div className="board-side-cover">
            {currentBoard.cover_url && <RemoteImage src={currentBoard.cover_url} alt="" />}
            <div>
              <p>Pinboard</p>
              <h1>{currentBoard.title}</h1>
            </div>
          </div>
          <div className="section-nav-list">
            {groups.map(group => <SectionNavItem key={group.id ?? 'inbox'} group={group} active={overSectionId === (group.id ?? 'inbox')} onContext={openSectionContext} />)}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={addSection} className="btn-ghost px-3 py-2 text-sm"><Plus size={15} /> Bereich</button>
            <button onClick={sortSectionsAlphabetically} className="btn-ghost px-3 py-2 text-sm">A-Z</button>
          </div>
          <div className="mt-auto space-y-2 pt-4"><button onClick={toggleTheme} className="btn-ghost w-full justify-start px-3 py-2 text-sm" aria-label={theme === 'dark' ? 'Zum hellen Modus wechseln' : 'Zum dunklen Modus wechseln'}>{theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />} {theme === 'dark' ? 'Hellmodus' : 'Dunkelmodus'}</button><button onClick={signOut} className="btn-ghost w-full justify-start px-3 py-2 text-sm"><LogOut size={15} /> {userEmail}</button></div>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="top-glass pinboard-header-mirror z-20 shrink-0 px-3 py-3 md:px-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="board-header-title-wrap flex min-w-0 items-center gap-3"><div className="min-w-0 text-left"><h2 className="board-header-title truncate text-[var(--fs-section)] font-semibold tracking-[-0.045em]">{currentBoard.title}</h2><div className="board-header-meta mt-1 flex items-center gap-2 text-[var(--fs-meta)] uppercase tracking-[0.18em] text-[var(--muted)]"><Grid2X2 size={13} /> {visiblePins.length} Pins · {sections.length} Bereiche</div></div></div>
            <div className="flex min-w-0 flex-wrap items-center gap-2 md:flex-nowrap">
              <div className="view-mode-switch" aria-label="Ansicht wählen">
                <ViewModeButton active={viewMode === 'detailed'} icon={<Grid2X2 size={15} />} label="Detailliert" onClick={() => setViewMode('detailed')} />
                <ViewModeButton active={viewMode === 'standard'} icon={<ListTree size={15} />} label="Standard" onClick={() => setViewMode('standard')} />
                <ViewModeButton active={viewMode === 'compact'} icon={<List size={15} />} label="Kompakt" onClick={() => setViewMode('compact')} />
              </div>
              <label className="field flex min-w-[210px] flex-1 items-center gap-2 p-0 px-3 md:w-[320px]"><Search size={16} className="text-[var(--muted)]" /><input ref={searchRef} value={search} onChange={event => setSearch(event.target.value)} placeholder="Titel, Tags, URL ..." className="h-10 min-w-0 flex-1 bg-transparent outline-none" /></label>
              {viewMode === 'detailed' && <select value={sectionFilter} onChange={event => setSectionFilter(event.target.value)} className="field app-select w-auto py-2"><option value="all">Alle Bereiche</option><option value="inbox">Ohne Teilbereich</option>{sections.map(section => <option key={section.id} value={section.id}>{section.title}</option>)}</select>}
              <select value={mediaFilter} onChange={event => setMediaFilter(event.target.value)} className="field app-select w-auto py-2"><option value="all">Alle Typen</option>{mediaKinds.map(kind => <option key={kind} value={kind}>{kind}</option>)}</select>
              <select value={sort} onChange={event => setSort(event.target.value as typeof sort)} className="field app-select w-auto py-2"><option value="position">Manuell</option><option value="newest">Neueste</option><option value="oldest">Älteste</option></select>
              {undo && <button onClick={undoLast} className="btn-ghost h-10 px-3 text-sm"><RotateCcw size={15} /> Rückgängig</button>}
              <button onClick={toggleSelectionMode} className={`btn-ghost h-10 px-3 text-sm ${selectionMode ? 'active' : ''}`}><CheckSquare size={15} /> Auswahl</button>
              <button onClick={() => setSettingsOpen(true)} className="btn-ghost h-10 w-10"><SlidersHorizontal size={17} /></button>
              <button onClick={() => setEditor({ sectionId: null })} className="btn-primary h-10 px-4 text-sm"><Plus size={17} /> Pin</button>
            </div>
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
            <div className={`external-drop-hint ${draggingOver ? 'opacity-100' : 'opacity-0'}`}><UploadCloud size={28} /> Link hier ablegen und als Pin importieren</div>
            {selectionMode && (selectedPinIds.length || selectedSectionIds.length) > 0 && (
              <div className="bulk-action-bar">
                <strong>{selectedPinIds.length} Pins · {selectedSectionIds.length} Bereiche</strong>
                <button type="button" onClick={() => setBulkMove({ kind: 'pins' })} disabled={!selectedPinIds.length}><FolderInput size={14} /> Verschieben</button>
                <button type="button" onClick={archiveSelectedPins} disabled={!selectedPinIds.length}><Archive size={14} /> Archivieren</button>
                <button type="button" onClick={requestDeleteSelection}><Trash2 size={14} /> Löschen</button>
                <button type="button" onClick={clearSelection}><X size={14} /> Abbrechen</button>
              </div>
            )}

            {viewMode === 'detailed' && (
              <section className="detailed-board-flow">
                <div className="detailed-filter-row">
                  <span><Filter size={14} /> Teilbereichsfilter</span>
                  {groups.map(group => <button key={group.id ?? 'inbox'} type="button" onClick={() => setSectionFilter(group.id ?? 'inbox')} className={sectionFilter === (group.id ?? 'inbox') ? 'active' : ''}>{group.title}<em>{group.pins.length}</em></button>)}
                  <button type="button" onClick={() => setSectionFilter('all')} className={sectionFilter === 'all' ? 'active' : ''}>Alle<em>{visiblePins.length}</em></button>
                </div>
                <SortableContext items={detailedPins.map(pin => `pin:${pin.id}`)} strategy={rectSortingStrategy}>
                  <div className="pin-grid pin-grid-detailed">
                    {detailedPins.map(pin => renderPin(pin, 'detailed'))}
                  </div>
                </SortableContext>
              </section>
            )}

            {viewMode === 'standard' && (
              <div className="section-stack">
                {groups.map(group => (
                  <BoardSectionPanel key={group.id ?? 'inbox'} group={group} activeTarget={overSectionId === (group.id ?? 'inbox')} onAdd={sectionId => setEditor({ sectionId })} onRename={renameSection} onContext={openSectionContext} onToggle={group.id ? () => toggleSection(group.id!) : undefined} selectionMode={selectionMode} selected={Boolean(group.id && selectedSectionIds.includes(group.id))} onToggleSelected={toggleSectionSelection}>
                    <SortableContext items={group.pins.map(pin => `pin:${pin.id}`)} strategy={rectSortingStrategy}>
                      <div className="pin-grid">
                        {group.pins.map(pin => renderPin(pin, 'standard'))}
                      </div>
                    </SortableContext>
                  </BoardSectionPanel>
                ))}
              </div>
            )}

            {viewMode === 'compact' && (
              <div className="section-stack compact-section-stack">
                {groups.map(group => (
                  <BoardSectionPanel key={group.id ?? 'inbox'} group={group} activeTarget={overSectionId === (group.id ?? 'inbox')} onAdd={sectionId => setEditor({ sectionId })} onRename={renameSection} onContext={openSectionContext} onToggle={group.id ? () => toggleSection(group.id!) : undefined} selectionMode={selectionMode} selected={Boolean(group.id && selectedSectionIds.includes(group.id))} onToggleSelected={toggleSectionSelection}>
                    <SortableContext items={group.pins.map(pin => `pin:${pin.id}`)} strategy={rectSortingStrategy}>
                      <div className="compact-pin-list">
                        {group.pins.map(pin => renderPin(pin, 'compact'))}
                      </div>
                    </SortableContext>
                  </BoardSectionPanel>
                ))}
              </div>
            )}
          </div>

          <DragOverlay dropAnimation={{ duration: 210, easing: 'cubic-bezier(.2,.8,.2,1)' }}>{activePin ? <PinOverlay pin={activePin} /> : null}</DragOverlay>
        </DndContext>
      </section>

      <MobileNav onAdd={() => setEditor({ sectionId: null })} onFocusSearch={() => searchRef.current?.focus()} />
      {editor && <PinEditor
        boardId={editor.pin?.board_id ?? currentBoard.id}
        boards={destinationBoards}
        sections={sections}
        allSections={destinationSections}
        allPins={destinationPins}
        targetSectionId={editor.sectionId ?? null}
        existingPin={editor.pin ?? null}
        existingPins={pins}
        allowBoardChange
        initialUrl={editor.initialUrl}
        onClose={() => setEditor(null)}
        onSaved={onSaved}
      />}
      {settingsOpen && <BoardSettingsPanel board={currentBoard} pins={pins} onClose={() => setSettingsOpen(false)} onSaved={(next) => { setCurrentBoard(next); setSettingsOpen(false); }} />}
      {playing && <VideoLightbox pin={playing} onClose={() => setPlaying(null)} />}
      {detailPin && <PinDetailModal pin={detailPin} onClose={() => setDetailPin(null)} onEdit={(pin) => { setDetailPin(null); setEditor({ pin, sectionId: pin.section_id }); }} onPlay={setPlaying} />}
      {pinContext && <ContextMenu x={pinContext.x} y={pinContext.y} onClose={() => setPinContext(null)} items={[
        { label: 'Öffnen', icon: pinMenuIcons.open, onSelect: () => setDetailPin(pinContext.pin) },
        { label: 'Umbenennen', icon: pinMenuIcons.edit, onSelect: () => { setRenameError(''); setRename({ kind: 'pin', pin: pinContext.pin }); } },
        { label: 'Bearbeiten', icon: pinMenuIcons.edit, onSelect: () => setEditor({ pin: pinContext.pin, sectionId: pinContext.pin.section_id }) },
        { label: 'Verschieben', icon: pinMenuIcons.move, onSelect: () => setMovePin({ pin: pinContext.pin }) },
        { label: 'Duplizieren', icon: pinMenuIcons.duplicate, onSelect: () => duplicatePin(pinContext.pin) },
        { label: 'Archivieren', icon: pinMenuIcons.archive, onSelect: () => archivePin(pinContext.pin) },
        { label: 'Löschen', icon: pinMenuIcons.delete, danger: true, onSelect: () => requestDeletePin(pinContext.pin) }
      ]} />}
      {bulkMove && <BulkMoveDialog count={selectedPinIds.length} groups={groups} onClose={() => setBulkMove(null)} onMove={moveSelectedPinsToSection} />}
      {movePin && <PinMoveDialog pin={movePin.pin} groups={groups} currentSectionId={movePin.pin.section_id ?? null} onClose={() => setMovePin(null)} onMove={(sectionId) => movePinToSection(movePin.pin, sectionId)} />}
      {sectionContext && <ContextMenu x={sectionContext.x} y={sectionContext.y} onClose={() => setSectionContext(null)} items={[
        { label: 'Anzeigen', icon: Filter, onSelect: () => { setViewMode('detailed'); setSectionFilter(sectionContext.group.id ?? 'inbox'); } },
        { label: 'Umbenennen', icon: Settings, disabled: !sectionContext.group.id, onSelect: () => requestRenameSection(sectionContext.group) },
        { label: 'Nach oben', icon: ArrowUp, disabled: !sectionContext.group.id, onSelect: () => sectionContext.group.id && moveSection(sectionContext.group.id, -1) },
        { label: 'Nach unten', icon: ArrowDown, disabled: !sectionContext.group.id, onSelect: () => sectionContext.group.id && moveSection(sectionContext.group.id, 1) },
        { label: 'Alphabetisch sortieren', icon: List, onSelect: sortSectionsAlphabetically },
        { label: 'Löschen', icon: Trash2, disabled: !sectionContext.group.id, danger: true, onSelect: () => requestDeleteSection(sectionContext.group) }
      ]} />}
      {rename && <RenameDialog title={rename.kind === 'pin' ? 'Pin umbenennen' : 'Teilbereich umbenennen'} initialValue={rename.kind === 'pin' ? (rename.pin.title || rename.pin.file_name || 'Unbenannter Pin') : rename.group.title} saving={renameSaving} error={renameError} onCancel={() => setRename(null)} onSubmit={submitRename} />}
      {confirm && <ConfirmDialog title={confirm.title} message={confirm.message} confirmLabel={confirm.confirmLabel} onCancel={() => setConfirm(null)} onConfirm={confirm.onConfirm} />}
    </main>
  );
}
