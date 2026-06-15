'use client';

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, LogOut, Moon, Pencil, Plus, Search, Sun, Trash2, UploadCloud, ExternalLink } from 'lucide-react';
import { Board } from '@/lib/types';
import { createClient } from '@/lib/supabase/browser';
import { MobileNav } from '@/components/pinboard/MobileNav';
import { ContextMenu } from '@/components/pinboard/ContextMenu';
import { ConfirmDialog } from '@/components/pinboard/ConfirmDialog';

type Props = { boards: Board[]; userEmail: string };
type BoardContext = null | { board: Board; x: number; y: number };
type ConfirmState = null | { title: string; message: string; confirmLabel?: string; onConfirm: () => void };

export function BoardDashboard({ boards: initialBoards, userEmail }: Props) {
  const [boards, setBoards] = useState(initialBoards);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [context, setContext] = useState<BoardContext>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const router = useRouter();

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return boards.filter(board => !board.archived_at && !board.deleted_at && (!q || [board.title, board.description].filter(Boolean).join(' ').toLowerCase().includes(q)));
  }, [boards, query]);

  async function createBoard() {
    setCreating(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data } = await supabase.from('boards').insert({ user_id: userData.user.id, title: `Board ${boards.length + 1}`, description: 'Neue visuelle Sammlung' }).select('*').single();
    if (data) setBoards(current => [data as Board, ...current]);
    setCreating(false);
  }

  async function archiveBoard(board: Board) {
    setBoards(current => current.map(item => item.id === board.id ? { ...item, archived_at: new Date().toISOString() } : item));
    await supabase.from('boards').update({ archived_at: new Date().toISOString() }).eq('id', board.id);
  }

  function requestDeleteBoard(board: Board) {
    setConfirm({
      title: 'Board wirklich löschen?',
      message: `„${board.title}“ wird aus der aktiven Ansicht entfernt. Pins bleiben über die Datenbank wiederherstellbar, bis endgültig gelöscht wird.`,
      confirmLabel: 'Board löschen',
      onConfirm: () => deleteBoard(board)
    });
  }

  async function deleteBoard(board: Board) {
    setConfirm(null);
    setBoards(current => current.filter(item => item.id !== board.id));
    await supabase.from('boards').update({ deleted_at: new Date().toISOString() }).eq('id', board.id);
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

  function openBoardContext(event: React.MouseEvent, board: Board) {
    event.preventDefault();
    setContext({ board, x: event.clientX, y: event.clientY });
  }

  return (
    <main className="app-shell min-h-dvh px-4 py-4 pb-24 md:px-7 md:py-6 md:pb-8">
      <header className="mx-auto mb-5 flex max-w-[1800px] flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.34em] text-[var(--accent)]">Pinboard</p>
          <h1 className="text-4xl font-semibold tracking-[-0.07em] md:text-6xl">Deine visuellen Sammlungen.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">Links, Medien, Dateien und Inspirationen in hochwertigen Boards, reduziert auf das Wesentliche.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/archive" className="btn-ghost h-10 px-3 text-sm"><Archive size={16} /> Archiv</Link>
          <button onClick={toggleTheme} className="btn-ghost h-10 px-3"><Moon size={16} /><Sun size={16} className="opacity-50" /></button>
          <button onClick={signOut} className="btn-ghost h-10 px-3 text-sm"><LogOut size={16} /> {userEmail}</button>
          <button onClick={createBoard} disabled={creating} className="btn-primary h-10 px-4 text-sm"><Plus size={17} /> Neues Board</button>
        </div>
      </header>

      <section className="glass mx-auto max-w-[1800px] rounded-[10px] p-3 md:p-4">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <label className="field flex max-w-xl items-center gap-2 p-0 px-3">
            <Search size={17} className="text-[var(--muted)]" />
            <input ref={searchRef} value={query} onChange={event => setQuery(event.target.value)} placeholder="Boards suchen ..." className="h-11 flex-1 bg-transparent outline-none" />
          </label>
          <div className="pill px-3 py-2 text-xs"><UploadCloud size={15} /> Rechtsklick auf ein Board öffnet Aktionen</div>
        </div>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,320px))] justify-start gap-4">
          {filtered.map(board => (
            <article key={board.id} onContextMenu={(event) => openBoardContext(event, board)} onClick={() => router.push(`/boards/${board.id}`)} className="board-card group relative h-[340px] cursor-pointer overflow-hidden rounded-[8px] border border-[var(--line)] bg-white/[0.045] shadow-lift transition duration-300 hover:-translate-y-1 hover:border-[var(--line-strong)]">
              {board.cover_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={board.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]" />
              ) : (
                <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,.095),rgba(255,255,255,.02)),radial-gradient(circle_at_30%_20%,rgba(255,255,255,.13),transparent_34%)]" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/18 to-transparent" />
              <div className="board-card-glass">
                <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.28em] text-white/55">Board</p>
                <h2 className="line-clamp-2 text-xl font-semibold tracking-[-0.045em]">{board.title}</h2>
                {board.description && <p className="mt-2 line-clamp-2 text-sm leading-5 text-white/70">{board.description}</p>}
              </div>
            </article>
          ))}
        </div>

        {!filtered.length && <div className="grid min-h-72 place-items-center rounded-[10px] border border-dashed border-[var(--line)] text-center text-[var(--muted)]">Keine Boards gefunden.</div>}
      </section>
      <MobileNav onAdd={createBoard} onFocusSearch={() => searchRef.current?.focus()} />
      {context && <ContextMenu x={context.x} y={context.y} onClose={() => setContext(null)} items={[
        { label: 'Öffnen', icon: ExternalLink, onSelect: () => router.push(`/boards/${context.board.id}`) },
        { label: 'Bearbeiten', icon: Pencil, onSelect: () => router.push(`/boards/${context.board.id}`) },
        { label: 'Archivieren', icon: Archive, onSelect: () => archiveBoard(context.board) },
        { label: 'Löschen', icon: Trash2, danger: true, onSelect: () => requestDeleteBoard(context.board) }
      ]} />}
      {confirm && <ConfirmDialog title={confirm.title} message={confirm.message} confirmLabel={confirm.confirmLabel} onCancel={() => setConfirm(null)} onConfirm={confirm.onConfirm} />}
    </main>
  );
}
