'use strict';

const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const BASE = path.join(__dirname, '..', 'pos_evento.db');
const db = new DatabaseSync(BASE);

// Parámetros de fechas (puedes cambiarlas aquí o pasar por comando)
const fechaDesde = process.argv[2] || '2026-09-13';
const fechaHasta = process.argv[3] || '2026-09-14';

console.log('\n' + '='.repeat(75));
console.log(`📊 REPORTE DE VENTAS POR MESERO (${fechaDesde} al ${fechaHasta})`);
console.log('='.repeat(75));

const sql = `
SELECT 
    m.nombre AS NOMBRE,
    ROUND(SUM(CASE WHEN UPPER(mp.nombre) = 'EFECTIVO' THEN pc.monto ELSE 0 END), 2) AS EFECTIVO,
    ROUND(SUM(CASE WHEN UPPER(mp.nombre) = 'QR' THEN pc.monto ELSE 0 END), 2) AS QR,
    ROUND(SUM(CASE WHEN UPPER(mp.nombre) = 'TARJETA' THEN pc.monto ELSE 0 END), 2) AS TARJETA,
    ROUND(SUM(CASE WHEN UPPER(mp.nombre) = 'TRANSFERENCIA' THEN pc.monto ELSE 0 END), 2) AS TRANSFERENCIA,
    ROUND(SUM(pc.monto), 2) AS TOTAL
FROM comanda c
JOIN mesero m ON c.id_mesero = m.id_mesero
JOIN pago_comanda pc ON c.id_comanda = pc.id_comanda
JOIN metodo_pago mp ON pc.id_metodo_pago = mp.id_metodo_pago
WHERE c.estado_pago != 'ANULADO'
  AND COALESCE(c.es_cortesia, 0) = 0
  AND UPPER(mp.nombre) != 'CORTESIA'
  AND DATE(c.fecha_hora) BETWEEN ? AND ?
GROUP BY m.id_mesero, m.nombre
ORDER BY TOTAL DESC;
`;

const filas = db.prepare(sql).all(fechaDesde, fechaHasta);

if (filas.length === 0) {
  console.log('\n❌ No se encontraron ventas registradas por meseros en esas fechas.\n');
} else {
  console.table(filas);

  const sqlTotal = `
  SELECT 
      ROUND(SUM(CASE WHEN UPPER(mp.nombre) = 'EFECTIVO' THEN pc.monto ELSE 0 END), 2) AS EFECTIVO,
      ROUND(SUM(CASE WHEN UPPER(mp.nombre) = 'QR' THEN pc.monto ELSE 0 END), 2) AS QR,
      ROUND(SUM(CASE WHEN UPPER(mp.nombre) = 'TARJETA' THEN pc.monto ELSE 0 END), 2) AS TARJETA,
      ROUND(SUM(CASE WHEN UPPER(mp.nombre) = 'TRANSFERENCIA' THEN pc.monto ELSE 0 END), 2) AS TRANSFERENCIA,
      ROUND(SUM(pc.monto), 2) AS TOTAL
  FROM comanda c
  JOIN pago_comanda pc ON c.id_comanda = pc.id_comanda
  JOIN metodo_pago mp ON pc.id_metodo_pago = mp.id_metodo_pago
  WHERE c.estado_pago != 'ANULADO'
    AND COALESCE(c.es_cortesia, 0) = 0
    AND UPPER(mp.nombre) != 'CORTESIA'
    AND DATE(c.fecha_hora) BETWEEN ? AND ?;
  `;
  const totalGeneral = db.prepare(sqlTotal).get(fechaDesde, fechaHasta);

  console.log('-'.repeat(75));
  console.log(`💰 TOTAL GENERAL:`);
  console.log(`   Efectivo:      ${Number(totalGeneral.EFECTIVO || 0).toFixed(2)} Bs.`);
  console.log(`   QR:            ${Number(totalGeneral.QR || 0).toFixed(2)} Bs.`);
  console.log(`   Tarjeta:       ${Number(totalGeneral.TARJETA || 0).toFixed(2)} Bs.`);
  console.log(`   Transferencia: ${Number(totalGeneral.TRANSFERENCIA || 0).toFixed(2)} Bs.`);
  console.log(`   👉 TOTAL RECAUDADO: ${Number(totalGeneral.TOTAL || 0).toFixed(2)} Bs.`);
  console.log('='.repeat(75) + '\n');
}

db.close();
