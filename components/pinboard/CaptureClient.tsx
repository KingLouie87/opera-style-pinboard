'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, ExternalLink, Grid2X2, LogOut, Plus, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';
import type { Board, BoardSection, Pin } from '@/lib/types';
import { PinEditor } from './PinEditor';

type Props = {
  boards: Board[];
  sections: BoardSection[];
  pins: Pin[];
  userEmail: string;
  initialUrl?: string;
  initialTitle?: string;
  initialDescription?: string;
  initialImageUrl?: string;
};

function boardLabel(board: Board) {
  const group = board.board_group?.trim();
  const workspace = board.workspace_type === 'business' ? 'Business' : 'Private';
  return `${board.title}${group ? ` · ${group}` : ''} · ${workspace}`;
}

function sanitizeInitial(value?: string) {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

export function CaptureClient({ boards, sections, pins, userEmail, initialUrl = '', initialTitle = '', initialDescription = '', initialImageUrl = '' }: Props) {
  const [selectedBoardId, setSelectedBoardId] = useState(boards[0]?.id ?? '');
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(Boolean(boards[0]));
  const [savedPin, setSavedPin] = useState<Pin | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const stored = localStorage.getItem('pinboard-last-capture-board');
    if (stored && boards.some(board => board.id === stored)) setSelectedBoardId(stored);
  }, [boards]);

  useEffect(() => {
    if (selectedBoardId) localStorage.setItem('pinboard-last-capture-board', selectedBoardId);
    setSelectedSectionId(null);
  }, [selectedBoardId]);

  const selectedBoard = useMemo(() => boards.find(board => board.id === selectedBoardId) ?? boards[0] ?? null, [boards, selectedBoardId]);
  const boardSections = useMemo(() => selectedBoard ? sections.filter(section => section.board_id === selectedBoard.id) : [], [sections, selectedBoard]);
  const boardPins = useMemo(() => selectedBoard ? pins.filter(pin => pin.board_id === selectedBoard.id) : [], [pins, selectedBoard]);

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
          <p>Die aktuelle Seite wird vorbereitet. Wähle nur noch Ziel-Board und Bereich, prüfe Titel/Cover und speichere den Pin.</p>
        </div>
        <div className="hero-control-panel hero-control-panel-inline clean-toolbar capture-target-panel">
          <label className="capture-field">
            <span>Board</span>
            <select value={selectedBoardId} onChange={event => setSelectedBoardId(event.target.value)} className="field app-select">
              {boards.map(board => <option key={board.id} value={board.id}>{boardLabel(board)}</option>)}
            </select>
          </label>
          <label className="capture-field">
            <span>Bereich</span>
            <select value={selectedSectionId ?? ''} onChange={event => setSelectedSectionId(event.target.value || null)} className="field app-select" disabled={!selectedBoard}>
              <option value="">Ohne Teilbereich</option>
              {boardSections.map(section => <option key={section.id} value={section.id}>{section.title}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => { setSavedPin(null); setEditorOpen(true); }} disabled={!selectedBoard} className="btn-primary h-11 px-4 text-sm"><Plus size={17} /> Capture öffnen</button>
        </div>
      </section>

      <section className="capture-summary-card">
        {savedPin ? (
          <div className="capture-success"><span><Check size={18} /></span><div><h2>Pin gespeichert</h2><p>„{savedPin.title || savedPin.url || 'Unbenannter Pin'}“ wurde in {selectedBoard?.title ?? 'deinem Board'} abgelegt.</p><Link href={`/boards/${savedPin.board_id}`} className="btn-ghost mt-4 h-10 px-3 text-sm">Board öffnen</Link></div></div>
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
        sections={boardSections}
        targetSectionId={selectedSectionId}
        existingPins={boardPins}
        initialUrl={initialUrl}
        initialTitle={sanitizeInitial(initialTitle)}
        initialDescription={sanitizeInitial(initialDescription)}
        initialImageUrl={initialImageUrl}
        onClose={() => setEditorOpen(false)}
        onSaved={(pin) => { setSavedPin(pin); setEditorOpen(false); }}
      />}
    </main>
  );
}
