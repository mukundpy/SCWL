import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { Search, MapPin } from "lucide-react";
import { api } from "@/lib/api";
import type { LogRow, Status } from "@/lib/types";
import { Button, Card, ErrorNote, Input, PageHeader, Spinner, StatusBadge } from "@/components/ui";
import { Stepper, Timeline } from "@/components/Tracking";
import { fmtDateTime } from "@/lib/format";

interface Tracked {
  shipment: { shipment_id: number; current_status: Status; dispatched_from: string; destination_address: string; carrier_name: string; created_at: string; delivered_at: string | null };
  logs: LogRow[];
}

export default function Track() {
  const { id } = useParams();
  const nav = useNavigate();
  const [val, setVal] = useState(id ?? "");
  const { data, isLoading, error } = useQuery({
    queryKey: ["track", id], queryFn: () => api.get<Tracked>(`/track/${id}`), enabled: !!id, retry: false,
  });

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Track a shipment" subtitle="Enter a shipment number to see where it is." />
      <form className="mb-5 flex gap-2" onSubmit={e => { e.preventDefault(); const v = val.replace(/\D/g, ""); if (v) nav(`/track/${v}`); }}>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input className="pl-9" inputMode="numeric" placeholder="Shipment number, e.g. 402" value={val} onChange={e => setVal(e.target.value)} />
        </div>
        <Button type="submit">Track</Button>
      </form>

      {!id ? (
        <div className="flex flex-col items-center py-12 text-center text-slate-400"><MapPin className="mb-2 h-8 w-8" /><p className="text-sm">Your shipment's journey will appear here.</p></div>
      ) : isLoading ? <Spinner /> : error ? <ErrorNote error={error} /> : data && (
        <div className="space-y-5">
          <Card className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">Shipment #{data.shipment.shipment_id}</div>
              <StatusBadge status={data.shipment.current_status} />
            </div>
            <Stepper status={data.shipment.current_status} />
            <dl className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-sm">
              <div><dt className="text-xs text-slate-400">From</dt><dd>{data.shipment.dispatched_from}</dd></div>
              <div><dt className="text-xs text-slate-400">To</dt><dd>{data.shipment.destination_address}</dd></div>
              <div><dt className="text-xs text-slate-400">Carrier</dt><dd>{data.shipment.carrier_name}</dd></div>
              <div><dt className="text-xs text-slate-400">{data.shipment.delivered_at ? "Delivered" : "Ordered"}</dt><dd>{fmtDateTime(data.shipment.delivered_at ?? data.shipment.created_at)}</dd></div>
            </dl>
          </Card>
          <Card className="p-5"><h2 className="mb-4 font-semibold text-slate-900">Journey</h2><Timeline logs={data.logs} /></Card>
        </div>)}
    </div>
  );
}
