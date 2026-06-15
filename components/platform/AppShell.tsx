'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Archive, Boxes, Compass, GalleryVerticalEnd, Home, Layers3, LogOut, Network, PanelLeft, Search, Sparkles, TimerReset, Workflow } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';

type AppShellActive = 'home' | 'vaults' | 'boards' | 'notes' | 'discover' | 'graph' | 'archive';

type AppShellProps = {
  userEmail: string;
  active?: AppShellActive;
  children: React.ReactNode;
  flush?: boolean;
};

const primaryNav = [
  { key: 'home', label: 'Home', href: '/workspaces', icon: Home },
  { key: 'vaults', label: 'Vaults', href: '/workspaces', icon: Boxes },
  { key: 'boards', label: 'Boards', href: '/boards', icon: Workflow },
  { key: 'notes', label: 'Notes', href: '/notes', icon: GalleryVerticalEnd },
  { key: 'discover', label: 'Discovery', href: '/workspaces#discovery', icon: Compass },
  { key: 'graph', label: 'Graph', href: '/workspaces#graph', icon: Network },
  { key: 'archive', label: 'Archive', href: '/workspaces#archive', icon: Archive }
] as const;

const mobileNav = primaryNav.filter(item => ['home', 'vaults', 'boards', 'notes'].includes(item.key));

export function AppShell({ userEmail, active = 'home', children, flush = false }: AppShellProps) {
  const supabase = createClient();
  const pathname = usePathname();

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  return (
    <main className="flex h-dvh overflow-hidden bg-[var(--app-bg)] text-[var(--text)]">
      <aside className="app-rail hidden h-dvh w-[286px] shrink-0 flex-col border-r border-[var(--line)] bg-[rgba(9,10,14,0.88)] p-3 backdrop-blur-2xl lg:flex">
        <Link href="/workspaces" className="mb-5 flex items-center gap-3 rounded-[8px] px-2.5 py-2 transition hover:bg-white/[0.045]">
          <span className="grid h-9 w-9 place-items-center rounded-[8px] border border-white/10 bg-white/[0.075] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
            <Sparkles size={17} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold tracking-[-0.02em]">Pinboard</span>
            <span className="block text-[10px] uppercase tracking-[0.26em] text-[var(--muted)]">Knowledge OS</span>
          </span>
        </Link>

        <button className="mb-4 flex w-full items-center gap-2 rounded-[8px] border border-[var(--line)] bg-black/20 px-3 py-2.5 text-left text-sm text-[var(--muted)] transition hover:border-white/15 hover:bg-white/[0.04] hover:text-[var(--text-soft)]">
          <Search size={15} />
          <span>Global Search</span>
          <kbd className="ml-auto rounded-[5px] border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-[var(--muted)]">⌘K</kbd>
        </button>

        <nav className="space-y-1">
          {primaryNav.map(item => {
            const Icon = item.icon;
            const isActive = item.key === active || (item.href !== '/workspaces' && pathname?.startsWith(item.href));
            return (
              <Link key={item.key} href={item.href} className={`rail-link ${isActive ? 'rail-link-active' : ''}`}>
                <Icon size={17} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-6 border-t border-[var(--line)] pt-4">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Modules</p>
          <Link href="/notes" className="rail-link"><Layers3 size={17} /> Notes Workspace</Link>
          <Link href="/workspaces#time-capsule" className="rail-link"><TimerReset size={17} /> Time Capsule</Link>
        </div>

        <div className="mt-auto rounded-[8px] border border-[var(--line)] bg-white/[0.032] p-3">
          <p className="truncate text-xs font-medium text-[var(--text-soft)]">{userEmail}</p>
          <button onClick={signOut} className="mt-3 flex w-full items-center justify-center gap-2 rounded-[7px] border border-[var(--line)] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-[var(--muted)] transition hover:bg-white/[0.075] hover:text-white">
            <LogOut size={14} /> Abmelden
          </button>
        </div>
      </aside>

      <section className={`relative min-w-0 flex-1 overflow-hidden ${flush ? '' : 'px-3 pb-[84px] pt-3 lg:px-5 lg:pb-5 lg:pt-5'}`}>
        <div className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(circle_at_78%_0%,rgba(87,112,255,.12),transparent_34rem),radial-gradient(circle_at_22%_12%,rgba(255,255,255,.05),transparent_22rem)]" />
        <div className="relative z-10 h-full min-w-0 overflow-hidden">
          {children}
        </div>
      </section>

      <nav className="fixed inset-x-3 bottom-3 z-50 grid grid-cols-4 rounded-[12px] border border-[var(--line)] bg-[rgba(12,13,18,.86)] p-1.5 shadow-[0_18px_60px_rgba(0,0,0,.44)] backdrop-blur-2xl lg:hidden">
        {mobileNav.map(item => {
          const Icon = item.icon;
          const isActive = item.key === active || (item.href !== '/workspaces' && pathname?.startsWith(item.href));
          return (
            <Link key={item.key} href={item.href} className={`flex flex-col items-center gap-1 rounded-[8px] px-2 py-2 text-[10px] font-semibold ${isActive ? 'bg-white/[0.095] text-white' : 'text-[var(--muted)]'}`}>
              <Icon size={17} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </main>
  );
}
