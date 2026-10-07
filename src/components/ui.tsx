import { ReactNode, useEffect, InputHTMLAttributes, SelectHTMLAttributes, ButtonHTMLAttributes, forwardRef } from "react";
import { ChevronLeft, ChevronRight, X, Loader2, Inbox } from "lucide-react";
import clsx from "clsx";
import type { Status } from "@/lib/types";

/* ---------- Button ---------- */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md"; loading?: boolean;
};
export function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...p }: BtnProps) {
  return (
    <button
      disabled={disabled || loading}
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed",
        size === "sm" ? "h-8 px-2.5 text-sm" : "h-10 px-4 text-sm",
        variant === "primary" && "bg-indigo-600 text-white hover:bg-indigo-700",
        variant === "secondary" && "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50",
        variant === "ghost" && "text-slate-600 hover:bg-slate-100",
        variant === "danger" && "bg-red-600 text-white hover:bg-red-700",
        className
      )}
      {...p}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

/* ---------- Inputs ---------- */
const fieldCls =
  "w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-100";
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} className={clsx(fieldCls, className)} {...p} />
));
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...p }, ref) => (
  <select ref={ref} className={clsx(fieldCls, "pr-8", className)} {...p} />
));
export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

/* ---------- Layout bits ---------- */
export const Card = ({ className, children }: { className?: string; children: ReactNode }) => (
  <div className={clsx("rounded-xl border border-slate-200 bg-white shadow-sm", className)}>{children}</div>
);

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export const Spinner = () => (
  <div className="flex justify-center py-12 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
);

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center py-12 text-center">
      <Inbox className="mb-2 h-8 w-8 text-slate-300" />
      <p className="font-medium text-slate-700">{title}</p>
      {hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  return <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{(error as Error)?.message ?? "Something went wrong"}</div>;
}

/* ---------- Badges ---------- */
const tones = {
  slate: "bg-slate-100 text-slate-700", green: "bg-emerald-50 text-emerald-700", red: "bg-red-50 text-red-700",
  amber: "bg-amber-50 text-amber-700", blue: "bg-sky-50 text-sky-700", indigo: "bg-indigo-50 text-indigo-700",
};
export const Badge = ({ tone = "slate", children }: { tone?: keyof typeof tones; children: ReactNode }) => (
  <span className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", tones[tone])}>{children}</span>
);

export const statusTone: Record<Status, keyof typeof tones> = {
  Pending: "slate", Dispatched: "blue", "In Transit": "amber", Delivered: "green", Cancelled: "red",
};
export const StatusBadge = ({ status }: { status: Status }) => <Badge tone={statusTone[status]}>{status}</Badge>;

/* ---------- Modal (bottom sheet on phones) ---------- */
export function Modal({ open, onClose, title, children, footer }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={title}
           className="relative flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:max-w-md sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Confirm({ open, onClose, onConfirm, title, message, confirmLabel = "Confirm", danger, loading }: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string; message: ReactNode;
  confirmLabel?: string; danger?: boolean; loading?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant={danger ? "danger" : "primary"} loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
      </>}>
      <p className="text-sm text-slate-600">{message}</p>
    </Modal>
  );
}

/* ---------- Pagination ---------- */
export function Pagination({ page, limit, total, onPage }: { page: number; limit: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (total <= limit) return null;
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
      <span>{(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}</span>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous"><ChevronLeft className="h-4 w-4" /></Button>
        <span className="px-2">{page} / {pages}</span>
        <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next"><ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

/* ---------- DataTable: real table on desktop, stacked cards on phones ---------- */
export interface Col<T> { key: string; header: string; render?: (row: T) => ReactNode; primary?: boolean; align?: "right"; hideOnMobile?: boolean }

export function DataTable<T>({ cols, rows, rowKey, onRowClick, actions }: {
  cols: Col<T>[]; rows: T[]; rowKey: (r: T) => string | number; onRowClick?: (r: T) => void; actions?: (r: T) => ReactNode;
}) {
  const cell = (c: Col<T>, r: T) => (c.render ? c.render(r) : String((r as any)[c.key] ?? "—"));
  const primary = cols.find(c => c.primary) ?? cols[0];
  return (
    <>
      {/* desktop */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              {cols.map(c => <th key={c.key} className={clsx("px-4 py-2.5 font-medium", c.align === "right" && "text-right")}>{c.header}</th>)}
              {actions && <th className="w-px" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(r => (
              <tr key={rowKey(r)} onClick={onRowClick && (() => onRowClick(r))}
                  className={clsx(onRowClick && "cursor-pointer hover:bg-slate-50")}>
                {cols.map(c => <td key={c.key} className={clsx("px-4 py-3", c.align === "right" && "text-right tabular-nums")}>{cell(c, r)}</td>)}
                {actions && <td className="whitespace-nowrap px-3 py-2 text-right" onClick={e => e.stopPropagation()}>{actions(r)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* phones */}
      <ul className="divide-y divide-slate-100 md:hidden">
        {rows.map(r => (
          <li key={rowKey(r)} onClick={onRowClick && (() => onRowClick(r))} className={clsx("space-y-1.5 px-4 py-3", onRowClick && "active:bg-slate-50")}>
            <div className="font-medium text-slate-900">{cell(primary, r)}</div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              {cols.filter(c => c !== primary && !c.hideOnMobile).map(c => (
                <div key={c.key} className="min-w-0">
                  <dt className="text-xs text-slate-400">{c.header}</dt>
                  <dd className="truncate text-slate-700">{cell(c, r)}</dd>
                </div>
              ))}
            </dl>
            {actions && <div className="flex justify-end pt-1" onClick={e => e.stopPropagation()}>{actions(r)}</div>}
          </li>
        ))}
      </ul>
    </>
  );
}

/* ---------- Progress bar ---------- */
export function Bar({ pct, tone = "indigo" }: { pct: number; tone?: "indigo" | "red" | "amber" }) {
  const c = { indigo: "bg-indigo-500", red: "bg-red-500", amber: "bg-amber-500" }[tone];
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={clsx("h-full rounded-full transition-all", c)} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}
