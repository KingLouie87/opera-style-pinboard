'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  closestCorners,
  DndContext,
  DragEndEvent,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import { arrayMove, horizontalListSortingStrategy, SortableContext, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { ArrowLeft, Moon, Plus, RotateCcw, Search, Sun } from 'lucide-react';
import { Board, BoardSection, Pin } from '@/lib/types';
import { createClient } from '@/lib/supabase/browser';
import { normalizePositions, nextPosition } from '@/lib/position';
import { SectionColumn } from './SectionColumn';
import { PinEditor } from './PinEditor';

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

export function PinboardClient({ board, initialSections, initialPins }: { board: Board; initialSections: BoardSection[]; initialPins: Pin[] }) {
  const [sections, setSections] = useState(initialSections);
  const [pins, setPins] = useState(initialPins);
  const [editor, setEditor] = useState<EditorState>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dark, setDark] = useState(false);
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
      .insert({ board_id: board.id, user_id: userData.user.id, title, position: nextPosition(sections) })
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

  return (
    <main className={dark ? 'dark min-h-screen' : 'min-h-screen'}>
      <div className="min-h-screen p-4 md:p-6">
        <header className="glass-strong sticky top-4 z-20 mx-auto mb-5 flex max-w-[1800px] flex-col gap-4 rounded-[2rem] p-4 shadow-soft md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <Link href="/boards" className="mb-2 inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--accent)]"><ArrowLeft size={16} /> Boards</Link>
            <h1 className="truncate text-3xl font-semibold tracking-tight md:text-4xl">{board.title}</h1>
            {board.description && <p className="mt-1 line-clamp-1 text-sm text-[var(--muted)]">{board.description}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex min-w-56 flex-1 items-center gap-2 rounded-2xl border border-[var(--line)] bg-white/50 px-3 py-2 dark:bg-white/10">
              <Search size={16} className="text-[var(--muted)]" />
              <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Pins suchen ..." className="w-full bg-transparent text-sm outline-none" />
            </label>
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className="rounded-2xl border border-[var(--line)] bg-white/50 px-3 py-2 text-sm outline-none dark:bg-white/10">
              <option value="">Alle Status</option>
              {statuses.map(status => <option key={status} value={status}>{status}</option>)}
            </select>
            <button onClick={addSection} className="inline-flex items-center gap-2 rounded-2xl bg-[var(--accent)] px-4 py-2 font-semibold text-white"><Plus size={18} /> Bereich</button>
            <button onClick={() => setDark(value => !value)} className="rounded-2xl border border-[var(--line)] p-2 hover:bg-black/5 dark:hover:bg-white/10" aria-label="Theme wechseln">{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
          </div>
        </header>

        {undo && (
          <div className="mx-auto mb-4 flex max-w-[1800px] items-center justify-between rounded-2xl border border-[var(--line)] bg-black/80 px-4 py-3 text-sm text-white shadow-soft">
            <span>{undo.label} vorgemerkt.</span>
            <button onClick={undoLast} className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-3 py-1.5 hover:bg-white/25"><RotateCcw size={15} /> Rückgängig</button>
          </div>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <SortableContext items={sections.map(section => `section:${section.id}`)} strategy={horizontalListSortingStrategy}>
            <div className="board-scroll mx-auto flex max-w-[1800px] gap-4 overflow-x-auto pb-5">
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

              <button onClick={addSection} className="grid h-80 w-[22rem] shrink-0 place-items-center rounded-[2rem] border border-dashed border-[var(--line)] bg-white/30 text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] dark:bg-white/5">
                <span className="inline-flex items-center gap-2"><Plus size={18} /> Bereich hinzufügen</span>
              </button>
            </div>
          </SortableContext>
        </DndContext>

        {!sections.length && (
          <div className="mx-auto mt-10 max-w-xl rounded-[2rem] border border-[var(--line)] bg-white/60 p-8 text-center shadow-soft dark:bg-white/10">
            <h2 className="text-2xl font-semibold">Starte mit deinem ersten Bereich.</h2>
            <p className="mt-2 text-[var(--muted)]">Bereiche sind deine frei sortierbaren Zonen, zum Beispiel Recherche, Design, Arbeit oder Später ansehen.</p>
            <button onClick={addSection} className="mt-5 rounded-2xl bg-[var(--accent)] px-5 py-3 font-semibold text-white">Ersten Bereich erstellen</button>
          </div>
        )}

        {editor && (
          <PinEditor
            boardId={board.id}
            section={editor.section}
            existingPin={editor.pin}
            existingPins={pins}
            onClose={() => setEditor(null)}
            onSaved={onSaved}
          />
        )}
      </div>
    </main>
  );
}
