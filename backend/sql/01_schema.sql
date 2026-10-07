-- =====================================================
-- Supply Chain & Warehouse Logistics  |  01 SCHEMA
-- Original design by: Mukund Chaurasiya (2025300040),
--   Ishan Desai (2025300046), Hetansh Dhoria (2025300055)
-- Changes vs. original: AUTO_INCREMENT keys, ENUM status,
--   shipment timestamps, Stock_Movements audit table, indexes.
-- =====================================================
DROP DATABASE IF EXISTS supply_chain;
CREATE DATABASE supply_chain CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE supply_chain;

CREATE TABLE Suppliers (
    supplier_id   INT AUTO_INCREMENT PRIMARY KEY,
    company_name  VARCHAR(100) NOT NULL,
    contact_email VARCHAR(100) UNIQUE,
    phone         VARCHAR(20)
);

CREATE TABLE Products (
    product_id   INT AUTO_INCREMENT PRIMARY KEY,
    sku          VARCHAR(30)  NOT NULL UNIQUE,
    product_name VARCHAR(100) NOT NULL,
    unit_price   DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0)
);

CREATE TABLE Warehouses (
    warehouse_id   INT AUTO_INCREMENT PRIMARY KEY,
    warehouse_name VARCHAR(100) NOT NULL,
    address        VARCHAR(200),
    max_capacity   INT NOT NULL CHECK (max_capacity > 0)
);

CREATE TABLE Carriers (
    carrier_id   INT AUTO_INCREMENT PRIMARY KEY,
    carrier_name VARCHAR(100) NOT NULL,
    vehicle_type VARCHAR(50)
);

-- Suppliers <-> Products (many-to-many)
CREATE TABLE Supplier_Product (
    supplier_id INT,
    product_id  INT,
    PRIMARY KEY (supplier_id, product_id),
    FOREIGN KEY (supplier_id) REFERENCES Suppliers(supplier_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id)  REFERENCES Products(product_id)  ON DELETE CASCADE
);

-- Weak entity: Products x Warehouses
CREATE TABLE Inventory_Levels (
    product_id        INT,
    warehouse_id      INT,
    quantity_on_hand  INT NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
    reorder_threshold INT NOT NULL DEFAULT 0 CHECK (reorder_threshold >= 0),
    PRIMARY KEY (product_id, warehouse_id),
    FOREIGN KEY (product_id)   REFERENCES Products(product_id)     ON DELETE CASCADE,
    FOREIGN KEY (warehouse_id) REFERENCES Warehouses(warehouse_id) ON DELETE CASCADE
);

CREATE TABLE Shipments (
    shipment_id         INT AUTO_INCREMENT PRIMARY KEY,
    destination_address VARCHAR(200) NOT NULL,
    current_status      ENUM('Pending','Dispatched','In Transit','Delivered','Cancelled')
                        NOT NULL DEFAULT 'Pending',
    warehouse_id        INT NOT NULL,
    carrier_id          INT NOT NULL,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    dispatched_at       DATETIME NULL,
    delivered_at        DATETIME NULL,
    FOREIGN KEY (warehouse_id) REFERENCES Warehouses(warehouse_id),
    FOREIGN KEY (carrier_id)   REFERENCES Carriers(carrier_id),
    INDEX idx_ship_status (current_status),
    INDEX idx_ship_wh (warehouse_id),
    INDEX idx_ship_carrier (carrier_id)
);

-- Weak entity: Shipments x Products
CREATE TABLE Shipment_Items (
    shipment_id      INT,
    product_id       INT,
    quantity_shipped INT NOT NULL CHECK (quantity_shipped > 0),
    PRIMARY KEY (shipment_id, product_id),
    FOREIGN KEY (shipment_id) REFERENCES Shipments(shipment_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id)  REFERENCES Products(product_id)
);

-- Weak entity: log_id is the partial key (unique within a shipment)
CREATE TABLE Shipment_Logs (
    log_id              INT,
    shipment_id         INT,
    logged_at           DATETIME NOT NULL,
    checkpoint_location VARCHAR(100),
    status_update       VARCHAR(100),
    PRIMARY KEY (shipment_id, log_id),
    FOREIGN KEY (shipment_id) REFERENCES Shipments(shipment_id) ON DELETE CASCADE,
    INDEX idx_log_time (shipment_id, logged_at)
);

-- Audit trail: every change to stock is recorded here
CREATE TABLE Stock_Movements (
    movement_id  BIGINT AUTO_INCREMENT PRIMARY KEY,
    product_id   INT NOT NULL,
    warehouse_id INT NOT NULL,
    change_qty   INT NOT NULL,
    reason       ENUM('RECEIPT','ADJUSTMENT','DISPATCH','RETURN') NOT NULL,
    shipment_id  INT NULL,
    note         VARCHAR(200),
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id)   REFERENCES Products(product_id)     ON DELETE CASCADE,
    FOREIGN KEY (warehouse_id) REFERENCES Warehouses(warehouse_id) ON DELETE CASCADE,
    FOREIGN KEY (shipment_id)  REFERENCES Shipments(shipment_id)   ON DELETE SET NULL,
    INDEX idx_mov_time (created_at),
    INDEX idx_mov_pw (product_id, warehouse_id)
);
