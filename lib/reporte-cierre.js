/* ==========================================================================
 * MasterDrinks — Reporte Ejecutivo de Ventas (Reporte Barra VIP)
 * ========================================================================== */

'use strict';

const { Documento, COLOR, num2, fmtBs } = require('./pdf');

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
               'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function fechaLegible(iso) {
  if (!iso) return '';
  const parts = String(iso).split(' ')[0].split('-');
  if (parts.length === 3) {
    const [a, m, d] = parts;
    return `${Number(d)} de ${MESES[Number(m) - 1]} de ${a}`;
  }
  return String(iso);
}

function nombreArchivoReporte(datos) {
  const hoy = new Date();
  const p = n => String(n).padStart(2, '0');
  const sello = `${p(hoy.getDate())}_${p(hoy.getMonth() + 1)}_${hoy.getFullYear()}`;
  const barra = (datos.evento && datos.evento.barra ? datos.evento.barra : 'VIP')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return `Reporte_Barra_${barra}_${sello}.pdf`;
}

const pct = (parte, total) => (total > 0 ? (parte / total) * 100 : 0);

function construirPdfCierre(datos) {
  const { resumen, evento } = datos;
  const barraNombre = (evento && evento.barra) || 'VIP';

  const doc = new Documento({
    titulo: `Reporte ejecutivo de ventas - Barra ${barraNombre}`,
    pie: '!eben Producciones'
  });

  // ---- Page 1: Executive Summary & Top Header --------------------------
  // Top Logo Box
  doc.logoEben(doc.ancho / 2 - 65, doc.alto - 62);

  // Title block
  doc.y = doc.alto - 84;
  doc.texto('Reporte ejecutivo de ventas', doc.margen, doc.y, { tamano: 17, fuente: 'negrita', color: COLOR.tinta });
  doc.y -= 15;
  doc.texto(`Evento: ${evento.nombre_evento || 'Serenata a Cochabamba'}`, doc.margen, doc.y, { tamano: 9, fuente: 'normal', color: COLOR.tinta });
  doc.y -= 12;
  doc.texto(`Cliente: ${evento.cliente || 'Link'}`, doc.margen, doc.y, { tamano: 9, fuente: 'normal', color: COLOR.tinta });
  doc.y -= 12;
  doc.texto(`Fecha: ${fechaLegible(evento.fecha_evento || '2026-09-13')}`, doc.margen, doc.y, { tamano: 9, fuente: 'normal', color: COLOR.tinta });
  doc.y -= 12;
  const hoyStr = fechaLegible(datos.generado || new Date().toISOString().slice(0, 10));
  doc.texto(`Fecha de emisión del reporte: ${hoyStr}`, doc.margen, doc.y, { tamano: 9, fuente: 'normal', color: COLOR.tinta });
  doc.y -= 15;

  // Dark Banner BARRA: [BARRA]
  doc.bannerNegro(`BARRA: ${barraNombre.toUpperCase()}`);

  // Explanatory note
  doc.parrafo(`Se presenta un resumen consolidado de las ventas registradas por cajero correspondientes a la Barra ${barraNombre}. Se consideran únicamente las comandas COMPLETADAS y se excluyen las anuladas y las cortesías.`, { tamano: 8.5, color: COLOR.tinta });
  doc.espacio(4);

  // KPI Row 1: 4 boxes (Registradas, Válidas, Cortesías, Anuladas)
  doc.kpiFila4([
    { titulo: 'Comandas registradas', valor: resumen.comandas },
    { titulo: 'Comandas válidas', valor: resumen.validas },
    { titulo: 'Comandas cortesía', valor: resumen.cortesias_completadas || 0 },
    { titulo: 'Comandas anuladas', valor: resumen.anuladas }
  ]);

  // KPI Row 2: 2 boxes
  doc.kpiFila2([
    { titulo: 'Venta válida total', valor: fmtBs(resumen.recaudado) },
    { titulo: 'Monto anulado', valor: fmtBs(resumen.importe_anulado) }
  ]);

  // ---- Table 1: Detalle de ventas por cajero ----------------------------
  doc.seccion('Detalle de ventas por cajero');
  const cajerosList = datos.porCajero || [];
  const sumComandasCaj = cajerosList.reduce((s, c) => s + Number(c.comandas || 0), 0);
  const sumImporteCaj = cajerosList.reduce((s, c) => s + Number(c.importe || 0), 0);

  doc.tabla({
    columnas: [
      { titulo: 'Cajero', ancho: 40 },
      { titulo: 'Comandas válidas', ancho: 20, align: 'center' },
      { titulo: 'Total vendido', ancho: 25, align: 'right' },
      { titulo: '% del total', ancho: 15, align: 'right' }
    ],
    filas: cajerosList.map(c => [
      c.cajero,
      String(c.comandas),
      fmtBs(c.importe),
      pct(c.importe, resumen.recaudado).toFixed(2).replace('.', ',') + '%'
    ]),
    totales: [
      'TOTAL',
      String(sumComandasCaj || resumen.validas),
      fmtBs(sumImporteCaj || resumen.recaudado),
      '100,00%'
    ]
  });

  // ---- Table 2: Desglose por método de pago -----------------------------
  doc.seccion('Desglose por método de pago');
  const metodoCajeroList = datos.porMetodoCajero || [];
  const sumEfCaj = metodoCajeroList.reduce((s, m) => s + Number(m.efectivo || 0), 0);
  const sumQrCaj = metodoCajeroList.reduce((s, m) => s + Number(m.qr || 0), 0);
  const sumTransCaj = metodoCajeroList.reduce((s, m) => s + Number(m.transferencia || 0), 0);
  const sumTarjCaj = metodoCajeroList.reduce((s, m) => s + Number(m.tarjeta || 0), 0);
  const sumTotCaj = metodoCajeroList.reduce((s, m) => s + Number(m.total || 0), 0);

  doc.tabla({
    columnas: [
      { titulo: 'Cajero', ancho: 25 },
      { titulo: 'Efectivo', ancho: 15, align: 'right' },
      { titulo: 'QR', ancho: 15, align: 'right' },
      { titulo: 'Transferencia', ancho: 15, align: 'right' },
      { titulo: 'Tarjeta', ancho: 15, align: 'right' },
      { titulo: 'Total vendido', ancho: 15, align: 'right' }
    ],
    filas: metodoCajeroList.map(m => [
      m.cajero,
      fmtBs(m.efectivo),
      fmtBs(m.qr),
      fmtBs(m.transferencia),
      fmtBs(m.tarjeta),
      fmtBs(m.total)
    ]),
    totales: [
      'TOTAL',
      fmtBs(sumEfCaj),
      fmtBs(sumQrCaj),
      fmtBs(sumTransCaj),
      fmtBs(sumTarjCaj),
      fmtBs(sumTotCaj || resumen.recaudado)
    ]
  });

  // ---- Table 3: Desglose de cobros por mesero ---------------------------
  doc.seccion('Desglose de cobros por mesero');
  const meseroMetodoList = datos.porMeseroMetodo || [];
  const sumEfMes = meseroMetodoList.reduce((s, m) => s + Number(m.efectivo || 0), 0);
  const sumQrMes = meseroMetodoList.reduce((s, m) => s + Number(m.qr || 0), 0);
  const sumTransMes = meseroMetodoList.reduce((s, m) => s + Number(m.transferencia || 0), 0);
  const sumTarjMes = meseroMetodoList.reduce((s, m) => s + Number(m.tarjeta || 0), 0);
  const sumTotMes = meseroMetodoList.reduce((s, m) => s + Number(m.total || 0), 0);

  doc.tabla({
    columnas: [
      { titulo: 'Mesero', ancho: 25 },
      { titulo: 'Efectivo', ancho: 15, align: 'right' },
      { titulo: 'QR', ancho: 15, align: 'right' },
      { titulo: 'Transferencia', ancho: 15, align: 'right' },
      { titulo: 'Tarjeta', ancho: 15, align: 'right' },
      { titulo: 'Total', ancho: 15, align: 'right' }
    ],
    filas: meseroMetodoList.map(m => [
      m.mesero,
      fmtBs(m.efectivo),
      fmtBs(m.qr),
      fmtBs(m.transferencia),
      fmtBs(m.tarjeta),
      fmtBs(m.total)
    ]),
    totales: [
      'TOTAL',
      fmtBs(sumEfMes),
      fmtBs(sumQrMes),
      fmtBs(sumTransMes),
      fmtBs(sumTarjMes),
      fmtBs(sumTotMes || resumen.recaudado)
    ]
  });

  // ---- Table 4: Movimiento y valorización de productos vendidos --------
  doc.seccion('Movimiento y valorización de productos vendidos');
  const prodsList = datos.productos || [];
  const sumTotalProds = prodsList.reduce((s, p) => s + Number(p.total || 0), 0);

  doc.tabla({
    columnas: [
      { titulo: 'Producto', ancho: 25 },
      { titulo: 'Cantidad', ancho: 9, align: 'center' },
      { titulo: 'Equivalencia física', ancho: 22 },
      { titulo: 'Tipo de venta', ancho: 17 },
      { titulo: 'Precio aplicado', ancho: 14, align: 'right' },
      { titulo: 'Total', ancho: 13, align: 'right' }
    ],
    filas: prodsList.map(p => [
      p.producto,
      String(p.cantidad),
      p.equivalencia_fisica,
      p.tipo_venta,
      fmtBs(p.precio_aplicado),
      fmtBs(p.total)
    ]),
    totales: [
      'TOTAL',
      '',
      '',
      '',
      '',
      fmtBs(sumTotalProds || resumen.recaudado)
    ]
  });

  doc.parrafo(`La valorización total de productos vendidos concilia exactamente con la venta válida total: ${fmtBs(resumen.recaudado)}. Los acompañantes incluidos se contabilizan como movimiento físico con precio Bs 0,00.`, { tamano: 8.5, color: COLOR.tinta });
  doc.espacio(10);

  // ---- Section 5: CORTESÍAS (If any) -----------------------------------
  if (datos.cortesias && datos.cortesias.length > 0) {
    const fnEncCorridoCort = d => {
      d.linea(d.margen, d.alto - 25, d.ancho - d.margen, d.alto - 25, COLOR.linea, 0.5);
      d.texto(`CORTESÍAS - Barra ${barraNombre}`, d.margen, d.alto - 20, { tamano: 9.5, fuente: 'negrita', color: COLOR.tinta });
      d.texto(`${datos.cortesias.length} comandas registradas`, d.ancho - d.margen, d.alto - 20, { tamano: 9.5, fuente: 'normal', color: COLOR.tinta, align: 'right' });
    };

    doc.nuevaPagina(fnEncCorridoCort);
    doc.runningHeaderFn = fnEncCorridoCort;

    doc.seccion('CORTESÍAS');
    doc.parrafo(`Se registraron ${resumen.cortesias} comandas de cortesía. De ellas, ${resumen.cortesias_completadas} fueron completadas por un valor referencial de ${fmtBs(resumen.importe_cortesia)} y ${resumen.cortesias_anuladas} fue anulada por ${fmtBs(resumen.importe_cortesia_anulado)}. Estos importes no forman parte de la venta válida del reporte.`, { tamano: 9, color: COLOR.tinta });
    doc.espacio(6);

    for (const c of datos.cortesias) {
      doc.cardComanda({
        ref: c.id_comanda,
        fecha: c.fecha_hora,
        pago: null,
        total: c.total,
        cajero: c.cajero,
        mesero: c.mesero,
        detalle: c.detalle_texto,
        esCortesia: true,
        anulada: c.estado_pago === 'ANULADO'
      });
    }
  }

  // ---- Section 6: Detalle de comandas ----------------------------------
  if (datos.comandas && datos.comandas.length > 0) {
    const fnEncCorridoCom = d => {
      d.linea(d.margen, d.alto - 25, d.ancho - d.margen, d.alto - 25, COLOR.linea, 0.5);
      d.texto(`Detalle de comandas - Barra ${barraNombre}`, d.margen, d.alto - 20, { tamano: 9.5, fuente: 'negrita', color: COLOR.tinta });
      d.texto(`${resumen.validas} comandas | ${fmtBs(resumen.recaudado)}`, d.ancho - d.margen, d.alto - 20, { tamano: 9.5, fuente: 'normal', color: COLOR.tinta, align: 'right' });
    };

    doc.nuevaPagina(fnEncCorridoCom);
    doc.runningHeaderFn = fnEncCorridoCom;

    for (const c of datos.comandas) {
      doc.cardComanda({
        ref: `V-${c.id_comanda}`,
        fecha: c.fecha_hora,
        pago: c.pago_texto,
        total: c.total,
        cajero: c.cajero,
        mesero: c.mesero,
        detalle: c.detalle_texto
      });
    }
  }

  // Signature at the end
  doc.espacio(20);
  doc.firmaFinal('Ing. Benjamin Frontanilla Hermosa', 'Gerente General');

  return doc.salida();
}

module.exports = { construirPdfCierre, nombreArchivoReporte };
