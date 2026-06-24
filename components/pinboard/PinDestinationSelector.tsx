'use client';

import type { Board, BoardSection } from '@/lib/types';

type Props = {
  boards: Board[];
  sections: BoardSection[];
  selectedBoardId: string;
  selectedSectionId: string | null;
  onBoardChange: (boardId: string) => void;
  onSectionChange: (sectionId: string | null) => void;
  disabled?: boolean;
  compact?: boolean;
};

function boardLabel(board: Board) {
  const group = board.board_group?.trim();
  const workspace = board.workspace_type === 'business' ? 'Business' : 'Private';
  return `${board.title}${group ? ` · ${group}` : ''} · ${workspace}`;
}

export function PinDestinationSelector({ boards, sections, selectedBoardId, selectedSectionId, onBoardChange, onSectionChange, disabled = false, compact = false }: Props) {
  const boardSections = sections.filter(section => section.board_id === selectedBoardId);
  const selectedBoard = boards.find(board => board.id === selectedBoardId) ?? null;

  if (!boards.length) {
    return (
      <section className="pin-destination-selector pin-destination-selector-empty">
        <p className="pin-destination-kicker">Zielort</p>
        <h3>Noch kein Board vorhanden</h3>
        <p>Erstelle zuerst ein Board, damit dieser Pin gespeichert werden kann.</p>
      </section>
    );
  }

  return (
    <section className={`pin-destination-selector ${compact ? 'pin-destination-selector-compact' : ''}`}>
      <div className="pin-destination-title-row">
        <div>
          <p className="pin-destination-kicker">Zielort</p>
          <h3>{selectedBoard ? selectedBoard.title : 'Board wählen'}</h3>
        </div>
        <span>{boardSections.length ? `${boardSections.length} Bereiche` : 'Inbox'}</span>
      </div>

      <div className="pin-destination-grid">
        <label className="capture-field pin-destination-field">
          <span>Board</span>
          <select value={selectedBoardId} onChange={event => onBoardChange(event.target.value)} className="field app-select" disabled={disabled || boards.length <= 1}>
            {boards.map(board => <option key={board.id} value={board.id}>{boardLabel(board)}</option>)}
          </select>
        </label>
        <label className="capture-field pin-destination-field">
          <span>Bereich</span>
          <select value={selectedSectionId ?? ''} onChange={event => onSectionChange(event.target.value || null)} className="field app-select" disabled={disabled || !selectedBoardId}>
            <option value="">Ohne Teilbereich / Inbox</option>
            {boardSections.map(section => <option key={section.id} value={section.id}>{section.title}</option>)}
          </select>
        </label>
      </div>
    </section>
  );
}
