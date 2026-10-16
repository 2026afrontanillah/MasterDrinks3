'use strict';

const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const RAIZ = path.join(__dirname, '..');
const BASE = process.env.DB_FILE
  ? path.resolve(RAIZ, process.env.DB_FILE)
  : path.join(RAIZ, 'pos_evento.db');

if (!fs.existsSync(BASE)) {
  console.error('\n❌ No existe la base de datos: ' + BASE);
  process.exit(1);
}

// 1. Respaldo previo de seguridad
const carpetaRespaldos = path.join(RAIZ, 'respaldos');
if (!fs.existsSync(carpetaRespaldos)) {
  fs.mkdirSync(carpetaRespaldos, { recursive: true });
}
const timestamp = Date.now();
const archivoRespaldo = path.join(carpetaRespaldos, `pos_evento_antes_de_vaciar_${timestamp}.db`);

const db = new DatabaseSync(BASE);

try {
  db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  db.exec(`VACUUM INTO '${archivoRespaldo.replace(/'/g, "''")}';`);
  console.log('📦 Copia de respaldo guardada en:', archivoRespaldo);
} catch (err) {
  // Si VACUUM INTO falla por archivo existente o bloqueo, intentamos copia simple
  try {
    fs.copyFileSync(BASE, archivoRespaldo);
    console.log('📦 Copia de seguridad guardada por copia directa en:', archivoRespaldo);
  } catch (errCopia) {
    console.warn('⚠️ Nota de respaldo:', errCopia.message);
  }
}

db.exec('PRAGMA foreign_keys = OFF;');
db.exec('BEGIN IMMEDIATE;');

try {
  // 2. Limpieza de ventas y transacciones
  const tablasVentas = [
    'impresion_comanda_cajero',
    'impresion_comanda_mesero',
    'pago_comanda',
    'detalle_comanda',
    'comanda',
    'movimiento_stock',
    'traspaso_detalle',
    'traspaso',
    'auditoria_admin'
  ];

  for (const tabla of tablasVentas) {
    db.exec(`DELETE FROM ${tabla};`);
    console.log(`✔ Vaciada tabla: ${tabla}`);
  }

  // 3. Limpieza de personal (cajeros y meseros)
  db.exec('DELETE FROM mesero;');
  console.log('✔ Vaciada tabla: mesero');

  db.exec('DELETE FROM cajero;');
  console.log('✔ Vaciada tabla: cajero');

  // Mantener solo el administrador principal
  db.exec("DELETE FROM administrador_evento WHERE usuario != 'admin' AND id_admin != 1;");
  console.log('✔ Eliminados administradores secundarios y encargados.');

  // Asegurar que el usuario admin esté activo
  const adminRow = db.prepare("SELECT id_admin FROM administrador_evento WHERE id_admin = 1 OR usuario = 'admin'").get();
  if (adminRow) {
    db.prepare("UPDATE administrador_evento SET activo = 1 WHERE id_admin = ?").run(adminRow.id_admin);
    console.log('✔ Usuario admin preservado y activo.');
  }

  // 4. Reiniciar stock de todos los productos a 0 (conservando productos y categorías)
  const resStock = db.prepare('UPDATE producto SET stock_actual = 0;').run();
  console.log(`✔ Stock de todos los productos reiniciado a 0 (${resStock.changes} productos actualizados).`);

  // 5. Reiniciar secuencias autoincrementales
  const secuencias = [
    'comanda',
    'detalle_comanda',
    'pago_comanda',
    'impresion_comanda_cajero',
    'impresion_comanda_mesero',
    'movimiento_stock',
    'traspaso',
    'traspaso_detalle',
    'auditoria_admin',
    'mesero',
    'cajero'
  ];
  const placeholders = secuencias.map(t => `'${t}'`).join(', ');
  db.exec(`DELETE FROM sqlite_sequence WHERE name IN (${placeholders});`);
  console.log('✔ Contadores de IDs autoincrementales reiniciados a 1.');

  db.exec('COMMIT;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA wal_checkpoint(TRUNCATE);');

  console.log('\n======================================================');
  console.log('✅ BASE DE DATOS LIMPIADA EXITOSAMENTE:');
  console.log('   - Administrador: Conservado (único)');
  console.log('   - Meseros y Cajeros: 0');
  console.log('   - Comandas y Pagos: 0');
  console.log('   - Movimientos e Inventario/Traspasos: 0');
  console.log('   - Auditoría: 0');
  console.log('   - Productos, Categorías, Evento, Barra, Promociones: CONSERVADOS');
  console.log('   - Stock de productos: 0');
  console.log('======================================================\n');
} catch (err) {
  db.exec('ROLLBACK;');
  console.error('❌ Error durante la limpieza:', err);
  db.close();
  process.exit(1);
}

db.close();
process.exit(0);
