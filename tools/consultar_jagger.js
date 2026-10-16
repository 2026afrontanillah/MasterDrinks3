'use strict';
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('pos_evento.db');

console.log('=== PRODUCTOS JAGGER / MEISTER ===');
const prods = db.prepare(`
  SELECT id_producto, nombre, stock_actual, id_botella_vinculada, vasos_por_botella, precio_venta, activo
  FROM producto
  WHERE LOWER(nombre) LIKE '%jagger%' OR LOWER(nombre) LIKE '%meister%'
`).all();
console.table(prods);

console.log('\n=== TABLAS DE PROMOCIÓN ===');
const promoTables = db.prepare(`
  SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%promo%'
`).all();
console.log(promoTables);

for (const t of promoTables) {
  console.log(`\nContenido de ${t.name}:`);
  console.log(db.prepare(`SELECT * FROM ${t.name}`).all());
}

console.log('\n=== MOVIMIENTOS DE STOCK (JAGGER) ===');
const movs = db.prepare(`
  SELECT ms.id_movimiento, ms.id_producto, p.nombre, ms.tipo_movimiento,
         ms.cantidad, ms.stock_anterior, ms.stock_nuevo, ms.motivo, ms.fecha_hora
  FROM movimiento_stock ms
  JOIN producto p ON ms.id_producto = p.id_producto
  WHERE LOWER(p.nombre) LIKE '%jagger%' OR LOWER(p.nombre) LIKE '%meister%'
  ORDER BY ms.id_movimiento DESC
  LIMIT 15
`).all();
console.table(movs);

console.log('\n=== ÚLTIMAS COMANDAS ===');
const comandas = db.prepare(`
  SELECT c.id_comanda, c.fecha_hora, c.total, c.estado_pago,
         dc.cantidad, pr.nombre AS producto, dc.id_promocion
  FROM comanda c
  JOIN detalle_comanda dc ON c.id_comanda = dc.id_comanda
  JOIN producto pr ON dc.id_producto = pr.id_producto
  WHERE LOWER(pr.nombre) LIKE '%jagger%' OR LOWER(pr.nombre) LIKE '%meister%'
  ORDER BY c.id_comanda DESC
  LIMIT 10
`).all();
console.table(comandas);
