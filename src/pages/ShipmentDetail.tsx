import { useState, ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { LogRow, ShipmentRow, Status } from "@/lib/types";
import { Button, Card, Confirm, ErrorNote, Field, Input, Modal, Spinner, StatusBadge } from "@/components/ui";
import { Stepper, Timeline } from "@/components/Tracking";
import { fmtDateTime, inr } from "@/lib/format";

interface Detail {
  shipment: ShipmentRow;
  items: { product_id: number; sku: string; product_name: string; unit_price: number; quantity_shipped: number; line_total: number }[];
  logs: LogRow[];
}

const NEXT: Partial<Record<Status, { to: Status; label: string; hint: string }>> = {
  Pending: { to: "Dispatched", label: "Dispatch", hint: "Stock will be deducted from the warehouse." },
  Dispatched: { to: "In Transit", label: "Mark in transit", hint: "The shipment has left the warehouse area." },
  "In Transit": { to: "Delivered", label: "Mark delivered", hint: "The shipment reached its destination. This closes it." },
};

export default function ShipmentDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const key = ["shipment", id];
  const { data, isLoading, error } = useQuery({ queryKey: key, queryFn: () => api.get<Detail>(`/shipments/${id}`) });

  const [step, setStep] = useState<{ to: Status; label: string; hint: string } | null>(null);
  const [location, setLocation] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);

  const refresh = () => ["shipments", "dashboard", "inventory", "movements", "warehouses"].forEach(k => qc.invalidateQueries({ queryKey: [k] }));
  const changeStatus = useMutation({
    mutationFn: (v: { status: Status; location?: string }) => api.post(`/shipments/${id}/status`, v),
    onSuccess: (_d, v) => { toast.success(`Status: ${v.status}`); setStep(null); setCancelOpen(false); setLocation(""); qc.invalidateQueries({ queryKey: key }); refresh(); },
    onError: (e: Error) => { toast.error(e.message); setStep(null); setCancelOpen(false); },
  });
  const remove = useMutation({
    mutationFn: () => api.del(`/shipments/${id}`),
    onSuccess: () => { toast.success("Shipment deleted"); refresh(); nav("/shipments"); },
    onError: (e: Error) => { toast.error(e.message); setDeleteOpen(false); },
  });

  if (isLoading) return <Spinner />;
  if (error || !data) return <div className="space-y-3"><ErrorNote error={error} /><Link to="/shipments" className="text-indigo-600 hover:underline">← Back to shipments</Link></div>;

  const { shipment: s, items, logs } = data;
  const next = NEXT[s.current_status];
  const canCancel = s.current_status === "Pending" || s.current_status === "Dispatched";
  const canDelete = s.current_status === "Pending" || s.current_status === "Cancelled";
  const open = s.current_status !== "Delivered" && s.current_status !== "Cancelled";
  const totalUnits = items.reduce((a, i) => a + i.quantity_shipped, 0);

  const Info = ({ label, children }: { label: string; children: ReactNode }) => (
    <div><dt className="text-xs text-slate-400">{label}</dt><dd className="text-sm text-slate-800">{children}</dd></div>);

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/shipments" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" />Shipments</Link>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Shipment #{s.shipment_id}</h1>
          <StatusBadge status={s.current_status} />
        </div>
        <div className="flex flex-wrap gap-2">
          {canDelete && <Button variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => setDeleteOpen(true)}><Trash2 className="h-4 w-4" />Delete</Button>}
          {canCancel && <Button variant="secondary" onClick={() => setCancelOpen(true)}>Cancel shipment</Button>}
          {next && <Button onClick={() => setStep(next)}>{next.label}</Button>}
        </div>
      </div>

      <Card className="mb-5 p-5"><Stepper status={s.current_status} /></Card>

      <div className="grid gap-5 md:grid-cols-5">
        <div className="space-y-5 md:col-span-3">
          <Card className="p-5">
            <dl className="grid grid-cols-2 gap-4">
              <Info label="From">{s.dispatched_from}</Info>
              <Info label="Carrier">{s.carrier_name}{s.vehicle_type ? ` · ${s.vehicle_type}` : ""}</Info>
              <div className="col-span-2"><Info label="Destination">{s.destination_address}</Info></div>
              <Info label="Created">{fmtDateTime(s.created_at)}</Info>
              <Info label="Dispatched">{fmtDateTime(s.dispatched_at)}</Info>
              <Info label="Delivered">{fmtDateTime(s.delivered_at)}</Info>
            </dl>
          </Card>

          <Card>
            <h2 className="px-5 pt-5 font-semibold text-slate-900">Items</h2>
            <ul className="divide-y divide-slate-100 px-5 pt-2">
              {items.map(i => (
                <li key={i.product_id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0"><div className="truncate text-sm font-medium text-slate-900">{i.product_name}</div>
                    <div className="text-xs text-slate-500">{i.quantity_shipped} × {inr(i.unit_price)}</div></div>
                  <div className="shrink-0 text-sm font-medium tabular-nums">{inr(i.line_total)}</div>
                </li>))}
            </ul>
            <div className="flex justify-between border-t border-slate-100 px-5 py-3 text-sm">
              <span className="text-slate-500">{totalUnits} units</span><span className="font-semibold tabular-nums">{inr(s.total_value)}</span>
            </div>
          </Card>
        </div>

        <Card className="p-5 md:col-span-2 md:self-start">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Tracking</h2>
            {open && <Button size="sm" variant="secondary" onClick={() => setLogOpen(true)}><Plus className="h-3.5 w-3.5" />Checkpoint</Button>}
          </div>
          <Timeline logs={logs} />
        </Card>
      </div>

      {/* advance status */}
      <Modal open={!!step} onClose={() => setStep(null)} title={step?.label ?? ""}
        footer={<><Button variant="secondary" onClick={() => setStep(null)}>Back</Button>
          <Button loading={changeStatus.isPending} onClick={() => step && changeStatus.mutate({ status: step.to, location })}>{step?.label}</Button></>}>
        <p className="text-sm text-slate-600">{step?.hint}</p>
        <Field label="Location (optional)" hint="Shown on the tracking timeline"><Input value={location} maxLength={100} placeholder="e.g. Thane checkpoint" onChange={e => setLocation(e.target.value)} /></Field>
      </Modal>

      <Confirm open={cancelOpen} danger onClose={() => setCancelOpen(false)} loading={changeStatus.isPending} confirmLabel="Cancel shipment"
        title="Cancel this shipment?"
        message={s.current_status === "Dispatched" ? "Stock that was deducted at dispatch will be returned to the warehouse." : "No stock has been deducted, so nothing needs to be returned."}
        onConfirm={() => changeStatus.mutate({ status: "Cancelled" })} />
      <Confirm open={deleteOpen} danger onClose={() => setDeleteOpen(false)} loading={remove.isPending} confirmLabel="Delete"
        title="Delete shipment?" message="This permanently removes the shipment and its tracking history." onConfirm={() => remove.mutate()} />
      {logOpen && <LogModal id={id!} onClose={() => setLogOpen(false)} onSaved={() => { setLogOpen(false); qc.invalidateQueries({ queryKey: key }); }} />}
    </div>
  );
}

function LogModal({ id, onClose, onSaved }: { id: string; onClose: () => void; onSaved: () => void }) {
  const [location, setLocation] = useState("");
  const [text, setText] = useState("");
  const save = useMutation({
    mutationFn: () => api.post(`/shipments/${id}/logs`, { location, status_update: text }),
    onSuccess: () => { toast.success("Checkpoint added"); onSaved(); },
  });
  return (
    <Modal open onClose={onClose} title="Add checkpoint"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} disabled={!location.trim() || !text.trim()} onClick={() => save.mutate()}>Add</Button></>}>
      <Field label="Location *"><Input autoFocus value={location} maxLength={100} placeholder="e.g. Gurugram Hub" onChange={e => setLocation(e.target.value)} /></Field>
      <Field label="Update *"><Input value={text} maxLength={100} placeholder="e.g. Arrived at sorting hub" onChange={e => setText(e.target.value)} /></Field>
      {save.error && <ErrorNote error={save.error} />}
    </Modal>
  );
}
