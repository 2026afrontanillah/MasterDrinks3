const fs = require('fs');
const path = require('path');
const { construirPdfCierre } = require('../lib/reporte-cierre');

const datosTest = {
  evento: {
    nombre_evento: 'Serenata a Cochabamba',
    cliente: 'Link',
    fecha_evento: '2026-09-13',
    lugar: 'Cochabamba',
    responsable: 'Admin',
    barra: 'VIP'
  },
  generado: '2026-09-15 12:00:00',
  resumen: {
    comandas: 842,
    validas: 832,
    anuladas: 10,
    cortesias: 15,
    cortesias_completadas: 14,
    cortesias_anuladas: 1,
    recaudado: 108560,
    importe_anulado: 3545,
    importe_cortesia: 5820,
    importe_cortesia_anulado: 700,
    unidades: 3500
  },
  porCajero: [
    { cajero: 'Josué Figueroa', comandas: 299, importe: 39465 },
    { cajero: 'Cristian Gutierrez', comandas: 280, importe: 37120 },
    { cajero: 'Alison Aguilar', comandas: 253, importe: 31975 }
  ],
  porMetodoCajero: [
    { cajero: 'Josué Figueroa', efectivo: 20435, qr: 10985, transferencia: 0, tarjeta: 8045, total: 39465 },
    { cajero: 'Cristian Gutierrez', efectivo: 24990, qr: 8755, transferencia: 0, tarjeta: 3375, total: 37120 },
    { cajero: 'Alison Aguilar', efectivo: 20240, qr: 6635, transferencia: 0, tarjeta: 5100, total: 31975 }
  ],
  porMeseroMetodo: [
    { mesero: 'Jose Merino', efectivo: 6410, qr: 4065, transferencia: 0, tarjeta: 2510, total: 12985 },
    { mesero: 'Dennis Veliz', efectivo: 4510, qr: 2175, transferencia: 0, tarjeta: 1940, total: 8625 },
    { mesero: 'Maya Rocha', efectivo: 4095, qr: 775, transferencia: 0, tarjeta: 3505, total: 8375 },
    { mesero: 'Luz Tinini', efectivo: 4830, qr: 1980, transferencia: 0, tarjeta: 1545, total: 8355 }
  ],
  productos: [
    { producto: '7 Up 2lt', cantidad: 5, equivalencia_fisica: '-', tipo_venta: 'Acompañante incluido', precio_aplicado: 0, total: 0 },
    { producto: '7 Up 2lt', cantidad: 45, equivalencia_fisica: '-', tipo_venta: 'Venta normal', precio_aplicado: 30, total: 1350 },
    { producto: 'Shot Tequila Chocolate', cantidad: 1, equivalencia_fisica: '0 botellas + 1 shots', tipo_venta: 'Venta normal', precio_aplicado: 40, total: 40 },
    { producto: 'Shot Tequila Reposado', cantidad: 5, equivalencia_fisica: '0 botellas + 5 shots', tipo_venta: 'Venta normal', precio_aplicado: 40, total: 200 },
    { producto: 'Vaso Fernet con Coca', cantidad: 75, equivalencia_fisica: '4 botellas + 11 vasos', tipo_venta: 'Venta normal', precio_aplicado: 35, total: 2625 }
  ],
  cortesias: [
    { id_comanda: 'V-143', fecha_hora: '13/9/2026 18:31', total: 700, estado_pago: 'ANULADO', cajero: 'Alison Aguilar', mesero: 'Sra Rocio', detalle_texto: '2x Ron 37 Lenguas; 1x Pepsi 2lt' },
    { id_comanda: 'V-145', fecha_hora: '13/9/2026 18:33', total: 350, estado_pago: 'COMPLETADO', cajero: 'Alison Aguilar', mesero: 'Sra Rocio', detalle_texto: '1x Ron 37 Lenguas; 1x Pepsi 2lt' }
  ],
  comandas: [
    { id_comanda: 1, fecha_hora: '13/9/2026 15:35', pago_texto: 'QR 30', total: 30, cajero: 'Cristian Gutierrez', mesero: 'Andrea Vargas', detalle_texto: '1x Pepsi 2lt' },
    { id_comanda: 2, fecha_hora: '13/9/2026 15:35', pago_texto: 'Ef. 25', total: 25, cajero: 'Josué Figueroa', mesero: 'Madhelyne Ledezma', detalle_texto: '2x Cerveza Paceña' }
  ]
};

const buffer = construirPdfCierre(datosTest);
const outputPath = path.join(__dirname, 'test_cierre.pdf');
fs.writeFileSync(outputPath, buffer);
console.log('PDF generado exitosamente en:', outputPath);
