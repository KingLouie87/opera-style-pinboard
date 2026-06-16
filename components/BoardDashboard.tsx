'use client';

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, BriefcaseBusiness, ExternalLink, Home, LogOut, Moon, Pencil, Plus, Search, Sun, Trash2 } from 'lucide-react';
import { Board, WorkspaceType } from '@/lib/types';
import { createClient } from '@/lib/supabase/browser';
import { MobileNav } from '@/components/pinboard/MobileNav';
import { ContextMenu } from '@/components/pinboard/ContextMenu';
import { ConfirmDialog } from '@/components/pinboard/ConfirmDialog';

type Props = { boards: Board[]; userEmail: string };
type BoardContext = null | { board: Board; x: number; y: number };
type ConfirmState = null | { title: string; message: string; confirmLabel?: string; onConfirm: () => void };

function boardWorkspace(board: Board): WorkspaceType {
  return board.workspace_type === 'business' ? 'business' : 'private';
}

function workspaceCopy(workspace: WorkspaceType) {
  return workspace === 'business'
    ? { label: 'Business', eyebrow: 'Strukturierte Recherche', title: 'Business Boards', description: 'Sachliche Sammlungen, Projektmaterial und operative Recherche in einer ruhigen Oberfläche.' }
    : { label: 'Private', eyebrow: 'Visuelle Sammlung', title: 'Private Pinboards', description: 'Inspirationen, Referenzen und persönliche Ideen als hochwertige visuelle Galerie.' };
}

export function BoardDashboard({ boards: initialBoards, userEmail }: Props) {
  const [boards, setBoards] = useState(initialBoards);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [workspace, setWorkspace] = useState<WorkspaceType>('private');
  const [context, setContext] = useState<BoardContext>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const router = useRouter();
  const copy = workspaceCopy(workspace);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return boards.filter(board => {
      const matchesWorkspace = boardWorkspace(board) === workspace;
      const matchesActive = !board.archived_at && !board.deleted_at;
      const matchesSearch = !q || [board.title, board.description].filter(Boolean).join(' ').toLowerCase().includes(q);
      return matchesWorkspace && matchesActive && matchesSearch;
    });
  }, [boards, query, workspace]);

  const workspaceCounts = useMemo(() => ({
    private: boards.filter(board => boardWorkspace(board) === 'private' && !board.archived_at && !board.deleted_at).length,
    business: boards.filter(board => boardWorkspace(board) === 'business' && !board.archived_at && !board.deleted_at).length
  }), [boards]);

  async function createBoard() {
    setCreating(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setCreating(false);
      return;
    }
    const { data } = await supabase
      .from('boards')
      .insert({ user_id: userData.user.id, title: `${copy.label} Board ${filtered.length + 1}`, description: 'Neue visuelle Sammlung', workspace_type: workspace })
      .select('*')
      .single();
    if (data) setBoards(current => [data as Board, ...current]);
    setCreating(false);
  }

  async function archiveBoard(board: Board) {
    const archivedAt = new Date().toISOString();
    setBoards(current => current.map(item => item.id === board.id ? { ...item, archived_at: archivedAt } : item));
    await supabase.from('boards').update({ archived_at: archivedAt }).eq('id', board.id);
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
    const deletedAt = new Date().toISOString();
    setBoards(current => current.filter(item => item.id !== board.id));
    await supabase.from('boards').update({ deleted_at: deletedAt }).eq('id', board.id);
  }

  function openContext(event: React.MouseEvent, board: Board) {
    event.preventDefault();
    event.stopPropagation();
    setContext({ board, x: event.clientX, y: event.clientY });
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

  return (
    <main className={`app-shell award-grid-bg dashboard-shell min-h-dvh pb-24 ${workspace === 'business' ? 'workspace-business' : 'workspace-private'}`}>
      <header className="dashboard-topbar">
        <div className="brand-mark"><span /> Pinboard</div>
        <div className="workspace-switch" role="tablist" aria-label="Workspace wählen">
          <button type="button" role="tab" aria-selected={workspace === 'private'} onClick={() => setWorkspace('private')} className={workspace === 'private' ? 'active' : ''}><Home size={15} /> Private <span>{workspaceCounts.private}</span></button>
          <button type="button" role="tab" aria-selected={workspace === 'business'} onClick={() => setWorkspace('business')} className={workspace === 'business' ? 'active' : ''}><BriefcaseBusiness size={15} /> Business <span>{workspaceCounts.business}</span></button>
        </div>
        <div className="topbar-actions">
          <Link href="/archive" className="btn-ghost h-10 px-3 text-sm"><Archive size={16} /> Archiv</Link>
          <button onClick={toggleTheme} className="btn-ghost h-10 w-10" aria-label="Theme wechseln"><Moon size={16} /><Sun size={16} className="hidden" /></button>
          <button onClick={signOut} className="btn-ghost hidden h-10 px-3 text-sm md:inline-flex"><LogOut size={15} /> {userEmail}</button>
        </div>
      </header>

      <section className="dashboard-hero">
        <div>
          <p className="hero-eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
        </div>
        <div className="hero-control-panel">
          <label className="field hero-search"><Search size={16} className="text-[var(--muted)]" /><input ref={searchRef} value={query} onChange={event => setQuery(event.target.value)} placeholder="Boards durchsuchen ..." /></label>
          <button onClick={createBoard} disabled={creating} className="btn-primary h-12 px-5 text-sm"><Plus size={18} /> {creating ? 'Erstelle ...' : 'Neues Board'}</button>
        </div>
      </section>

      <section className="board-gallery-section">
        <div className="board-gallery-grid">
          {filtered.map((board, index) => (
            <article
              key={board.id}
              onClick={() => router.push(`/boards/${board.id}`)}
              onContextMenu={event => openContext(event, board)}
              className={`board-gallery-card board-gallery-card-${(index % 4) + 1}`}
            >
              {board.cover_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={board.cover_url} alt="" className="board-gallery-img" />
              ) : (
                <div className="board-gallery-material" />
              )}
              <div className="board-gallery-shade" />
              <button type="button" onClick={(event) => openContext(event, board)} className="board-card-menu" aria-label="Board Menü">•••</button>
              <div className="board-card-glass">
                <p>{workspace === 'business' ? 'Business' : 'Private'}</p>
                <h2>{board.title}</h2>
                {board.description && <span>{board.description}</span>}
              </div>
            </article>
          ))}
        </div>

        {!filtered.length && <div className="empty-board-state"><div><h3>Keine Boards gefunden</h3><p>Erstelle dein erstes {copy.label}-Board oder ändere die Suche.</p></div></div>}
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
