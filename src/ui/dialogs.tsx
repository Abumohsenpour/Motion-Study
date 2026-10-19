/**
 * Modal dialogs and toasts.
 * `confirmDialog()` returns a promise, so an edit can wait for the researcher's decision
 * ("this will change …; reason: …") before it is applied.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { create } from 'zustand';
import { Button, TextArea, cx } from './kit';
import { Icon } from './icons';

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[8vh]" onMouseDown={onClose}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        className={cx('w-full rounded-xl border border-line bg-surface shadow-xl outline-none', wide ? 'max-w-5xl' : 'max-w-xl')}
      >
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="بستن" className="rounded p-1 text-muted hover:bg-surface-2">
            <Icon name="x" />
          </button>
        </header>
        <div className="max-h-[70vh] overflow-y-auto px-4 py-3">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-4 py-3">{footer}</footer>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Confirm dialog (promise based)
// ---------------------------------------------------------------------------------------------

export interface ConfirmRequest {
  title: string;
  body?: ReactNode;
  items?: string[];
  askReason?: boolean;
  confirmLabel?: string;
  tone?: 'danger' | 'normal';
}

interface Pending extends ConfirmRequest {
  resolve: (r: { ok: boolean; reason: string }) => void;
}

const useConfirmStore = create<{ queue: Pending[] }>(() => ({ queue: [] }));

export function confirmDialog(req: ConfirmRequest): Promise<{ ok: boolean; reason: string }> {
  return new Promise((resolve) => useConfirmStore.setState((s) => ({ queue: [...s.queue, { ...req, resolve }] })));
}

export function ConfirmHost() {
  const current = useConfirmStore((s) => s.queue[0]);
  const [reason, setReason] = useState('');
  if (!current) return null;
  const finish = (ok: boolean) => {
    current.resolve({ ok, reason: reason.trim() });
    setReason('');
    useConfirmStore.setState((s) => ({ queue: s.queue.slice(1) }));
  };
  return (
    <Modal
      open
      title={current.title}
      onClose={() => finish(false)}
      footer={
        <>
          <Button onClick={() => finish(false)}>انصراف</Button>
          <Button variant={current.tone === 'danger' ? 'danger' : 'primary'} onClick={() => finish(true)}>
            {current.confirmLabel ?? 'اعمال'}
          </Button>
        </>
      }
    >
      {current.body}
      {current.items && current.items.length > 0 && (
        <ul className="my-2 list-disc space-y-1 ps-5 text-sm">
          {current.items.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      )}
      {current.askReason && (
        <div className="mt-3">
          <label className="mb-1 block text-[13px] text-muted">دلیل تغییر (در دفتر تغییرات ثبت می‌شود؛ اختیاری)</label>
          <TextArea value={reason} onChange={setReason} rows={2} aria-label="دلیل تغییر" />
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------------------------

interface Toast {
  id: number;
  text: string;
  tone: 'normal' | 'bad';
  action?: { label: string; run: () => void };
}

const useToastStore = create<{ toasts: Toast[] }>(() => ({ toasts: [] }));
let toastId = 0;

export function toast(text: string, opts: { tone?: 'normal' | 'bad'; action?: Toast['action']; ms?: number } = {}) {
  const id = ++toastId;
  useToastStore.setState((s) => ({ toasts: [...s.toasts, { id, text, tone: opts.tone ?? 'normal', action: opts.action }] }));
  setTimeout(() => useToastStore.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), opts.ms ?? 6000);
}

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div className="no-print fixed bottom-4 left-4 z-[60] flex flex-col gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cx(
            'flex items-center gap-3 rounded-lg border px-3 py-2 text-sm shadow-lg',
            t.tone === 'bad' ? 'border-bad/40 bg-bad-soft text-bad' : 'border-line bg-surface text-ink',
          )}
        >
          <span>{t.text}</span>
          {t.action && (
            <button
              type="button"
              className="font-semibold text-accent underline-offset-2 hover:underline"
              onClick={() => {
                t.action!.run();
                useToastStore.setState((s) => ({ toasts: s.toasts.filter((x) => x.id !== t.id) }));
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
