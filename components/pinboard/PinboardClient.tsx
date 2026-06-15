'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  closestCorners,
  DndContext,
  DragOverlay,
  DragEndEvent,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import { arrayMove, horizontalListSortingStrategy, SortableContext, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { ArrowLeft, BookOpen, Plus, RotateCcw, Search, Settings } from 'lucide-react';
import { Board, BoardSection, Pin } from '@/lib/types';
import { createClient } from '@/lib/supabase/browser';
import { normalizePositions, nextPosition } from '@/lib/position';
import { SectionColumn } from './SectionColumn';
import { PinEditor } from './PinEditor';
import { BoardSettingsPanel } from './BoardSettingsPanel';
import { AppShell } from '@/components/platform/AppShell';

type EditorState = null | { section: BoardSection; pin?: Pin | null };

type UndoState = {
  sections: BoardSection[];
  pins: Pin[];
  label: string;
} | null;

function parseId(id: string) {
  const [type, value] = id.split(':');
  return { type, value };
}

export function PinboardClient({ board, initialSections, initialPins, userEmail }: { board: Board; initialSections: BoardSection[]; initialPins: Pin[]; userEmail: string }) {
  const [currentBoard, setCurrentBoard] = useState(board);
  const [sections, setSections] = useState(initialSections);
  const [pins, setPins] = useState(initialPins);
  const [editor, setEditor] = useState<EditorState>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [undo, setUndo] = useState<UndoState>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const supabase = createClient();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 7 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const visiblePins = useMemo(() => {
    const q = search.toLowerCase().trim();
    return pins.filter(pin => {
      const haystack = [pin.title, pin.description, pin.url, pin.notes, ...(pin.tags ?? [])].filter(Boolean).join(' ').toLowerCase();
      const matchesSearch = !q || haystack.includes(q);
      const matchesStatus = !statusFilter || (pin.status ?? '').toLowerCase().includes(statusFilter.toLowerCase());
      return matchesSearch && matchesStatus;
    });
  }, [pins, search, statusFilter]);

  const statuses = useMemo(() => Array.from(new Set(pins.map(pin => pin.status).filter(Boolean))) as string[], [pins]);

  function pinsForSection(sectionId: string) {
    return visiblePins.filter(pin => pin.section_id === sectionId).sort((a, b) => a.position - b.position);
  }

  async function addSection() {
    const title = `Bereich ${sections.length + 1}`;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data } = await supabase
      .from('board_sections')
      .insert({ board_id: currentBoard.id, user_id: userData.user.id, title, position: nextPosition(sections) })
      .select('*')
      .single();
    if (data) setSections(current => [...current, data as BoardSection]);
  }

  async function renameSection(section: BoardSection, title: string) {
    setSections(current => current.map(item => (item.id === section.id ? { ...item, title } : item)));
    await supabase.from('board_sections').update({ title }).eq('id', section.id);
  }

  async function deleteSection(section: BoardSection) {
    if (!confirm(`Bereich "${section.title}" und alle Pins darin löschen?`)) return;
    setSections(current => current.filter(item => item.id !== section.id));
    setPins(current => current.filter(pin => pin.section_id !== section.id));
    await supabase.from('board_sections').delete().eq('id', section.id);
  }

  async function deletePin(pin: Pin) {
    setUndo({ sections, pins, label: 'Pin gelöscht' });
    setPins(current => current.filter(item => item.id !== pin.id));
    await supabase.from('pins').update({ deleted_at: new Date().toISOString() }).eq('id', pin.id);
  }

  async function archivePin(pin: Pin) {
    setUndo({ sections, pins, label: 'Pin archiviert' });
    setPins(current => current.filter(item => item.id !== pin.id));
    await supabase.from('pins').update({ archived_at: new Date().toISOString() }).eq('id', pin.id);
  }

  async function duplicatePin(pin: Pin) {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { id, created_at, updated_at, ...rest } = pin;
    const { data } = await supabase
      .from('pins')
      .insert({ ...rest, user_id: userData.user.id, title: `${pin.title ?? 'Pin'} Kopie`, position: nextPosition(pins.filter(item => item.section_id === pin.section_id)) })
      .select('*')
      .single();
    if (data) setPins(current => [...current, data as Pin]);
  }

  async function undoLast() {
    if (!undo) return;
    const last = undo;
    setSections(last.sections);
    setPins(last.pins);
    setUndo(null);

    await Promise.all(last.sections.map(section =>
      supabase.from('board_sections').update({ title: section.title, position: section.position }).eq('id', section.id)
    ));

    await Promise.all(last.pins.map(pin =>
      supabase.from('pins').update({
        section_id: pin.section_id,
        position: pin.position,
        deleted_at: pin.deleted_at,
        archived_at: pin.archived_at
      }).eq('id', pin.id)
    ));
  }

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  async function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const active = parseId(String(event.active.id));
    if (!event.over) return;
    const overRaw = String(event.over.id);
    const over = parseId(overRaw);

    setUndo({ sections, pins, label: 'Verschiebung' });

    if (active.type === 'section' && over.type === 'section') {
      const oldIndex = sections.findIndex(section => section.id === active.value);
      const newIndex = sections.findIndex(section => section.id === over.value);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
      const reordered = normalizePositions(arrayMove(sections, oldIndex, newIndex));
      setSections(reordered);
      await Promise.all(reordered.map(section => supabase.from('board_sections').update({ position: section.position }).eq('id', section.id)));
      return;
    }

    if (active.type !== 'pin') return;
    const moving = pins.find(pin => pin.id === active.value);
    if (!moving) return;

    let targetSectionId = moving.section_id;
    let targetPinId: string | null = null;

    if (over.type === 'pin') {
      targetPinId = over.value;
      targetSectionId = pins.find(pin => pin.id === over.value)?.section_id ?? moving.section_id;
    }
    if (over.type === 'section-drop') {
      targetSectionId = over.value;
    }
    if (over.type === 'section') {
      targetSectionId = over.value;
    }

    const withoutMoving = pins.filter(pin => pin.id !== moving.id);
    const targetPins = withoutMoving.filter(pin => pin.section_id === targetSectionId).sort((a, b) => a.position - b.position);
    const insertIndex = targetPinId ? Math.max(0, targetPins.findIndex(pin => pin.id === targetPinId)) : targetPins.length;
    const updatedMoving = { ...moving, section_id: targetSectionId };
    const newTargetPins = [...targetPins.slice(0, insertIndex), updatedMoving, ...targetPins.slice(insertIndex)];
    const normalizedTargetPins = normalizePositions(newTargetPins);

    const otherPins = withoutMoving.filter(pin => pin.section_id !== targetSectionId);
    const nextPins = [...otherPins, ...normalizedTargetPins].sort((a, b) => a.position - b.position);
    setPins(nextPins);

    await Promise.all(normalizedTargetPins.map(pin => supabase.from('pins').update({ section_id: pin.section_id, position: pin.position }).eq('id', pin.id)));
  }

  function onSaved(pin: Pin) {
    setPins(current => {
      const exists = current.some(item => item.id === pin.id);
      return exists ? current.map(item => (item.id === pin.id ? pin : item)) : [...current, pin];
    });
    setEditor(null);
  }

  const activePin = activeId?.startsWith('pin:') ? pins.find(pin => pin.id === activeId.slice(4)) : null;

  return (
    <AppShell userEmail={userEmail} active="boards" flush>
      <div className="board-shell flex h-full min-w-0 flex-col">
        <header className="board-topbar z-20 flex min-h-[74px] shrink-0 flex-col gap-3 px-3 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/boards" className="btn-ghost hidden h-9 w-9 shrink-0 lg:inline-flex" aria-label="Zurück zu Boards"><ArrowLeft size={17} /></Link>
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
                <span>Board</span><span className="h-1 w-1 rounded-full bg-[var(--muted)]" /><span>{sections.length} Bereiche</span><span>{pins.length} Pins</span>
              </div>
              <h1 className="truncate text-2xl font-semibold tracking-[-0.055em] md:text-3xl">{currentBoard.title}</h1>
            </div>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2 lg:flex-nowrap lg:justify-end">
            <label className="search-pill min-w-[15rem] flex-1 lg:w-[360px] lg:flex-none"><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Pins, Tags, Links suchen ..." /></label>
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className="field w-auto min-w-[145px] py-2 text-sm">
              <option value="">Alle Status</option>
              {statuses.map(status => <option key={status} value={status}>{status}</option>)}
            </select>
            <Link href="/notes" className="btn-ghost px-3 py-2 text-sm font-semibold"><BookOpen size={17} /> Notizen</Link>
            <button onClick={addSection} className="btn-primary px-3 py-2 text-sm"><Plus size={17} /> Bereich</button>
            <button onClick={() => setSettingsOpen(true)} className="btn-ghost h-9 w-9" aria-label="Board bearbeiten"><Settings size={17} /></button>
          </div>
        </header>

        {currentBoard.description && <div className="hidden shrink-0 border-b border-[var(--line)] bg-black/10 px-5 py-2 text-sm text-[var(--muted)] lg:block">{currentBoard.description}</div>}

        {undo && (
          <div className="mx-3 mt-3 flex shrink-0 items-center justify-between rounded-[8px] border border-[var(--line)] bg-black/70 px-4 py-3 text-sm text-white shadow-soft lg:mx-5">
            <span>{undo.label} vorgemerkt.</span>
            <button onClick={undoLast} className="inline-flex items-center gap-2 rounded-[7px] bg-white/12 px-3 py-1.5 hover:bg-white/20"><RotateCcw size={15} /> Rückgängig</button>
          </div>
        )}

        <section className="board-canvas min-h-0 flex-1 px-3 py-3 lg:px-5 lg:py-4">
          {sections.length ? (
            <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
              <SortableContext items={sections.map(section => `section:${section.id}`)} strategy={horizontalListSortingStrategy}>
                <div className="board-scroll flex h-full min-h-0 w-full gap-3 overflow-x-auto overflow-y-hidden pb-2 pr-2 lg:gap-4">
                  {sections.map(section => (
                    <SectionColumn
                      key={section.id}
                      section={section}
                      pins={pinsForSection(section.id)}
                      onAddPin={section => setEditor({ section })}
                      onEditPin={pin => setEditor({ section: sections.find(item => item.id === pin.section_id) ?? section, pin })}
                      onDeletePin={deletePin}
                      onDuplicatePin={duplicatePin}
                      onArchivePin={archivePin}
                      onRenameSection={renameSection}
                      onDeleteSection={deleteSection}
                    />
                  ))}

                  <button onClick={addSection} className="grid h-full min-h-[24rem] w-[21rem] max-w-[calc(100vw-2rem)] shrink-0 place-items-center rounded-[8px] border border-dashed border-[var(--line)] bg-white/[0.026] text-[var(--muted)] transition hover:border-[var(--accent)] hover:bg-white/[0.045] hover:text-[var(--accent)]">
                    <span className="inline-flex items-center gap-2"><Plus size={18} /> Bereich hinzufügen</span>
                  </button>
                </div>
              </SortableContext>
              <DragOverlay>
                {activePin ? (
                  <div className="pin-drag-overlay w-[21rem] rounded-[8px] border border-[var(--line-strong)] bg-[rgba(18,20,27,.96)] p-4 backdrop-blur-2xl">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Verschieben</p>
                    <h3 className="mt-2 line-clamp-2 text-lg font-semibold tracking-[-0.035em]">{activePin.title || 'Unbenannter Pin'}</h3>
                    {activePin.description && <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--muted)]">{activePin.description}</p>}
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          ) : (
            <div className="grid h-full place-items-center rounded-[10px] border border-dashed border-[var(--line)] bg-white/[0.025] p-6">
              <div className="max-w-xl text-center">
                <h2 className="text-2xl font-semibold">Starte mit deinem ersten Bereich.</h2>
                <p className="mt-2 text-[var(--muted)]">Bereiche sind frei sortierbare Zonen, zum Beispiel Recherche, Design, Arbeit oder Später ansehen.</p>
                <button onClick={addSection} className="btn-primary mt-5 px-5 py-3">Ersten Bereich erstellen</button>
              </div>
            </div>
          )}
        </section>

        {editor && (
          <PinEditor
            boardId={currentBoard.id}
            section={editor.section}
            existingPin={editor.pin}
            existingPins={pins}
            onClose={() => setEditor(null)}
            onSaved={onSaved}
          />
        )}

        {settingsOpen && (
          <BoardSettingsPanel
            board={currentBoard}
            pins={pins}
            onClose={() => setSettingsOpen(false)}
            onBoardSaved={setCurrentBoard}
          />
        )}
      </div>
    </AppShell>
  );
}
