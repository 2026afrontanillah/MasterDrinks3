/* ==========================================================================
 * MasterDrinks — Generador de PDF (Reporte Barra VIP)
 * ========================================================================== */

'use strict';

const CP1252_EXTRA = {
  '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87,
  'ˆ': 0x88, '‰': 0x89, 'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e,
  '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97,
  '˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f
};

function aWinAnsi(texto) {
  const bytes = [];
  for (const ch of String(texto)) {
    const cp = ch.codePointAt(0);
    if (cp === 0x0a || cp === 0x0d) { bytes.push(0x20); continue; }
    if (cp < 0x80) { bytes.push(cp); continue; }
    if (CP1252_EXTRA[ch] !== undefined) { bytes.push(CP1252_EXTRA[ch]); continue; }
    if (cp <= 0xff) { bytes.push(cp); continue; }
    bytes.push(0x3f);
  }
  return bytes;
}

function cadenaPdf(texto) {
  const salida = [0x28];
  for (const b of aWinAnsi(texto)) {
    if (b === 0x28 || b === 0x29 || b === 0x5c) salida.push(0x5c);
    salida.push(b);
  }
  salida.push(0x29);
  return Buffer.from(salida).toString('latin1');
}

const FUENTES = {
  normal: { recurso: 'F1', base: 'Helvetica', monoespaciada: false },
  negrita: { recurso: 'F2', base: 'Helvetica-Bold', monoespaciada: false },
  mono: { recurso: 'F3', base: 'Courier', monoespaciada: true },
  monoNegrita: { recurso: 'F4', base: 'Courier-Bold', monoespaciada: true }
};

const anchoTexto = (texto, tamano, fuente) =>
  String(texto).length * tamano * (FUENTES[fuente].monoespaciada ? 0.6 : 0.55);

function recortar(texto, anchoMax, tamano, fuente) {
  let t = String(texto);
  if (anchoTexto(t, tamano, fuente) <= anchoMax) return t;
  while (t.length > 1 && anchoTexto(t + '...', tamano, fuente) > anchoMax) {
    t = t.slice(0, -1);
  }
  return t + '...';
}

const num2 = n => (Math.round((Number(n) + Number.EPSILON) * 100) / 100).toFixed(2);

function fmtBs(val) {
  const n = Number(val) || 0;
  const partes = (Math.round((n + Number.EPSILON) * 100) / 100).toFixed(2).split('.');
  const entero = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `Bs ${entero},${partes[1]}`;
}

const COLOR = {
  tinta: [0.05, 0.05, 0.05],
  suave: [0.35, 0.35, 0.38],
  linea: [0.80, 0.80, 0.82],
  marca: [0.05, 0.05, 0.05],
  acento: [0.05, 0.05, 0.05],
  ok: [0.05, 0.05, 0.05],
  alerta: [0.75, 0.15, 0.15],
  aviso: [0.80, 0.50, 0.05],
  cebra: [0.98, 0.98, 0.99],
  fondoCard: [0.98, 0.98, 0.98],
  fondoGris: [0.94, 0.94, 0.95],
  textoAnulado: [0.45, 0.45, 0.48],
  grisAnulado: [0.93, 0.93, 0.94],
  blanco: [1, 1, 1]
};

class Documento {
  constructor(opciones = {}) {
    this.ancho = 595;
    this.alto = 842;
    this.margen = 40;
    this.titulo = opciones.titulo || 'Reporte';
    this.pie = opciones.pie || '';
    this.paginas = [];
    this.runningHeaderFn = null;
    this.nuevaPagina();
  }

  get anchoUtil() { return this.ancho - this.margen * 2; }

  nuevaPagina(encabezadoCorrido = null) {
    this.pagina = { ops: [], encabezadoCorrido: encabezadoCorrido || this.runningHeaderFn };
    this.paginas.push(this.pagina);
    this.y = this.alto - this.margen;
    if (this.paginas.length > 1 && this.pagina.encabezadoCorrido) {
      this.pagina.encabezadoCorrido(this);
    }
    return this.pagina;
  }

  asegurar(altura) {
    if (this.y - altura < this.margen + 35) this.nuevaPagina();
  }

  op(linea) { this.pagina.ops.push(linea); }

  color(c, relleno = true) {
    this.op(c.map(v => v.toFixed(3)).join(' ') + (relleno ? ' rg' : ' RG'));
  }

  rect(x, y, ancho, alto, c) {
    this.color(c);
    this.op(`${x.toFixed(2)} ${y.toFixed(2)} ${ancho.toFixed(2)} ${alto.toFixed(2)} re f`);
  }

  rectBorde(x, y, ancho, alto, cFondo, cBorde, grosor = 0.6) {
    if (cFondo) {
      this.color(cFondo);
      this.op(`${x.toFixed(2)} ${y.toFixed(2)} ${ancho.toFixed(2)} ${alto.toFixed(2)} re f`);
    }
    if (cBorde) {
      this.color(cBorde, false);
      this.op(`${grosor} w ${x.toFixed(2)} ${y.toFixed(2)} ${ancho.toFixed(2)} ${alto.toFixed(2)} re S`);
    }
  }

  linea(x1, y1, x2, y2, c, grosor = 0.6) {
    this.color(c, false);
    this.op(`${grosor} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
  }

  texto(txt, x, y, opciones = {}) {
    const tamano = opciones.tamano || 10;
    const fuente = opciones.fuente || 'normal';
    const c = opciones.color || COLOR.tinta;
    const align = opciones.align || 'left';

    let px = x;
    if (align !== 'left') {
      const w = anchoTexto(txt, tamano, fuente);
      px = align === 'right' ? x - w : x - w / 2;
    }

    this.color(c);
    this.op(`BT /${FUENTES[fuente].recurso} ${tamano} Tf ` +
            `1 0 0 1 ${px.toFixed(2)} ${y.toFixed(2)} Tm ${cadenaPdf(txt)} Tj ET`);
  }

  logoEben(x, y) {
    const w = 130;
    const h = 48;
    this.rect(x, y, w, h, COLOR.fondoGris);
    this.texto('!eben', x + w / 2, y + 26, { tamano: 22, fuente: 'negrita', color: COLOR.tinta, align: 'center' });
    const textoProd = 'Producciones';
    const sqSize = 5;
    const anchoProd = anchoTexto(textoProd, 9, 'normal');
    const startX = x + (w - (anchoProd + sqSize + 4)) / 2;
    this.rect(startX, y + 14, sqSize, sqSize, COLOR.tinta);
    this.texto(textoProd, startX + sqSize + 4, y + 13, { tamano: 9, fuente: 'normal', color: COLOR.tinta, align: 'left' });
  }

  cabecera(marca, titulo, subtitulo) {
    this.logoEben(this.ancho / 2 - 65, this.alto - 62);
    this.y = this.alto - 84;
    this.texto(titulo, this.margen, this.y, { tamano: 16, fuente: 'negrita', color: COLOR.tinta });
    if (subtitulo) {
      this.y -= 14;
      this.texto(subtitulo, this.margen, this.y, { tamano: 9.5, fuente: 'normal', color: COLOR.suave });
    }
    this.y -= 16;
  }

  indicadores(lista) {
    if (!lista || lista.length === 0) return;
    this.asegurar(55);
    const altoHeader = 18;
    const altoValor = 28;
    const altoTotal = altoHeader + altoValor;
    const n = lista.length;
    const wCol = this.anchoUtil / n;
    const y = this.y - altoTotal;

    lista.forEach((item, i) => {
      const x = this.margen + i * wCol;
      this.rect(x, y + altoValor, wCol, altoHeader, COLOR.tinta);
      this.texto(item.etiqueta || item.titulo || '', x + wCol / 2, y + altoValor + 5, { tamano: 7.5, fuente: 'negrita', color: COLOR.blanco, align: 'center' });
      this.rectBorde(x, y, wCol, altoValor, COLOR.blanco, COLOR.tinta, 0.7);
      this.texto(String(item.valor), x + wCol / 2, y + 8, { tamano: 13, fuente: 'negrita', color: item.color || COLOR.tinta, align: 'center' });
    });
    this.y = y - 14;
  }

  bannerNegro(textoStr) {
    this.asegurar(28);
    const alto = 22;
    const y = this.y - alto;
    this.rect(this.margen, y, this.anchoUtil, alto, COLOR.tinta);
    this.texto(textoStr, this.ancho / 2, y + 6.5, { tamano: 11, fuente: 'negrita', color: COLOR.blanco, align: 'center' });
    this.y = y - 14;
  }

  kpiFila3(items) {
    this.asegurar(55);
    const altoHeader = 20;
    const altoValor = 30;
    const altoTotal = altoHeader + altoValor;
    const wCol = this.anchoUtil / 3;

    const y = this.y - altoTotal;
    items.forEach((item, i) => {
      const x = this.margen + i * wCol;
      // Dark Header
      this.rect(x, y + altoValor, wCol, altoHeader, COLOR.tinta);
      this.texto(item.titulo, x + wCol / 2, y + altoValor + 6, { tamano: 8.5, fuente: 'negrita', color: COLOR.blanco, align: 'center' });

      // Value Box
      this.rectBorde(x, y, wCol, altoValor, COLOR.blanco, COLOR.tinta, 0.7);
      this.texto(String(item.valor), x + wCol / 2, y + 8, { tamano: 16, fuente: 'negrita', color: COLOR.tinta, align: 'center' });
    });

    this.y = y - 14;
  }

  kpiFila4(items) {
    this.asegurar(55);
    const altoHeader = 18;
    const altoValor = 28;
    const altoTotal = altoHeader + altoValor;
    const wCol = this.anchoUtil / 4;

    const y = this.y - altoTotal;
    items.forEach((item, i) => {
      const x = this.margen + i * wCol;
      // Dark Header
      this.rect(x, y + altoValor, wCol, altoHeader, COLOR.tinta);
      this.texto(item.titulo, x + wCol / 2, y + altoValor + 5, { tamano: 8, fuente: 'negrita', color: COLOR.blanco, align: 'center' });

      // Value Box
      this.rectBorde(x, y, wCol, altoValor, COLOR.blanco, COLOR.tinta, 0.7);
      this.texto(String(item.valor), x + wCol / 2, y + 7, { tamano: 15, fuente: 'negrita', color: COLOR.tinta, align: 'center' });
    });

    this.y = y - 12;
  }

  kpiFila2(items) {
    this.asegurar(55);
    const altoHeader = 20;
    const altoValor = 30;
    const altoTotal = altoHeader + altoValor;
    const paddingHorizontal = 60;
    const anchoUtilKpi = this.anchoUtil - paddingHorizontal * 2;
    const wCol = anchoUtilKpi / 2;

    const y = this.y - altoTotal;
    items.forEach((item, i) => {
      const x = this.margen + paddingHorizontal + i * wCol;
      // Dark Header
      this.rect(x, y + altoValor, wCol, altoHeader, COLOR.tinta);
      this.texto(item.titulo, x + wCol / 2, y + altoValor + 6, { tamano: 8.5, fuente: 'negrita', color: COLOR.blanco, align: 'center' });

      // Value Box
      this.rectBorde(x, y, wCol, altoValor, COLOR.blanco, COLOR.tinta, 0.7);
      this.texto(String(item.valor), x + wCol / 2, y + 8, { tamano: 15, fuente: 'negrita', color: COLOR.tinta, align: 'center' });
    });

    this.y = y - 18;
  }

  seccion(txt) {
    this.asegurar(50);
    this.texto(txt, this.margen, this.y, { tamano: 12, fuente: 'negrita', color: COLOR.tinta });
    this.y -= 16;
  }

  parrafo(txt, opciones = {}) {
    const tamano = opciones.tamano || 9;
    const fuente = opciones.fuente || 'normal';
    const estilo = Object.assign({ tamano, fuente, color: COLOR.tinta }, opciones);

    for (const linea of this.partir(String(txt), this.anchoUtil, tamano, fuente)) {
      this.asegurar(14);
      this.texto(linea, this.margen, this.y, estilo);
      this.y -= tamano + 4;
    }
    this.y -= 6;
  }

  partir(txt, anchoMax, tamano, fuente) {
    const bloques = String(txt).split('\n');
    const lineas = [];

    for (const bloque of bloques) {
      const palabras = bloque.split(/\s+/).filter(Boolean);
      if (palabras.length === 0) continue;
      let actual = '';

      for (const palabra of palabras) {
        const tentativa = actual ? actual + ' ' + palabra : palabra;
        if (anchoTexto(tentativa, tamano, fuente) <= anchoMax) {
          actual = tentativa;
        } else if (actual) {
          lineas.push(actual);
          actual = palabra;
        } else {
          lineas.push(recortar(palabra, anchoMax, tamano, fuente));
          actual = '';
        }
      }
      if (actual) lineas.push(actual);
    }
    return lineas.length ? lineas : [''];
  }

  tabla({ columnas, filas, totales }) {
    const altoFila = 18;
    const altoCabecera = 20;
    const suma = columnas.reduce((s, c) => s + c.ancho, 0);
    const anchos = columnas.map(c => (c.ancho / suma) * this.anchoUtil);

    const dibujarCabecera = () => {
      this.asegurar(altoCabecera + altoFila);
      const y = this.y - altoCabecera;
      this.rect(this.margen, y, this.anchoUtil, altoCabecera, COLOR.tinta);
      let x = this.margen;
      columnas.forEach((col, i) => {
        const align = col.align || 'left';
        const px = align === 'right' ? x + anchos[i] - 6 : align === 'center' ? x + anchos[i] / 2 : x + 6;
        this.texto(recortar(col.titulo, anchos[i] - 10, 8, 'negrita'), px, y + 6,
          { tamano: 8, fuente: 'negrita', color: COLOR.blanco, align });
        x += anchos[i];
      });
      this.y = y;
    };

    dibujarCabecera();

    filas.forEach((fila, indice) => {
      const celdas = Array.isArray(fila) ? fila : (fila && fila.celdas ? fila.celdas : []);
      const fondoFila = (fila && fila.fondo) ? fila.fondo : (indice % 2 === 1 ? COLOR.cebra : null);

      const contenido = celdas.map((celda, i) => {
        const col = columnas[i] || {};
        const align = (celda && typeof celda === 'object' && celda.align) || col.align || 'left';
        const fuente = (celda && typeof celda === 'object' && celda.fuente) || col.fuente || 'normal';
        const tamano = (celda && typeof celda === 'object' && celda.tamano) || col.tamano || 8.5;
        const valor = String((celda && typeof celda === 'object' ? celda.texto : celda) ?? '');
        const lineas = col.multilinea ? this.partir(valor, anchos[i] - 10, tamano, fuente) : [recortar(valor, anchos[i] - 10, tamano, fuente)];

        return {
          lineas,
          color: (celda && typeof celda === 'object' && celda.color) || COLOR.tinta,
          tamano,
          align,
          fuente
        };
      });

      const numLineas = Math.max(1, ...contenido.map(c => c.lineas.length));
      const altoReal = numLineas === 1 ? altoFila : 6 + numLineas * 11;

      if (this.y - altoReal < this.margen + 35) {
        this.nuevaPagina();
        dibujarCabecera();
      }

      const y = this.y - altoReal;
      if (fondoFila) this.rect(this.margen, y, this.anchoUtil, altoReal, fondoFila);
      this.rectBorde(this.margen, y, this.anchoUtil, altoReal, null, COLOR.linea, 0.4);

      let x = this.margen;
      contenido.forEach((celda, i) => {
        const px = celda.align === 'right' ? x + anchos[i] - 6
          : celda.align === 'center' ? x + anchos[i] / 2 : x + 6;
        celda.lineas.forEach((linea, l) => {
          this.texto(linea, px, y + altoReal - 12 - l * 11,
            { tamano: celda.tamano, fuente: celda.fuente, color: celda.color, align: celda.align });
        });
        x += anchos[i];
      });

      this.y = y;
    });

    if (totales) {
      if (this.y - altoFila < this.margen + 35) { this.nuevaPagina(); dibujarCabecera(); }
      const y = this.y - altoFila;
      this.rectBorde(this.margen, y, this.anchoUtil, altoFila, COLOR.blanco, COLOR.tinta, 0.8);
      let x = this.margen;
      totales.forEach((celda, i) => {
        const col = columnas[i] || {};
        const align = (celda && typeof celda === 'object' && celda.align) || col.align || 'left';
        const px = align === 'right' ? x + anchos[i] - 6 : align === 'center' ? x + anchos[i] / 2 : x + 6;
        const textoValor = String((celda && typeof celda === 'object' ? celda.texto : celda) ?? '');
        this.texto(textoValor, px, y + 5,
          { tamano: 8.5, fuente: 'negrita', color: COLOR.tinta, align });
        x += anchos[i];
      });
      this.y = y;
    }

    this.y -= 14;
  }

  cardComanda({ ref, fecha, pago, total, cajero, mesero, detalle, esCortesia = false, anulada = false }) {
    const altoCard = 40;
    this.asegurar(altoCard + 4);
    const y = this.y - altoCard;

    this.rectBorde(this.margen, y, this.anchoUtil, altoCard, COLOR.blanco, COLOR.linea, 0.5);

    // Left Header block (top line)
    const refTxt = `# ${ref} ${fecha}`;
    this.texto(refTxt, this.margen + 8, y + 27, { tamano: 8.5, fuente: 'negrita', color: COLOR.tinta });

    if (pago) {
      this.texto(pago, this.margen + 160, y + 27, { tamano: 8.5, fuente: 'normal', color: COLOR.tinta });
    }

    if (esCortesia) {
      const tagCort = anulada ? 'Cortesía ANULADA' : 'Cortesía';
      this.texto(tagCort, this.margen + 160, y + 27, { tamano: 8.5, fuente: 'normal', color: COLOR.tinta });
    }

    this.texto(fmtBs(total), this.ancho - this.margen - 8, y + 27, { tamano: 8.5, fuente: 'negrita', color: COLOR.tinta, align: 'right' });

    // Dividers inside card
    this.linea(this.margen + 8, y + 23, this.ancho - this.margen - 8, y + 23, COLOR.linea, 0.4);

    // Row 2 & Row 3
    this.texto(`Cajero: ${cajero || '—'}`, this.margen + 8, y + 13, { tamano: 8, fuente: 'normal', color: COLOR.tinta });
    this.texto(`Detalle: ${detalle || '—'}`, this.margen + 160, y + 13, { tamano: 8, fuente: 'normal', color: COLOR.tinta });

    this.texto(`Mesero: ${mesero || '—'}`, this.margen + 8, y + 3, { tamano: 8, fuente: 'normal', color: COLOR.tinta });

    this.y = y - 4;
  }

  firmaFinal(nombre, cargo) {
    this.asegurar(60);
    const y = this.y - 40;
    const xCentro = this.ancho / 2;
    this.linea(xCentro - 110, y + 24, xCentro + 110, y + 24, COLOR.tinta, 0.8);
    this.texto(nombre, xCentro, y + 12, { tamano: 9.5, fuente: 'negrita', color: COLOR.tinta, align: 'center' });
    this.texto(cargo, xCentro, y + 1, { tamano: 8.5, fuente: 'normal', color: COLOR.tinta, align: 'center' });
    this.y = y - 10;
  }

  espacio(alto = 10) { this.y -= alto; }

  pintarPies() {
    const total = this.paginas.length;
    this.paginas.forEach((pagina, i) => {
      const guardada = this.pagina;
      this.pagina = pagina;

      // Header corrido si existe
      if (i > 0 && pagina.encabezadoCorrido) {
        // running header rendered during page creation
      }

      // Footer
      const y = 20;
      this.linea(this.margen, y + 14, this.ancho - this.margen, y + 14, COLOR.linea, 0.5);
      this.texto('!eben Producciones', this.margen, y + 3, { tamano: 8, fuente: 'normal', color: COLOR.tinta });
      this.texto(`Página ${i + 1}`, this.ancho - this.margen, y + 3,
        { tamano: 8, fuente: 'normal', color: COLOR.tinta, align: 'right' });
      this.pagina = guardada;
    });
  }

  salida() {
    this.pintarPies();

    const objetos = [];
    const añadir = cuerpo => { objetos.push(cuerpo); return objetos.length; };

    añadir('<< /Type /Catalog /Pages 2 0 R >>');
    añadir(null);
    const idFuente = {};
    for (const clave of Object.keys(FUENTES)) {
      const f = FUENTES[clave];
      idFuente[f.recurso] = añadir(
        `<< /Type /Font /Subtype /Type1 /BaseFont /${f.base} /Encoding /WinAnsiEncoding >>`
      );
    }

    const recursos = '<< /Font << ' +
      Object.keys(idFuente).map(r => `/${r} ${idFuente[r]} 0 R`).join(' ') + ' >> >>';

    const idsPagina = [];
    for (const pagina of this.paginas) {
      const flujo = pagina.ops.join('\n');
      const idFlujo = añadir(
        `<< /Length ${Buffer.byteLength(flujo, 'latin1')} >>\nstream\n${flujo}\nendstream`
      );
      idsPagina.push(añadir(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.ancho} ${this.alto}] ` +
        `/Resources ${recursos} /Contents ${idFlujo} 0 R >>`
      ));
    }

    objetos[1] = `<< /Type /Pages /Kids [${idsPagina.map(id => id + ' 0 R').join(' ')}] ` +
                 `/Count ${idsPagina.length} >>`;

    const idInfo = añadir(
      `<< /Title ${cadenaPdf(this.titulo)} /Producer ${cadenaPdf('MasterDrinks POS')} ` +
      `/CreationDate ${cadenaPdf(fechaPdf(new Date()))} >>`
    );

    let pdf = '%PDF-1.4\n';
    const posiciones = [];
    objetos.forEach((cuerpo, i) => {
      posiciones[i] = Buffer.byteLength(pdf, 'latin1');
      pdf += `${i + 1} 0 obj\n${cuerpo}\nendobj\n`;
    });

    const inicioXref = Buffer.byteLength(pdf, 'latin1');
    pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
    posiciones.forEach(pos => {
      pdf += String(pos).padStart(10, '0') + ' 00000 n \n';
    });
    pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R /Info ${idInfo} 0 R >>\n` +
           `startxref\n${inicioXref}\n%%EOF\n`;

    return Buffer.from(pdf, 'latin1');
  }
}

function fechaPdf(d) {
  const p = n => String(n).padStart(2, '0');
  return 'D:' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) +
         p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
}

module.exports = { Documento, COLOR, num2, fmtBs, recortar };

