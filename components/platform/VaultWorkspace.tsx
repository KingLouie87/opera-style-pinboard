'use client';

import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';
import { ArrowLeft, Bookmark, CheckCircle2, FileText, GalleryVerticalEnd, GitBranch, ImagePlus, LayoutGrid, ListChecks, Plus, Search, Star, TimerReset } from 'lucide-react';
import { TaskItem, Vault, VaultItem } from '@/lib/types';
import { createClient } from '@/lib/supabase/browser';
import { AppRail } from './AppRail';

type Tab = 'pins' | 'notes' | 'tasks' | 'mindmap' | 'files';

type Props = {
  vault: Vault;
  initialItems: VaultItem[];
  initialTasks: TaskItem[];
  userEmail: string;
};

const tabs: { id: Tab; label: string; icon: typeof Bookmark }[] = [
  { id: 'pins', label: 'Pins', icon: Bookmark },
  { id: 'notes', label: 'Notizen', icon: FileText },
  { id: 'tasks', label: 'To-do', icon: ListChecks },
  { id: 'mindmap', label: 'Mindmap', icon: GitBranch },
  { id: 'files', label: 'Dateien', icon: GalleryVerticalEnd }
];

export function VaultWorkspace({ vault, initialItems, initialTasks, userEmail }: Props) {
  const supabase = createClient();
  const [items, setItems] = useState(initialItems);
  const [tasks, setTasks] = useState(initialTasks);
  const [tab, setTab] = useState<Tab>('pins');
  const [query, setQuery] = useState('');
  const [quickTitle, setQuickTitle] = useState('');
  const [quickUrl, setQuickUrl] = useState('');

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(item => {
      const tabType = tab === 'pins' ? ['pin', 'link', 'media'].includes(item.type) : tab === 'notes' ? item.type === 'note' : tab === 'files' ? item.type === 'file' : true;
      const matches = !q || `${item.title} ${item.description ?? ''} ${(item.tags ?? []).join(' ')}`.toLowerCase().includes(q);
      return tabType && matches;
    });
  }, [items, query, tab]);

  async function createQuickPin(event: FormEvent) {
    event.preventDefault();
    const title = quickTitle.trim() || quickUrl.trim();
    if (!title) return;

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data, error } = await supabase
      .from('vault_items')
      .insert({
        user_id: userData.user.id,
        workspace_id: vault.workspace_id,
        vault_id: vault.id,
        type: quickUrl.trim() ? 'link' : 'pin',
        title,
        url: quickUrl.trim() || null,
        position: Date.now(),
        metadata: {}
      })
      .select('*')
      .single();

    if (error) {
      alert(`Pin konnte nicht erstellt werden: ${error.message}`);
      return;
    }
    if (data) {
      setItems(current => [data as VaultItem, ...current]);
      setQuickTitle('');
      setQuickUrl('');
    }
  }

  async function createTask(event: FormEvent) {
    event.preventDefault();
    const title = quickTitle.trim();
    if (!title) return;

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data, error } = await supabase
      .from('tasks')
      .insert({ user_id: userData.user.id, workspace_id: vault.workspace_id, vault_id: vault.id, title, status: 'open', priority: 'normal' })
      .select('*')
      .single();

    if (error) {
      alert(`Aufgabe konnte nicht erstellt werden: ${error.message}`);
      return;
    }
    if (data) {
      setTasks(current => [data as TaskItem, ...current]);
      setQuickTitle('');
    }
  }

  return (
    <main className="flex min-h-screen bg-[var(--app-bg)] text-[var(--text)]">
      <AppRail userEmail={userEmail} active="vaults" />
      <section className="min-w-0 flex-1 px-4 py-4 lg:px-6 lg:py-6">
        <div className="mx-auto max-w-[1500px]">
          <header className="premium-hero relative overflow-hidden rounded-[16px] border border-[var(--line)] p-5 md:p-7">
            <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <Link href="/workspaces" className="mb-4 inline-flex items-center gap-2 text-sm text-[var(--muted)] transition hover:text-white"><ArrowLeft size={16} /> Workspaces</Link>
                <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-[var(--accent)]">Vault</p>
                <h1 className="mt-2 text-4xl font-semibold tracking-[-0.065em] md:text-6xl">{vault.title}</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">{vault.description || 'Ein Projektcontainer für Pins, Notizen, Aufgaben, Medien, Mindmaps und Wiederentdeckung.'}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="btn-ghost px-4 py-3 text-sm"><Star size={17} /> Favorit</button>
                <button className="btn-ghost px-4 py-3 text-sm"><TimerReset size={17} /> Wiedervorlage</button>
              </div>
            </div>
          </header>

          <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_360px]">
            <section className="panel min-h-[720px] p-4 md:p-5">
              <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="module-tabs">
                  {tabs.map(item => {
                    const Icon = item.icon;
                    return <button key={item.id} onClick={() => setTab(item.id)} className={tab === item.id ? 'module-tab-active' : ''}><Icon size={16} /> {item.label}</button>;
                  })}
                </div>
                <label className="search-pill w-full lg:w-[320px]"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Im Vault suchen ..." /></label>
              </div>

              {tab === 'tasks' ? (
                <div className="grid gap-3">
                  {tasks.map(task => <div key={task.id} className="task-card"><CheckCircle2 size={18} /><div><p className="font-semibold">{task.title}</p><p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">{task.priority} · {task.status}</p></div></div>)}
                  {!tasks.length && <EmptyModule title="Noch keine Aufgaben" text="Erstelle Aufgaben, Deadlines und Erinnerungen für diesen Vault." />}
                </div>
              ) : tab === 'mindmap' ? (
                <MindmapPlaceholder />
              ) : (
                <div className="vault-masonry">
                  {filteredItems.map(item => <VaultItemCard key={item.id} item={item} />)}
                  {!filteredItems.length && <EmptyModule title="Noch keine Inhalte" text="Füge Pins, Links, Notizen oder Dateien hinzu. Der Vault bündelt alles projektbezogen." />}
                </div>
              )}
            </section>

            <aside className="space-y-5">
              <form onSubmit={tab === 'tasks' ? createTask : createQuickPin} className="panel p-4">
                <p className="section-label">Quick Capture</p>
                <h2 className="mt-1 text-xl font-semibold tracking-[-0.04em]">Schnell hinzufügen</h2>
                <div className="mt-4 space-y-3">
                  <input value={quickTitle} onChange={event => setQuickTitle(event.target.value)} placeholder={tab === 'tasks' ? 'Aufgabe ...' : 'Titel oder Gedanke ...'} className="field" />
                  {tab !== 'tasks' && <input value={quickUrl} onChange={event => setQuickUrl(event.target.value)} placeholder="Link optional" className="field" />}
                  <button className="btn-primary w-full px-3 py-2.5 text-sm"><Plus size={16} /> Hinzufügen</button>
                </div>
              </form>

              <div className="panel p-4">
                <p className="section-label">Collections</p>
                <div className="mt-4 space-y-2">
                  <button className="collection-line"><LayoutGrid size={16} /> Alle Bilder <span>{items.filter(i => i.image_url).length}</span></button>
                  <button className="collection-line"><Bookmark size={16} /> Alle Links <span>{items.filter(i => i.url).length}</span></button>
                  <button className="collection-line"><Star size={16} /> Favoriten <span>{items.filter(i => i.favorite).length}</span></button>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}

function VaultItemCard({ item }: { item: VaultItem }) {
  return (
    <article className="vault-item-card">
      {item.image_url ? <img src={item.image_url} alt="" /> : <div className="vault-item-empty"><ImagePlus size={22} /></div>}
      <div className="p-4">
        <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-[var(--accent)]">{item.type}</p>
        <h3 className="text-lg font-semibold tracking-[-0.04em]">{item.title}</h3>
        {item.description && <p className="mt-2 line-clamp-3 text-sm leading-5 text-[var(--muted)]">{item.description}</p>}
        {!!item.tags?.length && <div className="mt-3 flex flex-wrap gap-1.5">{item.tags.map(tag => <span key={tag} className="tag-chip">{tag}</span>)}</div>}
      </div>
    </article>
  );
}

function EmptyModule({ title, text }: { title: string; text: string }) {
  return <div className="empty-state"><ImagePlus size={28} /><strong>{title}</strong><span>{text}</span></div>;
}

function MindmapPlaceholder() {
  return (
    <div className="mindmap-stage">
      <div className="mindmap-node mindmap-node-main">Vault</div>
      <div className="mindmap-node mindmap-node-a">Pins</div>
      <div className="mindmap-node mindmap-node-b">Notizen</div>
      <div className="mindmap-node mindmap-node-c">Aufgaben</div>
      <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
        <line x1="50%" y1="50%" x2="28%" y2="34%" stroke="rgba(255,255,255,.18)" />
        <line x1="50%" y1="50%" x2="72%" y2="36%" stroke="rgba(255,255,255,.18)" />
        <line x1="50%" y1="50%" x2="52%" y2="74%" stroke="rgba(255,255,255,.18)" />
      </svg>
    </div>
  );
}
