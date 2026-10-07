import { Router } from 'express';
import { z } from 'zod';
import { rows, call, exec } from '../db.js';
import { wrap, HttpError } from '../errors.js';

const r = Router();

r.get('/', wrap(async (req, res) => {
  const where = [], p = [];
  if (req.query.warehouse_id) { where.push('warehouse_id = ?'); p.push(req.query.warehouse_id); }
  if (req.query.low === '1')  { where.push('is_low = 1'); }
  const q = String(req.query.q || '').trim();
  if (q) { where.push('(product_name LIKE ? OR sku LIKE ?)'); p.push(`%${q}%`, `%${q}%`); }
  res.json(await rows(
    `SELECT * FROM vw_Warehouse_Inventory ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY warehouse_name, product_name LIMIT 500`, p));
}));

r.get('/movements', wrap(async (req, res) => {
  const limit = Math.min(200, parseInt(req.query.limit) || 30);
  res.json(await rows(
    `SELECT m.movement_id, m.created_at, p.sku, p.product_name, w.warehouse_name,
            m.change_qty, m.reason, m.shipment_id, m.note
       FROM Stock_Movements m
       JOIN Products p ON p.product_id = m.product_id
       JOIN Warehouses w ON w.warehouse_id = m.warehouse_id
      ORDER BY m.movement_id DESC LIMIT ?`, [limit]));
}));

// receive / adjust stock (creates the product-in-warehouse row on first receipt)
r.post('/adjust', wrap(async (req, res) => {
  const b = z.object({
    product_id: z.coerce.number().int(), warehouse_id: z.coerce.number().int(),
    delta: z.coerce.number().int(),
    reason: z.enum(['RECEIPT', 'ADJUSTMENT']).default('ADJUSTMENT'),
    note: z.string().trim().max(200).optional().nullable(),
    reorder_threshold: z.coerce.number().int().min(0).optional(),
  }).parse(req.body);
  const out = await call('CALL sp_adjust_stock(?,?,?,?,?)',
    [b.product_id, b.warehouse_id, b.delta, b.reason, b.note || null]);
  if (b.reorder_threshold !== undefined) {
    await exec('UPDATE Inventory_Levels SET reorder_threshold=? WHERE product_id=? AND warehouse_id=?',
      [b.reorder_threshold, b.product_id, b.warehouse_id]);
  }
  res.json(out[0]);
}));

r.put('/threshold', wrap(async (req, res) => {
  const b = z.object({
    product_id: z.coerce.number().int(), warehouse_id: z.coerce.number().int(),
    reorder_threshold: z.coerce.number().int().min(0),
  }).parse(req.body);
  const o = await exec('UPDATE Inventory_Levels SET reorder_threshold=? WHERE product_id=? AND warehouse_id=?',
    [b.reorder_threshold, b.product_id, b.warehouse_id]);
  if (!o.affectedRows) throw new HttpError(404, 'NOT_FOUND', 'Inventory row not found');
  res.json({ ok: true });
}));

export default r;
