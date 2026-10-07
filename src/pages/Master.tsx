import { useEffect, useState, ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Search, Link2 } from "lucide-react";
import { toast } from "sonner";
import { api, qs } from "@/lib/api";
import type { Paged } from "@/lib/types";
import { Button, Card, Col, Confirm, DataTable, Empty, ErrorNote, Field, Input, Modal, PageHeader, Pagination, Select, Spinner, Bar } from "@/components/ui";
import { inr, num } from "@/lib/format";

type Row = Record<string, any>;
interface FieldDef { name: string; label: string; type?: "text" | "email" | "number"; required?: boolean; placeholder?: string }
interface Config {
  title: string; singular: string; subtitle: string; endpoint: string; idKey: string;
  cols: Col<Row>[]; fields: FieldDef[]; searchHint: string; extra?: (row: Row) => ReactNode;
}

function useDebounced<T>(v: T, ms = 300) {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

function Resource({ cfg }: { cfg: Config }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const q = useDebounced(search);
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [q]);
  const limit = 15;

  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);

  const list = useQuery({
    queryKey: [cfg.endpoint, q, page],
    queryFn: () => api.get<Paged<Row>>(`/${cfg.endpoint}${qs({ q, page, limit })}`),
    placeholderData: prev => prev,
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: [cfg.endpoint] }); qc.invalidateQueries({ queryKey: ["lookups"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); };

  const del = useMutation({
    mutationFn: (r: Row) => api.del(`/${cfg.endpoint}/${r[cfg.idKey]}`),
    onSuccess: () => { toast.success(`${cfg.singular} deleted`); setDeleting(null); refresh(); },
    onError: (e: Error) => { toast.error(e.message); setDeleting(null); },
  });

  return (
    <>
      <PageHeader title={cfg.title} subtitle={cfg.subtitle}
        actions={<Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" />Add {cfg.singular.toLowerCase()}</Button>} />
      <Card>
        <div className="border-b border-slate-100 p-3">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder={cfg.searchHint} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        {list.isLoading ? <Spinner /> : list.error ? <div className="p-4"><ErrorNote error={list.error} /></div> :
          list.data!.data.length === 0 ? (
            <Empty title={q ? "No matches" : `No ${cfg.title.toLowerCase()} yet`} hint={q ? "Try a different search." : undefined}
              action={!q && <Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" />Add {cfg.singular.toLowerCase()}</Button>} />
          ) : (
            <>
              <DataTable cols={cfg.cols} rows={list.data!.data} rowKey={r => r[cfg.idKey]}
                actions={r => (
                  <div className="inline-flex items-center gap-1">
                    {cfg.extra?.(r)}
                    <Button size="sm" variant="ghost" aria-label="Edit" onClick={() => setEditing(r)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" aria-label="Delete" className="text-red-600 hover:bg-red-50" onClick={() => setDeleting(r)}><Trash2 className="h-4 w-4" /></Button>
                  </div>)} />
              <Pagination page={page} limit={limit} total={list.data!.total} onPage={setPage} />
            </>)}
      </Card>

      {editing && <FormModal cfg={cfg} row={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />}
      <Confirm open={!!deleting} danger onClose={() => setDeleting(null)} loading={del.isPending} confirmLabel="Delete"
        title={`Delete ${cfg.singular.toLowerCase()}?`}
        message={<>This will permanently remove <b>{deleting && (deleting[cfg.fields[0].name] ?? "")}</b>. This can't be undone.</>}
        onConfirm={() => deleting && del.mutate(deleting)} />
    </>
  );
}

function FormModal({ cfg, row, onClose, onSaved }: { cfg: Config; row: Row | null; onClose: () => void; onSaved: () => void }) {
  const [vals, setVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(cfg.fields.map(f => [f.name, row?.[f.name] != null ? String(row[f.name]) : ""])));
  const save = useMutation({
    mutationFn: () => {
      const body = Object.fromEntries(cfg.fields.map(f => [f.name, vals[f.name]]));
      return row ? api.put(`/${cfg.endpoint}/${row[cfg.idKey]}`, body) : api.post(`/${cfg.endpoint}`, body);
    },
    onSuccess: () => { toast.success(`${cfg.singular} ${row ? "updated" : "added"}`); onSaved(); },
  });
  return (
    <Modal open onClose={onClose} title={`${row ? "Edit" : "Add"} ${cfg.singular.toLowerCase()}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} onClick={() => save.mutate()}>Save</Button></>}>
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
        {cfg.fields.map((f, i) => (
          <Field key={f.name} label={f.label + (f.required ? " *" : "")}>
            <Input autoFocus={i === 0} type={f.type ?? "text"} inputMode={f.type === "number" ? "decimal" : undefined}
              min={f.type === "number" ? 0 : undefined} step={f.type === "number" ? "any" : undefined}
              placeholder={f.placeholder} value={vals[f.name]} onChange={e => setVals(v => ({ ...v, [f.name]: e.target.value }))} />
          </Field>))}
        {save.error && <ErrorNote error={save.error} />}
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

/* ---------- Supplier <-> product catalogue ---------- */
function Catalog({ supplier }: { supplier: Row }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="ghost" aria-label="Products supplied" title="Products supplied" onClick={() => setOpen(true)}><Link2 className="h-4 w-4" /></Button>
      {open && <CatalogModal supplier={supplier} onClose={() => setOpen(false)} />}
    </>
  );
}
function CatalogModal({ supplier, onClose }: { supplier: Row; onClose: () => void }) {
  const qc = useQueryClient();
  const [pick, setPick] = useState("");
  const key = ["catalog", supplier.supplier_id];
  const items = useQuery({ queryKey: key, queryFn: () => api.get<Row[]>(`/suppliers/${supplier.supplier_id}/products`) });
  const lookups = useQuery({ queryKey: ["lookups"], queryFn: () => api.get<import("@/lib/types").Lookups>("/lookups") });
  const add = useMutation({
    mutationFn: () => api.post(`/suppliers/${supplier.supplier_id}/products`, { product_id: Number(pick) }),
    onSuccess: () => { setPick(""); qc.invalidateQueries({ queryKey: key }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (pid: number) => api.del(`/suppliers/${supplier.supplier_id}/products/${pid}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e: Error) => toast.error(e.message),
  });
  const available = (lookups.data?.products ?? []).filter(p => !items.data?.some(i => i.product_id === p.product_id));
  return (
    <Modal open onClose={onClose} title={`${supplier.company_name} · products`} footer={<Button variant="secondary" onClick={onClose}>Done</Button>}>
      {items.isLoading ? <Spinner /> : items.data!.length === 0 ? <p className="text-sm text-slate-500">No products linked yet.</p> : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {items.data!.map(p => (
            <li key={p.product_id} className="flex items-center justify-between gap-2 px-3 py-2">
              <div className="min-w-0"><div className="truncate text-sm font-medium">{p.product_name}</div><div className="text-xs text-slate-500">{p.sku} · {inr(p.unit_price)}</div></div>
              <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" aria-label="Unlink" onClick={() => remove.mutate(p.product_id)}><Trash2 className="h-4 w-4" /></Button>
            </li>))}
        </ul>)}
      <div className="flex gap-2">
        <Select value={pick} onChange={e => setPick(e.target.value)} aria-label="Product to link">
          <option value="">Link a product…</option>
          {available.map(p => <option key={p.product_id} value={p.product_id}>{p.product_name}</option>)}
        </Select>
        <Button disabled={!pick} loading={add.isPending} onClick={() => add.mutate()}>Add</Button>
      </div>
    </Modal>
  );
}

/* ---------- Page configs ---------- */
export const Products = () => <Resource cfg={{
  title: "Products", singular: "Product", subtitle: "Items you store and ship", endpoint: "products", idKey: "product_id",
  searchHint: "Search name or SKU",
  cols: [
    { key: "product_name", header: "Product", primary: true },
    { key: "sku", header: "SKU", render: r => <span className="font-mono text-xs">{r.sku}</span> },
    { key: "unit_price", header: "Unit price", align: "right", render: r => inr(r.unit_price) },
  ],
  fields: [
    { name: "product_name", label: "Product name", required: true },
    { name: "sku", label: "SKU", required: true, placeholder: "SKU-ABC-001" },
    { name: "unit_price", label: "Unit price (₹)", type: "number", required: true },
  ],
}} />;

export const Suppliers = () => <Resource cfg={{
  title: "Suppliers", singular: "Supplier", subtitle: "Companies that provide your products", endpoint: "suppliers", idKey: "supplier_id",
  searchHint: "Search name, email or phone",
  cols: [
    { key: "company_name", header: "Company", primary: true },
    { key: "contact_email", header: "Email" },
    { key: "phone", header: "Phone" },
  ],
  fields: [
    { name: "company_name", label: "Company name", required: true },
    { name: "contact_email", label: "Contact email", type: "email" },
    { name: "phone", label: "Phone" },
  ],
  extra: r => <Catalog supplier={r} />,
}} />;

export const Warehouses = () => <Resource cfg={{
  title: "Warehouses", singular: "Warehouse", subtitle: "Storage locations and how full they are", endpoint: "warehouses", idKey: "warehouse_id",
  searchHint: "Search name or address",
  cols: [
    { key: "warehouse_name", header: "Warehouse", primary: true },
    { key: "address", header: "Address" },
    { key: "max_capacity", header: "Capacity", align: "right", render: r => num(r.max_capacity) },
    { key: "utilization_pct", header: "Used", render: r => (
        <div className="flex min-w-[110px] items-center gap-2"><div className="w-full"><Bar pct={r.utilization_pct} tone={r.utilization_pct > 90 ? "red" : "indigo"} /></div>
          <span className="w-12 shrink-0 text-right text-xs tabular-nums text-slate-500">{r.utilization_pct}%</span></div>) },
  ],
  fields: [
    { name: "warehouse_name", label: "Warehouse name", required: true },
    { name: "address", label: "Address" },
    { name: "max_capacity", label: "Max capacity (units)", type: "number", required: true },
  ],
}} />;

export const Carriers = () => <Resource cfg={{
  title: "Carriers", singular: "Carrier", subtitle: "Transport partners for your shipments", endpoint: "carriers", idKey: "carrier_id",
  searchHint: "Search carrier or vehicle",
  cols: [
    { key: "carrier_name", header: "Carrier", primary: true },
    { key: "vehicle_type", header: "Vehicle type" },
  ],
  fields: [
    { name: "carrier_name", label: "Carrier name", required: true },
    { name: "vehicle_type", label: "Vehicle type", placeholder: "Truck, Mini Van…" },
  ],
}} />;
