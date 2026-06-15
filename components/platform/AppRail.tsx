'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Archive, Boxes, Compass, GalleryVerticalEnd, Home, LogOut, Network, Search, Sparkles, TimerReset, Workflow } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';

type Active = 'home' | 'vaults' | 'boards' | 'notes' | 'discover' | 'graph' | 'archive';

const nav = [
  { key: 'home', label: 'Home', icon: Home, href: '/workspaces' },
  { key: 'vaults', label: 'Vaults', icon: Boxes, href: '/workspaces' },
  { key: 'boards', label: 'Boards', icon: Workflow, href: '/boards' },
  { key: 'notes', label: 'Notes', icon: GalleryVerticalEnd, href: '/notes' },
  { key: 'discover', label: 'Discovery', icon: Compass, href: '/workspaces#discovery' },
  { key: 'graph', label: 'Graph', icon: Network, href: '/workspaces#graph' },
  { key: 'archive', label: 'Archive', icon: Archive, href: '/workspaces#archive' }
] as const;

export function AppRail({ userEmail, active = 'home' }: { userEmail: string; active?: Active }) {
  const supabase = createClient();
  const pathname = usePathname();

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  return (
    <aside className="app-rail hidden h-dvh w-[286px] shrink-0 flex-col border-r border-[var(--line)] bg-[rgba(9,10,14,0.88)] p-3 backdrop-blur-2xl lg:flex">
      <Link href="/workspaces" className="mb-5 flex items-center gap-3 rounded-[8px] px-2.5 py-2 transition hover:bg-white/[0.045]">
        <span className="grid h-9 w-9 place-items-center rounded-[8px] border border-white/10 bg-white/[0.075]"><Sparkles size={17} /></span>
        <span><span className="block text-sm font-semibold tracking-[-0.02em]">Pinboard</span><span className="block text-[10px] uppercase tracking-[0.26em] text-[var(--muted)]">Knowledge OS</span></span>
      </Link>

      <button className="mb-4 flex w-full items-center gap-2 rounded-[8px] border border-[var(--line)] bg-black/20 px-3 py-2.5 text-left text-sm text-[var(--muted)] transition hover:border-white/15 hover:bg-white/[0.04] hover:text-[var(--text-soft)]">
        <Search size={15} /><span>Global Search</span><kbd className="ml-auto rounded-[5px] border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-[var(--muted)]">⌘K</kbd>
      </button>

      <nav className="space-y-1">
        {nav.map(item => {
          const Icon = item.icon;
          const isActive = item.key === active || (item.href !== '/workspaces' && pathname?.startsWith(item.href));
          return <Link key={item.key} href={item.href} className={`rail-link ${isActive ? 'rail-link-active' : ''}`}><Icon size={17} /><span>{item.label}</span></Link>;
        })}
      </nav>

      <div className="mt-6 border-t border-[var(--line)] pt-4">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Modules</p>
        <Link href="/workspaces#time-capsule" className="rail-link"><TimerReset size={17} /> Time Capsule</Link>
      </div>

      <div className="mt-auto rounded-[8px] border border-[var(--line)] bg-white/[0.032] p-3">
        <p className="truncate text-xs font-medium text-[var(--text-soft)]">{userEmail}</p>
        <button onClick={signOut} className="mt-3 flex w-full items-center justify-center gap-2 rounded-[7px] border border-[var(--line)] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-[var(--muted)] transition hover:bg-white/[0.075] hover:text-white"><LogOut size={14} /> Abmelden</button>
      </div>
    </aside>
  );
}
