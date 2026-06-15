'use client';

import { Grid2X2, Plus, Search, Sparkles } from 'lucide-react';

export function MobileNav({ onAdd, onFocusSearch }: { onAdd: () => void; onFocusSearch: () => void }) {
  return (
    <nav className="mobile-glass-nav fixed inset-x-4 bottom-4 z-40 grid h-16 grid-cols-4 items-center rounded-[12px] px-2 shadow-2xl md:hidden">
      <a href="/boards" className="grid place-items-center gap-1 text-[10px] font-medium text-[var(--text-soft)]"><Grid2X2 size={19} /> Boards</a>
      <button onClick={onFocusSearch} className="grid place-items-center gap-1 text-[10px] font-medium text-[var(--text-soft)]"><Search size={19} /> Suche</button>
      <button onClick={onAdd} className="mx-auto grid h-11 w-11 place-items-center rounded-[10px] bg-white text-black shadow-lg"><Plus size={22} /></button>
      <button className="grid place-items-center gap-1 text-[10px] font-medium text-[var(--text-soft)]"><Sparkles size={19} /> Fokus</button>
    </nav>
  );
}
