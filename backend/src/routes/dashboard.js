import { Router } from 'express';
import { rows } from '../db.js';
import { wrap, HttpError } from '../errors.js';

export const dashboard = Router().get('/', wrap(async (_req, res) => {
  // independent queries run in parallel on separate pooled connections
  const [totals, byStatus, low, util, recent] = await Promise.all([
    rows(`SELECT (SELECT COUNT(*) FROM Products) AS products,
                 (SELECT COALESCE(SUM(quantity_on_hand),0) FROM Inventory_Levels) AS units,
                 (SELECT COUNT(*) FROM vw_Low_Stock_Alerts) AS low_stock,
                 (SELECT COUNT(*) FROM Shipments WHERE current_status IN ('Dispatched','In Transit')) AS active_shipments`),
    rows('SELECT current_status AS status, COUNT(*) AS count FROM Shipments GROUP BY current_status'),
    rows('SELECT * FROM vw_Low_Stock_Alerts ORDER BY (quantity_on_hand / NULLIF(reorder_threshold,0)) LIMIT 6'),
    rows('SELECT warehouse_name, units_stored, max_capacity, utilization_pct FROM vw_Warehouse_Utilization ORDER BY warehouse_name'),
    rows('SELECT shipment_id, destination_address, current_status, dispatched_from, carrier_name, created_at FROM vw_Shipment_Details ORDER BY shipment_id DESC LIMIT 5'),
  ]);
  res.json({ totals: totals[0], byStatus, low, util, recent });
}));

// Public, privacy-safe tracking: no prices, no internal ids beyond the shipment number
export const track = Router().get('/:id', wrap(async (req, res) => {
  const [s, logs] = await Promise.all([
    rows(`SELECT shipment_id, current_status, dispatched_from, destination_address, carrier_name,
                 created_at, dispatched_at, delivered_at
            FROM vw_Shipment_Details WHERE shipment_id = ?`, [req.params.id]),
    rows('SELECT logged_at, checkpoint_location, status_update FROM vw_Shipment_Tracking WHERE shipment_id = ? ORDER BY logged_at, log_id', [req.params.id]),
  ]);
  if (!s[0]) throw new HttpError(404, 'NOT_FOUND', 'No shipment found with that number');
  res.json({ shipment: s[0], logs });
}));
