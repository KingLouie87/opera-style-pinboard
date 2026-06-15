'use client';

import { CSS } from '@dnd-kit/utilities';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
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
      className={`pin-column flex h-full min-h-0 w-[21rem] max-w-[calc(100vw-2rem)] shrink-0 flex-col ${sortable.isDragging ? 'opacity-60 shadow-2xl' : ''}`}
    >
      <header className="flex h-[58px] shrink-0 items-center gap-2 border-b border-[var(--line)] px-3">
        <button {...sortable.attributes} {...sortable.listeners} className="touch-none rounded-[6px] p-1.5 text-[var(--muted)] hover:bg-white/10 hover:text-white" aria-label="Bereich verschieben">
          <GripVertical size={17} />
        </button>
        <input
          value={section.title}
          onChange={event => onRenameSection(section, event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-[1rem] font-semibold tracking-[-0.035em] outline-none"
          aria-label="Bereichsname"
        />
        <span className="rounded-[6px] bg-white/[0.055] px-2 py-1 text-[11px] text-[var(--muted)]">{pins.length}</span>
        <button onClick={() => onAddPin(section)} className="rounded-[6px] p-1.5 hover:bg-white/10" aria-label="Pin hinzufügen"><Plus size={17} /></button>
        <button onClick={() => onDeleteSection(section)} className="rounded-[6px] p-1.5 text-[var(--muted)] hover:bg-red-500/10 hover:text-red-300" aria-label="Bereich löschen"><Trash2 size={15} /></button>
      </header>

      <SortableContext items={pins.map(pin => `pin:${pin.id}`)} strategy={verticalListSortingStrategy}>
        <div ref={droppable.setNodeRef} className="board-scroll min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
          {pins.map(pin => <PinCard key={pin.id} pin={pin} onEdit={onEditPin} onDelete={onDeletePin} onDuplicate={onDuplicatePin} onArchive={onArchivePin} />)}
          {!pins.length && (
            <button onClick={() => onAddPin(section)} className="grid min-h-36 w-full place-items-center rounded-[8px] border border-dashed border-[var(--line)] bg-white/[0.02] text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:bg-white/[0.04] hover:text-[var(--accent)]">
              Ersten Pin hinzufügen
            </button>
          )}
        </div>
      </SortableContext>
    </section>
  );
}
