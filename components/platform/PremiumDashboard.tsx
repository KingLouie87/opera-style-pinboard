'use client';

import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';
import { ArrowUpRight, Bell, Bookmark, BriefcaseBusiness, CalendarClock, ChevronRight, Compass, FolderKanban, GalleryVerticalEnd, Lightbulb, Plus, Search, ShieldCheck, Sparkles, TimerReset } from 'lucide-react';
import { Board, Notebook, TaskItem, Vault, VaultItem, Workspace } from '@/lib/types';
import { createClient } from '@/lib/supabase/browser';
import { AppRail } from './AppRail';

type Props = {
  userEmail: string;
  initialWorkspaces: Workspace[];
  initialVaults: Vault[];
  initialBoards: Board[];
  initialNotebooks: Notebook[];
  initialTasks: TaskItem[];
  initialRecentItems: VaultItem[];
};

const workspacePresets = [
  { kind: 'private' as const, title: 'Private Workspace', description: 'Kreativprojekte, Inspiration, Recherche und persönliche Wissenssammlungen.', icon: '✦', color: '#7aa7ff' },
  { kind: 'business' as const, title: 'Business Workspace', description: 'Hotelbetrieb, SOPs, Projekte, Meetings und operative Dokumentation.', icon: '▣', color: '#9ee6b4' }
];

export function PremiumDashboard({ userEmail, initialWorkspaces, initialVaults, initialBoards, initialNotebooks, initialTasks, initialRecentItems }: Props) {
  const supabase = createClient();
  const [workspaces, setWorkspaces] = useState(initialWorkspaces);
  const [vaults, setVaults] = useState(initialVaults);
  const [query, setQuery] = useState('');
  const [vaultTitle, setVaultTitle] = useState('');
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(initialWorkspaces[0]?.id ?? '');
  const [creating, setCreating] = useState(false);

  const activeWorkspace = workspaces.find(workspace => workspace.id === activeWorkspaceId) ?? workspaces[0];

  const filteredVaults = useMemo(() => {
    const q = query.trim().toLowerCase();
    return vaults.filter(vault => {
      const belongs = activeWorkspace ? vault.workspace_id === activeWorkspace.id : true;
      const matches = !q || `${vault.title} ${vault.description ?? ''}`.toLowerCase().includes(q);
      return belongs && matches;
    });
  }, [activeWorkspace, query, vaults]);

  async function ensureDefaultWorkspaces() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const inserts = workspacePresets
      .filter(preset => !workspaces.some(workspace => workspace.kind === preset.kind))
      .map((preset, index) => ({
        user_id: userData.user!.id,
        title: preset.title,
        description: preset.description,
        kind: preset.kind,
        icon: preset.icon,
        color: preset.color,
        position: (workspaces.length + index + 1) * 1000
      }));

    if (!inserts.length) return;

    const { data, error } = await supabase.from('workspaces').insert(inserts).select('*');
    if (error) {
      alert(`Workspaces konnten nicht erstellt werden: ${error.message}`);
      return;
    }
    const created = (data ?? []) as Workspace[];
    setWorkspaces(current => [...current, ...created]);
    if (!activeWorkspaceId && created[0]) setActiveWorkspaceId(created[0].id);
  }

  async function createVault(event: FormEvent) {
    event.preventDefault();
    const title = vaultTitle.trim();
    const workspace = activeWorkspace;
    if (!title || !workspace) return;

    setCreating(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setCreating(false);
      return;
    }

    const { data, error } = await supabase
      .from('vaults')
      .insert({ user_id: userData.user.id, workspace_id: workspace.id, title, description: null, color: workspace.color, position: Date.now() })
      .select('*')
      .single();

    setCreating(false);
    if (error) {
      alert(`Vault konnte nicht erstellt werden: ${error.message}`);
      return;
    }
    if (data) {
      setVaults(current => [data as Vault, ...current]);
      setVaultTitle('');
    }
  }

  const orphanStats = [
    { label: 'Boards', value: initialBoards.length, icon: Bookmark, href: '/boards' },
    { label: 'Notizbücher', value: initialNotebooks.length, icon: GalleryVerticalEnd, href: '/notes' },
    { label: 'Offene Aufgaben', value: initialTasks.length, icon: CalendarClock, href: '#tasks' },
    { label: 'Recent Items', value: initialRecentItems.length, icon: Sparkles, href: '#discovery' }
  ];

  return (
    <main className="flex min-h-screen bg-[var(--app-bg)] text-[var(--text)]">
      <AppRail userEmail={userEmail} active="home" />
      <section className="min-w-0 flex-1 px-4 py-4 lg:px-6 lg:py-6">
        <div className="mx-auto max-w-[1500px]">
          <header className="premium-hero relative overflow-hidden rounded-[16px] border border-[var(--line)] p-5 md:p-7">
            <div className="relative z-10 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-[var(--accent)]">Pinboard Knowledge OS</p>
                <h1 className="mt-3 text-4xl font-semibold tracking-[-0.065em] md:text-6xl">Workspaces, Vaults und Inhalte an einem Ort.</h1>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--muted)] md:text-base">Organisiere Pins, Notizen, Aufgaben, Mindmaps und Medien projektbasiert. Erst der Vault, dann der Inhaltstyp.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={ensureDefaultWorkspaces} className="btn-primary px-4 py-3 text-sm"><ShieldCheck size={17} /> Workspaces anlegen</button>
                <Link href="/notes" className="btn-ghost px-4 py-3 text-sm"><GalleryVerticalEnd size={17} /> Notizen</Link>
                <Link href="/boards" className="btn-ghost px-4 py-3 text-sm"><Bookmark size={17} /> Boards</Link>
              </div>
            </div>
          </header>

          <div className="mt-5 grid gap-4 lg:grid-cols-4">
            {orphanStats.map(stat => {
              const Icon = stat.icon;
              return (
                <Link key={stat.label} href={stat.href} className="metric-card group">
                  <div className="flex items-center justify-between">
                    <Icon size={18} className="text-[var(--accent)]" />
                    <ArrowUpRight size={16} className="text-[var(--muted)] opacity-0 transition group-hover:opacity-100" />
                  </div>
                  <strong className="mt-5 block text-3xl tracking-[-0.05em]">{stat.value}</strong>
                  <span className="mt-1 block text-xs uppercase tracking-[0.18em] text-[var(--muted)]">{stat.label}</span>
                </Link>
              );
            })}
          </div>

          <section className="mt-5 grid gap-5 xl:grid-cols-[360px_1fr_360px]">
            <div className="panel p-4">
              <div className="mb-4 flex items-center justify-between">
                <p className="section-label">Workspaces</p>
                <BriefcaseBusiness size={16} className="text-[var(--muted)]" />
              </div>
              <div className="space-y-2">
                {workspaces.map(workspace => (
                  <button key={workspace.id} onClick={() => setActiveWorkspaceId(workspace.id)} className={`workspace-switch ${workspace.id === activeWorkspace?.id ? 'workspace-switch-active' : ''}`}>
                    <span className="workspace-icon" style={{ color: workspace.color ?? undefined }}>{workspace.icon || '◆'}</span>
                    <span className="min-w-0 text-left">
                      <span className="block truncate text-sm font-semibold">{workspace.title}</span>
                      <span className="block truncate text-xs text-[var(--muted)]">{workspace.kind === 'business' ? 'Business' : 'Private'} Workspace</span>
                    </span>
                    <ChevronRight className="ml-auto text-[var(--muted)]" size={15} />
                  </button>
                ))}
                {!workspaces.length && <button onClick={ensureDefaultWorkspaces} className="empty-drop w-full">Private und Business Workspace erstellen</button>}
              </div>

              <form onSubmit={createVault} className="mt-5 rounded-[12px] border border-[var(--line)] bg-white/[0.035] p-3">
                <p className="mb-3 text-sm font-semibold">Neuer Vault</p>
                <input value={vaultTitle} onChange={event => setVaultTitle(event.target.value)} placeholder="z. B. Broken Horizon" className="field" />
                <button disabled={creating || !vaultTitle.trim() || !activeWorkspace} className="btn-primary mt-3 w-full px-3 py-2.5 text-sm disabled:opacity-50"><Plus size={16} /> Vault erstellen</button>
              </form>
            </div>

            <div className="panel min-h-[680px] p-4 md:p-5">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="section-label">Vaults</p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-[-0.045em]">{activeWorkspace?.title ?? 'Kein Workspace'}</h2>
                </div>
                <label className="search-pill w-full md:w-[320px]"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Vaults suchen ..." /></label>
              </div>

              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {filteredVaults.map(vault => (
                  <Link key={vault.id} href={`/vaults/${vault.id}`} className="vault-card group">
                    <div className="vault-cover" style={{ backgroundImage: vault.cover_url ? `url(${vault.cover_url})` : undefined }}>
                      <div className="vault-cover-glow" style={{ background: vault.color ? `linear-gradient(135deg, ${vault.color}55, transparent)` : undefined }} />
                      <FolderKanban className="relative z-10" size={24} />
                    </div>
                    <div className="p-4">
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <h3 className="line-clamp-2 text-xl font-semibold tracking-[-0.04em]">{vault.title}</h3>
                        <ArrowUpRight size={17} className="shrink-0 text-[var(--muted)] transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white" />
                      </div>
                      <p className="line-clamp-2 text-sm leading-5 text-[var(--muted)]">{vault.description || 'Pins, Notizen, Aufgaben, Medien und Ideen in einem Projektcontainer.'}</p>
                    </div>
                  </Link>
                ))}
              </div>

              {!filteredVaults.length && <div className="empty-state mt-4"><Lightbulb size={28} /><strong>Leerer Workspace</strong><span>Erstelle den ersten Vault, um projektbasiert zu arbeiten.</span></div>}
            </div>

            <aside className="space-y-5">
              <div id="discovery" className="panel p-4">
                <div className="mb-4 flex items-center justify-between">
                  <p className="section-label">Discovery Feed</p>
                  <Compass size={16} className="text-[var(--accent)]" />
                </div>
                <div className="space-y-3">
                  {initialRecentItems.slice(0, 5).map(item => (
                    <div key={item.id} className="compact-item">
                      <span className="compact-dot" />
                      <div className="min-w-0"><p className="truncate text-sm font-semibold">{item.title}</p><p className="truncate text-xs text-[var(--muted)]">{item.type}</p></div>
                    </div>
                  ))}
                  {!initialRecentItems.length && <p className="text-sm leading-6 text-[var(--muted)]">Sobald du Inhalte in Vaults speicherst, erscheinen hier vergessene Ressourcen, ältere Ideen und relevante Querverbindungen.</p>}
                </div>
              </div>

              <div id="tasks" className="panel p-4">
                <div className="mb-4 flex items-center justify-between"><p className="section-label">Heute</p><Bell size={16} className="text-[var(--accent)]" /></div>
                <div className="space-y-2">
                  {initialTasks.slice(0, 5).map(task => <div key={task.id} className="task-line"><span /> <p>{task.title}</p></div>)}
                  {!initialTasks.length && <p className="text-sm leading-6 text-[var(--muted)]">Keine offenen Aufgaben. To-dos werden in der nächsten Ausbaustufe direkt in Vaults gepflegt.</p>}
                </div>
              </div>

              <div id="time-capsule" className="panel p-4">
                <div className="mb-4 flex items-center justify-between"><p className="section-label">Time Capsule</p><TimerReset size={16} className="text-[var(--accent)]" /></div>
                <p className="text-sm leading-6 text-[var(--muted)]">Wiedervorlagen für Inhalte, Ideen und Projekte. Bereit für „in 30 Tagen erneut anzeigen“.</p>
              </div>
            </aside>
          </section>
        </div>
      </section>
    </main>
  );
}
