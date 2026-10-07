import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');

export class SqlError extends Error {
  constructor(sqlState, message, errno = null) {
    super(message);
    this.sqlState = sqlState;
    this.sqlMessage = message;
    if (errno) this.errno = errno;
  }
}

function formatDateTime(d = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const INITIAL_SEED = {
  Suppliers: [
    { supplier_id: 1, company_name: 'Tata Components Ltd', contact_email: 'sales@tatacomp.com', phone: '9876500001' },
    { supplier_id: 2, company_name: 'Reliance Industrial Supplies', contact_email: 'orders@relindustrial.com', phone: '9876500002' },
    { supplier_id: 3, company_name: 'Bharat Electronics Traders', contact_email: 'contact@bharatelec.com', phone: '9876500003' },
    { supplier_id: 4, company_name: 'Mahindra Packaging Co', contact_email: 'info@mahindrapack.com', phone: '9876500004' },
  ],
  Products: [
    { product_id: 101, sku: 'SKU-LPT-001', product_name: 'Laptop 14 inch', unit_price: 45000.00 },
    { product_id: 102, sku: 'SKU-MOB-002', product_name: 'Smartphone X', unit_price: 22000.00 },
    { product_id: 103, sku: 'SKU-HDP-003', product_name: 'Wireless Headphones', unit_price: 3500.00 },
    { product_id: 104, sku: 'SKU-KBD-004', product_name: 'Mechanical Keyboard', unit_price: 2800.00 },
  ],
  Warehouses: [
    { warehouse_id: 201, warehouse_name: 'Mumbai Central Hub', address: 'Bhiwandi, Maharashtra', max_capacity: 10000 },
    { warehouse_id: 202, warehouse_name: 'Delhi North Depot', address: 'Narela, Delhi', max_capacity: 8000 },
    { warehouse_id: 203, warehouse_name: 'Bangalore Fulfilment Center', address: 'Hoskote, Karnataka', max_capacity: 6000 },
    { warehouse_id: 204, warehouse_name: 'Pune Distribution Yard', address: 'Chakan, Maharashtra', max_capacity: 5000 },
  ],
  Carriers: [
    { carrier_id: 301, carrier_name: 'BlueDart Logistics', vehicle_type: 'Truck' },
    { carrier_id: 302, carrier_name: 'Delhivery Express', vehicle_type: 'Mini Van' },
    { carrier_id: 303, carrier_name: 'Gati Cargo', vehicle_type: 'Container Truck' },
    { carrier_id: 304, carrier_name: 'DTDC Freight', vehicle_type: 'Cargo Van' },
  ],
  Supplier_Product: [
    { supplier_id: 1, product_id: 101 },
    { supplier_id: 1, product_id: 104 },
    { supplier_id: 2, product_id: 102 },
    { supplier_id: 3, product_id: 102 },
    { supplier_id: 3, product_id: 103 },
    { supplier_id: 4, product_id: 103 },
  ],
  Inventory_Levels: [
    { product_id: 101, warehouse_id: 201, quantity_on_hand: 500, reorder_threshold: 100 },
    { product_id: 102, warehouse_id: 201, quantity_on_hand: 80, reorder_threshold: 100 },
    { product_id: 103, warehouse_id: 202, quantity_on_hand: 1200, reorder_threshold: 300 },
    { product_id: 104, warehouse_id: 203, quantity_on_hand: 40, reorder_threshold: 50 },
    { product_id: 101, warehouse_id: 204, quantity_on_hand: 250, reorder_threshold: 75 },
    { product_id: 102, warehouse_id: 202, quantity_on_hand: 600, reorder_threshold: 150 },
  ],
  Stock_Movements: [
    { movement_id: 1, product_id: 101, warehouse_id: 201, change_qty: 500, reason: 'RECEIPT', shipment_id: null, note: 'Opening balance', created_at: '2026-09-01 09:00:00' },
    { movement_id: 2, product_id: 102, warehouse_id: 201, change_qty: 80, reason: 'RECEIPT', shipment_id: null, note: 'Opening balance', created_at: '2026-09-01 09:00:00' },
    { movement_id: 3, product_id: 103, warehouse_id: 202, change_qty: 1200, reason: 'RECEIPT', shipment_id: null, note: 'Opening balance', created_at: '2026-09-01 09:00:00' },
    { movement_id: 4, product_id: 104, warehouse_id: 203, change_qty: 40, reason: 'RECEIPT', shipment_id: null, note: 'Opening balance', created_at: '2026-09-01 09:00:00' },
    { movement_id: 5, product_id: 101, warehouse_id: 204, change_qty: 250, reason: 'RECEIPT', shipment_id: null, note: 'Opening balance', created_at: '2026-09-01 09:00:00' },
    { movement_id: 6, product_id: 102, warehouse_id: 202, change_qty: 600, reason: 'RECEIPT', shipment_id: null, note: 'Opening balance', created_at: '2026-09-01 09:00:00' },
  ],
  Shipments: [
    { shipment_id: 401, destination_address: 'Andheri East, Mumbai', current_status: 'Delivered', warehouse_id: 201, carrier_id: 301, created_at: '2026-09-24 17:00:00', dispatched_at: '2026-09-25 09:00:00', delivered_at: '2026-09-26 11:00:00' },
    { shipment_id: 402, destination_address: 'Connaught Place, New Delhi', current_status: 'In Transit', warehouse_id: 202, carrier_id: 302, created_at: '2026-10-04 16:00:00', dispatched_at: '2026-10-05 08:00:00', delivered_at: null },
    { shipment_id: 403, destination_address: 'Koramangala, Bangalore', current_status: 'In Transit', warehouse_id: 203, carrier_id: 303, created_at: '2026-10-05 15:00:00', dispatched_at: '2026-10-06 07:30:00', delivered_at: null },
    { shipment_id: 404, destination_address: 'Hinjewadi, Pune', current_status: 'Pending', warehouse_id: 204, carrier_id: 304, created_at: '2026-10-07 06:00:00', dispatched_at: null, delivered_at: null },
  ],
  Shipment_Items: [
    { shipment_id: 401, product_id: 101, quantity_shipped: 20 },
    { shipment_id: 401, product_id: 102, quantity_shipped: 15 },
    { shipment_id: 402, product_id: 103, quantity_shipped: 100 },
    { shipment_id: 403, product_id: 104, quantity_shipped: 30 },
    { shipment_id: 404, product_id: 101, quantity_shipped: 10 },
  ],
  Shipment_Logs: [
    { log_id: 1, shipment_id: 401, logged_at: '2026-09-25 09:00:00', checkpoint_location: 'Mumbai Central Hub', status_update: 'Dispatched' },
    { log_id: 2, shipment_id: 401, logged_at: '2026-09-25 14:30:00', checkpoint_location: 'Thane Checkpoint', status_update: 'In Transit' },
    { log_id: 3, shipment_id: 401, logged_at: '2026-09-26 11:00:00', checkpoint_location: 'Andheri East', status_update: 'Delivered' },
    { log_id: 1, shipment_id: 402, logged_at: '2026-10-05 08:00:00', checkpoint_location: 'Delhi North Depot', status_update: 'Dispatched' },
    { log_id: 2, shipment_id: 402, logged_at: '2026-10-06 10:15:00', checkpoint_location: 'Gurugram Hub', status_update: 'In Transit' },
    { log_id: 1, shipment_id: 403, logged_at: '2026-10-06 07:30:00', checkpoint_location: 'Bangalore Fulfilment Center', status_update: 'Dispatched' },
    { log_id: 2, shipment_id: 403, logged_at: '2026-10-07 09:45:00', checkpoint_location: 'Electronic City Checkpoint', status_update: 'In Transit' },
    { log_id: 1, shipment_id: 404, logged_at: '2026-10-07 06:00:00', checkpoint_location: 'Pune Distribution Yard', status_update: 'Order Received' },
  ],
};

class EmbeddedDatabase {
  constructor() {
    this.data = this.loadData();
  }

  loadData() {
    try {
      if (fs.existsSync(STORE_FILE)) {
        const raw = fs.readFileSync(STORE_FILE, 'utf8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Could not read existing store.json, re-initializing seed data', e.message);
    }
    const cloned = JSON.parse(JSON.stringify(INITIAL_SEED));
    this.saveData(cloned);
    return cloned;
  }

  saveData(data = this.data) {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      console.error('Failed to save store.json', e.message);
    }
  }

  // --- Views ---

  vwWarehouseInventory() {
    return this.data.Inventory_Levels.map(i => {
      const w = this.data.Warehouses.find(x => x.warehouse_id === i.warehouse_id);
      const p = this.data.Products.find(x => x.product_id === i.product_id);
      return {
        warehouse_id: i.warehouse_id,
        warehouse_name: w ? w.warehouse_name : '',
        product_id: i.product_id,
        sku: p ? p.sku : '',
        product_name: p ? p.product_name : '',
        quantity_on_hand: i.quantity_on_hand,
        reorder_threshold: i.reorder_threshold,
        is_low: i.quantity_on_hand <= i.reorder_threshold ? 1 : 0,
      };
    });
  }

  vwLowStockAlerts() {
    return this.vwWarehouseInventory().filter(r => r.is_low === 1);
  }

  vwShipmentDetails() {
    return this.data.Shipments.map(s => {
      const w = this.data.Warehouses.find(x => x.warehouse_id === s.warehouse_id);
      const c = this.data.Carriers.find(x => x.carrier_id === s.carrier_id);
      const items = this.data.Shipment_Items.filter(si => si.shipment_id === s.shipment_id);
      const itemCount = items.length;
      let totalUnits = 0;
      let totalValue = 0;
      for (const item of items) {
        totalUnits += item.quantity_shipped;
        const p = this.data.Products.find(x => x.product_id === item.product_id);
        if (p) totalValue += item.quantity_shipped * Number(p.unit_price);
      }
      return {
        shipment_id: s.shipment_id,
        warehouse_id: s.warehouse_id,
        dispatched_from: w ? w.warehouse_name : '',
        carrier_id: s.carrier_id,
        carrier_name: c ? c.carrier_name : '',
        vehicle_type: c ? c.vehicle_type : '',
        destination_address: s.destination_address,
        current_status: s.current_status,
        created_at: s.created_at,
        dispatched_at: s.dispatched_at,
        delivered_at: s.delivered_at,
        item_count: itemCount,
        total_units: totalUnits,
        total_value: totalValue,
      };
    });
  }

  vwShipmentTracking() {
    return this.data.Shipment_Logs.map(l => ({
      shipment_id: l.shipment_id,
      log_id: l.log_id,
      logged_at: l.logged_at,
      checkpoint_location: l.checkpoint_location,
      status_update: l.status_update,
    }));
  }

  vwSupplierCatalog() {
    const list = [];
    for (const sp of this.data.Supplier_Product) {
      const s = this.data.Suppliers.find(x => x.supplier_id === sp.supplier_id);
      const p = this.data.Products.find(x => x.product_id === sp.product_id);
      if (s && p) {
        list.push({
          supplier_id: s.supplier_id,
          company_name: s.company_name,
          product_id: p.product_id,
          sku: p.sku,
          product_name: p.product_name,
          unit_price: Number(p.unit_price),
        });
      }
    }
    return list;
  }

  vwWarehouseUtilization() {
    return this.data.Warehouses.map(w => {
      const invs = this.data.Inventory_Levels.filter(i => i.warehouse_id === w.warehouse_id);
      const unitsStored = invs.reduce((sum, i) => sum + i.quantity_on_hand, 0);
      const utilPct = w.max_capacity > 0 ? Math.round((unitsStored / w.max_capacity) * 1000) / 10 : 0;
      return {
        warehouse_id: w.warehouse_id,
        warehouse_name: w.warehouse_name,
        max_capacity: w.max_capacity,
        units_stored: unitsStored,
        utilization_pct: utilPct,
      };
    });
  }

  // --- Stored Procedures & Triggers ---

  addLogInternal(shipmentId, location, statusUpdate) {
    const existing = this.data.Shipment_Logs.filter(l => l.shipment_id === shipmentId);
    const nextLogId = existing.length > 0 ? Math.max(...existing.map(l => l.log_id)) + 1 : 1;
    this.data.Shipment_Logs.push({
      log_id: nextLogId,
      shipment_id: shipmentId,
      logged_at: formatDateTime(),
      checkpoint_location: location,
      status_update: statusUpdate,
    });
  }

  spAdjustStock(productId, warehouseId, delta, reason, note) {
    productId = Number(productId);
    warehouseId = Number(warehouseId);
    delta = Number(delta);

    if (delta === 0) {
      throw new SqlError('45000', 'INVALID: change must not be zero');
    }
    if (reason !== 'RECEIPT' && reason !== 'ADJUSTMENT') {
      throw new SqlError('45000', 'INVALID: reason must be RECEIPT or ADJUSTMENT');
    }

    const wh = this.data.Warehouses.find(w => w.warehouse_id === warehouseId);
    if (!wh) {
      throw new SqlError('45000', 'NOT_FOUND: warehouse not found');
    }

    let inv = this.data.Inventory_Levels.find(i => i.product_id === productId && i.warehouse_id === warehouseId);
    if (!inv) {
      inv = { product_id: productId, warehouse_id: warehouseId, quantity_on_hand: 0, reorder_threshold: 0 };
      this.data.Inventory_Levels.push(inv);
    }

    if (inv.quantity_on_hand + delta < 0) {
      throw new SqlError('45000', 'INSUFFICIENT_STOCK: not enough stock to remove that quantity');
    }

    // Trigger: capacity check
    const otherUnits = this.data.Inventory_Levels
      .filter(i => i.warehouse_id === warehouseId && i.product_id !== productId)
      .reduce((sum, i) => sum + i.quantity_on_hand, 0);

    if (otherUnits + inv.quantity_on_hand + delta > wh.max_capacity) {
      throw new SqlError('45000', 'CAPACITY_EXCEEDED: warehouse capacity would be exceeded');
    }

    inv.quantity_on_hand += delta;

    const nextMovId = this.data.Stock_Movements.length > 0
      ? Math.max(...this.data.Stock_Movements.map(m => m.movement_id)) + 1
      : 1;

    this.data.Stock_Movements.push({
      movement_id: nextMovId,
      product_id: productId,
      warehouse_id: warehouseId,
      change_qty: delta,
      reason,
      shipment_id: null,
      note: note || null,
      created_at: formatDateTime(),
    });

    this.saveData();
    return [{ quantity_on_hand: inv.quantity_on_hand }];
  }

  spCreateShipment(warehouseId, carrierId, dest, items) {
    warehouseId = Number(warehouseId);
    carrierId = Number(carrierId);
    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch { items = []; }
    }
    if (!Array.isArray(items) || items.length === 0) {
      throw new SqlError('45000', 'INVALID: a shipment needs at least one item');
    }

    const wh = this.data.Warehouses.find(w => w.warehouse_id === warehouseId);
    if (!wh) throw new SqlError('45000', 'NOT_FOUND: warehouse not found');

    const nextShipmentId = this.data.Shipments.length > 0
      ? Math.max(...this.data.Shipments.map(s => s.shipment_id)) + 1
      : 401;

    const newShipment = {
      shipment_id: nextShipmentId,
      destination_address: dest,
      current_status: 'Pending',
      warehouse_id: warehouseId,
      carrier_id: carrierId,
      created_at: formatDateTime(),
      dispatched_at: null,
      delivered_at: null,
    };
    this.data.Shipments.push(newShipment);

    for (const it of items) {
      this.data.Shipment_Items.push({
        shipment_id: nextShipmentId,
        product_id: Number(it.product_id),
        quantity_shipped: Number(it.quantity_shipped),
      });
    }

    this.addLogInternal(nextShipmentId, wh.warehouse_name, 'Order Received');
    this.saveData();
    return [{ shipment_id: nextShipmentId }];
  }

  spSetShipmentStatus(shipmentId, newStatus, location) {
    shipmentId = Number(shipmentId);
    const s = this.data.Shipments.find(x => x.shipment_id === shipmentId);
    if (!s) {
      throw new SqlError('45000', 'NOT_FOUND: shipment does not exist');
    }

    const vStatus = s.current_status;
    const allowed =
      (vStatus === 'Pending' && (newStatus === 'Dispatched' || newStatus === 'Cancelled')) ||
      (vStatus === 'Dispatched' && (newStatus === 'In Transit' || newStatus === 'Cancelled')) ||
      (vStatus === 'In Transit' && newStatus === 'Delivered');

    if (!allowed) {
      throw new SqlError('45000', 'INVALID_STATUS_TRANSITION: that status change is not allowed');
    }

    const items = this.data.Shipment_Items.filter(si => si.shipment_id === shipmentId);
    const wh = this.data.Warehouses.find(w => w.warehouse_id === s.warehouse_id);

    if (newStatus === 'Dispatched') {
      // Check stock
      for (const item of items) {
        const inv = this.data.Inventory_Levels.find(i => i.product_id === item.product_id && i.warehouse_id === s.warehouse_id);
        if (!inv || inv.quantity_on_hand < item.quantity_shipped) {
          throw new SqlError('45000', 'INSUFFICIENT_STOCK: not enough stock in this warehouse for one or more items');
        }
      }
      // Deduct stock
      for (const item of items) {
        const inv = this.data.Inventory_Levels.find(i => i.product_id === item.product_id && i.warehouse_id === s.warehouse_id);
        inv.quantity_on_hand -= item.quantity_shipped;
        const nextMovId = this.data.Stock_Movements.length > 0 ? Math.max(...this.data.Stock_Movements.map(m => m.movement_id)) + 1 : 1;
        this.data.Stock_Movements.push({
          movement_id: nextMovId,
          product_id: item.product_id,
          warehouse_id: s.warehouse_id,
          change_qty: -item.quantity_shipped,
          reason: 'DISPATCH',
          shipment_id: shipmentId,
          note: `Shipment #${shipmentId}`,
          created_at: formatDateTime(),
        });
      }
      s.dispatched_at = formatDateTime();
    } else if (newStatus === 'Cancelled' && vStatus === 'Dispatched') {
      // Return stock
      for (const item of items) {
        let inv = this.data.Inventory_Levels.find(i => i.product_id === item.product_id && i.warehouse_id === s.warehouse_id);
        if (!inv) {
          inv = { product_id: item.product_id, warehouse_id: s.warehouse_id, quantity_on_hand: 0, reorder_threshold: 0 };
          this.data.Inventory_Levels.push(inv);
        }
        inv.quantity_on_hand += item.quantity_shipped;
        const nextMovId = this.data.Stock_Movements.length > 0 ? Math.max(...this.data.Stock_Movements.map(m => m.movement_id)) + 1 : 1;
        this.data.Stock_Movements.push({
          movement_id: nextMovId,
          product_id: item.product_id,
          warehouse_id: s.warehouse_id,
          change_qty: item.quantity_shipped,
          reason: 'RETURN',
          shipment_id: shipmentId,
          note: `Shipment #${shipmentId} cancelled`,
          created_at: formatDateTime(),
        });
      }
    } else if (newStatus === 'Delivered') {
      s.delivered_at = formatDateTime();
    }

    s.current_status = newStatus;
    const loc = (location && location.trim())
      ? location.trim()
      : (newStatus === 'Delivered' ? s.destination_address : (newStatus === 'In Transit' ? 'In transit' : (wh ? wh.warehouse_name : 'Warehouse')));
    this.addLogInternal(shipmentId, loc, newStatus);

    this.saveData();
    return [{ current_status: newStatus }];
  }

  spAddLog(shipmentId, location, text) {
    shipmentId = Number(shipmentId);
    const s = this.data.Shipments.find(x => x.shipment_id === shipmentId);
    if (!s) throw new SqlError('45000', 'NOT_FOUND: shipment does not exist');
    if (s.current_status === 'Delivered' || s.current_status === 'Cancelled') {
      throw new SqlError('45000', 'NOT_ALLOWED: shipment is closed');
    }
    this.addLogInternal(shipmentId, location, text);
    this.saveData();
    return [{ ok: true }];
  }

  // --- SQL Query Engine ---

  async query(sql, params = []) {
    return this.rows(sql, params);
  }

  async rows(sql, params = []) {
    const s = sql.trim().replace(/\s+/g, ' ');

    // 1. Health check
    if (/^SELECT 1$/i.test(s)) {
      return [{ 1: 1 }];
    }

    // 2. Dashboard totals
    if (/SELECT \(SELECT COUNT\(\*\) FROM Products\) AS products/i.test(s)) {
      const products = this.data.Products.length;
      const units = this.data.Inventory_Levels.reduce((acc, i) => acc + i.quantity_on_hand, 0);
      const lowStock = this.vwLowStockAlerts().length;
      const activeShipments = this.data.Shipments.filter(x => ['Dispatched', 'In Transit'].includes(x.current_status)).length;
      return [{ products, units, low_stock: lowStock, active_shipments: activeShipments }];
    }

    // 3. Dashboard shipments by status
    if (/SELECT current_status AS status, COUNT\(\*\) AS count FROM Shipments GROUP BY current_status/i.test(s)) {
      const counts = {};
      for (const sh of this.data.Shipments) {
        counts[sh.current_status] = (counts[sh.current_status] || 0) + 1;
      }
      return Object.entries(counts).map(([status, count]) => ({ status, count }));
    }

    // 4. Dashboard low stock
    if (/SELECT \* FROM vw_Low_Stock_Alerts ORDER BY \(quantity_on_hand \/ NULLIF\(reorder_threshold,0\)\) LIMIT 6/i.test(s)) {
      const alerts = this.vwLowStockAlerts();
      alerts.sort((a, b) => (a.quantity_on_hand / (a.reorder_threshold || 1)) - (b.quantity_on_hand / (b.reorder_threshold || 1)));
      return alerts.slice(0, 6);
    }

    // 5. Dashboard utilization
    if (/SELECT warehouse_name, units_stored, max_capacity, utilization_pct FROM vw_Warehouse_Utilization ORDER BY warehouse_name/i.test(s)) {
      const list = this.vwWarehouseUtilization();
      list.sort((a, b) => a.warehouse_name.localeCompare(b.warehouse_name));
      return list;
    }

    // 6. Dashboard recent shipments
    if (/SELECT shipment_id, destination_address, current_status, dispatched_from, carrier_name, created_at FROM vw_Shipment_Details ORDER BY shipment_id DESC LIMIT 5/i.test(s)) {
      const list = this.vwShipmentDetails();
      list.sort((a, b) => b.shipment_id - a.shipment_id);
      return list.slice(0, 5).map(r => ({
        shipment_id: r.shipment_id,
        destination_address: r.destination_address,
        current_status: r.current_status,
        dispatched_from: r.dispatched_from,
        carrier_name: r.carrier_name,
        created_at: r.created_at,
      }));
    }

    // 7. Lookups
    if (/SELECT product_id, sku, product_name, unit_price FROM Products ORDER BY product_name/i.test(s)) {
      return [...this.data.Products].sort((a, b) => a.product_name.localeCompare(b.product_name));
    }
    if (/SELECT warehouse_id, warehouse_name FROM Warehouses ORDER BY warehouse_name/i.test(s)) {
      return this.data.Warehouses.map(w => ({ warehouse_id: w.warehouse_id, warehouse_name: w.warehouse_name }))
        .sort((a, b) => a.warehouse_name.localeCompare(b.warehouse_name));
    }
    if (/SELECT carrier_id, carrier_name, vehicle_type FROM Carriers ORDER BY carrier_name/i.test(s)) {
      return [...this.data.Carriers].sort((a, b) => a.carrier_name.localeCompare(b.carrier_name));
    }
    if (/SELECT supplier_id, company_name FROM Suppliers ORDER BY company_name/i.test(s)) {
      return this.data.Suppliers.map(x => ({ supplier_id: x.supplier_id, company_name: x.company_name }))
        .sort((a, b) => a.company_name.localeCompare(b.company_name));
    }

    // 8. Supplier catalog for supplier
    if (/SELECT product_id, sku, product_name, unit_price FROM vw_Supplier_Catalog WHERE supplier_id=\? ORDER BY product_name/i.test(s)) {
      const supId = Number(params[0]);
      return this.vwSupplierCatalog()
        .filter(r => r.supplier_id === supId)
        .sort((a, b) => a.product_name.localeCompare(b.product_name))
        .map(r => ({ product_id: r.product_id, sku: r.sku, product_name: r.product_name, unit_price: r.unit_price }));
    }

    // 9. Tracking page query
    if (/FROM vw_Shipment_Details WHERE shipment_id = \?/i.test(s)) {
      const id = Number(params[0]);
      const res = this.vwShipmentDetails().filter(x => x.shipment_id === id);
      return res;
    }

    if (/FROM vw_Shipment_Tracking WHERE shipment_id = \?/i.test(s)) {
      const id = Number(params[0]);
      return this.vwShipmentTracking()
        .filter(x => x.shipment_id === id)
        .sort((a, b) => a.logged_at.localeCompare(b.logged_at) || a.log_id - b.log_id);
    }

    // 10. Shipment items detail
    if (/FROM Shipment_Items si JOIN Products p ON p\.product_id = si\.product_id WHERE si\.shipment_id = \?/i.test(s)) {
      const id = Number(params[0]);
      const items = this.data.Shipment_Items.filter(si => si.shipment_id === id);
      const res = [];
      for (const item of items) {
        const p = this.data.Products.find(x => x.product_id === item.product_id);
        if (p) {
          res.push({
            product_id: p.product_id,
            sku: p.sku,
            product_name: p.product_name,
            unit_price: Number(p.unit_price),
            quantity_shipped: item.quantity_shipped,
            line_total: item.quantity_shipped * Number(p.unit_price),
          });
        }
      }
      res.sort((a, b) => a.product_name.localeCompare(b.product_name));
      return res;
    }

    // 11. Inventory list (vw_Warehouse_Inventory)
    if (/FROM vw_Warehouse_Inventory/i.test(s)) {
      let list = this.vwWarehouseInventory();
      // Apply filters if present
      let paramIdx = 0;
      if (/warehouse_id = \?/i.test(s)) {
        const whId = Number(params[paramIdx++]);
        list = list.filter(r => r.warehouse_id === whId);
      }
      if (/is_low = 1/i.test(s)) {
        list = list.filter(r => r.is_low === 1);
      }
      if (/\(product_name LIKE \? OR sku LIKE \?\)/i.test(s)) {
        const q1 = String(params[paramIdx++] || '').replace(/%/g, '').toLowerCase();
        const q2 = String(params[paramIdx++] || '').replace(/%/g, '').toLowerCase();
        list = list.filter(r => r.product_name.toLowerCase().includes(q1) || r.sku.toLowerCase().includes(q2));
      }
      list.sort((a, b) => a.warehouse_name.localeCompare(b.warehouse_name) || a.product_name.localeCompare(b.product_name));
      return list.slice(0, 500);
    }

    // 12. Stock Movements
    if (/FROM Stock_Movements m JOIN Products p ON p\.product_id = m\.product_id JOIN Warehouses w ON w\.warehouse_id = m\.warehouse_id/i.test(s)) {
      const limit = Number(params[0] || 30);
      const list = this.data.Stock_Movements.map(m => {
        const p = this.data.Products.find(x => x.product_id === m.product_id);
        const w = this.data.Warehouses.find(x => x.warehouse_id === m.warehouse_id);
        return {
          movement_id: m.movement_id,
          created_at: m.created_at,
          sku: p ? p.sku : '',
          product_name: p ? p.product_name : '',
          warehouse_name: w ? w.warehouse_name : '',
          change_qty: m.change_qty,
          reason: m.reason,
          shipment_id: m.shipment_id,
          note: m.note,
        };
      });
      list.sort((a, b) => b.movement_id - a.movement_id);
      return list.slice(0, limit);
    }

    // 13. Shipments list (vw_Shipment_Details)
    if (/FROM vw_Shipment_Details/i.test(s)) {
      let list = this.vwShipmentDetails();
      let paramIdx = 0;
      if (/current_status = \?/i.test(s)) {
        const st = String(params[paramIdx++]);
        list = list.filter(r => r.current_status === st);
      }
      if (/destination_address LIKE \?/i.test(s)) {
        const q = String(params[paramIdx++] || '').replace(/%/g, '').toLowerCase();
        // skip duplicate params in where clause
        paramIdx += 3;
        list = list.filter(r =>
          String(r.shipment_id).includes(q) ||
          r.destination_address.toLowerCase().includes(q) ||
          r.carrier_name.toLowerCase().includes(q) ||
          r.dispatched_from.toLowerCase().includes(q)
        );
      }
      if (/SELECT COUNT\(\*\) AS n/i.test(s)) {
        return [{ n: list.length }];
      }
      list.sort((a, b) => b.shipment_id - a.shipment_id);
      // check limit & offset
      const limit = Number(params[params.length - 2]);
      const offset = Number(params[params.length - 1]);
      if (!isNaN(limit) && !isNaN(offset)) {
        list = list.slice(offset, offset + limit);
      }
      return list;
    }

    // 14. CRUD Tables (Suppliers, Products, Warehouses, Carriers)
    if (/FROM (Suppliers|Products|Warehouses|Carriers)/i.test(s)) {
      let tableName = 'Suppliers';
      if (/FROM Products/i.test(s)) tableName = 'Products';
      else if (/FROM Warehouses/i.test(s)) tableName = 'Warehouses';
      else if (/FROM Carriers/i.test(s)) tableName = 'Carriers';

      let list;
      if (tableName === 'Warehouses' && /JOIN vw_Warehouse_Utilization/i.test(s)) {
        const util = this.vwWarehouseUtilization();
        list = this.data.Warehouses.map(w => {
          const u = util.find(x => x.warehouse_id === w.warehouse_id);
          return {
            warehouse_id: w.warehouse_id,
            warehouse_name: w.warehouse_name,
            address: w.address,
            max_capacity: w.max_capacity,
            units_stored: u ? u.units_stored : 0,
            utilization_pct: u ? u.utilization_pct : 0,
          };
        });
      } else {
        list = [...this.data[tableName]];
      }

      // Where LIKE search
      if (/WHERE .* LIKE \?/i.test(s)) {
        const q = String(params[0] || '').replace(/%/g, '').toLowerCase();
        list = list.filter(item => {
          return Object.values(item).some(val => val != null && String(val).toLowerCase().includes(q));
        });
      }

      if (/SELECT COUNT\(\*\) AS n/i.test(s)) {
        return [{ n: list.length }];
      }

      // Sort
      if (/ORDER BY w\.warehouse_name/i.test(s)) {
        list.sort((a, b) => a.warehouse_name.localeCompare(b.warehouse_name));
      } else if (/ORDER BY company_name/i.test(s)) {
        list.sort((a, b) => a.company_name.localeCompare(b.company_name));
      } else if (/ORDER BY product_name/i.test(s)) {
        list.sort((a, b) => a.product_name.localeCompare(b.product_name));
      } else if (/ORDER BY carrier_name/i.test(s)) {
        list.sort((a, b) => a.carrier_name.localeCompare(b.carrier_name));
      }

      // Limit & Offset
      const limit = Number(params[params.length - 2]);
      const offset = Number(params[params.length - 1]);
      if (!isNaN(limit) && !isNaN(offset)) {
        list = list.slice(offset, offset + limit);
      }
      return list;
    }

    console.warn('[EmbeddedDB] Unhandled SELECT query:', sql, params);
    return [];
  }

  async call(sql, params = []) {
    const s = sql.trim();
    if (/CALL sp_adjust_stock/i.test(s)) {
      return this.spAdjustStock(...params);
    }
    if (/CALL sp_create_shipment/i.test(s)) {
      return this.spCreateShipment(...params);
    }
    if (/CALL sp_set_shipment_status/i.test(s)) {
      return this.spSetShipmentStatus(...params);
    }
    if (/CALL sp_add_log/i.test(s)) {
      return this.spAddLog(...params);
    }
    console.warn('[EmbeddedDB] Unhandled CALL procedure:', sql, params);
    return [];
  }

  async exec(sql, params = []) {
    const s = sql.trim().replace(/\s+/g, ' ');

    // 1. Supplier_Product insert / delete
    if (/INSERT IGNORE INTO Supplier_Product/i.test(s)) {
      const [supplier_id, product_id] = params.map(Number);
      const exists = this.data.Supplier_Product.some(x => x.supplier_id === supplier_id && x.product_id === product_id);
      if (!exists) {
        this.data.Supplier_Product.push({ supplier_id, product_id });
        this.saveData();
      }
      return { affectedRows: 1 };
    }
    if (/DELETE FROM Supplier_Product WHERE supplier_id=\? AND product_id=\?/i.test(s)) {
      const [supplier_id, product_id] = params.map(Number);
      const before = this.data.Supplier_Product.length;
      this.data.Supplier_Product = this.data.Supplier_Product.filter(x => !(x.supplier_id === supplier_id && x.product_id === product_id));
      this.saveData();
      return { affectedRows: before - this.data.Supplier_Product.length };
    }

    // 2. Inventory_Levels reorder_threshold update
    if (/UPDATE Inventory_Levels SET reorder_threshold=\? WHERE product_id=\? AND warehouse_id=\?/i.test(s)) {
      const [thresh, pid, wid] = params.map(Number);
      const row = this.data.Inventory_Levels.find(i => i.product_id === pid && i.warehouse_id === wid);
      if (row) {
        row.reorder_threshold = thresh;
        this.saveData();
        return { affectedRows: 1 };
      }
      return { affectedRows: 0 };
    }

    // 3. Delete Shipment
    if (/DELETE FROM Shipments WHERE shipment_id = \?/i.test(s)) {
      const id = Number(params[0]);
      const sh = this.data.Shipments.find(x => x.shipment_id === id);
      if (!sh) return { affectedRows: 0 };
      if (sh.current_status !== 'Pending' && sh.current_status !== 'Cancelled') {
        throw new SqlError('45000', 'NOT_ALLOWED: only Pending or Cancelled shipments can be deleted');
      }
      this.data.Shipments = this.data.Shipments.filter(x => x.shipment_id !== id);
      this.data.Shipment_Items = this.data.Shipment_Items.filter(x => x.shipment_id !== id);
      this.data.Shipment_Logs = this.data.Shipment_Logs.filter(x => x.shipment_id !== id);
      this.saveData();
      return { affectedRows: 1 };
    }

    // 4. CRUD INSERTS
    if (/INSERT INTO (\w+)/i.test(s)) {
      const table = s.match(/INSERT INTO (\w+)/i)[1];
      const cols = s.match(/\((.*?)\)\s+VALUES/i)[1].split(',').map(c => c.trim());
      const row = {};
      cols.forEach((col, idx) => { row[col] = params[idx]; });

      if (table === 'Products') {
        if (this.data.Products.some(p => p.sku === row.sku)) {
          throw new SqlError('23000', 'Duplicate entry for SKU', 1062);
        }
        const newId = this.data.Products.length > 0 ? Math.max(...this.data.Products.map(p => p.product_id)) + 1 : 101;
        row.product_id = newId;
        this.data.Products.push(row);
        this.saveData();
        return { insertId: newId, affectedRows: 1 };
      }

      if (table === 'Suppliers') {
        if (row.contact_email && this.data.Suppliers.some(p => p.contact_email === row.contact_email)) {
          throw new SqlError('23000', 'Duplicate entry for email', 1062);
        }
        const newId = this.data.Suppliers.length > 0 ? Math.max(...this.data.Suppliers.map(p => p.supplier_id)) + 1 : 1;
        row.supplier_id = newId;
        this.data.Suppliers.push(row);
        this.saveData();
        return { insertId: newId, affectedRows: 1 };
      }

      if (table === 'Warehouses') {
        const newId = this.data.Warehouses.length > 0 ? Math.max(...this.data.Warehouses.map(p => p.warehouse_id)) + 1 : 201;
        row.warehouse_id = newId;
        this.data.Warehouses.push(row);
        this.saveData();
        return { insertId: newId, affectedRows: 1 };
      }

      if (table === 'Carriers') {
        const newId = this.data.Carriers.length > 0 ? Math.max(...this.data.Carriers.map(p => p.carrier_id)) + 1 : 301;
        row.carrier_id = newId;
        this.data.Carriers.push(row);
        this.saveData();
        return { insertId: newId, affectedRows: 1 };
      }
    }

    // 5. CRUD UPDATES
    if (/UPDATE (\w+) SET (.*) WHERE (\w+)=\?/i.test(s)) {
      const [, table, setClause, idCol] = s.match(/UPDATE (\w+) SET (.*) WHERE (\w+)=\?/i);
      const cols = setClause.split(',').map(c => c.split('=')[0].trim());
      const targetId = Number(params[params.length - 1]);
      const list = this.data[table];
      const target = list?.find(x => x[idCol] === targetId);
      if (!target) return { affectedRows: 0 };

      cols.forEach((col, idx) => {
        target[col] = params[idx];
      });
      this.saveData();
      return { affectedRows: 1 };
    }

    // 6. CRUD DELETES
    if (/DELETE FROM (\w+) WHERE (\w+)=\?/i.test(s)) {
      const [, table, idCol] = s.match(/DELETE FROM (\w+) WHERE (\w+)=\?/i);
      const targetId = Number(params[0]);

      // Check foreign key references
      if (table === 'Products') {
        if (this.data.Shipment_Items.some(si => si.product_id === targetId)) {
          throw new SqlError('23000', 'Product is used in shipment items', 1451);
        }
        this.data.Inventory_Levels = this.data.Inventory_Levels.filter(x => x.product_id !== targetId);
        this.data.Supplier_Product = this.data.Supplier_Product.filter(x => x.product_id !== targetId);
      } else if (table === 'Suppliers') {
        this.data.Supplier_Product = this.data.Supplier_Product.filter(x => x.supplier_id !== targetId);
      } else if (table === 'Warehouses') {
        if (this.data.Shipments.some(s => s.warehouse_id === targetId)) {
          throw new SqlError('23000', 'Warehouse has existing shipments', 1451);
        }
        if (this.data.Inventory_Levels.some(i => i.warehouse_id === targetId && i.quantity_on_hand > 0)) {
          throw new SqlError('23000', 'Warehouse has existing stock', 1451);
        }
      } else if (table === 'Carriers') {
        if (this.data.Shipments.some(s => s.carrier_id === targetId)) {
          throw new SqlError('23000', 'Carrier is assigned to shipments', 1451);
        }
      }

      const before = this.data[table].length;
      this.data[table] = this.data[table].filter(x => x[idCol] !== targetId);
      this.saveData();
      return { affectedRows: before - this.data[table].length };
    }

    console.warn('[EmbeddedDB] Unhandled EXEC statement:', sql, params);
    return { affectedRows: 0 };
  }
}

export const embeddedDb = new EmbeddedDatabase();
