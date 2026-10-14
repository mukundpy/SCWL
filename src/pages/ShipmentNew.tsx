import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { InvRow, Lookups } from "@/lib/types";
import { Button, Card, ErrorNote, Field, Input, PageHeader, Select, Spinner } from "@/components/ui";
import { inr } from "@/lib/format";
import { SqlInspector, sqlCreateShipment } from "@/components/SqlInspector";

interface Line { product_id: string; qty: string }

export default function ShipmentNew() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const lookups = useQuery({ queryKey: ["lookups"], queryFn: () => api.get<Lookups>("/lookups") });
  const [warehouse, setWarehouse] = useState("");
  const [carrier, setCarrier] = useState("");
  const [dest, setDest] = useState("");
  const [lines, setLines] = useState<Line[]>([{ product_id: "", qty: "" }]);

  // stock available in the chosen warehouse, so we can warn before dispatch
  const stock = useQuery({
    queryKey: ["inventory", warehouse, false, ""],
    queryFn: () => api.get<InvRow[]>(`/inventory?warehouse_id=${warehouse}`),
    enabled: !!warehouse,
  });
  const avail = (pid: string) => stock.data?.find(r => String(r.product_id) === pid)?.quantity_on_hand ?? 0;

  const create = useMutation({
    mutationFn: () => api.post<{ shipment_id: number }>("/shipments", {
      warehouse_id: Number(warehouse), carrier_id: Number(carrier), destination_address: dest,
      items: lines.filter(l => l.product_id).map(l => ({ product_id: Number(l.product_id), quantity_shipped: Number(l.qty) })),
    }),
    onSuccess: r => {
      toast.success(`Shipment #${r.shipment_id} created`);
      ["shipments", "dashboard"].forEach(k => qc.invalidateQueries({ queryKey: [k] }));
      nav(`/shipments/${r.shipment_id}`);
    },
  });

  if (lookups.isLoading) return <Spinner />;
  const L = lookups.data!;
  const setLine = (i: number, patch: Partial<Line>) => setLines(ls => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const total = lines.reduce((a, l) => a + (L.products.find(p => String(p.product_id) === l.product_id)?.unit_price ?? 0) * Number(l.qty || 0), 0);
  const chosen = new Set(lines.map(l => l.product_id));
  const valid = warehouse && carrier && dest.trim() && lines.some(l => l.product_id && Number(l.qty) > 0) &&
    lines.every(l => !l.product_id || Number(l.qty) > 0);

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/shipments" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" />Shipments</Link>
      <PageHeader title="New shipment" subtitle="Stock is deducted when you dispatch, not when you create." />
      <form onSubmit={e => { e.preventDefault(); if (valid) create.mutate(); }} className="space-y-5">
        <Card className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ship from *"><Select value={warehouse} onChange={e => setWarehouse(e.target.value)}>
              <option value="">Select warehouse…</option>{L.warehouses.map(w => <option key={w.warehouse_id} value={w.warehouse_id}>{w.warehouse_name}</option>)}</Select></Field>
            <Field label="Carrier *"><Select value={carrier} onChange={e => setCarrier(e.target.value)}>
              <option value="">Select carrier…</option>{L.carriers.map(c => <option key={c.carrier_id} value={c.carrier_id}>{c.carrier_name}{c.vehicle_type ? ` · ${c.vehicle_type}` : ""}</option>)}</Select></Field>
          </div>
          <Field label="Destination address *"><Input value={dest} maxLength={200} placeholder="Street, area, city" onChange={e => setDest(e.target.value)} /></Field>
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 font-semibold text-slate-900">Items</h2>
          {!warehouse && <p className="mb-3 text-sm text-slate-500">Choose a warehouse to see available stock.</p>}
          <div className="space-y-3">
            {lines.map((l, i) => {
              const a = avail(l.product_id); const over = !!l.product_id && !!warehouse && Number(l.qty) > a;
              return (
                <div key={i} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex gap-2">
                    <Select value={l.product_id} onChange={e => setLine(i, { product_id: e.target.value })} aria-label="Product">
                      <option value="">Select product…</option>
                      {L.products.filter(p => String(p.product_id) === l.product_id || !chosen.has(String(p.product_id))).map(p =>
                        <option key={p.product_id} value={p.product_id}>{p.product_name}</option>)}
                    </Select>
                    <Input className="w-24 shrink-0" type="number" inputMode="numeric" min={1} placeholder="Qty" value={l.qty} onChange={e => setLine(i, { qty: e.target.value })} aria-label="Quantity" />
                    <Button type="button" variant="ghost" aria-label="Remove item" disabled={lines.length === 1} onClick={() => setLines(ls => ls.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  {l.product_id && warehouse && (
                    <p className={over ? "mt-1.5 text-xs font-medium text-amber-600" : "mt-1.5 text-xs text-slate-500"}>
                      {over ? `Only ${a} in stock here — dispatch will fail unless stock is added.` : `${a} available in this warehouse`}</p>)}
                </div>);
            })}
          </div>
          <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={() => setLines(ls => [...ls, { product_id: "", qty: "" }])}
            disabled={lines.length >= L.products.length}><Plus className="h-4 w-4" />Add item</Button>
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
            <span className="text-slate-500">Estimated value</span><span className="text-base font-semibold tabular-nums">{inr(total)}</span>
          </div>
        </Card>

        {create.error && <ErrorNote error={create.error} />}

        {/* Live SQL preview — updates as the user fills the form */}
        {(warehouse || dest || lines.some(l => l.product_id)) && (
          <SqlInspector
            title="SQL that will run when you click Create shipment"
            blocks={sqlCreateShipment(
              Number(warehouse) || 0,
              Number(carrier) || 0,
              dest || "<destination>",
              lines.filter(l => l.product_id && Number(l.qty) > 0)
                   .map(l => ({ product_id: Number(l.product_id), quantity_shipped: Number(l.qty) }))
            )}
            defaultOpen={true}
          />
        )}

        <div className="flex justify-end gap-2">
          <Link to="/shipments"><Button type="button" variant="secondary">Cancel</Button></Link>
          <Button type="submit" loading={create.isPending} disabled={!valid}>Create shipment</Button>
        </div>
      </form>
    </div>
  );
}
