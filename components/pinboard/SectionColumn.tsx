'use client';

import { CSS } from '@dnd-kit/utilities';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { BoardSection, Pin } from '@/lib/types';
import { PinCard } from './PinCard';

export function SectionColumn({
  section,
  pins,
  onAddPin,
  onEditPin,
  onDeletePin,
  onDuplicatePin,
  onArchivePin,
  onRenameSection,
  onDeleteSection
}: {
  section: BoardSection;
  pins: Pin[];
  onAddPin: (section: BoardSection) => void;
  onEditPin: (pin: Pin) => void;
  onDeletePin: (pin: Pin) => void;
  onDuplicatePin: (pin: Pin) => void;
  onArchivePin: (pin: Pin) => void;
  onRenameSection: (section: BoardSection, title: string) => void;
  onDeleteSection: (section: BoardSection) => void;
}) {
  const sortable = useSortable({ id: `section:${section.id}` });
  const droppable = useDroppable({ id: `section-drop:${section.id}` });
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition
  };

  return (
    <section
      ref={sortable.setNodeRef}
      style={style}
      className={`flex max-h-[calc(100vh-10rem)] min-h-[24rem] w-[22rem] shrink-0 flex-col rounded-[2rem] border border-[var(--line)] bg-white/55 shadow-sm backdrop-blur-xl dark:bg-white/10 ${sortable.isDragging ? 'opacity-60 shadow-soft' : ''}`}
    >
      <header className="flex items-center gap-2 border-b border-[var(--line)] p-4">
        <button {...sortable.attributes} {...sortable.listeners} className="touch-none rounded-xl p-1 text-[var(--muted)] hover:bg-black/5 dark:hover:bg-white/10" aria-label="Bereich verschieben">
          <GripVertical size={18} />
        </button>
        <input
          value={section.title}
          onChange={event => onRenameSection(section, event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-lg font-semibold outline-none"
          aria-label="Bereichsname"
        />
        <button onClick={() => onAddPin(section)} className="rounded-xl p-2 hover:bg-black/5 dark:hover:bg-white/10" aria-label="Pin hinzufügen"><Plus size={18} /></button>
        <button onClick={() => onDeleteSection(section)} className="rounded-xl p-2 text-[var(--muted)] hover:bg-red-500/10 hover:text-red-500" aria-label="Bereich löschen"><Trash2 size={16} /></button>
      </header>

      <SortableContext items={pins.map(pin => `pin:${pin.id}`)} strategy={verticalListSortingStrategy}>
        <div ref={droppable.setNodeRef} className="board-scroll flex-1 space-y-3 overflow-y-auto p-3">
          {pins.map(pin => (
            <PinCard key={pin.id} pin={pin} onEdit={onEditPin} onDelete={onDeletePin} onDuplicate={onDuplicatePin} onArchive={onArchivePin} />
          ))}
          {!pins.length && (
            <button onClick={() => onAddPin(section)} className="grid min-h-40 w-full place-items-center rounded-[1.5rem] border border-dashed border-[var(--line)] text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]">
              Ersten Pin hinzufügen
            </button>
          )}
        </div>
      </SortableContext>
    </section>
  );
}
