/* ==========================================================================
 * MasterDrinks — Reporte Ejecutivo de Inventario y Stock en PDF
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

function nombreArchivoInventario(datos) {
  const hoy = new Date();
  const p = n => String(n).padStart(2, '0');
  const fechaStr = `${hoy.getFullYear()}_${p(hoy.getMonth() + 1)}_${p(hoy.getDate())}`;
  const barra = (datos.evento && datos.evento.barra ? datos.evento.barra : '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return `Inventario_${barra ? barra + '_' : ''}${fechaStr}.pdf`;
}

function construirPdfInventario(datos) {
  const { evento, productos, generado } = datos;
  const barraNombre = (evento && evento.barra) || 'Barra';

  const doc = new Documento({
    titulo: `Reporte de Inventario y Stock - Barra ${barraNombre}`,
    pie: '!eben Producciones'
  });

  // Top Logo Box
  doc.logoEben(doc.ancho / 2 - 65, doc.alto - 62);

  // Encabezado
  doc.y = doc.alto - 84;
  doc.texto('Reporte de inventario y stock', doc.margen, doc.y, { tamano: 17, fuente: 'negrita', color: COLOR.tinta });
  doc.y -= 15;
  doc.texto(`Evento: ${evento.nombre_evento || 'Evento'}`, doc.margen, doc.y, { tamano: 9, fuente: 'normal', color: COLOR.tinta });
  doc.y -= 12;
  doc.texto(`Lugar: ${evento.lugar || 'Predio del Evento'}`, doc.margen, doc.y, { tamano: 9, fuente: 'normal', color: COLOR.tinta });
  doc.y -= 12;
  doc.texto(`Fecha: ${fechaLegible(evento.fecha_evento || new Date().toISOString().slice(0, 10))}`, doc.margen, doc.y, { tamano: 9, fuente: 'normal', color: COLOR.tinta });
  doc.y -= 12;
  const hoyStr = fechaLegible(generado ? generado.slice(0, 10) : new Date().toISOString().slice(0, 10));
  doc.texto(`Hora de emisión: ${generado || new Date().toLocaleTimeString()}`, doc.margen, doc.y, { tamano: 9, fuente: 'normal', color: COLOR.tinta });
  doc.y -= 15;

  // Banner negro
  doc.bannerNegro(`BARRA: ${barraNombre.toUpperCase()}`);

  doc.parrafo(`Estado actual de existencias físicas y stock disponible en la Barra ${barraNombre}. Los productos derivados (shots/vasos) descuentan en tiempo real de su botella vinculada.`, { tamano: 8.5, color: COLOR.tinta });
  doc.espacio(4);

  // Cálculos de KPIs
  const prods = productos || [];
  const totalProds = prods.length;
  let stockBajo = 0;
  let agotados = 0;
  let botellasFisicas = 0;

  prods.forEach(p => {
    const s = Number(p.stock_actual) || 0;
    if (p.id_botella_vinculada) {
      if (s <= 0) agotados++;
    } else {
      if (s <= 0) agotados++;
      else if (s <= 15) stockBajo++;
      botellasFisicas += s;
    }
  });

  // KPIs
  doc.kpiFila4([
    { titulo: 'Productos en catálogo', valor: String(totalProds) },
    { titulo: 'Botellas / latas físicas', valor: String(Math.floor(botellasFisicas)) },
    { titulo: 'Stock bajo (<= 15)', valor: String(stockBajo) },
    { titulo: 'Agotados (0 uds.)', valor: String(agotados) }
  ]);

  // Agrupar productos por categoría
  const porCategoria = new Map();
  prods.forEach(p => {
    const cat = p.categoria_nombre || 'General';
    if (!porCategoria.has(cat)) porCategoria.set(cat, []);
    porCategoria.get(cat).push(p);
  });

  // Listar tablas por categoría
  for (const [catNombre, items] of porCategoria) {
    doc.seccion(`Categoría: ${catNombre} (${items.length} productos)`);

    const filas = items.map(p => {
      let stockTexto = '';
      let estado = 'Normal';

      if (p.id_botella_vinculada) {
        stockTexto = `(De: ${p.nombre_botella_vinculada || 'Botella'})`;
        estado = (p.stock_calculado <= 0) ? 'AGOTADO' : `${p.stock_calculado} vasos`;
      } else {
        const s = Number(p.stock_actual) || 0;
        stockTexto = `${s} uds.`;
        if (s <= 0) estado = 'AGOTADO';
        else if (s <= 15) estado = 'BAJO';
        else estado = 'DISPONIBLE';
      }

      return [
        `#${p.id_producto}`,
        p.nombre,
        p.tipo_producto === 'BEBIDA_ALCOHOLICA' ? 'Bebida Alc.' : (p.tipo_producto === 'COMIDA' ? 'Comida' : 'Bebida No Alc.'),
        fmtBs(p.precio_venta),
        stockTexto,
        estado
      ];
    });

    doc.tabla({
      columnas: [
        { titulo: 'ID', ancho: 10, align: 'center' },
        { titulo: 'Producto', ancho: 38 },
        { titulo: 'Tipo', ancho: 18 },
        { titulo: 'Precio Venta', ancho: 14, align: 'right' },
        { titulo: 'Stock Físico', ancho: 10, align: 'center' },
        { titulo: 'Estado', ancho: 10, align: 'center' }
      ],
      filas
    });

    doc.espacio(6);
  }

  // Running Header para páginas siguientes
  const fnEncCorrido = (d) => {
    d.texto(`Reporte de inventario y stock - Barra ${barraNombre}`, d.margen, d.alto - 20, { tamano: 9.5, fuente: 'negrita', color: COLOR.tinta });
    d.texto(`${fechaLegible(generado ? generado.slice(0, 10) : '')}`, d.ancho - d.margen, d.alto - 20, { tamano: 9.5, fuente: 'normal', color: COLOR.tinta, align: 'right' });
  };
  doc.runningHeaderFn = fnEncCorrido;

  // Firma al pie
  doc.espacio(20);
  doc.firmaFinal(evento.responsable || 'Responsable de Barra', 'Encargado de Inventario y Operación');

  return doc.salida();
}

module.exports = { construirPdfInventario, nombreArchivoInventario };
