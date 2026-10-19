/** Small, calm UI building blocks shared by every screen. */
import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import type { Domain } from '../core';
import { PALETTE } from '../core';
import { parseNumber, useFmt } from './format';
import { Icon, type IconName } from './icons';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

// ---------------------------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------------------------

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; icon?: IconName }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'inline-flex items-center gap-1.5 rounded-md border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        size === 'sm' ? 'px-2 py-0.5 text-[13px]' : 'px-3 py-1.5 text-sm',
        variant === 'primary' && 'border-accent bg-accent text-accent-ink hover:opacity-90',
        variant === 'secondary' && 'border-line bg-surface text-ink hover:bg-surface-2',
        variant === 'ghost' && 'border-transparent bg-transparent text-ink hover:bg-surface-2',
        variant === 'danger' && 'border-bad/40 bg-surface text-bad hover:bg-bad-soft',
        className,
      )}
    >
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}

export function IconButton({
  icon,
  label,
  tone,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string; tone?: 'danger' }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      {...rest}
      className={cx(
        'inline-flex size-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-30',
        tone === 'danger' && 'hover:text-bad',
        className,
      )}
    >
      <Icon name={icon} />
    </button>
  );
}

/** Up/down buttons for reordering a list item. */
export function Reorder({ onUp, onDown, first, last }: { onUp: () => void; onDown: () => void; first: boolean; last: boolean }) {
  return (
    <span className="inline-flex">
      <IconButton icon="up" label="انتقال به بالا" onClick={onUp} disabled={first} />
      <IconButton icon="down" label="انتقال به پایین" onClick={onDown} disabled={last} />
    </span>
  );
}

// ---------------------------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------------------------

const inputCls =
  'w-full rounded-md border border-line bg-surface px-2 py-1 text-sm text-ink placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25';

export function TextInput({
  value,
  onChange,
  placeholder,
  className,
  ltr,
  ...rest
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  ltr?: boolean;
  'aria-label'?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      dir={ltr ? 'ltr' : undefined}
      onChange={(e) => onChange(e.target.value)}
      className={cx(inputCls, ltr && 'text-left', className)}
      {...rest}
    />
  );
}

export function TextArea({
  value,
  onChange,
  rows = 3,
  placeholder,
  className,
  ...rest
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
}) {
  return (
    <textarea
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cx(inputCls, 'leading-7', className)}
      {...rest}
    />
  );
}

/**
 * Number field that accepts Persian or Latin digits. The value is committed on every valid keystroke;
 * an empty field commits null. Shows digits in the current digit mode when not focused.
 */
export function NumberInput({
  value,
  onChange,
  min,
  max,
  integer,
  lazy,
  placeholder,
  className,
  ...rest
}: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
  integer?: boolean;
  /** Commit only on blur or Enter (for settings whose change triggers a "what will change" preview). */
  lazy?: boolean;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
}) {
  const fmt = useFmt();
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState('');
  const shown = focused ? text : value === null || value === undefined ? '' : fmt.auto(value, 6);
  const parsed = parseNumber(text);
  const accept = (n: number | null): n is number =>
    n !== null && (min === undefined || n >= min) && (max === undefined || n <= max) && (!integer || Number.isInteger(n));
  const invalid =
    focused &&
    text.trim() !== '' &&
    (parsed === null || (min !== undefined && parsed < min) || (max !== undefined && parsed > max) || (integer && !Number.isInteger(parsed)));
  return (
    <input
      type="text"
      inputMode="decimal"
      dir="ltr"
      value={shown}
      placeholder={placeholder}
      onFocus={() => {
        setFocused(true);
        setText(value === null || value === undefined ? '' : fmt.auto(value, 6));
      }}
      onBlur={() => {
        setFocused(false);
        if (lazy) {
          if (text.trim() === '') {
            if (value !== null && value !== undefined) onChange(null);
          } else if (accept(parsed) && parsed !== value) onChange(parsed);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      onChange={(e) => {
        setText(e.target.value);
        if (lazy) return;
        const n = parseNumber(e.target.value);
        if (e.target.value.trim() === '') onChange(null);
        else if (accept(n)) onChange(n);
      }}
      aria-invalid={invalid || undefined}
      className={cx(inputCls, 'text-center tabular-nums', invalid && 'border-bad ring-2 ring-bad/25', className)}
      {...rest}
    />
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  className,
  ...rest
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
  'aria-label'?: string;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as T)} className={cx(inputCls, 'py-1', className)} {...rest}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Checkbox({ checked, onChange, label, className }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; className?: string }) {
  const id = useId();
  return (
    <label htmlFor={id} className={cx('inline-flex cursor-pointer items-center gap-2 text-sm', className)}>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-[var(--accent)]" />
      {label}
    </label>
  );
}

export function DateInput({ value, onChange, ...rest }: { value: string | null; onChange: (v: string | null) => void; 'aria-label'?: string }) {
  const fmt = useFmt();
  return (
    <span className="inline-flex items-center gap-2">
      <input
        type="date"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className={cx(inputCls, 'w-36')}
        dir="ltr"
        {...rest}
      />
      {value && <span className="text-xs whitespace-nowrap text-muted">{fmt.date(value)}</span>}
    </span>
  );
}

export function Field({ label, hint, children, className }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1 block text-[13px] font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          title={c}
          aria-label={`رنگ ${c}`}
          onClick={() => onChange(c)}
          className={cx('size-5 rounded-full border border-line', value.toLowerCase() === c.toLowerCase() && 'ring-2 ring-accent ring-offset-1')}
          style={{ background: c }}
        />
      ))}
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-6 w-8 cursor-pointer rounded border border-line bg-surface" aria-label="رنگ دلخواه" />
    </span>
  );
}

/** Opens the file dialog; calls back with the chosen files. */
export function FilePick({
  accept,
  multiple,
  onFiles,
  children,
  icon = 'upload',
  variant = 'secondary',
}: {
  accept: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  children: ReactNode;
  icon?: IconName;
  variant?: Variant;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button icon={icon} variant={variant} onClick={() => ref.current?.click()}>
        {children}
      </Button>
      <input
        ref={ref}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          if (files.length) onFiles(files);
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------------------------

type Tone = 'neutral' | 'ok' | 'warn' | 'bad' | 'accent';

const toneCls: Record<Tone, string> = {
  neutral: 'border-line bg-surface-2 text-muted',
  ok: 'border-ok/30 bg-ok-soft text-ok',
  warn: 'border-warn/30 bg-warn-soft text-warn',
  bad: 'border-bad/30 bg-bad-soft text-bad',
  accent: 'border-accent/30 bg-accent-soft text-accent',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cx('inline-flex items-center gap-1 rounded-full border px-2 py-0 text-xs whitespace-nowrap', toneCls[tone], className)}>{children}</span>;
}

export function Callout({ tone = 'neutral', title, children, className }: { tone?: Tone; title?: ReactNode; children?: ReactNode; className?: string }) {
  const icon: IconName = tone === 'bad' || tone === 'warn' ? 'alert' : tone === 'ok' ? 'check' : 'info';
  return (
    <div className={cx('flex gap-2 rounded-lg border px-3 py-2 text-sm', toneCls[tone], className)} role={tone === 'bad' ? 'alert' : undefined}>
      <Icon name={icon} className="mt-1 size-4 shrink-0" />
      <div className="min-w-0 text-ink">
        {title && <div className="font-semibold">{title}</div>}
        {children}
      </div>
    </div>
  );
}

export function Card({ title, actions, children, className, id }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cx('rounded-xl border border-line bg-surface p-4 shadow-[0_1px_0_rgba(0,0,0,0.02)]', className)}>
      {(title || actions) && (
        <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageTitle({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-muted">{children}</div>;
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="mb-4 flex flex-wrap gap-1 border-b border-line">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          type="button"
          aria-selected={t.id === value}
          onClick={() => onChange(t.id)}
          className={cx(
            '-mb-px rounded-t-md border border-b-0 px-3 py-1.5 text-sm',
            t.id === value ? 'border-line bg-surface font-semibold text-ink' : 'border-transparent text-muted hover:text-ink',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** A domain's colour mark with its short label, so colour is never the only signal. */
export function DomainChip({ domain, withName }: { domain: Domain | undefined; withName?: boolean }) {
  if (!domain) return <span className="text-muted">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span
        className="inline-flex size-5 items-center justify-center rounded text-[11px] font-bold text-white"
        style={{ background: domain.color }}
        aria-hidden="true"
      >
        {domain.shortLabel}
      </span>
      {withName ? <span>{domain.name}</span> : <span className="sr-only">{domain.name}</span>}
    </span>
  );
}

/** Table wrapper with sticky header and horizontal scrolling for large matrices. */
export function TableWrap({ children, maxHeight = '70vh' }: { children: ReactNode; maxHeight?: string }) {
  return (
    <div className="overflow-auto rounded-lg border border-line" style={{ maxHeight }}>
      {children}
    </div>
  );
}

export const th = 'border-b border-line px-2 py-1.5 text-right text-[13px] font-semibold text-muted whitespace-nowrap';
export const td = 'border-b border-line/70 px-2 py-1 align-middle';

/** Runs a callback when Ctrl/Cmd+Z / Ctrl+Y / Ctrl+Shift+Z are pressed outside text fields. */
export function useUndoKeys(undo: () => void, redo: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      // e.code is layout independent, so the shortcut also works with a Persian keyboard layout.
      const k = e.code;
      if (k === 'KeyZ' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (k === 'KeyY' || (k === 'KeyZ' && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);
}

export { cx };
