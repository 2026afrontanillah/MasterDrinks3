'use strict';

const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const BASE = path.join(__dirname, '..', 'pos_evento.db');
const carpetaRespaldos = path.join(__dirname, '..', 'respaldos');

if (!fs.existsSync(BASE)) {
  console.error('❌ No se encontró la base de datos:', BASE);
  process.exit(1);
}

// 1. Crear respaldo previo de seguridad
if (!fs.existsSync(carpetaRespaldos)) {
  fs.mkdirSync(carpetaRespaldos, { recursive: true });
}
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const archivoRespaldo = path.join(carpetaRespaldos, `pos_evento_backup_${timestamp}.db`);

const db = new DatabaseSync(BASE);

try {
  db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  db.exec(`VACUUM INTO '${archivoRespaldo.replace(/'/g, "''")}';`);
  console.log('📦 Respaldo previo creado exitosamente en:');
  console.log('   ' + archivoRespaldo);
} catch (err) {
  try {
    fs.copyFileSync(BASE, archivoRespaldo);
    console.log('📦 Respaldo previo creado vía copia directa en:');
    console.log('   ' + archivoRespaldo);
  } catch (errCopia) {
    console.warn('⚠️ Advertencia sobre respaldo:', errCopia.message);
  }
}

// 2. Conteo previo
console.log('\n--- ESTADO PREVIO ---');
const antes = {
  comandas: db.prepare('SELECT COUNT(*) c FROM comanda').get().c,
  detalles: db.prepare('SELECT COUNT(*) c FROM detalle_comanda').get().c,
  pagos: db.prepare('SELECT COUNT(*) c FROM pago_comanda').get().c,
  impresionesCajero: db.prepare('SELECT COUNT(*) c FROM impresion_comanda_cajero').get().c,
  impresionesMesero: db.prepare('SELECT COUNT(*) c FROM impresion_comanda_mesero').get().c,
  auditoria: db.prepare('SELECT COUNT(*) c FROM auditoria_admin').get().c,
  movimientos: db.prepare('SELECT COUNT(*) c FROM movimiento_stock').get().c,
  traspasos: db.prepare('SELECT COUNT(*) c FROM traspaso').get().c,
  traspasosDetalle: db.prepare('SELECT COUNT(*) c FROM traspaso_detalle').get().c,
  productos: db.prepare('SELECT COUNT(*) c FROM producto').get().c,
  categorias: db.prepare('SELECT COUNT(*) c FROM categoria_producto').get().c,
  promociones: db.prepare('SELECT COUNT(*) c FROM promocion').get().c,
  admins: db.prepare('SELECT COUNT(*) c FROM administrador_evento').get().c,
  cajeros: db.prepare('SELECT COUNT(*) c FROM cajero').get().c,
  meseros: db.prepare('SELECT COUNT(*) c FROM mesero').get().c
};
console.table(antes);

// 3. Ejecutar limpieza dentro de una transacción
db.exec('PRAGMA foreign_keys = OFF;');
db.exec('BEGIN IMMEDIATE;');

try {
  // A. Eliminar comandas y registros asociados
  db.exec('DELETE FROM impresion_comanda_cajero;');
  db.exec('DELETE FROM impresion_comanda_mesero;');
  db.exec('DELETE FROM pago_comanda;');
  db.exec('DELETE FROM detalle_comanda;');
  db.exec('DELETE FROM comanda;');
  console.log('✔ Comandas, detalles, pagos e impresiones eliminados.');

  // B. Eliminar logs / auditoría
  db.exec('DELETE FROM auditoria_admin;');
  console.log('✔ Todos los registros de logs y auditoría eliminados.');

  // C. Eliminar movimientos de inventario y traspasos
  db.exec('DELETE FROM traspaso_detalle;');
  db.exec('DELETE FROM traspaso;');
  db.exec('DELETE FROM movimiento_stock;');
  console.log('✔ Todos los movimientos de inventario y traspasos eliminados.');

  // D. Resetear el stock_actual de los productos a 0
  const stockRes = db.prepare('UPDATE producto SET stock_actual = 0').run();
  console.log(`✔ Stock de todos los productos establecido en 0 (${stockRes.changes} productos actualizados).`);

  // E. Reiniciar contadores autoincrementales
  const secuencias = [
    'comanda',
    'detalle_comanda',
    'pago_comanda',
    'impresion_comanda_cajero',
    'impresion_comanda_mesero',
    'movimiento_stock',
    'traspaso',
    'traspaso_detalle',
    'auditoria_admin'
  ];
  const placeholders = secuencias.map(t => `'${t}'`).join(', ');
  db.exec(`DELETE FROM sqlite_sequence WHERE name IN (${placeholders});`);
  console.log('✔ Secuencias de IDs autoincrementales reiniciadas a 1 para las tablas limpiadas.');

  db.exec('COMMIT;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  console.log('\n✅ Transacción confirmada y aplicada exitosamente.');
} catch (err) {
  db.exec('ROLLBACK;');
  console.error('❌ Error durante la limpieza, transacción revertida:', err);
  db.close();
  process.exit(1);
}

// 4. Verificación post-limpieza
console.log('\n--- ESTADO POSTERIOR A LA LIMPIEZA ---');
const despues = {
  comandas: db.prepare('SELECT COUNT(*) c FROM comanda').get().c,
  detalles: db.prepare('SELECT COUNT(*) c FROM detalle_comanda').get().c,
  pagos: db.prepare('SELECT COUNT(*) c FROM pago_comanda').get().c,
  impresionesCajero: db.prepare('SELECT COUNT(*) c FROM impresion_comanda_cajero').get().c,
  impresionesMesero: db.prepare('SELECT COUNT(*) c FROM impresion_comanda_mesero').get().c,
  auditoria: db.prepare('SELECT COUNT(*) c FROM auditoria_admin').get().c,
  movimientos: db.prepare('SELECT COUNT(*) c FROM movimiento_stock').get().c,
  traspasos: db.prepare('SELECT COUNT(*) c FROM traspaso').get().c,
  traspasosDetalle: db.prepare('SELECT COUNT(*) c FROM traspaso_detalle').get().c,
  productos: db.prepare('SELECT COUNT(*) c FROM producto').get().c,
  categorias: db.prepare('SELECT COUNT(*) c FROM categoria_producto').get().c,
  promociones: db.prepare('SELECT COUNT(*) c FROM promocion').get().c,
  admins: db.prepare('SELECT COUNT(*) c FROM administrador_evento').get().c,
  cajeros: db.prepare('SELECT COUNT(*) c FROM cajero').get().c,
  meseros: db.prepare('SELECT COUNT(*) c FROM mesero').get().c,
  productosConStockDistintoDeCero: db.prepare('SELECT COUNT(*) c FROM producto WHERE stock_actual != 0').get().c
};
console.table(despues);

// 5. Mostrar usuarios intactos
console.log('\n--- USUARIOS CONSERVADOS (INTACTOS) ---');
console.log('Administradores:');
console.table(db.prepare('SELECT id_admin, nombre, usuario, rol, activo FROM administrador_evento').all());
console.log('Cajeros:');
console.table(db.prepare('SELECT id_cajero, id_barra, nombre, usuario, activo FROM cajero').all());
console.log('Meseros:');
console.table(db.prepare('SELECT id_mesero, id_cajero, nombre, usuario, activo FROM mesero').all());

// 6. Resumen de productos
console.log('\n--- PRODUCTOS Y CATEGORÍAS (INTACTOS) ---');
console.log(`Total productos conservados: ${despues.productos}`);
console.log(`Total categorías conservadas: ${despues.categorias}`);
console.log(`Total promociones conservadas: ${despues.promociones}`);

db.close();
console.log('\n✨ Proceso de limpieza finalizado con éxito.');
