'use client';

import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';
import { LogOut, Plus, Search, Sparkles } from 'lucide-react';
import { Board } from '@/lib/types';
import { createClient } from '@/lib/supabase/browser';

export function BoardDashboard({ initialBoards, userEmail }: { initialBoards: Board[]; userEmail: string }) {
  const [boards, setBoards] = useState(initialBoards);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
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

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  return (
    <main className="min-h-screen p-5 md:p-8">
      <header className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.32em] text-[var(--accent)]">Opera Inspired Pinboard</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-6xl">Boards</h1>
          <p className="mt-3 text-sm text-[var(--muted)]">Angemeldet als {userEmail}</p>
        </div>
        <button onClick={signOut} className="inline-flex items-center gap-2 rounded-2xl border border-[var(--line)] bg-white/50 px-4 py-3 text-sm font-medium shadow-sm transition hover:bg-white/80 dark:bg-white/10 dark:hover:bg-white/15">
          <LogOut size={17} /> Abmelden
        </button>
      </header>

      <section className="mx-auto mt-8 grid max-w-7xl gap-5 lg:grid-cols-[380px_1fr]">
        <form onSubmit={createBoard} className="glass-strong rounded-[2rem] p-5 shadow-soft">
          <div className="mb-5 flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--accent)] text-white"><Sparkles size={20} /></span>
            <div>
              <h2 className="font-semibold">Neues Board</h2>
              <p className="text-sm text-[var(--muted)]">Sammlung, Projekt oder Recherche anlegen.</p>
            </div>
          </div>
          <div className="space-y-3">
            <input value={title} onChange={event => setTitle(event.target.value)} placeholder="Board Name" className="w-full rounded-2xl border border-[var(--line)] bg-white/70 px-4 py-3 outline-none focus:border-[var(--accent)] dark:bg-white/10" />
            <textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="Beschreibung optional" rows={4} className="w-full resize-none rounded-2xl border border-[var(--line)] bg-white/70 px-4 py-3 outline-none focus:border-[var(--accent)] dark:bg-white/10" />
            <button disabled={creating || !title.trim()} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-4 py-3 font-semibold text-white transition hover:scale-[1.01] disabled:opacity-50">
              <Plus size={18} /> Board erstellen
            </button>
          </div>
        </form>

        <div className="space-y-4">
          <label className="glass flex items-center gap-3 rounded-3xl px-4 py-3">
            <Search size={18} className="text-[var(--muted)]" />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Boards suchen ..." className="w-full bg-transparent outline-none" />
          </label>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map(board => (
              <Link key={board.id} href={`/boards/${board.id}`} className="group glass-strong block overflow-hidden rounded-[2rem] p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-soft">
                <div className="mb-7 h-32 rounded-[1.5rem] bg-gradient-to-br from-red-500/20 via-white/50 to-black/10 p-4 dark:via-white/10">
                  <div className="h-full rounded-[1.15rem] border border-white/40 bg-white/25 backdrop-blur-md dark:bg-black/20" />
                </div>
                <h2 className="text-xl font-semibold tracking-tight group-hover:text-[var(--accent)]">{board.title}</h2>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--muted)]">{board.description || 'Keine Beschreibung'}</p>
              </Link>
            ))}
          </div>

          {!filtered.length && (
            <div className="glass rounded-[2rem] p-8 text-center text-[var(--muted)]">Noch kein passendes Board gefunden.</div>
          )}
        </div>
      </section>
    </main>
  );
}
