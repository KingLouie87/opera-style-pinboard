'use client';

import Link from 'next/link';
import { ChangeEvent, FormEvent, useMemo, useRef, useState } from 'react';
import { BookOpen, ImagePlus, LogOut, Plus, Search, Sparkles, Upload } from 'lucide-react';
import { Board } from '@/lib/types';
import { createClient } from '@/lib/supabase/browser';

export function BoardDashboard({ initialBoards, userEmail }: { initialBoards: Board[]; userEmail: string }) {
  const [boards, setBoards] = useState(initialBoards);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const supabase = createClient();

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return boards;
    return boards.filter(board => `${board.title} ${board.description ?? ''}`.toLowerCase().includes(q));
  }, [boards, search]);

  async function createBoard(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data, error } = await supabase
      .from('boards')
      .insert({ user_id: userData.user.id, title: title.trim(), description: description.trim() || null })
      .select('*')
      .single();

    if (!error && data) {
      setBoards(current => [data as Board, ...current]);
      setTitle('');
      setDescription('');
    }
    setCreating(false);
  }

  async function uploadBoardCover(board: Board, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${userData.user.id}/boards/${board.id}-${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from('pin-images').upload(path, file, {
      contentType: file.type,
      upsert: false,
      cacheControl: '31536000'
    });
    if (uploadError) return;

    const coverUrl = `/api/images/${path}`;
    const { data } = await supabase.from('boards').update({ cover_url: coverUrl, cover_path: path }).eq('id', board.id).select('*').single();
    if (data) setBoards(current => current.map(item => (item.id === board.id ? (data as Board) : item)));
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  return (
    <main className="min-h-screen p-4 md:p-8">
      <header className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.36em] text-[var(--accent)]">Private Workspace</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.06em] md:text-6xl">Boards</h1>
          <p className="mt-3 text-sm text-[var(--muted)]">Angemeldet als {userEmail}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/notes" className="btn-ghost px-4 py-3 text-sm font-semibold"><BookOpen size={17} /> Notizen</Link>
          <button onClick={signOut} className="btn-ghost px-4 py-3 text-sm font-semibold"><LogOut size={17} /> Abmelden</button>
        </div>
      </header>

      <section className="mx-auto mt-8 grid max-w-7xl gap-5 lg:grid-cols-[380px_1fr]">
        <form onSubmit={createBoard} className="glass-strong rounded-[24px] p-5">
          <div className="mb-5 flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-[14px] bg-[var(--accent-soft)] text-[var(--accent)]"><Sparkles size={20} /></span>
            <div>
              <h2 className="font-semibold">Neues Board</h2>
              <p className="text-sm text-[var(--muted)]">Sammlung, Projekt oder Recherche anlegen.</p>
            </div>
          </div>
          <div className="space-y-3">
            <input value={title} onChange={event => setTitle(event.target.value)} placeholder="Board Name" className="field" />
            <textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="Beschreibung optional" rows={4} className="field resize-none" />
            <button disabled={creating || !title.trim()} className="btn-primary w-full px-4 py-3 disabled:opacity-50">
              <Plus size={18} /> Board erstellen
            </button>
          </div>
        </form>

        <div className="space-y-4">
          <label className="glass flex items-center gap-3 rounded-[18px] px-4 py-3">
            <Search size={18} className="text-[var(--muted)]" />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Boards suchen ..." className="w-full bg-transparent outline-none placeholder:text-white/30" />
          </label>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map(board => (
              <article key={board.id} className="group surface overflow-hidden rounded-[22px] transition hover:-translate-y-1 hover:border-white/20">
                <Link href={`/boards/${board.id}`} className="block">
                  <div className="relative h-36 overflow-hidden bg-gradient-to-br from-white/10 via-[var(--accent-soft)] to-black/30">
                    {board.cover_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={board.cover_url} alt="" className="h-full w-full object-cover opacity-90 transition duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[var(--muted)]"><ImagePlus size={28} /></div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                  </div>
                  <div className="p-5">
                    <h2 className="text-xl font-semibold tracking-[-0.03em] group-hover:text-[var(--accent)]">{board.title}</h2>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--muted)]">{board.description || 'Keine Beschreibung'}</p>
                  </div>
                </Link>
                <label className="mx-5 mb-5 flex cursor-pointer items-center justify-center gap-2 rounded-[12px] border border-[var(--line)] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-[var(--text-soft)] hover:bg-white/[0.075]">
                  <Upload size={14} /> Board-Bild ändern
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={event => uploadBoardCover(board, event)} className="hidden" />
                </label>
              </article>
            ))}
          </div>

          {!filtered.length && <div className="glass rounded-[22px] p-8 text-center text-[var(--muted)]">Noch kein passendes Board gefunden.</div>}
        </div>
      </section>
    </main>
  );
}
