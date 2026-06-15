'use client';

import Link from 'next/link';
import { ChangeEvent, FormEvent, useMemo, useRef, useState } from 'react';
import { ImagePlus, Plus, Search, Sparkles, Upload } from 'lucide-react';
import { Board } from '@/lib/types';
import { createClient } from '@/lib/supabase/browser';
import { AppShell } from '@/components/platform/AppShell';

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

  return (
    <AppShell userEmail={userEmail} active="boards">
      <div className="board-scroll h-full overflow-y-auto pr-1">
        <header className="premium-hero relative overflow-hidden rounded-[10px] border border-[var(--line)] p-5 md:p-7">
          <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="section-label text-[var(--accent)]">Private Workspace</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-[-0.065em] md:text-6xl">Boards</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">Visuelle Sammlungen, Rechercheflächen und Projektboards. Angemeldet als {userEmail}</p>
            </div>
            <label className="search-pill w-full lg:w-[360px]"><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Boards suchen ..." /></label>
          </div>
        </header>

        <section className="mt-5 grid gap-5 xl:grid-cols-[360px_1fr]">
          <form onSubmit={createBoard} className="panel h-fit p-4">
            <div className="mb-5 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-[8px] bg-[var(--accent-soft)] text-[var(--accent)]"><Sparkles size={19} /></span>
              <div>
                <h2 className="font-semibold">Neues Board</h2>
                <p className="text-sm text-[var(--muted)]">Sammlung, Projekt oder Recherche anlegen.</p>
              </div>
            </div>
            <div className="space-y-3">
              <input value={title} onChange={event => setTitle(event.target.value)} placeholder="Board Name" className="field" />
              <textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="Beschreibung optional" rows={4} className="field resize-none" />
              <button disabled={creating || !title.trim()} className="btn-primary w-full px-4 py-3 disabled:opacity-50"><Plus size={18} /> Board erstellen</button>
            </div>
          </form>

          <div className="grid auto-rows-fr gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {filtered.map(board => (
              <article key={board.id} className="group surface overflow-hidden transition hover:-translate-y-0.5 hover:border-white/20">
                <Link href={`/boards/${board.id}`} className="block">
                  <div className="relative h-40 overflow-hidden bg-gradient-to-br from-white/10 via-[var(--accent-soft)] to-black/30">
                    {board.cover_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={board.cover_url} alt="" className="h-full w-full object-cover opacity-90 transition duration-500 group-hover:scale-[1.035]" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[var(--muted)]"><ImagePlus size={28} /></div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/72 via-black/14 to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3">
                      <h2 className="line-clamp-1 text-xl font-semibold tracking-[-0.035em] text-white">{board.title}</h2>
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="line-clamp-2 text-sm leading-6 text-[var(--muted)]">{board.description || 'Keine Beschreibung'}</p>
                  </div>
                </Link>
                <label className="mx-4 mb-4 flex cursor-pointer items-center justify-center gap-2 rounded-[7px] border border-[var(--line)] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-[var(--text-soft)] hover:bg-white/[0.075]">
                  <Upload size={14} /> Board-Bild ändern
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={event => uploadBoardCover(board, event)} className="hidden" />
                </label>
              </article>
            ))}
            {!filtered.length && <div className="empty-state col-span-full"><strong>No Boards</strong><span>Lege ein Board an, um Pins, Links und visuelle Inspirationen zu sammeln.</span></div>}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
