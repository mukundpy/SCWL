-- =====================================================
-- 03 TRIGGERS + STORED PROCEDURES  (all business rules live in the DB)
-- Errors raised with SQLSTATE 45000 use the message format  "CODE: text"
-- =====================================================
USE supply_chain;
DROP TRIGGER   IF EXISTS trg_inv_capacity_ins;
DROP TRIGGER   IF EXISTS trg_inv_capacity_upd;
DROP TRIGGER   IF EXISTS trg_shipment_before_delete;
DROP PROCEDURE IF EXISTS sp_adjust_stock;
DROP PROCEDURE IF EXISTS sp_log_internal;
DROP PROCEDURE IF EXISTS sp_add_log;
DROP PROCEDURE IF EXISTS sp_create_shipment;
DROP PROCEDURE IF EXISTS sp_set_shipment_status;

DELIMITER $$

-- Rule: total stock in a warehouse can never exceed max_capacity
CREATE TRIGGER trg_inv_capacity_ins BEFORE INSERT ON Inventory_Levels
FOR EACH ROW
BEGIN
    DECLARE v_cap INT;
    DECLARE v_other BIGINT;
    SELECT max_capacity INTO v_cap FROM Warehouses WHERE warehouse_id = NEW.warehouse_id;
    SELECT COALESCE(SUM(quantity_on_hand), 0) INTO v_other
      FROM Inventory_Levels WHERE warehouse_id = NEW.warehouse_id AND product_id <> NEW.product_id;
    IF v_other + NEW.quantity_on_hand > v_cap THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'CAPACITY_EXCEEDED: warehouse capacity would be exceeded';
    END IF;
END$$

CREATE TRIGGER trg_inv_capacity_upd BEFORE UPDATE ON Inventory_Levels
FOR EACH ROW
BEGIN
    DECLARE v_cap INT;
    DECLARE v_other BIGINT;
    IF NEW.quantity_on_hand > OLD.quantity_on_hand THEN
        SELECT max_capacity INTO v_cap FROM Warehouses WHERE warehouse_id = NEW.warehouse_id;
        SELECT COALESCE(SUM(quantity_on_hand), 0) INTO v_other
          FROM Inventory_Levels WHERE warehouse_id = NEW.warehouse_id AND product_id <> NEW.product_id;
        IF v_other + NEW.quantity_on_hand > v_cap THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'CAPACITY_EXCEEDED: warehouse capacity would be exceeded';
        END IF;
    END IF;
END$$

-- Rule: only Pending or Cancelled shipments may be deleted
CREATE TRIGGER trg_shipment_before_delete BEFORE DELETE ON Shipments
FOR EACH ROW
BEGIN
    IF OLD.current_status NOT IN ('Pending', 'Cancelled') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'NOT_ALLOWED: only Pending or Cancelled shipments can be deleted';
    END IF;
END$$

-- Receive stock / manual adjustment (positive or negative). Creates the row if needed.
CREATE PROCEDURE sp_adjust_stock(
    IN p_product INT, IN p_wh INT, IN p_delta INT, IN p_reason VARCHAR(20), IN p_note VARCHAR(200))
BEGIN
    DECLARE v_qty INT;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

    IF p_delta = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'INVALID: change must not be zero';
    END IF;
    IF p_reason NOT IN ('RECEIPT', 'ADJUSTMENT') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'INVALID: reason must be RECEIPT or ADJUSTMENT';
    END IF;

    START TRANSACTION;
    INSERT INTO Inventory_Levels (product_id, warehouse_id, quantity_on_hand, reorder_threshold)
    VALUES (p_product, p_wh, 0, 0)
    ON DUPLICATE KEY UPDATE product_id = product_id;

    SELECT quantity_on_hand INTO v_qty FROM Inventory_Levels
     WHERE product_id = p_product AND warehouse_id = p_wh FOR UPDATE;

    IF v_qty + p_delta < 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'INSUFFICIENT_STOCK: not enough stock to remove that quantity';
    END IF;

    UPDATE Inventory_Levels SET quantity_on_hand = quantity_on_hand + p_delta
     WHERE product_id = p_product AND warehouse_id = p_wh;
    INSERT INTO Stock_Movements (product_id, warehouse_id, change_qty, reason, note)
    VALUES (p_product, p_wh, p_delta, p_reason, p_note);
    COMMIT;

    SELECT quantity_on_hand FROM Inventory_Levels WHERE product_id = p_product AND warehouse_id = p_wh;
END$$

-- Internal helper: append a tracking log. Caller must already hold the shipment row lock.
CREATE PROCEDURE sp_log_internal(IN p_shipment INT, IN p_location VARCHAR(100), IN p_text VARCHAR(100))
BEGIN
    DECLARE v_next INT;
    SELECT COALESCE(MAX(log_id), 0) + 1 INTO v_next FROM Shipment_Logs WHERE shipment_id = p_shipment;
    INSERT INTO Shipment_Logs (log_id, shipment_id, logged_at, checkpoint_location, status_update)
    VALUES (v_next, p_shipment, NOW(), p_location, p_text);
END$$

-- Public: add a checkpoint to a shipment's tracking history
CREATE PROCEDURE sp_add_log(IN p_shipment INT, IN p_location VARCHAR(100), IN p_text VARCHAR(100))
BEGIN
    DECLARE v_status VARCHAR(20);
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
    START TRANSACTION;
    SELECT current_status INTO v_status FROM Shipments WHERE shipment_id = p_shipment FOR UPDATE;
    IF v_status IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'NOT_FOUND: shipment does not exist';
    END IF;
    IF v_status IN ('Delivered', 'Cancelled') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'NOT_ALLOWED: shipment is closed';
    END IF;
    CALL sp_log_internal(p_shipment, p_location, p_text);
    COMMIT;
END$$

-- Create a Pending shipment with its items in one atomic step.
-- p_items: JSON array like [{"product_id":101,"quantity_shipped":20}, ...]
CREATE PROCEDURE sp_create_shipment(
    IN p_wh INT, IN p_carrier INT, IN p_dest VARCHAR(200), IN p_items JSON)
BEGIN
    DECLARE v_id INT;
    DECLARE v_wname VARCHAR(100);
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

    IF p_items IS NULL OR JSON_LENGTH(p_items) = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'INVALID: a shipment needs at least one item';
    END IF;

    START TRANSACTION;
    INSERT INTO Shipments (destination_address, warehouse_id, carrier_id)
    VALUES (p_dest, p_wh, p_carrier);
    SET v_id = LAST_INSERT_ID();

    INSERT INTO Shipment_Items (shipment_id, product_id, quantity_shipped)
    SELECT v_id, jt.product_id, jt.qty
      FROM JSON_TABLE(p_items, '$[*]' COLUMNS (
            product_id INT PATH '$.product_id',
            qty        INT PATH '$.quantity_shipped')) AS jt;

    SELECT warehouse_name INTO v_wname FROM Warehouses WHERE warehouse_id = p_wh;
    CALL sp_log_internal(v_id, v_wname, 'Order Received');
    COMMIT;

    SELECT v_id AS shipment_id;
END$$

-- Move a shipment through its lifecycle. Handles stock, timestamps and the tracking log.
--   Pending -> Dispatched (stock deducted) | Cancelled
--   Dispatched -> In Transit | Cancelled (stock returned)
--   In Transit -> Delivered
CREATE PROCEDURE sp_set_shipment_status(IN p_id INT, IN p_new VARCHAR(20), IN p_location VARCHAR(100))
BEGIN
    DECLARE v_status VARCHAR(20);
    DECLARE v_wh INT;
    DECLARE v_wname VARCHAR(100);
    DECLARE v_dest VARCHAR(200);
    DECLARE v_short INT DEFAULT 0;
    DECLARE v_loc VARCHAR(100);
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

    START TRANSACTION;
    SELECT s.current_status, s.warehouse_id, w.warehouse_name, s.destination_address
      INTO v_status, v_wh, v_wname, v_dest
      FROM Shipments s JOIN Warehouses w ON w.warehouse_id = s.warehouse_id
     WHERE s.shipment_id = p_id FOR UPDATE;

    IF v_status IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'NOT_FOUND: shipment does not exist';
    END IF;

    IF NOT ( (v_status = 'Pending'    AND p_new IN ('Dispatched', 'Cancelled'))
          OR (v_status = 'Dispatched' AND p_new IN ('In Transit', 'Cancelled'))
          OR (v_status = 'In Transit' AND p_new = 'Delivered') ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'INVALID_STATUS_TRANSITION: that status change is not allowed';
    END IF;

    IF p_new = 'Dispatched' THEN
        -- lock the stock rows and make sure every line can be fulfilled
        SELECT COUNT(*) INTO v_short
          FROM Shipment_Items si
          LEFT JOIN Inventory_Levels il ON il.product_id = si.product_id AND il.warehouse_id = v_wh
         WHERE si.shipment_id = p_id
           AND (il.quantity_on_hand IS NULL OR il.quantity_on_hand < si.quantity_shipped)
        FOR UPDATE;
        IF v_short > 0 THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'INSUFFICIENT_STOCK: not enough stock in this warehouse for one or more items';
        END IF;

        UPDATE Inventory_Levels il
          JOIN Shipment_Items si ON si.product_id = il.product_id AND si.shipment_id = p_id
           SET il.quantity_on_hand = il.quantity_on_hand - si.quantity_shipped
         WHERE il.warehouse_id = v_wh;
        INSERT INTO Stock_Movements (product_id, warehouse_id, change_qty, reason, shipment_id, note)
        SELECT si.product_id, v_wh, -si.quantity_shipped, 'DISPATCH', p_id, CONCAT('Shipment #', p_id)
          FROM Shipment_Items si WHERE si.shipment_id = p_id;
        UPDATE Shipments SET dispatched_at = NOW() WHERE shipment_id = p_id;

    ELSEIF p_new = 'Cancelled' AND v_status = 'Dispatched' THEN
        UPDATE Inventory_Levels il
          JOIN Shipment_Items si ON si.product_id = il.product_id AND si.shipment_id = p_id
           SET il.quantity_on_hand = il.quantity_on_hand + si.quantity_shipped
         WHERE il.warehouse_id = v_wh;
        INSERT INTO Stock_Movements (product_id, warehouse_id, change_qty, reason, shipment_id, note)
        SELECT si.product_id, v_wh, si.quantity_shipped, 'RETURN', p_id, CONCAT('Shipment #', p_id, ' cancelled')
          FROM Shipment_Items si WHERE si.shipment_id = p_id;

    ELSEIF p_new = 'Delivered' THEN
        UPDATE Shipments SET delivered_at = NOW() WHERE shipment_id = p_id;
    END IF;

    UPDATE Shipments SET current_status = p_new WHERE shipment_id = p_id;

    SET v_loc = COALESCE(NULLIF(TRIM(p_location), ''),
        CASE p_new WHEN 'Delivered' THEN v_dest WHEN 'In Transit' THEN 'In transit' ELSE v_wname END);
    CALL sp_log_internal(p_id, v_loc, p_new);
    COMMIT;

    SELECT p_new AS current_status;
END$$

DELIMITER ;
