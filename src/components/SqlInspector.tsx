/**
 * SqlInspector — shows the SQL statements that will be / were executed
 * for a given operation. Used as a collapsible panel under action buttons.
 */
import { useState } from "react";
import { ChevronDown, ChevronUp, Database, Copy, Check } from "lucide-react";
import clsx from "clsx";

export interface SqlBlock {
  label: string;           // e.g. "INSERT — Create shipment row"
  sql: string;             // the actual SQL (with ? replaced by real values)
  type: "DML" | "DDL" | "CALL" | "SELECT";
}

interface Props {
  title?: string;
  blocks: SqlBlock[];
  defaultOpen?: boolean;
}

function typeBadge(t: SqlBlock["type"]) {
  const cls: Record<SqlBlock["type"], string> = {
    CALL:   "bg-purple-100 text-purple-700",
    DML:    "bg-blue-100   text-blue-700",
    DDL:    "bg-amber-100  text-amber-700",
    SELECT: "bg-slate-100  text-slate-600",
  };
  return (
    <span className={clsx("rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide font-mono", cls[t])}>
      {t}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button onClick={copy} title="Copy SQL"
      className="ml-auto rounded p-1 text-slate-400 transition hover:bg-slate-700 hover:text-white">
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

export function SqlInspector({ title = "SQL executed", blocks, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* header — always visible */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
      >
        <Database className="h-4 w-4 text-indigo-500 shrink-0" />
        <span className="flex-1">{title}</span>
        <span className="text-xs text-slate-400 font-normal mr-2">{blocks.length} statement{blocks.length !== 1 ? "s" : ""}</span>
        {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>

      {/* body */}
      {open && (
        <div className="border-t border-slate-100 divide-y divide-slate-800 bg-slate-900">
          {blocks.map((b, i) => (
            <div key={i} className="px-4 py-3">
              <div className="mb-2 flex items-center gap-2">
                {typeBadge(b.type)}
                <span className="text-xs text-slate-400">{b.label}</span>
                <CopyButton text={b.sql} />
              </div>
              <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-emerald-300">
                {b.sql}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Pre-built block factories ─────────────────────────────────────── */

/** Shipment creation */
export function sqlCreateShipment(warehouseId: number, carrierId: number, dest: string, items: { product_id: number; quantity_shipped: number }[]): SqlBlock[] {
  return [
    {
      type: "CALL",
      label: "Stored procedure — creates shipment atomically",
      sql: `CALL sp_create_shipment(
  p_wh      = ${warehouseId},
  p_carrier = ${carrierId},
  p_dest    = '${dest}',
  p_items   = '${JSON.stringify(items)}'
);`,
    },
    {
      type: "DML",
      label: "INSERT — create shipment row",
      sql: `INSERT INTO Shipments
  (destination_address, warehouse_id, carrier_id)
VALUES
  ('${dest}', ${warehouseId}, ${carrierId});`,
    },
    {
      type: "DML",
      label: "INSERT — add line items",
      sql: items.map(it =>
        `INSERT INTO Shipment_Items (shipment_id, product_id, quantity_shipped)\nVALUES (LAST_INSERT_ID(), ${it.product_id}, ${it.quantity_shipped});`
      ).join("\n\n"),
    },
    {
      type: "DML",
      label: "INSERT — first tracking log (Order Received)",
      sql: `INSERT INTO Shipment_Logs (log_id, shipment_id, logged_at, checkpoint_location, status_update)
VALUES (1, LAST_INSERT_ID(), NOW(), '<warehouse_name>', 'Order Received');`,
    },
  ];
}

/** Status transition */
export function sqlSetStatus(shipmentId: number, newStatus: string, location?: string): SqlBlock[] {
  const blocks: SqlBlock[] = [
    {
      type: "CALL",
      label: "Stored procedure — transitions status and enforces rules",
      sql: `CALL sp_set_shipment_status(
  p_id       = ${shipmentId},
  p_new      = '${newStatus}',
  p_location = ${location ? `'${location}'` : "NULL"}
);`,
    },
  ];

  if (newStatus === "Dispatched") {
    blocks.push(
      {
        type: "DML",
        label: "UPDATE — deduct stock from Inventory_Levels",
        sql: `UPDATE Inventory_Levels il
  JOIN Shipment_Items si
    ON si.product_id = il.product_id
   AND si.shipment_id = ${shipmentId}
SET il.quantity_on_hand = il.quantity_on_hand - si.quantity_shipped
WHERE il.warehouse_id = <warehouse_id>;`,
      },
      {
        type: "DML",
        label: "INSERT — stock movement audit row (DISPATCH)",
        sql: `INSERT INTO Stock_Movements
  (product_id, warehouse_id, change_qty, reason, shipment_id, note)
SELECT si.product_id, <warehouse_id>,
       -si.quantity_shipped, 'DISPATCH',
       ${shipmentId}, 'Shipment #${shipmentId}'
FROM Shipment_Items si
WHERE si.shipment_id = ${shipmentId};`,
      },
      {
        type: "DML",
        label: "UPDATE — stamp dispatched_at timestamp",
        sql: `UPDATE Shipments
SET dispatched_at = NOW()
WHERE shipment_id = ${shipmentId};`,
      }
    );
  }

  if (newStatus === "Cancelled") {
    blocks.push({
      type: "DML",
      label: "UPDATE — return stock to Inventory_Levels (RETURN movement)",
      sql: `UPDATE Inventory_Levels il
  JOIN Shipment_Items si
    ON si.product_id = il.product_id
   AND si.shipment_id = ${shipmentId}
SET il.quantity_on_hand = il.quantity_on_hand + si.quantity_shipped
WHERE il.warehouse_id = <warehouse_id>;

INSERT INTO Stock_Movements (product_id, warehouse_id, change_qty, reason, shipment_id, note)
SELECT si.product_id, <warehouse_id>,
       si.quantity_shipped, 'RETURN',
       ${shipmentId}, 'Shipment #${shipmentId} cancelled'
FROM Shipment_Items si WHERE si.shipment_id = ${shipmentId};`,
    });
  }

  if (newStatus === "Delivered") {
    blocks.push({
      type: "DML",
      label: "UPDATE — stamp delivered_at timestamp",
      sql: `UPDATE Shipments
SET delivered_at = NOW()
WHERE shipment_id = ${shipmentId};`,
    });
  }

  blocks.push({
    type: "DML",
    label: "UPDATE — set new status + tracking log",
    sql: `UPDATE Shipments
SET current_status = '${newStatus}'
WHERE shipment_id = ${shipmentId};

-- tracking log appended via sp_log_internal:
INSERT INTO Shipment_Logs (log_id, shipment_id, logged_at, checkpoint_location, status_update)
VALUES (<next_log_id>, ${shipmentId}, NOW(), '${location || "<location>"}', '${newStatus}');`,
  });

  return blocks;
}

/** Cancel shipment */
export function sqlCancelShipment(shipmentId: number, wasDispatched: boolean): SqlBlock[] {
  return sqlSetStatus(shipmentId, "Cancelled", wasDispatched ? "<warehouse>" : undefined);
}

/** Delete shipment */
export function sqlDeleteShipment(shipmentId: number): SqlBlock[] {
  return [
    {
      type: "DML",
      label: "DELETE — remove shipment (trigger checks status first)",
      sql: `-- TRIGGER trg_shipment_before_delete fires first:
-- SIGNAL error if status NOT IN ('Pending','Cancelled')

DELETE FROM Shipments
WHERE shipment_id = ${shipmentId};
-- Shipment_Items and Shipment_Logs cascade-deleted automatically`,
    },
  ];
}

/** Add tracking checkpoint */
export function sqlAddLog(shipmentId: number, location: string, text: string): SqlBlock[] {
  return [
    {
      type: "CALL",
      label: "Stored procedure — add checkpoint log",
      sql: `CALL sp_add_log(
  p_shipment = ${shipmentId},
  p_location = '${location}',
  p_text     = '${text}'
);`,
    },
    {
      type: "DML",
      label: "INSERT — Shipment_Logs row",
      sql: `INSERT INTO Shipment_Logs
  (log_id, shipment_id, logged_at, checkpoint_location, status_update)
VALUES
  (<max_log_id + 1>, ${shipmentId}, NOW(), '${location}', '${text}');`,
    },
  ];
}

/** Stock adjustment / receipt */
export function sqlAdjustStock(productId: number, warehouseId: number, delta: number, reason: string, note?: string): SqlBlock[] {
  return [
    {
      type: "CALL",
      label: "Stored procedure — adjust stock atomically",
      sql: `CALL sp_adjust_stock(
  p_product = ${productId},
  p_wh      = ${warehouseId},
  p_delta   = ${delta},
  p_reason  = '${reason}',
  p_note    = '${note ?? ""}'
);`,
    },
    {
      type: "DML",
      label: "UPDATE — change quantity_on_hand",
      sql: `UPDATE Inventory_Levels
SET quantity_on_hand = quantity_on_hand + (${delta})
WHERE product_id = ${productId}
  AND warehouse_id = ${warehouseId};`,
    },
    {
      type: "DML",
      label: "INSERT — Stock_Movements audit row",
      sql: `INSERT INTO Stock_Movements
  (product_id, warehouse_id, change_qty, reason, note)
VALUES
  (${productId}, ${warehouseId}, ${delta}, '${reason}', '${note ?? ""}');`,
    },
  ];
}

/** Update reorder threshold */
export function sqlUpdateThreshold(productId: number, warehouseId: number, threshold: number): SqlBlock[] {
  return [
    {
      type: "DML",
      label: "UPDATE — set reorder_threshold",
      sql: `UPDATE Inventory_Levels
SET reorder_threshold = ${threshold}
WHERE product_id = ${productId}
  AND warehouse_id = ${warehouseId};`,
    },
  ];
}

/** Generic master data (suppliers, products, warehouses, carriers) */
export function sqlMasterInsert(table: string, fields: Record<string, unknown>): SqlBlock[] {
  const cols = Object.keys(fields).join(", ");
  const vals = Object.values(fields).map(v => typeof v === "string" ? `'${v}'` : String(v)).join(", ");
  return [{
    type: "DML",
    label: `INSERT — new ${table} row`,
    sql: `INSERT INTO ${table} (${cols})\nVALUES (${vals});`,
  }];
}

export function sqlMasterUpdate(table: string, idKey: string, id: unknown, fields: Record<string, unknown>): SqlBlock[] {
  const sets = Object.entries(fields).map(([k, v]) => `  ${k} = ${typeof v === "string" ? `'${v}'` : v}`).join(",\n");
  return [{
    type: "DML",
    label: `UPDATE — edit ${table} row`,
    sql: `UPDATE ${table}\nSET\n${sets}\nWHERE ${idKey} = ${id};`,
  }];
}

export function sqlMasterDelete(table: string, idKey: string, id: unknown): SqlBlock[] {
  return [{
    type: "DML",
    label: `DELETE — remove from ${table}`,
    sql: `DELETE FROM ${table}\nWHERE ${idKey} = ${id};`,
  }];
}
