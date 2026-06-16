'use client';

import { useEffect, useMemo } from 'react';
import { Archive, Copy, ExternalLink, FolderInput, Pencil, Trash2, type LucideIcon } from 'lucide-react';

type Item = {
  label: string;
  icon: LucideIcon;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
};

export function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: Item[]; onClose: () => void }) {
  useEffect(() => {
    function close() { onClose(); }
    function onKey(event: KeyboardEvent) { if (event.key === 'Escape') onClose(); }
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const position = useMemo(() => {
    const width = 224;
    const height = Math.max(52, items.length * 42 + 18);
    return {
      left: Math.min(x, Math.max(12, window.innerWidth - width - 12)),
      top: Math.min(y, Math.max(12, window.innerHeight - height - 12))
    };
  }, [x, y, items.length]);

  return (
    <div className="context-menu" style={position} onPointerDown={event => event.stopPropagation()} role="menu">
      {items.map(item => {
        const Icon = item.icon;
        return (
          <button key={item.label} type="button" disabled={item.disabled} onClick={() => { if (item.disabled) return; item.onSelect(); onClose(); }} className={item.danger ? 'danger' : ''} role="menuitem">
            <Icon size={15} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export const pinMenuIcons = {
  open: ExternalLink,
  edit: Pencil,
  move: FolderInput,
  duplicate: Copy,
  archive: Archive,
  delete: Trash2,
  ExternalLink,
  Pencil,
  FolderInput,
  Copy,
  Archive,
  Trash2
};
