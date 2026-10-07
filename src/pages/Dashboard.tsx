import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Package, Boxes, AlertTriangle, Truck, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { Status, STATUSES } from "@/lib/types";
import { Card, PageHeader, Spinner, ErrorNote, Bar, StatusBadge, Button, Empty } from "@/components/ui";
import { num, fmtDateTime } from "@/lib/format";
import clsx from "clsx";

interface Dash {
  totals: { products: number; units: number; low_stock: number; active_shipments: number };
  byStatus: { status: Status; count: number }[];
  low: { warehouse_id: number; warehouse_name: string; product_id: number; product_name: string; quantity_on_hand: number; reorder_threshold: number }[];
  util: { warehouse_name: string; units_stored: number; max_capacity: number; utilization_pct: number }[];
  recent: { shipment_id: number; destination_address: string; current_status: Status; dispatched_from: string; carrier_name: string; created_at: string }[];
}

const segColor: Record<Status, string> = {
  Pending: "bg-slate-300", Dispatched: "bg-sky-400", "In Transit": "bg-amber-400", Delivered: "bg-emerald-500", Cancelled: "bg-red-400",
};

export default function Dashboard() {
  const { data, isLoading, error } = useQuery({ queryKey: ["dashboard"], queryFn: () => api.get<Dash>("/dashboard") });
  if (isLoading) return <Spinner />;
  if (error || !data) return <ErrorNote error={error} />;
  const { totals, byStatus, low, util, recent } = data;
  const totalShip = byStatus.reduce((a, b) => a + b.count, 0);

  const stats = [
    { label: "Products", value: totals.products, icon: Package, to: "/products", tone: "text-indigo-600 bg-indigo-50" },
    { label: "Units in stock", value: num(totals.units), icon: Boxes, to: "/inventory", tone: "text-emerald-600 bg-emerald-50" },
    { label: "Low stock items", value: totals.low_stock, icon: AlertTriangle, to: "/inventory?low=1", tone: totals.low_stock ? "text-red-600 bg-red-50" : "text-slate-500 bg-slate-100" },
    { label: "Active shipments", value: totals.active_shipments, icon: Truck, to: "/shipments", tone: "text-amber-600 bg-amber-50" },
  ];

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Live overview of stock and shipments"
        actions={<Link to="/shipments/new"><Button><Plus className="h-4 w-4" />New shipment</Button></Link>} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(s => (
          <Link key={s.label} to={s.to}>
            <Card className="p-4 transition-shadow hover:shadow-md">
              <span className={clsx("mb-3 flex h-9 w-9 items-center justify-center rounded-lg", s.tone)}><s.icon className="h-[18px] w-[18px]" /></span>
              <div className="text-2xl font-semibold tabular-nums text-slate-900">{s.value}</div>
              <div className="text-sm text-slate-500">{s.label}</div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 font-semibold text-slate-900">Shipments by status</h2>
          {totalShip === 0 ? <Empty title="No shipments yet" /> : (
            <>
              <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
                {STATUSES.map(s => { const c = byStatus.find(b => b.status === s)?.count ?? 0;
                  return c ? <div key={s} className={segColor[s]} style={{ width: `${(c / totalShip) * 100}%` }} title={`${s}: ${c}`} /> : null; })}
              </div>
              <ul className="mt-4 grid grid-cols-2 gap-2 text-sm">
                {STATUSES.map(s => (
                  <li key={s} className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-slate-600"><span className={clsx("h-2.5 w-2.5 rounded-full", segColor[s])} />{s}</span>
                    <span className="font-medium tabular-nums">{byStatus.find(b => b.status === s)?.count ?? 0}</span>
                  </li>))}
              </ul>
            </>)}
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 font-semibold text-slate-900">Warehouse utilization</h2>
          <ul className="space-y-3">
            {util.map(u => (
              <li key={u.warehouse_name}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="truncate text-slate-700">{u.warehouse_name}</span>
                  <span className="shrink-0 pl-2 tabular-nums text-slate-500">{num(u.units_stored)} / {num(u.max_capacity)}</span>
                </div>
                <Bar pct={u.utilization_pct} tone={u.utilization_pct > 90 ? "red" : u.utilization_pct > 75 ? "amber" : "indigo"} />
              </li>))}
          </ul>
        </Card>

        <Card>
          <div className="flex items-center justify-between px-5 pt-5">
            <h2 className="font-semibold text-slate-900">Needs restocking</h2>
            <Link to="/inventory?low=1" className="text-sm text-indigo-600 hover:underline">View all</Link>
          </div>
          {low.length === 0 ? <Empty title="All stock levels are healthy" /> : (
            <ul className="divide-y divide-slate-100 px-5 pb-2 pt-2">
              {low.map(l => (
                <li key={`${l.product_id}-${l.warehouse_id}`} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-900">{l.product_name}</div>
                    <div className="truncate text-xs text-slate-500">{l.warehouse_name}</div>
                  </div>
                  <div className="shrink-0 text-right text-sm">
                    <span className="font-semibold text-red-600 tabular-nums">{l.quantity_on_hand}</span>
                    <span className="text-slate-400"> / {l.reorder_threshold}</span>
                  </div>
                </li>))}
            </ul>)}
        </Card>

        <Card>
          <div className="flex items-center justify-between px-5 pt-5">
            <h2 className="font-semibold text-slate-900">Recent shipments</h2>
            <Link to="/shipments" className="text-sm text-indigo-600 hover:underline">View all</Link>
          </div>
          <ul className="divide-y divide-slate-100 px-5 pb-2 pt-2">
            {recent.map(s => (
              <li key={s.shipment_id}>
                <Link to={`/shipments/${s.shipment_id}`} className="flex items-center justify-between gap-3 py-3 hover:opacity-80">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-900">#{s.shipment_id} · {s.destination_address}</div>
                    <div className="truncate text-xs text-slate-500">{s.dispatched_from} · {fmtDateTime(s.created_at)}</div>
                  </div>
                  <StatusBadge status={s.current_status} />
                </Link>
              </li>))}
          </ul>
        </Card>
      </div>
    </>
  );
}
