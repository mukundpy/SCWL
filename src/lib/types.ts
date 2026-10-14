export type Status = "Pending" | "Dispatched" | "In Transit" | "Delivered" | "Cancelled";
export const STATUSES: Status[] = ["Pending", "Dispatched", "In Transit", "Delivered", "Cancelled"];

export interface Paged<T> { data: T[]; total: number; page: number; limit: number }

export interface Lookups {
  products: { product_id: number; sku: string; product_name: string; unit_price: number }[];
  warehouses: { warehouse_id: number; warehouse_name: string }[];
  carriers: { carrier_id: number; carrier_name: string; vehicle_type: string | null }[];
  suppliers: { supplier_id: number; company_name: string }[];
}

export interface InvRow {
  warehouse_id: number; warehouse_name: string; product_id: number; sku: string; product_name: string;
  quantity_on_hand: number; reorder_threshold: number; is_low: number;
}

export interface ShipmentRow {
  shipment_id: number; warehouse_id: number; dispatched_from: string; carrier_id: number; carrier_name: string;
  vehicle_type: string | null; destination_address: string; current_status: Status;
  created_at: string; dispatched_at: string | null; delivered_at: string | null;
  item_count: number; total_units: number; total_value: number;
}

export interface LogRow { log_id?: number; logged_at: string; checkpoint_location: string | null; status_update: string | null }

export interface SqlQueryEntry {
  id: string;
  sql: string;
  rawSql: string;
  params: unknown[];
  type: "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "CALL" | "DDL" | "OTHER";
  status: "success" | "error";
  error: string | null;
  durationMs: number;
  rowsCount?: number;
  affectedRows?: number;
  insertId?: number;
  timestamp: string;
  date: string;
  time: string;
}

export interface SqlHistoryStats {
  total: number;
  SELECT: number;
  INSERT: number;
  UPDATE: number;
  DELETE: number;
  CALL: number;
  OTHER: number;
}

export interface SqlHistoryResponse {
  queries: SqlQueryEntry[];
  total: number;
  stats: SqlHistoryStats;
}
