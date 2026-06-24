'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, ExternalLink, Grid2X2, LogOut, Plus, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';
import type { Board, BoardSection, Pin } from '@/lib/types';
import { PinEditor } from './PinEditor';
import { PinDestinationSelector } from './PinDestinationSelector';

type Props = {
  boards: Board[];
  sections: BoardSection[];
  pins: Pin[];
  userEmail: string;
  initialUrl?: string;
  initialTitle?: string;
  initialDescription?: string;
  initialImageUrl?: string;
  initialBoardId?: string;
  initialSectionId?: string;
};

const LAST_BOARD_KEY = 'pinboard-last-capture-board';
const sectionKey = (boardId: string) => `pinboard-last-capture-section:${boardId}`;

function sanitizeInitial(value?: string) {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function chooseInitialBoard(boards: Board[], requested?: string) {
  if (requested && boards.some(board => board.id === requested)) return requested;
  return boards[0]?.id ?? '';
}

export function CaptureClient({ boards, sections, pins, userEmail, initialUrl = '', initialTitle = '', initialDescription = '', initialImageUrl = '', initialBoardId = '', initialSectionId = '' }: Props) {
  const requestedBoardId = sanitizeInitial(initialBoardId);
  const requestedSectionId = sanitizeInitial(initialSectionId);
  const [selectedBoardId, setSelectedBoardId] = useState(() => chooseInitialBoard(boards, requestedBoardId));
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(requestedSectionId || null);
  const [editorOpen, setEditorOpen] = useState(Boolean(boards[0]));
  const [savedPin, setSavedPin] = useState<Pin | null>(null);
  const supabase = createClient();

  const selectedBoard = useMemo(() => boards.find(board => board.id === selectedBoardId) ?? boards[0] ?? null, [boards, selectedBoardId]);
  const boardSections = useMemo(() => selectedBoard ? sections.filter(section => section.board_id === selectedBoard.id) : [], [sections, selectedBoard]);
  const boardPins = useMemo(() => selectedBoard ? pins.filter(pin => pin.board_id === selectedBoard.id) : [], [pins, selectedBoard]);

  useEffect(() => {
    if (!boards.length) return;
    if (requestedBoardId && boards.some(board => board.id === requestedBoardId)) return;
    const stored = localStorage.getItem(LAST_BOARD_KEY);
    if (stored && boards.some(board => board.id === stored)) setSelectedBoardId(stored);
  }, [boards, requestedBoardId]);

  useEffect(() => {
    if (!selectedBoardId) return;
    localStorage.setItem(LAST_BOARD_KEY, selectedBoardId);
    const validSection = !selectedSectionId || sections.some(section => section.id === selectedSectionId && section.board_id === selectedBoardId);
    if (!validSection) {
      const storedSection = localStorage.getItem(sectionKey(selectedBoardId));
      if (storedSection && sections.some(section => section.id === storedSection && section.board_id === selectedBoardId)) {
        setSelectedSectionId(storedSection);
      } else {
        setSelectedSectionId(null);
      }
    }
  }, [selectedBoardId, selectedSectionId, sections]);

  useEffect(() => {
    if (selectedBoardId && selectedSectionId && sections.some(section => section.id === selectedSectionId && section.board_id === selectedBoardId)) {
      localStorage.setItem(sectionKey(selectedBoardId), selectedSectionId);
    }
  }, [selectedBoardId, selectedSectionId, sections]);

  function chooseBoard(boardId: string) {
    setSelectedBoardId(boardId);
    const storedSection = localStorage.getItem(sectionKey(boardId));
    if (storedSection && sections.some(section => section.id === storedSection && section.board_id === boardId)) {
      setSelectedSectionId(storedSection);
    } else {
      setSelectedSectionId(null);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  return (
    <main className="app-shell dashboard-shell capture-shell min-h-dvh pb-24">
      <header className="dashboard-topbar dashboard-topbar-clean">
        <Link href="/boards" className="btn-ghost h-10 px-3 text-sm"><ArrowLeft size={16} /> Alle Boards</Link>
        <div className="topbar-actions">
          <a href={initialUrl || undefined} target="_blank" rel="noreferrer" className={`btn-ghost h-10 px-3 text-sm ${initialUrl ? '' : 'pointer-events-none opacity-40'}`}><ExternalLink size={15} /> Quelle</a>
          <button onClick={signOut} className="btn-ghost hidden h-10 px-3 text-sm md:inline-flex"><LogOut size={15} /> {userEmail}</button>
        </div>
      </header>

      <section className="dashboard-hero dashboard-hero-compact dashboard-hero-raised capture-hero">
        <div>
          <p className="hero-eyebrow"><Sparkles size={13} /> Quick Capture</p>
          <h1>Pin aus Opera hinzufügen</h1>
          <p>Die aktuelle Seite wird vorbereitet. Wähle Ziel-Board und Bereich, prüfe Titel/Cover und speichere den Pin.</p>
        </div>
        <div className="hero-control-panel hero-control-panel-inline clean-toolbar capture-target-panel">
          <PinDestinationSelector
            boards={boards}
            sections={sections}
            selectedBoardId={selectedBoardId}
            selectedSectionId={selectedSectionId}
            onBoardChange={chooseBoard}
            onSectionChange={setSelectedSectionId}
            compact
          />
          <button type="button" onClick={() => { setSavedPin(null); setEditorOpen(true); }} disabled={!selectedBoard} className="btn-primary h-11 px-4 text-sm"><Plus size={17} /> Capture öffnen</button>
        </div>
      </section>

      <section className="capture-summary-card">
        {savedPin ? (
          <div className="capture-success"><span><Check size={18} /></span><div><h2>Pin gespeichert</h2><p>„{savedPin.title || savedPin.url || 'Unbenannter Pin'}“ wurde in {boards.find(board => board.id === savedPin.board_id)?.title ?? selectedBoard?.title ?? 'deinem Board'} abgelegt.</p><Link href={`/boards/${savedPin.board_id}`} className="btn-ghost mt-4 h-10 px-3 text-sm">Board öffnen</Link></div></div>
        ) : (
          <>
            <p className="hero-eyebrow">Eingehende Daten</p>
            <h2>{sanitizeInitial(initialTitle) || 'Neue Website'}</h2>
            <p>{sanitizeInitial(initialDescription) || initialUrl || 'Keine URL übergeben. Öffne Capture über die Browsererweiterung oder das Bookmarklet.'}</p>
            {initialImageUrl && <img src={initialImageUrl} alt="" className="capture-preview-image" />}
            {initialUrl && <code>{initialUrl}</code>}
          </>
        )}
      </section>

      {!boards.length && <section className="empty-board-state"><div><h3>Noch kein Board vorhanden</h3><p>Erstelle zuerst ein Board, damit Quick Capture Pins ablegen kann.</p><Link href="/boards" className="btn-primary mt-4 h-10 px-4 text-sm">Zu den Boards</Link></div></section>}

      {editorOpen && selectedBoard && <PinEditor
        boardId={selectedBoard.id}
        boards={boards}
        sections={boardSections}
        allSections={sections}
        allPins={pins}
        targetSectionId={selectedSectionId}
        existingPins={boardPins}
        initialUrl={initialUrl}
        initialTitle={sanitizeInitial(initialTitle)}
        initialDescription={sanitizeInitial(initialDescription)}
        initialImageUrl={initialImageUrl}
        allowBoardChange
        onDestinationChange={(boardId, sectionId) => { setSelectedBoardId(boardId); setSelectedSectionId(sectionId); }}
        onClose={() => setEditorOpen(false)}
        onSaved={(pin) => {
          localStorage.setItem(LAST_BOARD_KEY, pin.board_id);
          if (pin.section_id) localStorage.setItem(sectionKey(pin.board_id), pin.section_id);
          setSelectedBoardId(pin.board_id);
          setSelectedSectionId(pin.section_id ?? null);
          setSavedPin(pin);
          setEditorOpen(false);
        }}
      />}
    </main>
  );
}
