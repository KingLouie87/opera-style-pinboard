'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, BriefcaseBusiness, ChevronDown, ExternalLink, FolderInput, GripVertical, Home, LogOut, Moon, Pencil, Plus, Search, Sun, Trash2, Copy, X } from 'lucide-react';
import { Board, WorkspaceType } from '@/lib/types';
import { createClient } from '@/lib/supabase/browser';
import { MobileNav } from '@/components/pinboard/MobileNav';
import { ContextMenu } from '@/components/pinboard/ContextMenu';
import { ConfirmDialog } from '@/components/pinboard/ConfirmDialog';
import { RenameDialog } from '@/components/pinboard/RenameDialog';

type Props = { boards: Board[]; userEmail: string };
type BoardContext = null | { board: Board; x: number; y: number };
type GroupContext = null | { group: string; x: number; y: number };
type ConfirmState = null | { title: string; message: string; confirmLabel?: string; onConfirm: () => void };
type RenameState = null | { kind: 'board'; board: Board } | { kind: 'group'; group: string };
type BoardSort = 'manual' | 'alpha' | 'newest' | 'updated';

type GroupsByWorkspace = Record<WorkspaceType, string[]>;

function boardWorkspace(board: Board): WorkspaceType {
  return board.workspace_type === 'business' ? 'business' : 'private';
}

function boardGroup(board: Board) {
  return board.board_group?.trim() || 'Ohne Bereich';
}

function cleanGroup(value: string) {
  const trimmed = value.trim();
  return trimmed && trimmed !== 'Ohne Bereich' ? trimmed : 'Ohne Bereich';
}

function workspaceCopy(workspace: WorkspaceType) {
  return workspace === 'business'
    ? { label: 'Business', eyebrow: 'Strukturierte Recherche', title: 'Business Boards', description: 'Sachliche Sammlungen, Projektmaterial und operative Recherche in einer ruhigen Oberfläche.' }
    : { label: 'Private', eyebrow: 'Visuelle Sammlung', title: 'Private Pinboards', description: 'Inspirationen, Referenzen und persönliche Ideen als hochwertige visuelle Galerie.' };
}

function MoveBoardDialog({ board, groups, onClose, onMove }: {
  board: Board;
  groups: GroupsByWorkspace;
  onClose: () => void;
  onMove: (workspace: WorkspaceType, group: string) => void;
}) {
  const currentWorkspace = boardWorkspace(board);
  const currentGroup = boardGroup(board);
  return (
    <div className="modal-backdrop z-[78]" onMouseDown={onClose} role="dialog" aria-modal="true">
      <article className="move-dialog" onMouseDown={event => event.stopPropagation()}>
        <button type="button" onClick={onClose} className="move-dialog-close" aria-label="Schließen"><X size={16} /></button>
        <p>Board verschieben</p>
        <h2>{board.title}</h2>
        <div className="move-target-columns">
          {(['private', 'business'] as WorkspaceType[]).map(type => (
            <section key={type}>
              <h3>{type === 'private' ? 'Nach Private' : 'Nach Business'}</h3>
              {groups[type].map(group => {
                const active = currentWorkspace === type && currentGroup === group;
                return (
                  <button key={`${type}:${group}`} type="button" disabled={active} className={active ? 'active' : ''} onClick={() => onMove(type, group)}>
                    <FolderInput size={14} />
                    <span>{group}</span>
                    {active && <em>Aktuell</em>}
                  </button>
                );
              })}
            </section>
          ))}
        </div>
      </article>
    </div>
  );
}

export function BoardDashboard({ boards: initialBoards, userEmail }: Props) {
  const [boards, setBoards] = useState(initialBoards);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [workspace, setWorkspace] = useState<WorkspaceType>('private');
  const [sort, setSort] = useState<BoardSort>('manual');
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);
  const [extraGroups, setExtraGroups] = useState<string[]>([]);
  const [context, setContext] = useState<BoardContext>(null);
  const [groupContext, setGroupContext] = useState<GroupContext>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [moveBoard, setMoveBoard] = useState<Board | null>(null);
  const [rename, setRename] = useState<RenameState>(null);
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameError, setRenameError] = useState('');
  const [draggingBoardId, setDraggingBoardId] = useState<string | null>(null);
  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const searchRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const router = useRouter();
  const copy = workspaceCopy(workspace);

  useEffect(() => {
    const stored = localStorage.getItem('pinboard-theme') === 'light' ? 'light' : 'dark';
    setTheme(stored);
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const active = boards.filter(board => {
      const matchesWorkspace = boardWorkspace(board) === workspace;
      const matchesActive = !board.archived_at && !board.deleted_at;
      const matchesSearch = !q || [board.title, board.description, board.board_group].filter(Boolean).join(' ').toLowerCase().includes(q);
      return matchesWorkspace && matchesActive && matchesSearch;
    });
    return active.sort((a, b) => {
      if (sort === 'alpha') return a.title.localeCompare(b.title, 'de');
      if (sort === 'newest') return +new Date(b.created_at) - +new Date(a.created_at);
      if (sort === 'updated') return +new Date(b.updated_at) - +new Date(a.updated_at);
      return (a.board_position ?? 0) - (b.board_position ?? 0) || +new Date(b.updated_at) - +new Date(a.updated_at);
    });
  }, [boards, query, workspace, sort]);

  const groupsByWorkspace = useMemo<GroupsByWorkspace>(() => {
    const build = (type: WorkspaceType) => {
      const fromBoards = boards
        .filter(board => boardWorkspace(board) === type && !board.archived_at && !board.deleted_at)
        .map(boardGroup);
      const merged = type === workspace ? ['Ohne Bereich', ...fromBoards, ...extraGroups] : ['Ohne Bereich', ...fromBoards];
      return Array.from(new Set(merged.map(cleanGroup))).sort((a, b) => a === 'Ohne Bereich' ? -1 : b === 'Ohne Bereich' ? 1 : a.localeCompare(b, 'de'));
    };
    return { private: build('private'), business: build('business') };
  }, [boards, extraGroups, workspace]);

  const groupedBoards = useMemo(() => {
    const names = Array.from(new Set([...filtered.map(boardGroup), ...extraGroups])).sort((a, b) => a === 'Ohne Bereich' ? -1 : b === 'Ohne Bereich' ? 1 : a.localeCompare(b, 'de'));
    return names.map(name => ({ name, boards: filtered.filter(board => boardGroup(board) === name) }));
  }, [filtered, extraGroups]);

  const workspaceCounts = useMemo(() => ({
    private: boards.filter(board => boardWorkspace(board) === 'private' && !board.archived_at && !board.deleted_at).length,
    business: boards.filter(board => boardWorkspace(board) === 'business' && !board.archived_at && !board.deleted_at).length
  }), [boards]);

  async function createBoard(group = 'Ohne Bereich') {
    setCreating(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setCreating(false);
      return;
    }
    const scope = boards.filter(board => boardWorkspace(board) === workspace && boardGroup(board) === group);
    const { data } = await supabase
      .from('boards')
      .insert({ user_id: userData.user.id, title: `${copy.label} Board ${scope.length + 1}`, description: 'Neue visuelle Sammlung', workspace_type: workspace, board_group: group === 'Ohne Bereich' ? null : group, board_position: scope.length })
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

  async function duplicateBoard(board: Board) {
    const { id, created_at, updated_at, ...rest } = board;
    const { data } = await supabase.from('boards').insert({ ...rest, title: `${board.title} Kopie`, archived_at: null, deleted_at: null }).select('*').single();
    if (data) setBoards(current => [data as Board, ...current]);
  }

  async function renameBoard(board: Board, title: string) {
    const next = title.trim().slice(0, 120);
    if (!next) return;
    setRenameSaving(true);
    setRenameError('');
    const previous = boards;
    setBoards(current => current.map(item => item.id === board.id ? { ...item, title: next } : item));
    const { error } = await supabase.from('boards').update({ title: next }).eq('id', board.id);
    setRenameSaving(false);
    if (error) {
      setBoards(previous);
      setRenameError(error.message);
      return;
    }
    setRename(null);
  }

  async function renameBoardGroup(group: string, title: string) {
    const next = cleanGroup(title).slice(0, 120);
    if (!next || next === group) {
      setRename(null);
      return;
    }
    setRenameSaving(true);
    setRenameError('');
    const previousBoards = boards;
    const previousGroups = extraGroups;
    setBoards(current => current.map(board => boardGroup(board) === group && boardWorkspace(board) === workspace ? { ...board, board_group: next === 'Ohne Bereich' ? null : next } : board));
    setExtraGroups(current => current.map(name => name === group ? next : name));
    const { error } = await supabase.from('boards').update({ board_group: next === 'Ohne Bereich' ? null : next }).eq('workspace_type', workspace).eq('board_group', group === 'Ohne Bereich' ? null : group);
    setRenameSaving(false);
    if (error) {
      setBoards(previousBoards);
      setExtraGroups(previousGroups);
      setRenameError(error.message);
      return;
    }
    setRename(null);
  }

  async function moveBoardTo(board: Board, targetWorkspace: WorkspaceType, targetGroup: string) {
    const safeGroup = cleanGroup(targetGroup);
    const board_group = safeGroup === 'Ohne Bereich' ? null : safeGroup;
    const scope = boards.filter(item => item.id !== board.id && boardWorkspace(item) === targetWorkspace && boardGroup(item) === safeGroup && !item.archived_at && !item.deleted_at);
    const board_position = scope.length;
    setMoveBoard(null);
    setBoards(current => current.map(item => item.id === board.id ? { ...item, workspace_type: targetWorkspace, board_group, board_position } : item));
    setWorkspace(targetWorkspace);
    if (board_group && targetWorkspace === workspace) setExtraGroups(current => current.includes(board_group) ? current : [...current, board_group]);
    await supabase.from('boards').update({ workspace_type: targetWorkspace, board_group, board_position }).eq('id', board.id);
  }

  function openContext(event: React.MouseEvent, board: Board) {
    event.preventDefault();
    event.stopPropagation();
    setContext({ board, x: event.clientX, y: event.clientY });
  }

  function openGroupContext(event: React.MouseEvent, group: string) {
    event.preventDefault();
    event.stopPropagation();
    setGroupContext({ group, x: event.clientX, y: event.clientY });
  }

  function addGroup() {
    const name = window.prompt('Board-Bereich benennen')?.trim();
    if (name && !extraGroups.includes(name)) setExtraGroups(current => [...current, name]);
  }

  function renameGroup(group: string) {
    if (group === 'Ohne Bereich') return;
    setRenameError('');
    setRename({ kind: 'group', group });
  }

  function requestDeleteGroup(group: string) {
    setConfirm({
      title: 'Board-Bereich löschen?',
      message: `Der Bereich „${group}“ wird entfernt. Die Boards bleiben erhalten und werden nach „Ohne Bereich“ verschoben.`,
      confirmLabel: 'Bereich löschen',
      onConfirm: () => deleteGroup(group)
    });
  }

  async function deleteGroup(group: string) {
    setConfirm(null);
    setBoards(current => current.map(board => boardWorkspace(board) === workspace && boardGroup(board) === group ? { ...board, board_group: null } : board));
    setExtraGroups(current => current.filter(name => name !== group));
    await supabase.from('boards').update({ board_group: null }).eq('workspace_type', workspace).eq('board_group', group === 'Ohne Bereich' ? null : group);
  }

  function toggleGroup(group: string) {
    setCollapsedGroups(current => current.includes(group) ? current.filter(item => item !== group) : [...current, group]);
  }

  function startBoardDrag(event: React.DragEvent, board: Board) {
    event.stopPropagation();
    setDraggingBoardId(board.id);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', board.id);
  }

  function onBoardDrop(event: React.DragEvent, group: string) {
    event.preventDefault();
    const id = event.dataTransfer.getData('text/plain') || draggingBoardId;
    const board = boards.find(item => item.id === id);
    setDragOverGroup(null);
    setDraggingBoardId(null);
    if (board) moveBoardTo(board, workspace, group);
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('pinboard-theme', next);
  }

  return (
    <main className={`app-shell dashboard-shell min-h-dvh pb-24 ${workspace === 'business' ? 'workspace-business' : 'workspace-private'}`}>
      <header className="dashboard-topbar dashboard-topbar-clean">
        <div className="workspace-switch" role="tablist" aria-label="Workspace wählen">
          <button type="button" role="tab" aria-selected={workspace === 'private'} onClick={() => setWorkspace('private')} className={workspace === 'private' ? 'active' : ''}><Home size={15} /> Private <span>{workspaceCounts.private}</span></button>
          <button type="button" role="tab" aria-selected={workspace === 'business'} onClick={() => setWorkspace('business')} className={workspace === 'business' ? 'active' : ''}><BriefcaseBusiness size={15} /> Business <span>{workspaceCounts.business}</span></button>
        </div>
        <div className="topbar-actions">
          <Link href="/archive" className="btn-ghost h-10 px-3 text-sm"><Archive size={16} /> Archiv</Link>
          <button onClick={toggleTheme} className="btn-ghost h-10 w-10" aria-label={theme === 'dark' ? 'Zum hellen Modus wechseln' : 'Zum dunklen Modus wechseln'} title={theme === 'dark' ? 'Zum hellen Modus wechseln' : 'Zum dunklen Modus wechseln'}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button>
          <button onClick={signOut} className="btn-ghost hidden h-10 px-3 text-sm md:inline-flex"><LogOut size={15} /> {userEmail}</button>
        </div>
      </header>

      <section className="dashboard-hero dashboard-hero-compact dashboard-hero-raised">
        <div>
          <p className="hero-eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
        </div>
        <div className="hero-control-panel hero-control-panel-inline clean-toolbar">
          <label className="field hero-search"><Search size={16} className="text-[var(--muted)]" /><input ref={searchRef} value={query} onChange={event => setQuery(event.target.value)} placeholder="Boards durchsuchen" /></label>
          <select value={sort} onChange={event => setSort(event.target.value as BoardSort)} className="field app-select board-sort-select">
            <option value="manual">Manuell</option>
            <option value="alpha">Alphabetisch</option>
            <option value="newest">Neueste</option>
            <option value="updated">Aktualisiert</option>
          </select>
          <button onClick={() => createBoard()} disabled={creating} className="btn-primary board-create-button h-11 px-4 text-sm"><Plus size={17} /> {creating ? 'Erstelle ...' : 'Board'}</button>
          <button type="button" onClick={addGroup} className="btn-ghost h-11 px-3 text-sm"><Plus size={16} /> Bereich</button>
        </div>
      </section>

      <section className="board-gallery-section board-section-stack-main">
        {groupedBoards.map(group => (
          <section
            key={group.name}
            className={`board-main-section ${dragOverGroup === group.name ? 'board-group-over' : ''}`}
            onContextMenu={event => openGroupContext(event, group.name)}
            onDragOver={event => { if (draggingBoardId) { event.preventDefault(); setDragOverGroup(group.name); } }}
            onDragLeave={() => setDragOverGroup(current => current === group.name ? null : current)}
            onDrop={event => onBoardDrop(event, group.name)}
          >
            <header className="board-main-section-header">
              <button type="button" onClick={() => toggleGroup(group.name)}><ChevronDown size={16} className={collapsedGroups.includes(group.name) ? '-rotate-90' : ''} /> {group.name}</button>
              <span>{group.boards.length} Boards</span>
              <button type="button" onClick={() => createBoard(group.name)} className="board-section-add"><Plus size={14} /> Board</button>
            </header>
            {!collapsedGroups.includes(group.name) && (
              <div className="board-gallery-grid board-gallery-grid-fixed">
                {group.boards.map((board) => (
                  <article
                    key={board.id}
                    onClick={() => router.push(`/boards/${board.id}`)}
                    onContextMenu={event => openContext(event, board)}
                    className={`board-gallery-card board-gallery-card-fixed ${draggingBoardId === board.id ? 'board-card-dragging' : ''}`}
                  >
                    {board.cover_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={board.cover_url} alt="" className="board-gallery-img" draggable={false} />
                    ) : (
                      <div className="board-gallery-material" />
                    )}
                    <div className="board-gallery-shade" />
                    <button type="button" draggable onDragStart={event => startBoardDrag(event, board)} onClick={event => event.stopPropagation()} className="board-drag-handle" aria-label="Board verschieben"><GripVertical size={15} /></button>
                    <button type="button" onClick={(event) => openContext(event, board)} className="board-card-menu" aria-label="Board Menü">•••</button>
                    <div className="board-card-glass">
                      <p>{workspace === 'business' ? 'Business' : 'Private'}</p>
                      <h2>{board.title}</h2>
                      {board.description && <span>{board.description}</span>}
                    </div>
                  </article>
                ))}
                <button type="button" onClick={() => createBoard(group.name)} className="board-add-tile"><Plus size={18} /> Neues Board</button>
              </div>
            )}
          </section>
        ))}

        {!filtered.length && <div className="empty-board-state"><div><h3>Keine Boards gefunden</h3><p>Erstelle dein erstes {copy.label}-Board oder ändere die Suche.</p></div></div>}
      </section>

      <MobileNav onAdd={() => createBoard()} onFocusSearch={() => searchRef.current?.focus()} />
      {context && <ContextMenu x={context.x} y={context.y} onClose={() => setContext(null)} items={[
        { label: 'Öffnen', icon: ExternalLink, onSelect: () => router.push(`/boards/${context.board.id}`) },
        { label: 'Umbenennen', icon: Pencil, onSelect: () => { setRenameError(''); setRename({ kind: 'board', board: context.board }); } },
        { label: 'Bearbeiten', icon: Pencil, onSelect: () => router.push(`/boards/${context.board.id}`) },
        { label: 'Verschieben', icon: FolderInput, onSelect: () => setMoveBoard(context.board) },
        { label: 'Duplizieren', icon: Copy, onSelect: () => duplicateBoard(context.board) },
        { label: 'Archivieren', icon: Archive, onSelect: () => archiveBoard(context.board) },
        { label: 'Löschen', icon: Trash2, danger: true, onSelect: () => requestDeleteBoard(context.board) }
      ]} />}
      {groupContext && <ContextMenu x={groupContext.x} y={groupContext.y} onClose={() => setGroupContext(null)} items={[
        { label: 'Umbenennen', icon: Pencil, disabled: groupContext.group === 'Ohne Bereich', onSelect: () => renameGroup(groupContext.group) },
        { label: 'Einklappen', icon: ChevronDown, onSelect: () => toggleGroup(groupContext.group) },
        { label: 'Alphabetisch sortieren', icon: Search, onSelect: () => setSort('alpha') },
        { label: 'Löschen', icon: Trash2, disabled: groupContext.group === 'Ohne Bereich', danger: true, onSelect: () => requestDeleteGroup(groupContext.group) }
      ]} />}
      {rename && <RenameDialog title={rename.kind === 'board' ? 'Board umbenennen' : 'Bereich umbenennen'} initialValue={rename.kind === 'board' ? rename.board.title : rename.group} saving={renameSaving} error={renameError} onCancel={() => setRename(null)} onSubmit={(value) => rename.kind === 'board' ? renameBoard(rename.board, value) : renameBoardGroup(rename.group, value)} />}
      {moveBoard && <MoveBoardDialog board={moveBoard} groups={groupsByWorkspace} onClose={() => setMoveBoard(null)} onMove={(targetWorkspace, targetGroup) => moveBoardTo(moveBoard, targetWorkspace, targetGroup)} />}
      {confirm && <ConfirmDialog title={confirm.title} message={confirm.message} confirmLabel={confirm.confirmLabel} onCancel={() => setConfirm(null)} onConfirm={confirm.onConfirm} />}
    </main>
  );
}
