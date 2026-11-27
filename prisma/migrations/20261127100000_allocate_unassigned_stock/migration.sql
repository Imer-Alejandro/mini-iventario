INSERT INTO inventory_movements (
  id,
  product_id,
  to_location_id,
  type,
  quantity,
  reference_type,
  reference_id,
  reason,
  user_id
)
SELECT
  'opening-stock-' || product.id,
  product.id,
  'loc-003',
  'ENTRADA',
  product.current_stock,
  'OPENING_BALANCE',
  product.id,
  'Asignación del stock existente sin ubicación al mostrador.',
  'system'
FROM products AS product
JOIN locations AS location
  ON location.id = 'loc-003'
  AND location.status = 'ACTIVE'
WHERE product.current_stock > 0
  AND NOT EXISTS (
    SELECT 1
    FROM stock_by_location AS stock
    WHERE stock.product_id = product.id
  );

INSERT INTO stock_by_location (product_id, location_id, quantity)
SELECT product.id, 'loc-003', product.current_stock
FROM products AS product
JOIN locations AS location
  ON location.id = 'loc-003'
  AND location.status = 'ACTIVE'
WHERE product.current_stock > 0
  AND NOT EXISTS (
    SELECT 1
    FROM stock_by_location AS stock
    WHERE stock.product_id = product.id
  );
