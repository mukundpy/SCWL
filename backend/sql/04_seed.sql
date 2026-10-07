-- =====================================================
-- 04 SEED DATA  (your original data, same ids)
-- =====================================================
USE supply_chain;

INSERT INTO Suppliers (supplier_id, company_name, contact_email, phone) VALUES
(1, 'Tata Components Ltd', 'sales@tatacomp.com', '9876500001'),
(2, 'Reliance Industrial Supplies', 'orders@relindustrial.com', '9876500002'),
(3, 'Bharat Electronics Traders', 'contact@bharatelec.com', '9876500003'),
(4, 'Mahindra Packaging Co', 'info@mahindrapack.com', '9876500004');

INSERT INTO Products (product_id, sku, product_name, unit_price) VALUES
(101, 'SKU-LPT-001', 'Laptop 14 inch', 45000.00),
(102, 'SKU-MOB-002', 'Smartphone X', 22000.00),
(103, 'SKU-HDP-003', 'Wireless Headphones', 3500.00),
(104, 'SKU-KBD-004', 'Mechanical Keyboard', 2800.00);

INSERT INTO Warehouses (warehouse_id, warehouse_name, address, max_capacity) VALUES
(201, 'Mumbai Central Hub', 'Bhiwandi, Maharashtra', 10000),
(202, 'Delhi North Depot', 'Narela, Delhi', 8000),
(203, 'Bangalore Fulfilment Center', 'Hoskote, Karnataka', 6000),
(204, 'Pune Distribution Yard', 'Chakan, Maharashtra', 5000);

INSERT INTO Carriers (carrier_id, carrier_name, vehicle_type) VALUES
(301, 'BlueDart Logistics', 'Truck'),
(302, 'Delhivery Express', 'Mini Van'),
(303, 'Gati Cargo', 'Container Truck'),
(304, 'DTDC Freight', 'Cargo Van');

INSERT INTO Supplier_Product (supplier_id, product_id) VALUES
(1, 101), (1, 104), (2, 102), (3, 102), (3, 103), (4, 103);

INSERT INTO Inventory_Levels (product_id, warehouse_id, quantity_on_hand, reorder_threshold) VALUES
(101, 201, 500, 100), (102, 201, 80, 100), (103, 202, 1200, 300),
(104, 203, 40, 50),   (101, 204, 250, 75), (102, 202, 600, 150);

-- opening balance so the movement ledger matches current stock
INSERT INTO Stock_Movements (product_id, warehouse_id, change_qty, reason, note, created_at)
SELECT product_id, warehouse_id, quantity_on_hand, 'RECEIPT', 'Opening balance', '2026-09-01 09:00:00'
  FROM Inventory_Levels;

INSERT INTO Shipments (shipment_id, destination_address, current_status, warehouse_id, carrier_id,
                       created_at, dispatched_at, delivered_at) VALUES
(401, 'Andheri East, Mumbai',        'Delivered',  201, 301, '2026-09-24 17:00:00', '2026-09-25 09:00:00', '2026-09-26 11:00:00'),
(402, 'Connaught Place, New Delhi',  'In Transit', 202, 302, '2026-10-04 16:00:00', '2026-10-05 08:00:00', NULL),
(403, 'Koramangala, Bangalore',      'In Transit', 203, 303, '2026-10-05 15:00:00', '2026-10-06 07:30:00', NULL),
(404, 'Hinjewadi, Pune',             'Pending',    204, 304, '2026-10-07 06:00:00', NULL, NULL);

INSERT INTO Shipment_Items (shipment_id, product_id, quantity_shipped) VALUES
(401, 101, 20), (401, 102, 15), (402, 103, 100), (403, 104, 30), (404, 101, 10);

INSERT INTO Shipment_Logs (log_id, shipment_id, logged_at, checkpoint_location, status_update) VALUES
(1, 401, '2026-09-25 09:00:00', 'Mumbai Central Hub', 'Dispatched'),
(2, 401, '2026-09-25 14:30:00', 'Thane Checkpoint', 'In Transit'),
(3, 401, '2026-09-26 11:00:00', 'Andheri East', 'Delivered'),
(1, 402, '2026-10-05 08:00:00', 'Delhi North Depot', 'Dispatched'),
(2, 402, '2026-10-06 10:15:00', 'Gurugram Hub', 'In Transit'),
(1, 403, '2026-10-06 07:30:00', 'Bangalore Fulfilment Center', 'Dispatched'),
(2, 403, '2026-10-07 09:45:00', 'Electronic City Checkpoint', 'In Transit'),
(1, 404, '2026-10-07 06:00:00', 'Pune Distribution Yard', 'Order Received');
