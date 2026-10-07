import { Router } from 'express';
import { z } from 'zod';
import { rows, call, exec } from '../db.js';
import { wrap, HttpError } from '../errors.js';

const r = Router();
const STATUSES = ['Pending', 'Dispatched', 'In Transit', 'Delivered', 'Cancelled'];

r.get('/', wrap(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const where = [], p = [];
  if (STATUSES.includes(req.query.status)) { where.push('current_status = ?'); p.push(req.query.status); }
  const q = String(req.query.q || '').trim();
  if (q) {
    where.push('(CAST(shipment_id AS CHAR) = ? OR destination_address LIKE ? OR carrier_name LIKE ? OR dispatched_from LIKE ?)');
    p.push(q, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const [data, count] = await Promise.all([
    rows(`SELECT * FROM vw_Shipment_Details ${w} ORDER BY shipment_id DESC LIMIT ? OFFSET ?`, [...p, limit, (page - 1) * limit]),
    rows(`SELECT COUNT(*) AS n FROM vw_Shipment_Details ${w}`, p),
  ]);
  res.json({ data, total: count[0].n, page, limit });
}));

r.get('/:id', wrap(async (req, res) => {
  const [[shipment], items, logs] = await Promise.all([
    rows('SELECT * FROM vw_Shipment_Details WHERE shipment_id = ?', [req.params.id]).then(x => [x[0]]),
    rows(`SELECT si.product_id, p.sku, p.product_name, p.unit_price, si.quantity_shipped,
                 si.quantity_shipped * p.unit_price AS line_total
            FROM Shipment_Items si JOIN Products p ON p.product_id = si.product_id
           WHERE si.shipment_id = ? ORDER BY p.product_name`, [req.params.id]),
    rows('SELECT log_id, logged_at, checkpoint_location, status_update FROM vw_Shipment_Tracking WHERE shipment_id = ? ORDER BY logged_at, log_id', [req.params.id]),
  ]);
  if (!shipment) throw new HttpError(404, 'NOT_FOUND', 'Shipment not found');
  res.json({ shipment, items, logs });
}));

r.post('/', wrap(async (req, res) => {
  const b = z.object({
    warehouse_id: z.coerce.number().int(), carrier_id: z.coerce.number().int(),
    destination_address: z.string().trim().min(1, 'Required').max(200),
    items: z.array(z.object({
      product_id: z.coerce.number().int(), quantity_shipped: z.coerce.number().int().min(1),
    })).min(1, 'Add at least one item'),
  }).parse(req.body);
  const ids = new Set(b.items.map(i => i.product_id));
  if (ids.size !== b.items.length) throw new HttpError(400, 'VALIDATION_ERROR', 'Each product can appear only once');
  const out = await call('CALL sp_create_shipment(?,?,?,CAST(? AS JSON))',
    [b.warehouse_id, b.carrier_id, b.destination_address, JSON.stringify(b.items)]);
  res.status(201).json(out[0]);
}));

r.post('/:id/status', wrap(async (req, res) => {
  const b = z.object({ status: z.enum(STATUSES), location: z.string().trim().max(100).optional() }).parse(req.body);
  const out = await call('CALL sp_set_shipment_status(?,?,?)', [req.params.id, b.status, b.location || null]);
  res.json(out[0]);
}));

r.post('/:id/logs', wrap(async (req, res) => {
  const b = z.object({
    location: z.string().trim().min(1, 'Required').max(100),
    status_update: z.string().trim().min(1, 'Required').max(100),
  }).parse(req.body);
  await call('CALL sp_add_log(?,?,?)', [req.params.id, b.location, b.status_update]);
  res.status(201).json({ ok: true });
}));

r.delete('/:id', wrap(async (req, res) => {
  const o = await exec('DELETE FROM Shipments WHERE shipment_id = ?', [req.params.id]);
  if (!o.affectedRows) throw new HttpError(404, 'NOT_FOUND', 'Shipment not found');
  res.status(204).end();
}));

export default r;
