const { chromium } = require('playwright');
const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Configuración de tiempos optimizados (milisegundos)
const WAIT_TIMES = {
  short: 300,
  medium: 800,
  long: 1100,
  xlong: 1800,
  xxlong: 2000
};

// Configuración del proxy desde variables de entorno
const PROXY_CONFIG = {
  server: process.env.PROXY_SERVER || 'http://rko4yuebgb.cn.fxdx.in:17313',
  username: process.env.PROXY_USERNAME || '1Q2W3E4R5T6B',
  password: process.env.PROXY_PASSWORD || '1LEREGAZA89re89'
};

const EMAIL = process.env.EMAIL || 'hdhdhd78@gmail.com';

// Variable para controlar solicitudes simultáneas
let isProcessing = false;
let requestQueue = 0;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runAutomation(placa) {
  const browser = await chromium.launch({ 
    headless: true,
    proxy: PROXY_CONFIG,
    args: [
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-setuid-sandbox',
      '--no-sandbox',
      '--disable-accelerated-2d-canvas',
      '--disable-web-security',
      '--disable-features=site-per-process',
      `--proxy-server=${PROXY_CONFIG.server}`
    ]
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    proxy: PROXY_CONFIG
  });
  
  const page = await context.newPage();
  
  try {
    console.log(`Conectando con proxy: ${PROXY_CONFIG.server}...`);
    
    await page.goto('https://icvnl.gob.mx:1080/estadoctav3/edoctaconsulta#no-back-button', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await delay(WAIT_TIMES.medium);
    
    await page.getByRole('checkbox', { name: 'Acepto bajo protesta de decir' }).check();
    await delay(WAIT_TIMES.short);
    
    await page.getByRole('textbox', { name: 'Placa' }).click();
    await page.getByRole('textbox', { name: 'Placa' }).fill(placa);
    await delay(WAIT_TIMES.short);
    
    await page.locator('div:nth-child(4)').click();
    await delay(WAIT_TIMES.long);
    
    await page.getByRole('button', { name: 'Consultar' }).click();
    await delay(WAIT_TIMES.xlong);
    
    try {
      await page.waitForSelector('input[name="robot"], input[type="checkbox"]', { 
        timeout: 8000
      });
      await page.getByRole('checkbox', { name: 'No soy un robot' }).check();
      await delay(WAIT_TIMES.long);
    } catch (error) {
      console.log('No se encontró captcha o ya estaba resuelto');
    }
    
    await page.getByRole('textbox', { name: 'Email' }).click();
    await page.getByRole('textbox', { name: 'Email' }).fill(EMAIL);
    await delay(WAIT_TIMES.short);
    
    await page.getByRole('button', { name: 'Ver estado de cuenta' }).click();
    await delay(WAIT_TIMES.xxlong);
    
    // Obtener todo el contenido de la página
    const pageContent = await page.content();
    
    // Extraer datos usando selectores más específicos
    const allData = {
      placa: placa,
      informacionGeneral: {},
      informacionVehiculo: {},
      cargos: [],
      resumenPago: {},
      textoCompleto: ''
    };
    
    // Intentar extraer información usando múltiples selectores
    try {
      // Extraer información general (si existe)
      const infoSelectors = [
        'div.container', 'div.main-content', 'div.resultados', 
        'div.panel', 'div.card', 'table', 'tbody', 'div.row'
      ];
      
      for (const selector of infoSelectors) {
        const elements = await page.$$(selector);
        for (const element of elements) {
          const text = await element.textContent();
          if (text && text.trim().length > 10) {
            allData.textoCompleto += text + '\n';
          }
        }
      }
    } catch (error) {
      console.log('No se pudo extraer con selectores específicos:', error.message);
    }
    
    // Si no se obtuvo mucho texto con selectores, obtener todo el body
    if (allData.textoCompleto.length < 500) {
      const bodyText = await page.textContent('body');
      allData.textoCompleto = bodyText;
    }
    
    // Procesar el texto completo para extraer información estructurada
    const lines = allData.textoCompleto.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    // Filtrar solo líneas verdaderamente irrelevantes (código JS, etiquetas HTML, etc.)
    const filteredLines = lines.filter(line => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return false;
      
      // Solo eliminar líneas que son claramente código o basura
      const garbagePatterns = [
        /^<script/i,
        /^<\/script/i,
        /^<!--/i,
        /^-->/i,
        /^function /i,
        /^\$\('#/,
        /^CDATA/i,
        /^\/\/<!\[CDATA\[/i,
        /^\/\/\]\]>/i,
        /^console\.log/i,
        /^get_ip\(\)/i,
        /^\s*\{.*\}\s*$/,
        /^\s*\[\].*\]\s*$/,
        /^javascript:/i,
        /^\s*$/,
        /^\s*<\s*\/?\s*\w+\s*>\s*$/,
        /^\+.*\+$/,
        /^var\s+\w+\s*=/i,
        /^let\s+\w+\s*=/i,
        /^const\s+\w+\s*=/i,
        /^if\s*\(/i,
        /^else\s*{/i,
        /^for\s*\(/i,
        /^while\s*\(/i,
        /^document\./i,
        /^window\./i,
        /^setTimeout\(/i,
        /^setInterval\(/i,
        /^\.ajax\(/i,
        /^\$\.get\(/i,
        /^\$\.post\(/i
      ];
      
      // Solo filtrar si coincide con patrones de basura
      return !garbagePatterns.some(pattern => pattern.test(trimmedLine));
    });
    
    // Extraer información específica del vehículo
    const vehicleKeywords = [
      'Marca:', 'Modelo:', 'Linea:', 'Tipo:', 'Color:', 'NIV:', 
      'Año:', 'Placa:', 'Motor:', 'Serie:', 'Propietario:',
      'RFC:', 'CURP:', 'Dirección:', 'Colonia:', 'Municipio:',
      'Estado:', 'Código Postal:', 'Teléfono:', 'Email:'
    ];
    
    // Buscar información del vehículo
    for (let i = 0; i < filteredLines.length; i++) {
      const line = filteredLines[i];
      
      // Buscar etiquetas de información del vehículo
      for (const keyword of vehicleKeywords) {
        if (line.includes(keyword)) {
          const nextLine = i + 1 < filteredLines.length ? filteredLines[i + 1] : '';
          allData.informacionVehiculo[keyword.replace(':', '').toLowerCase()] = 
            line.replace(keyword, '').trim() || nextLine.trim();
        }
      }
      
      // Buscar cargos (líneas con montos de dinero)
      if (line.match(/\$\s*[\d,]+\.?\d*/) || line.match(/\d{4}\s+\$/) || line.match(/[\d,]+\.\d{2}/)) {
        // Verificar que no sea un total o subtotal
        if (!line.includes('TOTAL') && !line.includes('SUBTOTAL') && !line.includes('TOTAL A PAGAR')) {
          allData.cargos.push(line);
        }
      }
      
      // Buscar resumen de pagos
      if (line.includes('SUBTOTAL') || line.match(/SUBTOTAL.*\$\s*[\d,]+\.?\d*/i)) {
        allData.resumenPago.subtotal = line;
      }
      if (line.includes('TOTAL A PAGAR') || line.match(/TOTAL.*PAGAR.*\$\s*[\d,]+\.?\d*/i)) {
        allData.resumenPago.totalAPagar = line;
      }
      if (line.includes('MONTO SUBSIDIO') || line.includes('SUBSIDIO')) {
        allData.resumenPago.subsidio = line;
      }
      if (line.includes('RECARGO') || line.includes('RECARGOS')) {
        allData.resumenPago.recargos = line;
      }
      if (line.includes('DESCUENTO') || line.includes('DESCUENTOS')) {
        allData.resumenPago.descuentos = line;
      }
    }
    
    // Si no se encontraron cargos específicos, buscar por patrones alternativos
    if (allData.cargos.length === 0) {
      for (const line of filteredLines) {
        // Buscar líneas que parezcan conceptos de pago
        if (line.length > 20 && line.length < 100 && 
            (line.match(/\d{4}/) || line.includes('ADECUACION') || 
             line.includes('REFERENCIA') || line.includes('CONCEPTO'))) {
          allData.cargos.push(line);
        }
      }
    }
    
    // Si aún no hay cargos, agregar una nota
    if (allData.cargos.length === 0) {
      allData.cargos = ['No se encontraron cargos específicos en la página'];
    }
    
    // Asegurarse de que siempre haya información del vehículo
    if (Object.keys(allData.informacionVehiculo).length === 0) {
      // Buscar cualquier línea que pueda contener información del vehículo
      for (const line of filteredLines) {
        if (line.length > 5 && line.length < 50 && 
            !line.match(/[\$\€\£]/) && 
            !line.includes('http') && 
            !line.includes('www.')) {
          
          // Intentar clasificar la línea
          if (line.match(/[A-Z]{3}-\d{3,4}/i) || line.match(/[A-Z]{2,3}\d{4}/i)) {
            allData.informacionVehiculo.placa = line;
          } else if (line.match(/TOYOTA|NISSAN|HONDA|FORD|CHEVROLET|VOLKSWAGEN|BMW|MERCEDES/i)) {
            allData.informacionVehiculo.marca = line;
          } else if (line.match(/\d{4}/) && line.length < 10) {
            allData.informacionVehiculo.modelo = line;
          } else if (line.match(/GRIS|AZUL|ROJO|NEGRO|BLANCO|VERDE|AMARILLO/i)) {
            allData.informacionVehiculo.color = line;
          }
        }
      }
    }
    
    // Preparar respuesta final completa
    const resultado = {
      placa: placa,
      timestamp: new Date().toISOString(),
      estadoConsulta: 'completa',
      datosExtraidos: {
        informacionVehiculo: allData.informacionVehiculo,
        cargos: allData.cargos,
        resumenPago: allData.resumenPago
      },
      contenidoFiltrado: filteredLines,
      metadatos: {
        totalLineas: filteredLines.length,
        lineasOriginales: lines.length,
        tieneCargos: allData.cargos.length > 0,
        tieneInfoVehiculo: Object.keys(allData.informacionVehiculo).length > 0,
        tieneResumen: Object.keys(allData.resumenPago).length > 0
      }
    };
    
    return resultado;
    
  } catch (error) {
    console.error('Error durante la automatización:', error.message);
    
    // Devolver información del error pero manteniendo estructura
    return {
      placa: placa,
      timestamp: new Date().toISOString(),
      estadoConsulta: 'error',
      error: {
        mensaje: error.message,
        tipo: error.name,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      datosExtraidos: {
        informacionVehiculo: {},
        cargos: ['No se pudieron extraer cargos debido a un error'],
        resumenPago: {}
      },
      contenidoFiltrado: [],
      metadatos: {
        totalLineas: 0,
        lineasOriginales: 0,
        tieneCargos: false,
        tieneInfoVehiculo: false,
        tieneResumen: false
      }
    };
  } finally {
    await browser.close();
  }
}

// Middleware para verificar solicitudes simultáneas
function checkSimultaneousRequests(req, res, next) {
  requestQueue++;
  console.log(`📊 Solicitudes en cola: ${requestQueue}`);
  
  if (isProcessing) {
    requestQueue--;
    console.log(`❌ Solicitud rechazada - Ya hay una consulta en proceso`);
    return res.status(429).json({
      error: 'sin respuesta',
      mensaje: 'El sistema está procesando otra consulta. Intente nuevamente en unos momentos.',
      estado: 'ocupado',
      timestamp: new Date().toISOString()
    });
  }
  
  isProcessing = true;
  console.log(`✅ Solicitud aceptada - Iniciando proceso`);
  
  next();
}

// Endpoints de la API
app.get('/', (req, res) => {
  res.json({
    message: 'API de consulta de estado de cuenta vehicular - Versión Completa',
    status: 'online',
    version: '2.0.0',
    descripcion: 'API que devuelve TODA la información disponible sin omitir datos relevantes',
    proxy: 'activado',
    solicitudes_simultaneas: '1 máximo',
    estado_actual: isProcessing ? 'procesando' : 'disponible',
    cola: requestQueue,
    timestamp: new Date().toISOString(),
    endpoints: {
      consulta: 'GET /consulta?placa=ABC123',
      consultaPost: 'POST /consulta con JSON body { "placa": "ABC123" }',
      consultaDetallada: 'GET /consulta-detallada?placa=ABC123',
      health: 'GET /health',
      consola: 'GET /consulta-consola/:placa',
      html: 'GET /consulta-html/:placa'
    },
    ejemplo_respuesta: {
      placa: "ABC123",
      timestamp: "2024-01-15T10:30:00.000Z",
      estadoConsulta: "completa",
      datosExtraidos: {
        informacionVehiculo: {
          marca: "TOYOTA",
          modelo: "2023",
          linea: "CAMRY",
          tipo: "SEDAN",
          color: "NEGRO",
          niv: "12345678901234567"
        },
        cargos: [
          "2023 TENENCIA $1,500.00",
          "2023 VERIFICACION $350.00"
        ],
        resumenPago: {
          subtotal: "SUBTOTAL: $1,850.00",
          totalAPagar: "TOTAL A PAGAR: $1,850.00",
          subsidio: "MONTO SUBSIDIO: $0.00"
        }
      },
      contenidoFiltrado: ["Lista completa de líneas filtradas..."],
      metadatos: {
        totalLineas: 45,
        lineasOriginales: 120,
        tieneCargos: true,
        tieneInfoVehiculo: true,
        tieneResumen: true
      }
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    proxy: 'configurado',
    procesando: isProcessing,
    cola: requestQueue,
    service: 'consulta-vehicular-api-completa',
    version: '2.0.0'
  });
});

app.get('/consulta', checkSimultaneousRequests, async (req, res) => {
  try {
    const { placa } = req.query;
    
    if (!placa) {
      isProcessing = false;
      requestQueue--;
      return res.status(400).json({
        error: 'Placa requerida. Ejemplo: /consulta?placa=ABC123',
        timestamp: new Date().toISOString()
      });
    }
    
    const placaLimpia = placa.trim().toUpperCase().replace(/\s+/g, '');
    
    if (!placaLimpia) {
      isProcessing = false;
      requestQueue--;
      return res.status(400).json({
        error: 'Placa requerida',
        timestamp: new Date().toISOString()
      });
    }
    
    const startTime = Date.now();
    console.log(`\nIniciando consulta para placa: ${placaLimpia}`);
    console.log(`Usando proxy: ${PROXY_CONFIG.server}`);
    
    const resultados = await runAutomation(placaLimpia);
    const tiempo = ((Date.now() - startTime) / 1000).toFixed(2);
    
    // Añadir metadata de tiempo
    resultados.tiempoProcesamiento = `${tiempo} segundos`;
    resultados.servidorProxy = PROXY_CONFIG.server;
    resultados.fechaConsulta = new Date().toISOString();
    
    console.log(`Consulta completada en ${tiempo} segundos`);
    
    res.json(resultados);
    
  } catch (error) {
    console.error('Error en la consulta:', error);
    
    const errorResponse = {
      error: 'Error en la consulta',
      message: error.message,
      timestamp: new Date().toISOString(),
      detalles: 'Verifique: 1. Conexión a internet, 2. Proxy disponible, 3. Placa correcta',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    };
    
    res.status(500).json(errorResponse);
  } finally {
    isProcessing = false;
    requestQueue--;
    console.log(`🔄 Sistema liberado. Estado: disponible`);
  }
});

app.get('/consulta-detallada', checkSimultaneousRequests, async (req, res) => {
  try {
    const { placa } = req.query;
    
    if (!placa) {
      isProcessing = false;
      requestQueue--;
      return res.status(400).json({
        error: 'Placa requerida. Ejemplo: /consulta-detallada?placa=ABC123',
        timestamp: new Date().toISOString()
      });
    }
    
    const placaLimpia = placa.trim().toUpperCase().replace(/\s+/g, '');
    
    if (!placaLimpia) {
      isProcessing = false;
      requestQueue--;
      return res.status(400).json({
        error: 'Placa requerida',
        timestamp: new Date().toISOString()
      });
    }
    
    const startTime = Date.now();
    console.log(`\nIniciando consulta DETALLADA para placa: ${placaLimpia}`);
    
    const resultados = await runAutomation(placaLimpia);
    const tiempo = ((Date.now() - startTime) / 1000).toFixed(2);
    
    // Versión más detallada
    const respuestaDetallada = {
      ...resultados,
      metadata: {
        tiempoProcesamiento: `${tiempo} segundos`,
        proxyUtilizado: PROXY_CONFIG.server,
        fechaHora: new Date().toISOString(),
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        modoExtraccion: 'completa',
        filtrosAplicados: 'solo código JavaScript y etiquetas HTML'
      },
      estadisticas: {
        lineasProcesadas: resultados.contenidoFiltrado.length,
        cargosEncontrados: resultados.datosExtraidos.cargos.length,
        camposVehiculo: Object.keys(resultados.datosExtraidos.informacionVehiculo).length,
        camposResumen: Object.keys(resultados.datosExtraidos.resumenPago).length
      }
    };
    
    console.log(`Consulta detallada completada en ${tiempo} segundos`);
    
    res.json(respuestaDetallada);
    
  } catch (error) {
    console.error('Error en la consulta detallada:', error);
    res.status(500).json({
      error: 'Error en la consulta detallada',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    isProcessing = false;
    requestQueue--;
    console.log(`🔄 Sistema liberado. Estado: disponible`);
  }
});

app.post('/consulta', checkSimultaneousRequests, async (req, res) => {
  try {
    const { placa } = req.body;
    
    if (!placa) {
      isProcessing = false;
      requestQueue--;
      return res.status(400).json({
        error: 'Placa requerida en el body. Ejemplo: { "placa": "ABC123" }',
        timestamp: new Date().toISOString()
      });
    }
    
    const placaLimpia = placa.trim().toUpperCase().replace(/\s+/g, '');
    
    if (!placaLimpia) {
      isProcessing = false;
      requestQueue--;
      return res.status(400).json({
        error: 'Placa requerida',
        timestamp: new Date().toISOString()
      });
    }
    
    const startTime = Date.now();
    console.log(`\nIniciando consulta POST para placa: ${placaLimpia}`);
    
    const resultados = await runAutomation(placaLimpia);
    const tiempo = ((Date.now() - startTime) / 1000).toFixed(2);
    
    resultados.tiempoProcesamiento = `${tiempo} segundos`;
    resultados.fechaConsulta = new Date().toISOString();
    
    console.log(`Consulta POST completada en ${tiempo} segundos`);
    
    res.json(resultados);
    
  } catch (error) {
    console.error('Error en la consulta POST:', error);
    res.status(500).json({
      error: 'Error en la consulta',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    isProcessing = false;
    requestQueue--;
    console.log(`🔄 Sistema liberado. Estado: disponible`);
  }
});

// Endpoint para formato de consola
app.get('/consulta-consola/:placa', checkSimultaneousRequests, async (req, res) => {
  try {
    const { placa } = req.params;
    
    if (!placa) {
      isProcessing = false;
      requestQueue--;
      return res.status(400).send('Error: Placa requerida\n');
    }
    
    const placaLimpia = placa.trim().toUpperCase().replace(/\s+/g, '');
    const startTime = Date.now();
    
    console.log(`\nIniciando consulta CONSOLA para placa: ${placaLimpia}`);
    
    const resultados = await runAutomation(placaLimpia);
    const tiempo = ((Date.now() - startTime) / 1000).toFixed(2);
    
    // Formatear respuesta para consola
    let respuesta = '';
    respuesta += '\n' + '='.repeat(60) + '\n';
    respuesta += `CONSULTA COMPLETA - PLACA: ${resultados.placa}\n`;
    respuesta += '='.repeat(60) + '\n';
    respuesta += `Fecha: ${resultados.fechaConsulta || new Date().toISOString()}\n`;
    respuesta += `Tiempo: ${tiempo} segundos\n`;
    respuesta += `Estado: ${resultados.estadoConsulta}\n`;
    respuesta += '\n' + '-'.repeat(60) + '\n';
    
    respuesta += '\n📋 INFORMACIÓN DEL VEHÍCULO:\n';
    respuesta += '-'.repeat(30) + '\n';
    const infoVehiculo = resultados.datosExtraidos.informacionVehiculo;
    if (Object.keys(infoVehiculo).length > 0) {
      for (const [key, value] of Object.entries(infoVehiculo)) {
        respuesta += `${key.toUpperCase()}: ${value}\n`;
      }
    } else {
      respuesta += 'No se encontró información del vehículo\n';
    }
    
    respuesta += '\n💰 CARGOS DETECTADOS:\n';
    respuesta += '-'.repeat(30) + '\n';
    if (resultados.datosExtraidos.cargos && resultados.datosExtraidos.cargos.length > 0) {
      if (resultados.datosExtraidos.cargos[0] === 'No se encontraron cargos específicos en la página') {
        respuesta += 'No se encontraron cargos específicos\n';
      } else {
        resultados.datosExtraidos.cargos.forEach((cargo, index) => {
          respuesta += `${index + 1}. ${cargo}\n`;
        });
      }
    } else {
      respuesta += 'No se encontraron cargos\n';
    }
    
    respuesta += '\n🧾 RESUMEN DE PAGO:\n';
    respuesta += '-'.repeat(30) + '\n';
    const resumen = resultados.datosExtraidos.resumenPago;
    if (Object.keys(resumen).length > 0) {
      for (const [key, value] of Object.entries(resumen)) {
        respuesta += `${key.toUpperCase()}: ${value}\n`;
      }
    } else {
      respuesta += 'No se encontró resumen de pago\n';
    }
    
    respuesta += '\n📊 METADATOS:\n';
    respuesta += '-'.repeat(30) + '\n';
    const meta = resultados.metadatos || {};
    respuesta += `Líneas procesadas: ${meta.totalLineas || 0}\n`;
    respuesta += `Cargos encontrados: ${meta.tieneCargos ? 'Sí' : 'No'}\n`;
    respuesta += `Info vehículo: ${meta.tieneInfoVehiculo ? 'Sí' : 'No'}\n`;
    respuesta += `Resumen pago: ${meta.tieneResumen ? 'Sí' : 'No'}\n`;
    
    respuesta += '\n📄 CONTENIDO FILTRADO (primeras 20 líneas):\n';
    respuesta += '-'.repeat(30) + '\n';
    const contenido = resultados.contenidoFiltrado || [];
    const maxLines = Math.min(20, contenido.length);
    for (let i = 0; i < maxLines; i++) {
      respuesta += `${i + 1}. ${contenido[i]}\n`;
    }
    if (contenido.length > 20) {
      respuesta += `... y ${contenido.length - 20} líneas más\n`;
    }
    
    respuesta += '\n' + '='.repeat(60) + '\n';
    respuesta += 'FIN DEL REPORTE\n';
    respuesta += '='.repeat(60) + '\n';
    
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.send(respuesta);
    
  } catch (error) {
    console.error('Error en la consulta consola:', error);
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.status(500).send(`ERROR EN LA CONSULTA\n\nDetalles:\n${error.message}\n\nVerifique:\n1. Conexión a internet\n2. Proxy disponible\n3. Placa correcta\n`);
  } finally {
    isProcessing = false;
    requestQueue--;
    console.log(`🔄 Sistema liberado. Estado: disponible`);
  }
});

// Endpoint para formato HTML
app.get('/consulta-html/:placa', checkSimultaneousRequests, async (req, res) => {
  try {
    const { placa } = req.params;
    
    if (!placa) {
      isProcessing = false;
      requestQueue--;
      return res.status(400).send('<h1>Error: Placa requerida</h1>');
    }
    
    const placaLimpia = placa.trim().toUpperCase().replace(/\s+/g, '');
    const resultados = await runAutomation(placaLimpia);
    
    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Consulta Completa - Placa ${resultados.placa}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            padding: 20px;
            min-height: 100vh;
          }
          .container { 
            max-width: 1200px; 
            margin: 0 auto; 
            background: white; 
            border-radius: 15px; 
            box-shadow: 0 10px 30px rgba(0,0,0,0.1); 
            overflow: hidden;
          }
          .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 30px; 
            text-align: center;
          }
          .header h1 { font-size: 2.5rem; margin-bottom: 10px; }
          .header .placa { 
            background: rgba(255,255,255,0.2); 
            display: inline-block; 
            padding: 10px 25px; 
            border-radius: 50px; 
            font-size: 1.8rem; 
            font-weight: bold; 
            letter-spacing: 2px;
            margin: 10px 0;
          }
          .section { 
            padding: 25px; 
            border-bottom: 1px solid #eee;
          }
          .section:last-child { border-bottom: none; }
          .section-title { 
            color: #667eea; 
            font-size: 1.4rem; 
            margin-bottom: 20px; 
            padding-bottom: 10px; 
            border-bottom: 2px solid #667eea;
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .section-title:before { 
            content: "📋"; 
            font-size: 1.2rem;
          }
          .info-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); 
            gap: 15px;
          }
          .info-card { 
            background: #f8f9fa; 
            padding: 15px; 
            border-radius: 8px; 
            border-left: 4px solid #667eea;
          }
          .info-label { 
            font-weight: bold; 
            color: #555; 
            margin-bottom: 5px; 
            font-size: 0.9rem;
          }
          .info-value { 
            font-size: 1.1rem; 
            color: #222;
          }
          .charges-list, .content-list { 
            list-style: none; 
            max-height: 300px; 
            overflow-y: auto; 
            background: #f8f9fa; 
            padding: 15px; 
            border-radius: 8px;
          }
          .charges-list li, .content-list li { 
            padding: 10px; 
            border-bottom: 1px solid #ddd; 
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .charges-list li:last-child, .content-list li:last-child { border-bottom: none; }
          .amount { 
            color: #e74c3c; 
            font-weight: bold;
          }
          .metadata { 
            display: flex; 
            flex-wrap: wrap; 
            gap: 15px; 
            justify-content: center;
          }
          .meta-card { 
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); 
            color: white; 
            padding: 20px; 
            border-radius: 10px; 
            text-align: center; 
            flex: 1; 
            min-width: 200px;
          }
          .meta-value { 
            font-size: 2rem; 
            font-weight: bold; 
            margin: 10px 0;
          }
          .status-badge { 
            display: inline-block; 
            padding: 5px 15px; 
            border-radius: 20px; 
            font-size: 0.9rem; 
            font-weight: bold; 
            margin: 5px;
          }
          .status-success { background: #2ecc71; color: white; }
          .status-error { background: #e74c3c; color: white; }
          .status-warning { background: #f39c12; color: white; }
          .timestamp { 
            text-align: center; 
            color: #777; 
            font-size: 0.9rem; 
            padding: 20px;
            border-top: 1px solid #eee;
          }
          @media (max-width: 768px) {
            .header h1 { font-size: 2rem; }
            .info-grid { grid-template-columns: 1fr; }
            .meta-card { min-width: 100%; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Consulta Vehicular Completa</h1>
            <div class="placa">${resultados.placa}</div>
            <div style="margin-top: 10px;">
              <span class="status-badge ${resultados.estadoConsulta === 'completa' ? 'status-success' : 'status-error'}">
                ${resultados.estadoConsulta.toUpperCase()}
              </span>
              <span>Proxy: ${PROXY_CONFIG.server.split(':')[1] || 'Activo'}</span>
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">📊 Información del Vehículo</div>
            <div class="info-grid">
              ${Object.entries(resultados.datosExtraidos.informacionVehiculo)
                .map(([key, value]) => `
                <div class="info-card">
                  <div class="info-label">${key.toUpperCase()}</div>
                  <div class="info-value">${value || 'No disponible'}</div>
                </div>`)
                .join('')}
              ${Object.keys(resultados.datosExtraidos.informacionVehiculo).length === 0 ? 
                '<div class="info-card"><div class="info-value">No se encontró información del vehículo</div></div>' : ''}
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">💰 Cargos y Multas</div>
            <ul class="charges-list">
              ${resultados.datosExtraidos.cargos
                .map((cargo, index) => `
                <li>
                  <span>${index + 1}. ${cargo.split('$')[0] || cargo}</span>
                  ${cargo.includes('$') ? 
                    `<span class="amount">$${cargo.split('$')[1]}</span>` : 
                    ''}
                </li>`)
                .join('')}
            </ul>
          </div>
          
          <div class="section">
            <div class="section-title">🧾 Resumen de Pagos</div>
            <div class="info-grid">
              ${Object.entries(resultados.datosExtraidos.resumenPago)
                .map(([key, value]) => `
                <div class="info-card">
                  <div class="info-label">${key.toUpperCase()}</div>
                  <div class="info-value ${key.includes('total') ? 'amount' : ''}">
                    ${value}
                  </div>
                </div>`)
                .join('')}
              ${Object.keys(resultados.datosExtraidos.resumenPago).length === 0 ? 
                '<div class="info-card"><div class="info-value">No se encontró resumen de pago</div></div>' : ''}
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">📈 Metadatos y Estadísticas</div>
            <div class="metadata">
              <div class="meta-card">
                <div>Líneas Procesadas</div>
                <div class="meta-value">${resultados.metadatos?.totalLineas || 0}</div>
                <div>de ${resultados.metadatos?.lineasOriginales || 0} originales</div>
              </div>
              <div class="meta-card">
                <div>Cargos Encontrados</div>
                <div class="meta-value">${resultados.datosExtraidos.cargos.length}</div>
                <div>${resultados.metadatos?.tieneCargos ? '✅ Con cargos' : '❌ Sin cargos'}</div>
              </div>
              <div class="meta-card">
                <div>Información Vehículo</div>
                <div class="meta-value">${Object.keys(resultados.datosExtraidos.informacionVehiculo).length}</div>
                <div>campos extraídos</div>
              </div>
              <div class="meta-card">
                <div>Tiempo</div>
                <div class="meta-value">${resultados.tiempoProcesamiento || 'N/A'}</div>
                <div>de procesamiento</div>
              </div>
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">📄 Contenido Filtrado (muestra)</div>
            <ul class="content-list">
              ${(resultados.contenidoFiltrado || [])
                .slice(0, 15)
                .map((linea, index) => `
                <li>
                  <span>${index + 1}. ${linea.substring(0, 80)}${linea.length > 80 ? '...' : ''}</span>
                </li>`)
                .join('')}
              ${(resultados.contenidoFiltrado || []).length > 15 ? 
                `<li style="text-align: center; color: #667eea; font-style: italic;">
                  ... y ${resultados.contenidoFiltrado.length - 15} líneas más
                </li>` : ''}
            </ul>
          </div>
          
          <div class="timestamp">
            Consulta realizada el: ${resultados.fechaConsulta || new Date().toISOString()} | 
            Proxy: ${PROXY_CONFIG.server} | 
            API Versión: 2.0.0
          </div>
        </div>
      </body>
      </html>
    `;
    
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
    
  } catch (error) {
    const errorHtml = `
      <!DOCTYPE html>
      <html>
      <head><title>Error en consulta</title></head>
      <body style="font-family: Arial; padding: 20px;">
        <h1 style="color: #e74c3c;">❌ Error en la consulta</h1>
        <p><strong>Mensaje:</strong> ${error.message}</p>
        <p><strong>Posibles causas:</strong></p>
        <ul>
          <li>La placa puede ser incorrecta</li>
          <li>Problemas de conexión con el proxy</li>
          <li>El servicio puede estar temporalmente fuera de línea</li>
        </ul>
        <p><a href="/">Volver al inicio</a></p>
      </body>
      </html>
    `;
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.status(500).send(errorHtml);
  } finally {
    isProcessing = false;
    requestQueue--;
  }
});

// Endpoint para descargar datos en JSON
app.get('/consulta-json/:placa', checkSimultaneousRequests, async (req, res) => {
  try {
    const { placa } = req.params;
    
    if (!placa) {
      isProcessing = false;
      requestQueue--;
      return res.status(400).json({ error: 'Placa requerida' });
    }
    
    const placaLimpia = placa.trim().toUpperCase().replace(/\s+/g, '');
    const resultados = await runAutomation(placaLimpia);
    
    // Configurar headers para descarga
    const filename = `consulta-vehicular-${placaLimpia}-${Date.now()}.json`;
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    res.send(JSON.stringify(resultados, null, 2));
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    isProcessing = false;
    requestQueue--;
  }
});

app.listen(port, () => {
  console.log(`🚀 API DE CONSULTA COMPLETA INICIADA`);
  console.log(`📡 Puerto: ${port}`);
  console.log(`🌐 Proxy: ${PROXY_CONFIG.server}`);
  console.log(`📧 Email: ${EMAIL}`);
  console.log(`🚫 Solicitudes simultáneas: 1 máximo`);
  console.log(`📊 Modo: COMPLETO (sin omitir información relevante)`);
  console.log(`✅ Endpoints disponibles:`);
  console.log(`   GET  /                         - Información de la API`);
  console.log(`   GET  /consulta?placa=ABC123    - Consulta básica`);
  console.log(`   GET  /consulta-detallada?placa=ABC123 - Consulta detallada`);
  console.log(`   POST /consulta                 - Consulta por POST`);
  console.log(`   GET  /consulta-consola/ABC123  - Formato consola`);
  console.log(`   GET  /consulta-html/ABC123     - Formato HTML`);
  console.log(`   GET  /consulta-json/ABC123     - Descarga JSON`);
  console.log(`   GET  /health                   - Estado del servicio`);
  console.log(``);
  console.log(`⚠️  ADVERTENCIA: Esta versión devuelve TODA la información disponible`);
  console.log(`   Solo se filtran líneas de código JavaScript y etiquetas HTML`);
});
