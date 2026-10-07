import { Router } from 'express';
import { z } from 'zod';
import { crud, optText, reqText } from './crud.js';
import { rows, exec } from '../db.js';
import { wrap, HttpError } from '../errors.js';

export const suppliers = (() => {
  const r = crud({
    table: 'Suppliers', id: 'supplier_id', from: 'Suppliers',
    searchCols: ['company_name', 'contact_email', 'phone'], orderBy: 'company_name',
    cols: ['company_name', 'contact_email', 'phone'],
    schema: z.object({
      company_name: reqText(100),
      contact_email: z.preprocess(v => (v === '' ? null : v), z.string().email().max(100).nullish()),
      phone: optText(20),
    }),
  });
  // supplier <-> product catalogue (many-to-many bridge)
  r.get('/:id/products', wrap(async (req, res) => {
    res.json(await rows('SELECT product_id, sku, product_name, unit_price FROM vw_Supplier_Catalog WHERE supplier_id=? ORDER BY product_name', [req.params.id]));
  }));
  r.post('/:id/products', wrap(async (req, res) => {
    const { product_id } = z.object({ product_id: z.coerce.number().int() }).parse(req.body);
    await exec('INSERT IGNORE INTO Supplier_Product (supplier_id, product_id) VALUES (?, ?)', [req.params.id, product_id]);
    res.status(201).json({ ok: true });
  }));
  r.delete('/:id/products/:productId', wrap(async (req, res) => {
    await exec('DELETE FROM Supplier_Product WHERE supplier_id=? AND product_id=?', [req.params.id, req.params.productId]);
    res.status(204).end();
  }));
  return r;
})();

export const products = crud({
  table: 'Products', id: 'product_id', from: 'Products',
  searchCols: ['sku', 'product_name'], orderBy: 'product_name',
  cols: ['sku', 'product_name', 'unit_price'],
  schema: z.object({
    sku: reqText(30), product_name: reqText(100),
    unit_price: z.coerce.number().min(0).max(99999999),
  }),
});

export const warehouses = crud({
  table: 'Warehouses', id: 'warehouse_id',
  from: 'Warehouses w JOIN vw_Warehouse_Utilization u ON u.warehouse_id = w.warehouse_id',
  select: 'w.warehouse_id, w.warehouse_name, w.address, w.max_capacity, u.units_stored, u.utilization_pct',
  searchCols: ['w.warehouse_name', 'w.address'], orderBy: 'w.warehouse_name',
  cols: ['warehouse_name', 'address', 'max_capacity'],
  schema: z.object({
    warehouse_name: reqText(100), address: optText(200),
    max_capacity: z.coerce.number().int().min(1),
  }),
});

export const carriers = crud({
  table: 'Carriers', id: 'carrier_id', from: 'Carriers',
  searchCols: ['carrier_name', 'vehicle_type'], orderBy: 'carrier_name',
  cols: ['carrier_name', 'vehicle_type'],
  schema: z.object({ carrier_name: reqText(100), vehicle_type: optText(50) }),
});

// one small request that fills every dropdown in the UI
export const lookups = Router().get('/', wrap(async (_req, res) => {
  const [p, w, c, s] = await Promise.all([
    rows('SELECT product_id, sku, product_name, unit_price FROM Products ORDER BY product_name'),
    rows('SELECT warehouse_id, warehouse_name FROM Warehouses ORDER BY warehouse_name'),
    rows('SELECT carrier_id, carrier_name, vehicle_type FROM Carriers ORDER BY carrier_name'),
    rows('SELECT supplier_id, company_name FROM Suppliers ORDER BY company_name'),
  ]);
  res.json({ products: p, warehouses: w, carriers: c, suppliers: s });
}));
