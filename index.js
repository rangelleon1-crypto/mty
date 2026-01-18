const { chromium } = require('playwright');
const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Configuración de tiempos optimizados REDUCIDOS (milisegundos)
const WAIT_TIMES = {
  short: 200,      // Reducido de 300
  medium: 500,     // Reducido de 800
  long: 700,       // Reducido de 1100
  xlong: 1200,     // Reducido de 1800
  xxlong: 1400     // Reducido de 2000
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
      '--disable-blink-features=AutomationControlled',
      `--proxy-server=${PROXY_CONFIG.server}`
    ]
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    proxy: PROXY_CONFIG,
    javaScriptEnabled: true
  });
  
  const page = await context.newPage();
  
  try {
    console.log(`Conectando con proxy: ${PROXY_CONFIG.server}...`);
    
    // Navegación más rápida con timeout reducido
    await page.goto('https://icvnl.gob.mx:1080/estadoctav3/edoctaconsulta#no-back-button', {
      waitUntil: 'domcontentloaded',
      timeout: 20000  // Reducido de 30000
    });
    await delay(WAIT_TIMES.medium);
    
    // Realizar acciones más rápidas sin delays innecesarios
    await page.getByRole('checkbox', { name: 'Acepto bajo protesta de decir' }).check();
    
    await page.getByRole('textbox', { name: 'Placa' }).click();
    await page.getByRole('textbox', { name: 'Placa' }).fill(placa);
    
    await page.locator('div:nth-child(4)').click();
    await delay(WAIT_TIMES.short);
    
    await page.getByRole('button', { name: 'Consultar' }).click();
    
    // ESPERAR REDUCIDA para verificar campo de email
    await delay(2500); // Reducido de 6000 a 2500ms
    
    // Verificar si el campo de email está presente más rápidamente
    const emailFieldVisible = await page.getByRole('textbox', { name: 'Email' }).isVisible({ timeout: 3000 }).catch(() => false);
    
    // Si el campo de email NO está visible después de 2.5 segundos, la placa no tiene adeudo
    if (!emailFieldVisible) {
      // Verificación rápida de contenido
      const pageContent = await page.textContent('body', { timeout: 2000 }).catch(() => '');
      const sinAdeudoPatterns = [
        /sin\s+adeudo/i,
        /no\s+tiene\s+adeudo/i,
        /no\s+se\s+encontraron/i,
        /sin\s+deuda/i,
        /no\s+existen\s+cargos/i,
        /pago\s+al\s+corriente/i
      ];
      
      const tieneAdeudo = sinAdeudoPatterns.some(pattern => pattern.test(pageContent));
      
      if (!tieneAdeudo) {
        const mensajeExito = await page.locator('text=/pago realizado/i, text=/comprobante/i, text=/éxito/i').isVisible({ timeout: 2000 }).catch(() => false);
        
        if (!mensajeExito) {
          throw new Error('PLACA SIN ADEUDO');
        }
      }
    }
    
    // Proceso para placas CON adeudo (optimizado)
    try {
      await page.waitForSelector('input[name="robot"], input[type="checkbox"]', { 
        timeout: 5000  // Reducido de 8000
      });
      await page.getByRole('checkbox', { name: 'No soy un robot' }).check();
      await delay(WAIT_TIMES.short);
    } catch (error) {
      console.log('No se encontró captcha o ya estaba resuelto');
    }
    
    await page.getByRole('textbox', { name: 'Email' }).click();
    await page.getByRole('textbox', { name: 'Email' }).fill(EMAIL);
    
    await page.getByRole('button', { name: 'Ver estado de cuenta' }).click();
    
    // Espera optimizada para la carga de resultados
    await Promise.race([
      page.waitForSelector('body', { timeout: WAIT_TIMES.xlong }),
      delay(WAIT_TIMES.xlong)
    ]);
    
    // Extraer datos limpios de forma más eficiente
    const pageContent = await page.evaluate(() => {
      // Extracción directa del DOM para mayor velocidad
      const body = document.body;
      const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, null, false);
      const textNodes = [];
      let node;
      while (node = walker.nextNode()) {
        textNodes.push(node.textContent);
      }
      return textNodes.join('\n');
    });
    
    // Procesamiento más rápido de los datos
    const lines = pageContent.split('\n')
      .map(line => line.trim())
      .filter(line => {
        if (!line) return false;
        const exclusionPatterns = [
          'Selecciona el metodo de pago:',
          'Tarjeta de Crédito/Débito',
          'Línea de Referencia Bancaria',
          'Te redireccionaremos',
          'Favor de tener habilitados',
          'Cerrar',
          'get_ip',
          'CDATA',
          '$(\'#modalCargar\')',
          '//<![CDATA[',
          '//]]>',
          'function get_ip'
        ];
        return !exclusionPatterns.some(pattern => line.includes(pattern));
      });
    
    // Procesar información optimizado
    const vehicleInfo = [];
    const charges = [];
    let totalAPagar = '';
    let subtotal = '';
    
    // Patrones predefinidos para búsqueda rápida
    const vehiclePatterns = {
      'Marca:': /Marca:/i,
      'Modelo:': /Modelo:/i,
      'Linea:': /Linea:/i,
      'Tipo:': /Tipo:/i,
      'Color:': /Color:/i,
      'NIV:': /NIV:/i
    };
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Búsqueda optimizada de información del vehículo
      for (const [key, pattern] of Object.entries(vehiclePatterns)) {
        if (pattern.test(line)) {
          vehicleInfo.push(key);
          if (i + 1 < lines.length && lines[i + 1].trim() && !lines[i + 1].includes(':')) {
            vehicleInfo.push(lines[i + 1]);
          }
        }
      }
      
      // Capturar cargos (formato: año $)
      if (line.match(/\d{4}\s+\$/)) {
        charges.push(line);
      }
      
      // Capturar subtotal
      if (!subtotal && line.includes('SUBTOTAL')) {
        subtotal = line;
      }
      
      // Capturar total a pagar
      if (!totalAPagar && (line.includes('TOTAL A PAGAR') || /TOTAL.*PAGAR/i.test(line))) {
        totalAPagar = line;
      }
    }
    
    // Búsqueda alternativa rápida si no se encontró total
    if (!totalAPagar) {
      for (const line of lines) {
        if (/PAGO\s*TOTAL/i.test(line) || /TOTAL.*\$\d/.test(line)) {
          totalAPagar = line;
          break;
        }
      }
    }
    
    return {
      placa,
      vehiculo: vehicleInfo.filter(line => line && line.trim()),
      cargos: charges.length > 0 ? charges : ['No se encontraron cargos'],
      subtotal: subtotal || 'SUBTOTAL: No disponible',
      totalAPagar: totalAPagar || 'TOTAL A PAGAR: No disponible'
    };
    
  } catch (error) {
    console.error('Error durante la automatización:', error.message);
    throw error;
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
      estado: 'ocupado'
    });
  }
  
  isProcessing = true;
  console.log(`✅ Solicitud aceptada - Iniciando proceso`);
  
  next();
}

// Endpoints de la API (sin cambios significativos)
app.get('/', (req, res) => {
  res.json({
    message: 'API de consulta de estado de cuenta vehicular - OPTIMIZADA',
    status: 'online',
    proxy: 'activado',
    solicitudes_simultaneas: '1 máximo',
    estado_actual: isProcessing ? 'procesando' : 'disponible',
    cola: requestQueue,
    tiempo_estimado: '14-16 segundos',
    endpoints: {
      consulta: 'GET /consulta?placa=ABC123',
      consultaPost: 'POST /consulta con JSON body { "placa": "ABC123" }',
      health: 'GET /health',
      consola: 'GET /consulta-consola/:placa'
    },
    ejemplo: {
      url: '/consulta?placa=ABC123',
      respuesta_exito: {
        placa: "ABC123",
        vehiculo: ["Marca:", "TOYOTA", "Modelo:", "2025", "Linea:", "SIENNA HÍBRIDO", "Tipo:", "XLE, MINI VAN, SISTE", "Color:", "GRIS", "NIV:", "************45180"],
        cargos: ["No se encontraron cargos"],
        subtotal: "SUBTOTAL MONTO SUBSIDIO: -$198.00",
        totalAPagar: "TOTAL A PAGAR: $3,802.00"
      },
      respuesta_sin_adeudo: {
        placa: "XYZ789",
        mensaje: "PLACA SIN ADEUDO",
        estado: "Sin deudas pendientes",
        consultadoEn: "2024-01-15T10:30:00.000Z"
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
    service: 'consulta-vehicular-api',
    version: 'optimizada-v2'
  });
});

app.get('/consulta', checkSimultaneousRequests, async (req, res) => {
  try {
    const { placa } = req.query;
    
    if (!placa) {
      isProcessing = false;
      requestQueue--;
      return res.status(400).json({
        error: 'Placa requerida. Ejemplo: /consulta?placa=ABC123'
      });
    }
    
    const placaLimpia = placa.trim().toUpperCase().replace(/\s+/g, '');
    
    if (!placaLimpia) {
      isProcessing = false;
      requestQueue--;
      return res.status(400).json({
        error: 'Placa requerida'
      });
    }
    
    const startTime = Date.now();
    console.log(`\n🚀 Iniciando consulta OPTIMIZADA para placa: ${placaLimpia}`);
    console.log(`🌐 Usando proxy: ${PROXY_CONFIG.server}`);
    
    const resultados = await runAutomation(placaLimpia);
    const tiempo = ((Date.now() - startTime) / 1000).toFixed(2);
    
    const respuesta = {
      ...resultados,
      tiempoConsulta: `${tiempo} segundos`,
      consultadoEn: new Date().toISOString(),
      version: 'optimizada'
    };
    
    console.log(`✅ Consulta completada en ${tiempo} segundos`);
    
    res.json(respuesta);
    
  } catch (error) {
    console.error('Error en la consulta:', error.message);
    
    // Manejar específicamente el caso de "PLACA SIN ADEUDO"
    if (error.message === 'PLACA SIN ADEUDO') {
      const respuesta = {
        placa: req.query.placa ? req.query.placa.trim().toUpperCase().replace(/\s+/g, '') : 'Desconocida',
        mensaje: 'PLACA SIN ADEUDO',
        estado: 'Sin deudas pendientes',
        consultadoEn: new Date().toISOString(),
        nota: 'La placa no tiene adeudos registrados en el sistema',
        tiempoConsulta: ((Date.now() - startTime) / 1000).toFixed(2) + ' segundos'
      };
      
      res.json(respuesta);
    } else {
      res.status(500).json({
        error: 'Error en la consulta',
        message: error.message,
        detalles: 'Verifique: 1. Conexión a internet, 2. Proxy disponible, 3. Placa correcta',
        tiempoConsulta: ((Date.now() - startTime) / 1000).toFixed(2) + ' segundos'
      });
    }
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
        error: 'Placa requerida en el body. Ejemplo: { "placa": "ABC123" }'
      });
    }
    
    const placaLimpia = placa.trim().toUpperCase().replace(/\s+/g, '');
    
    if (!placaLimpia) {
      isProcessing = false;
      requestQueue--;
      return res.status(400).json({
        error: 'Placa requerida'
      });
    }
    
    const startTime = Date.now();
    console.log(`\n🚀 Iniciando consulta OPTIMIZADA para placa: ${placaLimpia}`);
    console.log(`🌐 Usando proxy: ${PROXY_CONFIG.server}`);
    
    const resultados = await runAutomation(placaLimpia);
    const tiempo = ((Date.now() - startTime) / 1000).toFixed(2);
    
    const respuesta = {
      ...resultados,
      tiempoConsulta: `${tiempo} segundos`,
      consultadoEn: new Date().toISOString(),
      version: 'optimizada'
    };
    
    console.log(`✅ Consulta completada en ${tiempo} segundos`);
    
    res.json(respuesta);
    
  } catch (error) {
    console.error('Error en la consulta:', error.message);
    
    // Manejar específicamente el caso de "PLACA SIN ADEUDO"
    if (error.message === 'PLACA SIN ADEUDO') {
      const respuesta = {
        placa: req.body.placa ? req.body.placa.trim().toUpperCase().replace(/\s+/g, '') : 'Desconocida',
        mensaje: 'PLACA SIN ADEUDO',
        estado: 'Sin deudas pendientes',
        consultadoEn: new Date().toISOString(),
        nota: 'La placa no tiene adeudos registrados en el sistema',
        tiempoConsulta: ((Date.now() - startTime) / 1000).toFixed(2) + ' segundos'
      };
      
      res.json(respuesta);
    } else {
      res.status(500).json({
        error: 'Error en la consulta',
        message: error.message,
        detalles: 'Verifique: 1. Conexión a internet, 2. Proxy disponible, 3. Placa correcta',
        tiempoConsulta: ((Date.now() - startTime) / 1000).toFixed(2) + ' segundos'
      });
    }
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
    
    console.log(`\n🚀 Iniciando consulta OPTIMIZADA para placa: ${placaLimpia}`);
    console.log(`🌐 Usando proxy: ${PROXY_CONFIG.server}`);
    
    const resultados = await runAutomation(placaLimpia);
    const tiempo = ((Date.now() - startTime) / 1000).toFixed(2);
    
    // Formatear respuesta como en la consola
    let respuesta = '';
    respuesta += '\n' + '='.repeat(50) + '\n';
    respuesta += `RESULTADOS PARA PLACA: ${resultados.placa}\n`;
    respuesta += '='.repeat(50) + '\n';
    
    respuesta += '\nINFORMACION DEL VEHICULO:\n';
    respuesta += '-'.repeat(30) + '\n';
    
    let currentKey = '';
    for (let i = 0; i < resultados.vehiculo.length; i++) {
      const item = resultados.vehiculo[i];
      if (item.endsWith(':')) {
        currentKey = item;
        respuesta += currentKey + '\n';
      } else if (currentKey && i > 0 && resultados.vehiculo[i - 1].endsWith(':')) {
        respuesta += item + '\n';
      } else {
        respuesta += item + '\n';
      }
    }
    
    respuesta += '\nCARGOS:\n';
    respuesta += '-'.repeat(30) + '\n';
    if (resultados.cargos && resultados.cargos.length > 0) {
      if (resultados.cargos[0] === 'No se encontraron cargos') {
        respuesta += 'No se encontraron cargos\n';
      } else {
        resultados.cargos.forEach((cargo, index) => {
          respuesta += `${index + 1}. ${cargo}\n`;
        });
      }
    } else {
      respuesta += 'No se encontraron cargos\n';
    }
    
    respuesta += '\nRESUMEN:\n';
    respuesta += '-'.repeat(30) + '\n';
    respuesta += `SUBTOTAL: ${resultados.subtotal}\n`;
    respuesta += `TOTAL A PAGAR: ${resultados.totalAPagar}\n`;
    respuesta += `\n⏱️  Tiempo de consulta: ${tiempo} segundos (OPTIMIZADO)\n`;
    
    res.set('Content-Type', 'text/plain');
    res.send(respuesta);
    
  } catch (error) {
    console.error('Error en la consulta:', error.message);
    
    // Manejar específicamente el caso de "PLACA SIN ADEUDO"
    if (error.message === 'PLACA SIN ADEUDO') {
      let respuesta = '';
      respuesta += '\n' + '='.repeat(50) + '\n';
      respuesta += `RESULTADOS PARA PLACA: ${req.params.placa.toUpperCase()}\n`;
      respuesta += '='.repeat(50) + '\n\n';
      respuesta += '✅ PLACA SIN ADEUDO ✅\n\n';
      respuesta += 'La placa consultada no tiene adeudos registrados en el sistema.\n';
      respuesta += 'No se encontraron deudas pendientes de pago.\n\n';
      respuesta += '='.repeat(50) + '\n';
      respuesta += `⏱️  Tiempo de consulta: ${((Date.now() - startTime) / 1000).toFixed(2)} segundos (RÁPIDO)\n`;
      
      res.set('Content-Type', 'text/plain');
      res.send(respuesta);
    } else {
      res.status(500).send(`Error en la consulta. Verifique:\n1. Conexión a internet\n2. Proxy disponible\n3. Placa correcta\nDetalle del error: ${error.message}\nTiempo: ${((Date.now() - startTime) / 1000).toFixed(2)} segundos\n`);
    }
  } finally {
    isProcessing = false;
    requestQueue--;
    console.log(`🔄 Sistema liberado. Estado: disponible`);
  }
});

app.listen(port, () => {
  console.log(`🚀 API de consulta vehicular INICIADA - VERSIÓN OPTIMIZADA`);
  console.log(`📡 Puerto: ${port}`);
  console.log(`🌐 Proxy: ${PROXY_CONFIG.server}`);
  console.log(`📧 Email: ${EMAIL}`);
  console.log(`🚫 Solicitudes simultáneas: 1 máximo`);
  console.log(`⏱️  Tiempo estimado por consulta: 14-16 segundos`);
  console.log(`✅ Endpoints disponibles:`);
  console.log(`   GET  /consulta?placa=ABC123`);
  console.log(`   POST /consulta`);
  console.log(`   GET  /consulta-consola/ABC123`);
  console.log(`   GET  /health`);
  console.log(`   GET  /`);
  console.log(`\n⚡ OPTIMIZACIONES APLICADAS:`);
  console.log(`   • Reducción de tiempos de espera (4 segundos menos)`);
  console.log(`   • Verificación más rápida de placas sin adeudo`);
  console.log(`   • Extracción optimizada de datos del DOM`);
  console.log(`   • Timeouts reducidos en todas las operaciones`);
  console.log(`\n⚠️  NOTA: Si una placa no tiene adeudo, se mostrará el mensaje "PLACA SIN ADEUDO" en ~4 segundos`);
});
