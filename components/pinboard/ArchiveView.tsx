'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, RotateCcw, Trash2 } from 'lucide-react';
import { Board, Pin } from '@/lib/types';
import { createClient } from '@/lib/supabase/browser';
import { RemoteImage } from './RemoteImage';
import { ConfirmDialog } from './ConfirmDialog';

type ConfirmState = null | { title: string; message: string; confirmLabel?: string; onConfirm: () => void };

export function ArchiveView({ boards: initialBoards, pins: initialPins }: { boards: Board[]; pins: Pin[] }) {
  const [boards, setBoards] = useState(initialBoards);
  const [pins, setPins] = useState(initialPins);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const supabase = createClient();

  async function restoreBoard(board: Board) {
    setBoards(current => current.filter(item => item.id !== board.id));
    await supabase.from('boards').update({ archived_at: null }).eq('id', board.id);
  }

  async function restorePin(pin: Pin) {
    setPins(current => current.filter(item => item.id !== pin.id));
    await supabase.from('pins').update({ archived_at: null }).eq('id', pin.id);
  }

  function requestDeleteBoard(board: Board) {
    setConfirm({ title: 'Board endgültig löschen?', message: `„${board.title}“ wird endgültig gelöscht.`, confirmLabel: 'Endgültig löschen', onConfirm: async () => {
      setConfirm(null);
      setBoards(current => current.filter(item => item.id !== board.id));
      await supabase.from('boards').delete().eq('id', board.id);
    }});
  }

  function requestDeletePin(pin: Pin) {
    setConfirm({ title: 'Pin endgültig löschen?', message: `„${pin.title || 'Unbenannter Pin'}“ wird endgültig gelöscht.`, confirmLabel: 'Endgültig löschen', onConfirm: async () => {
      setConfirm(null);
      setPins(current => current.filter(item => item.id !== pin.id));
      await supabase.from('pins').delete().eq('id', pin.id);
    }});
  }

  return (
    <main className="app-shell min-h-dvh px-4 py-4 md:px-7 md:py-6">
      <header className="mx-auto mb-5 flex max-w-[1800px] items-center justify-between gap-3">
        <div>
          <Link href="/boards" className="mb-4 inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--text)]"><ArrowLeft size={16} /> Zurück</Link>
          <p className="font-mono text-[11px] uppercase tracking-[0.34em] text-[var(--accent)]">Archiv</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.07em]">Archivierte Elemente</h1>
        </div>
      </header>

      <section className="glass mx-auto max-w-[1800px] rounded-[10px] p-4">
        <h2 className="mb-3 text-xl font-semibold tracking-[-0.04em]">Boards</h2>
        <div className="archive-grid">
          {boards.map(board => <article key={board.id} className="archive-card">
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">Board</p>
            <h3 className="mt-2 text-lg font-semibold">{board.title}</h3>
            {board.description && <p className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">{board.description}</p>}
            <div className="mt-4 flex gap-2"><button onClick={() => restoreBoard(board)} className="btn-ghost px-3 py-2 text-sm"><RotateCcw size={14} /> Wiederherstellen</button><button onClick={() => requestDeleteBoard(board)} className="btn-danger px-3 py-2 text-sm"><Trash2 size={14} /> Löschen</button></div>
          </article>)}
          {!boards.length && <p className="text-sm text-[var(--muted)]">Keine archivierten Boards.</p>}
        </div>

        <h2 className="mb-3 mt-8 text-xl font-semibold tracking-[-0.04em]">Pins</h2>
        <div className="archive-grid">
          {pins.map(pin => <article key={pin.id} className="archive-card">
            {pin.image_url && <RemoteImage src={pin.image_url} pageUrl={pin.url} alt="" className="mb-3 h-36 w-full rounded-[7px] object-cover" />}
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">Pin</p>
            <h3 className="mt-2 text-lg font-semibold">{pin.title || 'Unbenannter Pin'}</h3>
            {pin.description && <p className="mt-1 line-clamp-3 text-sm text-[var(--muted)]">{pin.description}</p>}
            <div className="mt-4 flex gap-2"><button onClick={() => restorePin(pin)} className="btn-ghost px-3 py-2 text-sm"><RotateCcw size={14} /> Wiederherstellen</button><button onClick={() => requestDeletePin(pin)} className="btn-danger px-3 py-2 text-sm"><Trash2 size={14} /> Löschen</button></div>
          </article>)}
          {!pins.length && <p className="text-sm text-[var(--muted)]">Keine archivierten Pins.</p>}
        </div>
      </section>
      {confirm && <ConfirmDialog title={confirm.title} message={confirm.message} confirmLabel={confirm.confirmLabel} onCancel={() => setConfirm(null)} onConfirm={confirm.onConfirm} />}
    </main>
  );
}
