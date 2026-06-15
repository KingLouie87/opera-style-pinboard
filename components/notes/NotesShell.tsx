'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, CheckSquare, FilePlus2, Hash, List, ListOrdered, Plus, Quote, Save, Search, Trash2 } from 'lucide-react';
import { Notebook, NotebookSection, NotePage } from '@/lib/types';
import { createClient } from '@/lib/supabase/browser';
import { AppShell } from '@/components/platform/AppShell';
import { nextPosition } from '@/lib/position';

function nowIso() {
  return new Date().toISOString();
}

export function NotesShell({ initialNotebooks, initialSections, initialPages, userEmail }: { initialNotebooks: Notebook[]; initialSections: NotebookSection[]; initialPages: NotePage[]; userEmail: string }) {
  const supabase = createClient();
  const [notebooks, setNotebooks] = useState(initialNotebooks);
  const [sections, setSections] = useState(initialSections);
  const [pages, setPages] = useState(initialPages);
  const [activeNotebookId, setActiveNotebookId] = useState(initialNotebooks[0]?.id ?? '');
  const [activeSectionId, setActiveSectionId] = useState(initialSections.find(section => section.notebook_id === initialNotebooks[0]?.id)?.id ?? '');
  const [activePageId, setActivePageId] = useState(initialPages[0]?.id ?? '');
  const [query, setQuery] = useState('');
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'dirty'>('saved');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const activeNotebook = notebooks.find(notebook => notebook.id === activeNotebookId) ?? null;
  const visibleSections = sections.filter(section => section.notebook_id === activeNotebookId);
  const activeSection = visibleSections.find(section => section.id === activeSectionId) ?? visibleSections[0] ?? null;

  const visiblePages = useMemo(() => {
    const q = query.toLowerCase().trim();
    return pages
      .filter(page => page.notebook_id === activeNotebookId)
      .filter(page => !activeSection || page.section_id === activeSection.id)
      .filter(page => !q || `${page.title} ${page.content} ${(page.tags ?? []).join(' ')}`.toLowerCase().includes(q));
  }, [pages, activeNotebookId, activeSection, query]);

  const activePage = pages.find(page => page.id === activePageId) ?? visiblePages[0] ?? null;

  useEffect(() => {
    if (!activeNotebookId && notebooks[0]) setActiveNotebookId(notebooks[0].id);
  }, [notebooks, activeNotebookId]);

  useEffect(() => {
    const firstSection = sections.find(section => section.notebook_id === activeNotebookId);
    if (firstSection && !sections.some(section => section.id === activeSectionId && section.notebook_id === activeNotebookId)) setActiveSectionId(firstSection.id);
  }, [activeNotebookId, sections, activeSectionId]);

  useEffect(() => {
    if (activePage && !visiblePages.some(page => page.id === activePageId)) setActivePageId(activePage.id);
  }, [visiblePages, activePage, activePageId]);

  useEffect(() => {
    if (!activePage || saveState !== 'dirty') return;
    const timeout = window.setTimeout(async () => {
      setSaveState('saving');
      const page = pages.find(item => item.id === activePage.id);
      if (!page) return;
      await supabase.from('note_pages').update({ title: page.title || 'Unbenannte Seite', content: page.content }).eq('id', page.id);
      setSaveState('saved');
    }, 850);
    return () => window.clearTimeout(timeout);
  }, [activePage, pages, saveState, supabase]);

  async function createNotebook() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data } = await supabase.from('notebooks').insert({ user_id: userData.user.id, title: `Notizbuch ${notebooks.length + 1}`, position: nextPosition(notebooks) }).select('*').single();
    if (!data) return;
    const notebook = data as Notebook;
    setNotebooks(current => [...current, notebook]);
    setActiveNotebookId(notebook.id);

    const { data: sectionData } = await supabase.from('notebook_sections').insert({ user_id: userData.user.id, notebook_id: notebook.id, title: 'Allgemein', position: 1000 }).select('*').single();
    if (sectionData) {
      const section = sectionData as NotebookSection;
      setSections(current => [...current, section]);
      setActiveSectionId(section.id);
    }
  }

  async function createSection() {
    if (!activeNotebook) return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const notebookSections = sections.filter(section => section.notebook_id === activeNotebook.id);
    const { data } = await supabase.from('notebook_sections').insert({ user_id: userData.user.id, notebook_id: activeNotebook.id, title: `Kapitel ${notebookSections.length + 1}`, position: nextPosition(notebookSections) }).select('*').single();
    if (data) {
      setSections(current => [...current, data as NotebookSection]);
      setActiveSectionId((data as NotebookSection).id);
    }
  }

  async function createPage() {
    if (!activeNotebook) return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const targetSection = activeSection;
    const sectionPages = pages.filter(page => page.section_id === targetSection?.id);
    const { data } = await supabase.from('note_pages').insert({
      user_id: userData.user.id,
      notebook_id: activeNotebook.id,
      section_id: targetSection?.id ?? null,
      title: `Neue Seite ${sectionPages.length + 1}`,
      content: '',
      position: nextPosition(sectionPages)
    }).select('*').single();
    if (data) {
      setPages(current => [...current, data as NotePage]);
      setActivePageId((data as NotePage).id);
    }
  }

  async function archiveNotebook(notebook: Notebook) {
    if (!confirm(`Notizbuch "${notebook.title}" archivieren?`)) return;
    setNotebooks(current => current.filter(item => item.id !== notebook.id));
    await supabase.from('notebooks').update({ archived_at: nowIso() }).eq('id', notebook.id);
  }

  async function archiveSection(section: NotebookSection) {
    if (!confirm(`Kapitel "${section.title}" archivieren?`)) return;
    setSections(current => current.filter(item => item.id !== section.id));
    await supabase.from('notebook_sections').update({ archived_at: nowIso() }).eq('id', section.id);
  }

  async function archivePage(page: NotePage) {
    if (!confirm(`Seite "${page.title}" archivieren?`)) return;
    setPages(current => current.filter(item => item.id !== page.id));
    await supabase.from('note_pages').update({ archived_at: nowIso() }).eq('id', page.id);
  }

  async function updateNotebookTitle(notebook: Notebook, title: string) {
    setNotebooks(current => current.map(item => (item.id === notebook.id ? { ...item, title } : item)));
    await supabase.from('notebooks').update({ title }).eq('id', notebook.id);
  }

  async function updateSectionTitle(section: NotebookSection, title: string) {
    setSections(current => current.map(item => (item.id === section.id ? { ...item, title } : item)));
    await supabase.from('notebook_sections').update({ title }).eq('id', section.id);
  }

  function updatePage(patch: Partial<NotePage>) {
    if (!activePage) return;
    setPages(current => current.map(page => (page.id === activePage.id ? { ...page, ...patch } : page)));
    setSaveState('dirty');
  }

  function insertMarkup(prefix: string, suffix = '') {
    const textarea = textareaRef.current;
    if (!textarea || !activePage) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const content = activePage.content;
    const selected = content.slice(start, end);
    const next = `${content.slice(0, start)}${prefix}${selected || 'Text'}${suffix}${content.slice(end)}`;
    updatePage({ content: next });
    window.requestAnimationFrame(() => textarea.focus());
  }

  return (
    <AppShell userEmail={userEmail} active="notes">
      <div className="flex h-full min-h-0 flex-col gap-4">
      <header className="glass-strong flex shrink-0 flex-col gap-4 rounded-[10px] p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Link href="/workspaces" className="mb-2 inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--accent)]"><ArrowLeft size={16} /> Home</Link>
          <h1 className="text-3xl font-semibold tracking-[-0.05em] md:text-4xl">Notizen</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Arbeitsnotizen, Kapitel und Seiten für {userEmail}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={createNotebook} className="btn-primary px-4 py-2"><Plus size={18} /> Notizbuch</button>
          <button onClick={createSection} disabled={!activeNotebook} className="btn-ghost px-4 py-2 text-sm font-semibold disabled:opacity-50"><BookOpen size={18} /> Kapitel</button>
          <button onClick={createPage} disabled={!activeNotebook} className="btn-ghost px-4 py-2 text-sm font-semibold disabled:opacity-50"><FilePlus2 size={18} /> Seite</button>
        </div>
      </header>

      <section className="grid min-h-0 flex-1 gap-3 overflow-hidden lg:grid-cols-[265px_315px_1fr]">
        <aside className="surface min-h-0 overflow-hidden rounded-[10px] p-3">
          <div className="mb-3 flex items-center justify-between px-2 py-1">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Notizbücher</h2>
          </div>
          <div className="space-y-2">
            {notebooks.map(notebook => (
              <div key={notebook.id} className={`rounded-[7px] border p-2 ${notebook.id === activeNotebookId ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-transparent hover:bg-white/[0.055]'}`}>
                <button onClick={() => setActiveNotebookId(notebook.id)} className="w-full text-left text-sm font-semibold">{notebook.title}</button>
                {notebook.id === activeNotebookId && (
                  <div className="mt-2 flex gap-1">
                    <input value={notebook.title} onChange={event => updateNotebookTitle(notebook, event.target.value)} className="min-w-0 flex-1 bg-transparent text-xs text-[var(--muted)] outline-none" />
                    <button onClick={() => archiveNotebook(notebook)} className="text-[var(--muted)] hover:text-red-300"><Trash2 size={14} /></button>
                  </div>
                )}
              </div>
            ))}
            {!notebooks.length && <button onClick={createNotebook} className="grid min-h-32 w-full place-items-center rounded-[8px] border border-dashed border-[var(--line)] text-sm text-[var(--muted)] hover:border-[var(--accent)]">Erstes Notizbuch erstellen</button>}
          </div>

          {!!visibleSections.length && <h3 className="mb-2 mt-6 px-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Kapitel</h3>}
          <div className="space-y-2">
            {visibleSections.map(section => (
              <div key={section.id} className={`rounded-[7px] border p-2 ${section.id === activeSection?.id ? 'border-white/20 bg-white/[0.07]' : 'border-transparent hover:bg-white/[0.055]'}`}>
                <button onClick={() => setActiveSectionId(section.id)} className="w-full text-left text-sm">{section.title}</button>
                {section.id === activeSection?.id && (
                  <div className="mt-2 flex gap-1">
                    <input value={section.title} onChange={event => updateSectionTitle(section, event.target.value)} className="min-w-0 flex-1 bg-transparent text-xs text-[var(--muted)] outline-none" />
                    <button onClick={() => archiveSection(section)} className="text-[var(--muted)] hover:text-red-300"><Trash2 size={14} /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </aside>

        <aside className="surface min-h-0 overflow-hidden rounded-[10px] p-3">
          <label className="mb-3 flex items-center gap-2 rounded-[7px] border border-[var(--line)] bg-white/[0.04] px-3 py-2 text-sm">
            <Search size={16} className="text-[var(--muted)]" />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Seiten suchen ..." className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-white/30" />
          </label>
          <div className="board-scroll h-full min-h-0 space-y-2 overflow-y-auto pr-1">
            {visiblePages.map(page => (
              <button key={page.id} onClick={() => setActivePageId(page.id)} className={`block w-full rounded-[8px] border p-3 text-left transition ${page.id === activePage?.id ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--line)] bg-white/[0.035] hover:bg-white/[0.06]'}`}>
                <h3 className="line-clamp-1 text-sm font-semibold">{page.title}</h3>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--muted)]">{page.content || 'Leere Seite'}</p>
              </button>
            ))}
            {!visiblePages.length && <button onClick={createPage} className="grid min-h-32 w-full place-items-center rounded-[8px] border border-dashed border-[var(--line)] text-sm text-[var(--muted)] hover:border-[var(--accent)]">Neue Seite erstellen</button>}
          </div>
        </aside>

        <section className="surface min-h-0 overflow-hidden rounded-[10px]">
          {activePage ? (
            <div className="flex h-full flex-col">
              <div className="border-b border-[var(--line)] p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <input value={activePage.title} onChange={event => updatePage({ title: event.target.value })} className="min-w-0 flex-1 bg-transparent text-3xl font-semibold tracking-[-0.05em] outline-none" />
                  <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                    <Save size={14} /> {saveState === 'saved' ? 'Gespeichert' : saveState === 'saving' ? 'Speichert ...' : 'Ungespeichert'}
                    <button onClick={() => archivePage(activePage)} className="btn-ghost px-3 py-2 text-xs font-semibold text-[var(--danger)]"><Trash2 size={14} /> Seite</button>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={() => insertMarkup('# ')} className="btn-ghost px-3 py-2 text-xs font-semibold"><Hash size={14} /> Titel</button>
                  <button onClick={() => insertMarkup('- ')} className="btn-ghost px-3 py-2 text-xs font-semibold"><List size={14} /> Liste</button>
                  <button onClick={() => insertMarkup('1. ')} className="btn-ghost px-3 py-2 text-xs font-semibold"><ListOrdered size={14} /> Nummern</button>
                  <button onClick={() => insertMarkup('- [ ] ')} className="btn-ghost px-3 py-2 text-xs font-semibold"><CheckSquare size={14} /> Checkliste</button>
                  <button onClick={() => insertMarkup('> ')} className="btn-ghost px-3 py-2 text-xs font-semibold"><Quote size={14} /> Zitat</button>
                </div>
              </div>
              <textarea
                ref={textareaRef}
                value={activePage.content}
                onChange={event => updatePage({ content: event.target.value })}
                placeholder="Schreibe deine Notizen hier. Nutze die Toolbar für Überschriften, Listen, Checklisten und Zitate."
                className="note-editor-area board-scroll min-h-0 flex-1 resize-none bg-transparent p-5 text-base leading-8 text-[var(--text-soft)] outline-none placeholder:text-white/25 md:p-7"
              />
            </div>
          ) : (
            <div className="grid h-full place-items-center p-8 text-center text-[var(--muted)]">
              <div>
                <BookOpen className="mx-auto mb-4" size={34} />
                <h2 className="text-xl font-semibold text-white">Noch keine Seite ausgewählt</h2>
                <p className="mt-2 max-w-sm text-sm leading-6">Erstelle ein Notizbuch, ein Kapitel und eine Seite, um mit strukturierten Notizen zu starten.</p>
                <button onClick={createNotebook} className="btn-primary mt-5 px-5 py-3">Notizbuch erstellen</button>
              </div>
            </div>
          )}
        </section>
      </section>
    </div>
    </AppShell>
  );
}
