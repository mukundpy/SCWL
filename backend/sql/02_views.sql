-- =====================================================
-- 02 VIEWS  (the original five, extended with ids the UI needs)
-- =====================================================
USE supply_chain;

CREATE OR REPLACE VIEW vw_Warehouse_Inventory AS
SELECT w.warehouse_id, w.warehouse_name, p.product_id, p.sku, p.product_name,
       i.quantity_on_hand, i.reorder_threshold,
       (i.quantity_on_hand <= i.reorder_threshold) AS is_low
FROM Inventory_Levels i
JOIN Warehouses w ON i.warehouse_id = w.warehouse_id
JOIN Products   p ON i.product_id   = p.product_id;

CREATE OR REPLACE VIEW vw_Low_Stock_Alerts AS
SELECT w.warehouse_id, w.warehouse_name, p.product_id, p.sku, p.product_name,
       i.quantity_on_hand, i.reorder_threshold
FROM Inventory_Levels i
JOIN Warehouses w ON i.warehouse_id = w.warehouse_id
JOIN Products   p ON i.product_id   = p.product_id
WHERE i.quantity_on_hand <= i.reorder_threshold;

CREATE OR REPLACE VIEW vw_Shipment_Details AS
SELECT s.shipment_id, w.warehouse_id, w.warehouse_name AS dispatched_from,
       c.carrier_id, c.carrier_name, c.vehicle_type,
       s.destination_address, s.current_status,
       s.created_at, s.dispatched_at, s.delivered_at,
       COALESCE(t.item_count, 0)  AS item_count,
       COALESCE(t.total_units, 0) AS total_units,
       COALESCE(t.total_value, 0) AS total_value
FROM Shipments s
JOIN Warehouses w ON s.warehouse_id = w.warehouse_id
JOIN Carriers   c ON s.carrier_id   = c.carrier_id
LEFT JOIN (
    SELECT si.shipment_id,
           COUNT(*)                              AS item_count,
           SUM(si.quantity_shipped)              AS total_units,
           SUM(si.quantity_shipped * p.unit_price) AS total_value
    FROM Shipment_Items si JOIN Products p ON p.product_id = si.product_id
    GROUP BY si.shipment_id
) t ON t.shipment_id = s.shipment_id;

CREATE OR REPLACE VIEW vw_Shipment_Tracking AS
SELECT s.shipment_id, l.log_id, l.logged_at, l.checkpoint_location, l.status_update
FROM Shipments s
JOIN Shipment_Logs l ON s.shipment_id = l.shipment_id;

CREATE OR REPLACE VIEW vw_Supplier_Catalog AS
SELECT s.supplier_id, s.company_name, p.product_id, p.sku, p.product_name, p.unit_price
FROM Suppliers s
JOIN Supplier_Product sp ON s.supplier_id = sp.supplier_id
JOIN Products p          ON sp.product_id = p.product_id;

-- New: how full is each warehouse
CREATE OR REPLACE VIEW vw_Warehouse_Utilization AS
SELECT w.warehouse_id, w.warehouse_name, w.max_capacity,
       COALESCE(SUM(i.quantity_on_hand), 0) AS units_stored,
       ROUND(COALESCE(SUM(i.quantity_on_hand), 0) / w.max_capacity * 100, 1) AS utilization_pct
FROM Warehouses w
LEFT JOIN Inventory_Levels i ON i.warehouse_id = w.warehouse_id
GROUP BY w.warehouse_id, w.warehouse_name, w.max_capacity;
