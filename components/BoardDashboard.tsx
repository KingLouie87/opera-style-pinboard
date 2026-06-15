'use client';

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import { LogOut, Moon, Plus, Search, Sun, UploadCloud } from 'lucide-react';
import { Board } from '@/lib/types';
import { createClient } from '@/lib/supabase/browser';
import { MobileNav } from '@/components/pinboard/MobileNav';

type Props = { boards: Board[]; userEmail: string };

export function BoardDashboard({ boards: initialBoards, userEmail }: Props) {
  const [boards, setBoards] = useState(initialBoards);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return boards.filter(board => !q || [board.title, board.description].filter(Boolean).join(' ').toLowerCase().includes(q));
  }, [boards, query]);

  async function createBoard() {
    setCreating(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data } = await supabase.from('boards').insert({ user_id: userData.user.id, title: `Board ${boards.length + 1}`, description: 'Neue visuelle Sammlung' }).select('*').single();
    if (data) setBoards(current => [data as Board, ...current]);
    setCreating(false);
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
    <main className="app-shell min-h-dvh px-4 py-4 pb-24 md:px-7 md:py-6 md:pb-8">
      <header className="mx-auto mb-5 flex max-w-[1800px] flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.34em] text-[var(--accent)]">Pinboard</p>
          <h1 className="text-4xl font-semibold tracking-[-0.07em] md:text-6xl">Deine visuellen Sammlungen.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">Links, Medien, Dateien und Inspirationen in hochwertigen Boards, reduziert auf das Wesentliche.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <div className="pill px-3 py-2 text-xs"><UploadCloud size={15} /> Links später direkt in ein Board ziehen</div>
        </div>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,320px))] justify-start gap-4">
          {filtered.map(board => (
            <Link key={board.id} href={`/boards/${board.id}`} className="group relative h-[340px] overflow-hidden rounded-[8px] border border-[var(--line)] bg-white/[0.045] shadow-lift transition duration-300 hover:-translate-y-1 hover:border-[var(--line-strong)]">
              {board.cover_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={board.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]" />
              ) : (
                <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(138,164,255,.16),rgba(255,255,255,.02)),radial-gradient(circle_at_30%_20%,rgba(255,255,255,.16),transparent_34%)]" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/18 to-transparent" />
              <div className="absolute inset-x-3 bottom-3 rounded-[7px] border border-white/14 bg-black/42 p-3 text-white backdrop-blur-2xl">
                <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.28em] text-white/55">Board</p>
                <h2 className="line-clamp-2 text-xl font-semibold tracking-[-0.045em]">{board.title}</h2>
                {board.description && <p className="mt-2 line-clamp-2 text-sm leading-5 text-white/70">{board.description}</p>}
              </div>
            </Link>
          ))}
        </div>

        {!filtered.length && <div className="grid min-h-72 place-items-center rounded-[10px] border border-dashed border-[var(--line)] text-center text-[var(--muted)]">Keine Boards gefunden.</div>}
      </section>
      <MobileNav onAdd={createBoard} onFocusSearch={() => searchRef.current?.focus()} />
    </main>
  );
}
