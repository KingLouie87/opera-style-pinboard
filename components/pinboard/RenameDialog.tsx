'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

export function RenameDialog({
  title,
  label = 'Name',
  initialValue,
  onCancel,
  onSubmit,
  saving = false,
  error = ''
}: {
  title: string;
  label?: string;
  initialValue: string;
  onCancel: () => void;
  onSubmit: (value: string) => void;
  saving?: boolean;
  error?: string;
}) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 40);
    return () => window.clearTimeout(timer);
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    const next = value.trim();
    if (!next || saving) return;
    onSubmit(next.slice(0, 120));
  }

  return (
    <div className="modal-backdrop z-[900]" role="dialog" aria-modal="true" onMouseDown={onCancel}>
      <form className="rename-dialog" onSubmit={submit} onMouseDown={event => event.stopPropagation()}>
        <button type="button" className="rename-dialog-close" onClick={onCancel} aria-label="Schließen"><X size={16} /></button>
        <p>Umbenennen</p>
        <h2>{title}</h2>
        <label>
          <span>{label}</span>
          <input
            ref={inputRef}
            value={value}
            maxLength={120}
            onChange={event => setValue(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Escape') onCancel();
            }}
          />
        </label>
        {error && <em>{error}</em>}
        <footer>
          <button type="button" className="btn-ghost px-4 py-3 text-sm" onClick={onCancel}>Abbrechen</button>
          <button type="submit" disabled={saving || !value.trim()} className="btn-primary px-5 py-3 text-sm">{saving ? 'Speichert ...' : 'Speichern'}</button>
        </footer>
      </form>
    </div>
  );
}
