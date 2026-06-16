'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Archive, Copy, ExternalLink, FolderInput, Pencil, Trash2, type LucideIcon } from 'lucide-react';

type Item = {
  label: string;
  icon: LucideIcon;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
};

type Point = { left: number; top: number };

function clampMenuPosition(x: number, y: number, width: number, height: number): Point {
  if (typeof window === 'undefined') return { left: x, top: y };
  const margin = 12;
  const safeWidth = Math.min(width || 236, window.innerWidth - margin * 2);
  const safeHeight = Math.min(height || 52, window.innerHeight - margin * 2);
  return {
    left: Math.min(Math.max(margin, x), Math.max(margin, window.innerWidth - safeWidth - margin)),
    top: Math.min(Math.max(margin, y), Math.max(margin, window.innerHeight - safeHeight - margin))
  };
}

export function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: Item[]; onClose: () => void }) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<Point>(() => ({ left: x, top: y }));
  const [measured, setMeasured] = useState(false);

  useLayoutEffect(() => {
    const node = menuRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    setPosition(clampMenuPosition(x, y, rect.width || 236, rect.height || Math.max(52, items.length * 42 + 18)));
    setMeasured(true);
  }, [x, y, items.length]);

  useEffect(() => {
    function close() { onClose(); }
    function onKey(event: KeyboardEvent) { if (event.key === 'Escape') onClose(); }
    function onResize() { onClose(); }

    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', close, true);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ left: position.left, top: position.top, opacity: measured ? 1 : 0 }}
      onPointerDown={event => event.stopPropagation()}
      onContextMenu={event => event.preventDefault()}
      role="menu"
    >
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
