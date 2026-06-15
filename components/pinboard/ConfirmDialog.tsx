'use client';

import { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export function ConfirmDialog({ title, message, confirmLabel = 'Löschen', onConfirm, onCancel }: { title: string; message: string; confirmLabel?: string; onConfirm: () => void; onCancel: () => void }) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="modal-backdrop z-[80]" role="dialog" aria-modal="true" onMouseDown={onCancel}>
      <div className="confirm-card" onMouseDown={event => event.stopPropagation()}>
        <button type="button" onClick={onCancel} className="confirm-close" aria-label="Schließen"><X size={16} /></button>
        <div className="confirm-icon"><AlertTriangle size={22} /></div>
        <h2>{title}</h2>
        <p>{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="btn-ghost px-4 py-2 text-sm font-semibold">Abbrechen</button>
          <button type="button" onClick={onConfirm} className="btn-danger px-4 py-2 text-sm font-semibold">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
