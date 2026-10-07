import { Check } from "lucide-react";
import clsx from "clsx";
import type { LogRow, Status } from "@/lib/types";
import { fmtDateTime } from "@/lib/format";

const STEPS: Status[] = ["Pending", "Dispatched", "In Transit", "Delivered"];

export function Stepper({ status }: { status: Status }) {
  if (status === "Cancelled")
    return <div className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">This shipment was cancelled.</div>;
  const cur = STEPS.indexOf(status);
  return (
    <ol className="flex items-start">
      {STEPS.map((s, i) => {
        const done = i <= cur;
        return (
          <li key={s} className="relative flex flex-1 flex-col items-center text-center">
            {i > 0 && <span className={clsx("absolute right-1/2 top-3.5 h-0.5 w-full -translate-y-1/2", i <= cur ? "bg-indigo-600" : "bg-slate-200")} />}
            <span className={clsx("relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-semibold",
              done ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 bg-white text-slate-400")}>
              {i < cur || status === "Delivered" ? <Check className="h-4 w-4" /> : i + 1}
            </span>
            <span className={clsx("mt-1.5 text-xs", done ? "font-medium text-slate-800" : "text-slate-400")}>{s}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function Timeline({ logs }: { logs: LogRow[] }) {
  if (!logs.length) return <p className="text-sm text-slate-500">No tracking updates yet.</p>;
  const sorted = [...logs].reverse(); // newest first
  return (
    <ol className="relative ml-2 border-l border-slate-200">
      {sorted.map((l, i) => (
        <li key={i} className="mb-5 ml-5 last:mb-0">
          <span className={clsx("absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white", i === 0 ? "bg-indigo-600" : "bg-slate-300")} />
          <div className="text-sm font-medium text-slate-900">{l.status_update}</div>
          <div className="text-sm text-slate-600">{l.checkpoint_location}</div>
          <div className="text-xs text-slate-400">{fmtDateTime(l.logged_at)}</div>
        </li>
      ))}
    </ol>
  );
}
