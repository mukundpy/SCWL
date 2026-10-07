import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import clsx from "clsx";
import { api, qs } from "@/lib/api";
import { Paged, ShipmentRow, STATUSES } from "@/lib/types";
import { Button, Card, DataTable, Empty, ErrorNote, Input, PageHeader, Pagination, Spinner, StatusBadge } from "@/components/ui";
import { fmtDateTime, inr } from "@/lib/format";

export default function Shipments() {
  const nav = useNavigate();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const limit = 15;
  useEffect(() => { const t = setTimeout(() => setQ(search), 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => setPage(1), [q, status]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["shipments", status, q, page],
    queryFn: () => api.get<Paged<ShipmentRow>>(`/shipments${qs({ status, q, page, limit })}`),
    placeholderData: p => p,
  });

  return (
    <>
      <PageHeader title="Shipments" subtitle="Orders moving from warehouses to customers"
        actions={<Link to="/shipments/new"><Button><Plus className="h-4 w-4" />New shipment</Button></Link>} />
      <Card>
        <div className="space-y-3 border-b border-slate-100 p-3">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder="Search # , destination, carrier…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
            {["", ...STATUSES].map(s => (
              <button key={s || "all"} onClick={() => setStatus(s)}
                className={clsx("shrink-0 rounded-full border px-3 py-1 text-sm transition-colors",
                  status === s ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")}>
                {s || "All"}</button>))}
          </div>
        </div>
        {isLoading ? <Spinner /> : error ? <div className="p-4"><ErrorNote error={error} /></div> :
          data!.data.length === 0 ? <Empty title="No shipments found" hint="Try another filter, or create a new shipment." /> : (
            <>
              <DataTable rows={data!.data} rowKey={r => r.shipment_id} onRowClick={r => nav(`/shipments/${r.shipment_id}`)}
                cols={[
                  { key: "shipment_id", header: "Shipment", primary: true, render: r => <span className="font-medium text-slate-900">#{r.shipment_id} · {r.destination_address}</span> },
                  { key: "current_status", header: "Status", render: r => <StatusBadge status={r.current_status} /> },
                  { key: "dispatched_from", header: "From" },
                  { key: "carrier_name", header: "Carrier" },
                  { key: "total_units", header: "Units", align: "right" },
                  { key: "total_value", header: "Value", align: "right", render: r => inr(r.total_value) },
                  { key: "created_at", header: "Created", render: r => fmtDateTime(r.created_at), hideOnMobile: true },
                ]} />
              <Pagination page={page} limit={limit} total={data!.total} onPage={setPage} />
            </>)}
      </Card>
    </>
  );
}
