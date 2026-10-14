import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Plus, Search, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import clsx from "clsx";
import { api, qs } from "@/lib/api";
import type { InvRow, Lookups } from "@/lib/types";
import { Badge, Button, Card, DataTable, Empty, ErrorNote, Field, Input, Modal, PageHeader, Select, Spinner } from "@/components/ui";
import { fmtDateTime, num } from "@/lib/format";
import { SqlInspector, sqlAdjustStock, sqlUpdateThreshold } from "@/components/SqlInspector";

interface Movement { movement_id: number; created_at: string; product_name: string; sku: string; warehouse_name: string; change_qty: number; reason: string; shipment_id: number | null; note: string | null }

export default function Inventory() {
  const [sp, setSp] = useSearchParams();
  const warehouse = sp.get("warehouse_id") ?? "";
  const low = sp.get("low") === "1";
  const [tab, setTab] = useState<"stock" | "history">("stock");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => { const t = setTimeout(() => setQ(search), 300); return () => clearTimeout(t); }, [search]);
  const [modal, setModal] = useState<{ row?: InvRow } | null>(null);

  const setParam = (k: string, v: string) => { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); setSp(n, { replace: true }); };

  const lookups = useQuery({ queryKey: ["lookups"], queryFn: () => api.get<Lookups>("/lookups") });
  const inv = useQuery({
    queryKey: ["inventory", warehouse, low, q],
    queryFn: () => api.get<InvRow[]>(`/inventory${qs({ warehouse_id: warehouse, low: low && "1", q })}`),
    placeholderData: p => p,
  });
  const moves = useQuery({ queryKey: ["movements"], queryFn: () => api.get<Movement[]>("/inventory/movements?limit=40"), enabled: tab === "history" });

  return (
    <>
      <PageHeader title="Inventory" subtitle="Stock on hand in every warehouse"
        actions={<Button onClick={() => setModal({})}><Plus className="h-4 w-4" />Receive stock</Button>} />

      <div className="mb-3 inline-flex rounded-lg bg-slate-200/60 p-1 text-sm">
        {(["stock", "history"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={clsx("rounded-md px-3 py-1.5 font-medium", tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-600")}>
            {t === "stock" ? "Stock levels" : "Movement history"}
          </button>))}
      </div>

      <Card>
        {tab === "stock" ? (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
              <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input className="pl-9" placeholder="Search product or SKU" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <Select className="w-auto max-w-[220px]" value={warehouse} onChange={e => setParam("warehouse_id", e.target.value)} aria-label="Warehouse">
                <option value="">All warehouses</option>
                {lookups.data?.warehouses.map(w => <option key={w.warehouse_id} value={w.warehouse_id}>{w.warehouse_name}</option>)}
              </Select>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-indigo-600" checked={low} onChange={e => setParam("low", e.target.checked ? "1" : "")} />
                Low stock only
              </label>
            </div>
            {inv.isLoading ? <Spinner /> : inv.error ? <div className="p-4"><ErrorNote error={inv.error} /></div> :
              inv.data!.length === 0 ? <Empty title="No stock found" hint={low ? "Nothing is below its reorder level." : "Try changing the filters."} /> : (
                <DataTable cols={[
                  { key: "product_name", header: "Product", primary: true, render: r => <div><div className="font-medium text-slate-900">{r.product_name}</div><div className="font-mono text-xs text-slate-400">{r.sku}</div></div> },
                  { key: "warehouse_name", header: "Warehouse" },
                  { key: "quantity_on_hand", header: "On hand", align: "right", render: r => <b className={r.is_low ? "text-red-600" : ""}>{num(r.quantity_on_hand)}</b> },
                  { key: "reorder_threshold", header: "Reorder at", align: "right", render: r => num(r.reorder_threshold) },
                  { key: "is_low", header: "Status", render: r => r.is_low ? <Badge tone="red">Low stock</Badge> : <Badge tone="green">OK</Badge> },
                ]} rows={inv.data!} rowKey={r => `${r.product_id}-${r.warehouse_id}`}
                  actions={r => <Button size="sm" variant="secondary" onClick={() => setModal({ row: r })}><SlidersHorizontal className="h-3.5 w-3.5" />Adjust</Button>} />
              )}
          </>
        ) : moves.isLoading ? <Spinner /> : moves.error ? <div className="p-4"><ErrorNote error={moves.error} /></div> : (
          <DataTable cols={[
            { key: "created_at", header: "When", primary: true, render: r => fmtDateTime(r.created_at) },
            { key: "product_name", header: "Product" },
            { key: "warehouse_name", header: "Warehouse" },
            { key: "change_qty", header: "Change", align: "right", render: r => <b className={r.change_qty < 0 ? "text-red-600" : "text-emerald-600"}>{r.change_qty > 0 ? "+" : ""}{r.change_qty}</b> },
            { key: "reason", header: "Reason", render: r => <Badge tone={r.reason === "DISPATCH" ? "blue" : r.reason === "RETURN" ? "amber" : "slate"}>{r.reason.toLowerCase()}</Badge> },
            { key: "note", header: "Note", hideOnMobile: true },
          ]} rows={moves.data!} rowKey={r => r.movement_id} />
        )}
      </Card>

      {modal && lookups.data && <StockModal row={modal.row} lookups={lookups.data} onClose={() => setModal(null)} />}
    </>
  );
}

function StockModal({ row, lookups, onClose }: { row?: InvRow; lookups: Lookups; onClose: () => void }) {
  const qc = useQueryClient();
  const [product, setProduct] = useState(row ? String(row.product_id) : "");
  const [warehouse, setWarehouse] = useState(row ? String(row.warehouse_id) : "");
  const [dir, setDir] = useState<"add" | "remove">("add");
  const [qty, setQty] = useState("");
  const [threshold, setThreshold] = useState(row ? String(row.reorder_threshold) : "");
  const [note, setNote] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      const n = Number(qty || 0);
      const thrChanged = threshold !== "" && (!row || Number(threshold) !== row.reorder_threshold);
      if (n > 0) {
        await api.post("/inventory/adjust", {
          product_id: Number(product), warehouse_id: Number(warehouse),
          delta: dir === "add" ? n : -n, reason: dir === "add" ? "RECEIPT" : "ADJUSTMENT",
          note: note || undefined, reorder_threshold: thrChanged ? Number(threshold) : undefined,
        });
      } else if (row && thrChanged) {
        await api.put("/inventory/threshold", { product_id: Number(product), warehouse_id: Number(warehouse), reorder_threshold: Number(threshold) });
      } else throw new Error("Enter a quantity or a new reorder level");
    },
    onSuccess: () => {
      toast.success("Stock updated");
      ["inventory", "dashboard", "movements", "warehouses"].forEach(k => qc.invalidateQueries({ queryKey: [k] }));
      onClose();
    },
  });

  return (
    <Modal open onClose={onClose} title={row ? "Adjust stock" : "Receive stock"}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button loading={save.isPending} disabled={!product || !warehouse} onClick={() => save.mutate()}>Save</Button></>}>
      {row ? (
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
          <div className="font-medium text-slate-900">{row.product_name}</div>
          <div className="text-slate-500">{row.warehouse_name} · currently <b>{num(row.quantity_on_hand)}</b> units</div>
        </div>
      ) : (<>
        <Field label="Product *"><Select value={product} onChange={e => setProduct(e.target.value)}>
          <option value="">Select product…</option>{lookups.products.map(p => <option key={p.product_id} value={p.product_id}>{p.product_name} ({p.sku})</option>)}</Select></Field>
        <Field label="Warehouse *"><Select value={warehouse} onChange={e => setWarehouse(e.target.value)}>
          <option value="">Select warehouse…</option>{lookups.warehouses.map(w => <option key={w.warehouse_id} value={w.warehouse_id}>{w.warehouse_name}</option>)}</Select></Field>
      </>)}
      {row && (
        <div className="inline-flex rounded-lg bg-slate-100 p-1 text-sm">
          {(["add", "remove"] as const).map(d => (
            <button key={d} type="button" onClick={() => setDir(d)}
              className={clsx("rounded-md px-3 py-1 font-medium", dir === d ? "bg-white shadow-sm" : "text-slate-500", dir === d && (d === "add" ? "text-emerald-700" : "text-red-700"))}>
              {d === "add" ? "Add units" : "Remove units"}</button>))}
        </div>)}
      <div className="grid grid-cols-2 gap-3">
        <Field label={row ? "Quantity" : "Quantity received *"}><Input type="number" inputMode="numeric" min={0} placeholder="0" value={qty} onChange={e => setQty(e.target.value)} /></Field>
        <Field label="Reorder level" hint="Alert when stock falls to this"><Input type="number" inputMode="numeric" min={0} value={threshold} onChange={e => setThreshold(e.target.value)} /></Field>
      </div>
      <Field label="Note (optional)"><Input value={note} maxLength={200} placeholder={row ? "e.g. cycle count correction" : "e.g. PO #1234"} onChange={e => setNote(e.target.value)} /></Field>

      {/* Live SQL preview */}
      {product && warehouse && (Number(qty) > 0 || (row && threshold !== "" && Number(threshold) !== row?.reorder_threshold)) && (
        <SqlInspector
          title="SQL that will run on Save"
          defaultOpen={true}
          blocks={[
            ...(Number(qty) > 0
              ? sqlAdjustStock(Number(product), Number(warehouse), dir === "add" ? Number(qty) : -Number(qty), dir === "add" ? "RECEIPT" : "ADJUSTMENT", note || undefined)
              : []),
            ...(row && threshold !== "" && Number(threshold) !== row.reorder_threshold
              ? sqlUpdateThreshold(Number(product), Number(warehouse), Number(threshold))
              : []),
          ]}
        />
      )}

      {save.error && <ErrorNote error={save.error} />}
    </Modal>
  );
}
