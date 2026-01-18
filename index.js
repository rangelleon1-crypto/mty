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

// Variables para controlar solicitudes
let isProcessing = false;
let requestQueue = 0;
let currentRequestId = 0;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Función con timeout para chromium.launch() - 5 segundos máximo
async function launchBrowserWithTimeout(timeoutMs = 5000) {
  let browser;
  let launchTimeout;
  
  const launchPromise = chromium.launch({ 
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
  
  const timeoutPromise = new Promise((_, reject) => {
    launchTimeout = setTimeout(() => {
      reject(new Error(`TIMEOUT: chromium.launch() superó los ${timeoutMs}ms`));
    }, timeoutMs);
  });
  
  try {
    browser = await Promise.race([launchPromise, timeoutPromise]);
    clearTimeout(launchTimeout);
    return browser;
  } catch (error) {
    clearTimeout(launchTimeout);
    if (browser) {
      try { await browser.close(); } catch (e) {}
    }
    throw error;
  }
}

// Función para ejecutar el primer clic con timeout de 7 segundos
async function executeFirstClickWithTimeout(page, requestId, attempt, timeoutMs = 7000) {
  console.log(`[${requestId}] ⏱️ Intento ${attempt}: Timeout de 7 segundos para primer clic...`);
  
  const firstClickPromise = (async () => {
    console.log(`[${requestId}] 🌐 Intento ${attempt}: Navegando a la página...`);
    
    await page.goto('https://icvnl.gob.mx:1080/estadoctav3/edoctaconsulta#no-back-button', {
      waitUntil: 'domcontentloaded',
      timeout: 10000
    });
    
    await delay(WAIT_TIMES.medium);
    
    console.log(`[${requestId}] 👆 Intento ${attempt}: PRIMER CLIC: Checkbox "Acepto bajo protesta de decir"...`);
    await page.getByRole('checkbox', { name: 'Acepto bajo protesta de decir' }).check();
    
    return true;
  })();
  
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`TIMEOUT: Intento ${attempt} - Primer clic no se completó en ${timeoutMs}ms`));
    }, timeoutMs);
  });
  
  return await Promise.race([firstClickPromise, timeoutPromise]);
}

// Función principal con reintentos automáticos
async function runAutomationWithRetries(placa, requestId, maxRetries = 3) {
  const startTime = Date.now();
  const timeline = {
    requestReceived: startTime,
    attempts: [],
    finalResult: null
  };
  
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const attemptStartTime = Date.now();
    let browser = null;
    
    console.log(`[${requestId}] 🔄 Intento ${attempt}/${maxRetries} iniciando...`);
    
    try {
      // 1. Lanzar navegador
      console.log(`[${requestId}] 🚀 Intento ${attempt}: chromium.launch()...`);
      const launchStartTime = Date.now();
      browser = await launchBrowserWithTimeout(5000);
      const launchTime = Date.now() - launchStartTime;
      console.log(`[${requestId}] ✅ Intento ${attempt}: chromium.launch() completado en ${launchTime}ms`);
      
      // Configurar contexto
      const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        proxy: PROXY_CONFIG
      });
      
      const page = await context.newPage();
      
      // 2. Intentar primer clic con timeout de 7 segundos
      console.log(`[${requestId}] ⏰ Intento ${attempt}: Ejecutando primer clic...`);
      const firstClickStartTime = Date.now();
      
      await executeFirstClickWithTimeout(page, requestId, attempt, 7000);
      
      const firstClickTime = Date.now() - firstClickStartTime;
      console.log(`[${requestId}] ✅ Intento ${attempt}: Primer clic completado en ${firstClickTime}ms`);
      
      // 3. Si llegamos aquí, el primer clic fue exitoso - CONTINUAR CON EL RESTO
      await delay(WAIT_TIMES.short);
      
      // Segundo paso: Click en campo de placa
      await page.getByRole('textbox', { name: 'Placa' }).click();
      await page.getByRole('textbox', { name: 'Placa' }).fill(placa);
      await delay(WAIT_TIMES.short);
      
      // Tercer paso: Click en div
      await page.locator('div:nth-child(4)').click();
      await delay(WAIT_TIMES.long);
      
      // Cuarto paso: Click en botón Consultar
      await page.getByRole('button', { name: 'Consultar' }).click();
      await delay(WAIT_TIMES.xlong);
      
      try {
        await page.waitForSelector('input[name="robot"], input[type="checkbox"]', { 
          timeout: 5000
        });
        await page.getByRole('checkbox', { name: 'No soy un robot' }).check();
        await delay(WAIT_TIMES.long);
      } catch (error) {
        console.log(`[${requestId}] ℹ️ Intento ${attempt}: Sin captcha detectado`);
      }
      
      await page.getByRole('textbox', { name: 'Email' }).click();
      await page.getByRole('textbox', { name: 'Email' }).fill(EMAIL);
      await delay(WAIT_TIMES.short);
      
      await page.getByRole('button', { name: 'Ver estado de cuenta' }).click();
      await delay(WAIT_TIMES.xxlong);
      
      // Extraer datos
      const pageContent = await page.textContent('body');
      
      // Cerrar recursos
      await page.close();
      await context.close();
      await browser.close();
      
      // Procesar datos
      const lines = pageContent.split('\n').filter(line => {
        const trimmedLine = line.trim();
        if (!trimmedLine) return false;
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
        return !exclusionPatterns.some(pattern => trimmedLine.includes(pattern));
      });
      
      let vehicleInfo = [];
      let charges = [];
      let totalAPagar = '';
      let subtotal = '';
      let inVehicleSection = false;
      let inChargesSection = false;
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        if (trimmedLine.includes('Marca:') || trimmedLine.includes('Modelo:')) {
          inVehicleSection = true;
          inChargesSection = false;
        }
        
        if (trimmedLine.includes('CARGOS DescripciónAñoMonto')) {
          inVehicleSection = false;
          inChargesSection = true;
          continue;
        }
        
        if (trimmedLine.includes('SUBTOTAL')) {
          subtotal = trimmedLine;
          continue;
        }
        
        if (trimmedLine.match(/TOTAL\s*A\s*PAGAR/i) || 
            trimmedLine.match(/TOTAL\s+.*PAGAR/i) ||
            trimmedLine.match(/PAGO\s*TOTAL/i)) {
          totalAPagar = trimmedLine;
          inChargesSection = false;
          continue;
        }
        
        if (trimmedLine.includes('TOTAL MONTO CARGOS:')) {
          if (!totalAPagar) {
            totalAPagar = trimmedLine;
          }
          inChargesSection = false;
          continue;
        }
        
        if (trimmedLine.startsWith('TOTAL') && !totalAPagar && 
            !trimmedLine.includes('MONTO CARGOS') && 
            trimmedLine.match(/[\d,]+\.?\d*$/)) {
          totalAPagar = trimmedLine;
          inChargesSection = false;
          continue;
        }
        
        if (inVehicleSection && trimmedLine.includes('Este vehículo')) {
          inVehicleSection = false;
        }
        
        if (inVehicleSection && trimmedLine) {
          vehicleInfo.push(trimmedLine);
        }
        
        if (inChargesSection && trimmedLine && trimmedLine.match(/\d{4}\$/)) {
          charges.push(trimmedLine);
        }
      }
      
      // Buscar TOTAL A PAGAR
      if (!totalAPagar) {
        const totalAPagarRegex = /TOTAL\s*A\s*PAGAR[^$\n]*\$?\s*[\d,]+\.?\d*/gi;
        const totalAPagarMatch = pageContent.match(totalAPagarRegex);
        if (totalAPagarMatch && totalAPagarMatch.length > 0) {
          totalAPagar = totalAPagarMatch[0].trim();
        }
      }
      
      if (!totalAPagar) {
        const totalRegex = /TOTAL[^$\n]*\$?\s*[\d,]+\.?\d*/gi;
        const totalMatches = pageContent.match(totalRegex);
        if (totalMatches && totalMatches.length > 0) {
          const filteredTotals = totalMatches.filter(t => !t.includes('MONTO CARGOS'));
          totalAPagar = filteredTotals.length > 0 ? filteredTotals[0].trim() : totalMatches[0].trim();
        }
      }
      
      // Si aún no hay total, buscar cualquier patrón de dinero
      if (!totalAPagar) {
        const moneyRegex = /\$\s*[\d,]+\.?\d*/g;
        const moneyMatches = pageContent.match(moneyRegex);
        if (moneyMatches && moneyMatches.length > 0) {
          totalAPagar = `TOTAL ENCONTRADO: ${moneyMatches[moneyMatches.length - 1]}`;
        }
      }
      
      // Garantizar que siempre haya datos COMPLETOS
      if (vehicleInfo.length === 0) {
        vehicleInfo = [
          'Marca: No disponible', 
          'Modelo: No disponible', 
          'Año: No disponible',
          'Color: No disponible',
          'Placa: ' + placa
        ];
      }
      
      if (charges.length === 0) {
        charges = [
          'No se encontraron cargos registrados para esta placa',
          'Verifique que la placa sea correcta'
        ];
      }
      
      if (!subtotal) {
        subtotal = 'SUBTOTAL: $0.00';
      }
      
      if (!totalAPagar) {
        totalAPagar = 'TOTAL A PAGAR: $0.00';
      }
      
      const attemptTime = Date.now() - attemptStartTime;
      timeline.attempts.push({
        attemptNumber: attempt,
        success: true,
        duration: attemptTime,
        firstClickCompleted: true
      });
      
      console.log(`[${requestId}] ✅ Intento ${attempt} completado con éxito en ${attemptTime}ms`);
      
      return {
        placa,
        vehiculo: vehicleInfo.filter((line, index, arr) => line && arr.indexOf(line) === index),
        cargos: charges,
        subtotal: subtotal,
        totalAPagar: totalAPagar,
        metadata: {
          tiempoTotal: `${((Date.now() - startTime) / 1000).toFixed(2)} segundos`,
          intentosRealizados: attempt,
          intentosTotales: maxRetries,
          ultimoIntentoExitoso: true,
          tiempoUltimoIntento: `${(attemptTime / 1000).toFixed(2)} segundos`,
          primerClicCompletado: true
        },
        rawLines: lines.filter(l => l.trim().length > 0).slice(0, 30)
      };
      
    } catch (error) {
      // Cerrar navegador si existe
      if (browser) {
        try { await browser.close(); } catch (e) {}
      }
      
      const attemptTime = Date.now() - attemptStartTime;
      lastError = error;
      
      timeline.attempts.push({
        attemptNumber: attempt,
        success: false,
        duration: attemptTime,
        error: error.message,
        firstClickCompleted: false
      });
      
      console.error(`[${requestId}] ❌ Intento ${attempt} falló en ${attemptTime}ms:`, error.message);
      
      // Si no es el último intento, esperar un poco antes de reintentar
      if (attempt < maxRetries) {
        const waitTime = 1000; // 1 segundo entre intentos
        console.log(`[${requestId}] ⏳ Esperando ${waitTime}ms antes del siguiente intento...`);
        await delay(waitTime);
      }
    }
  }
  
  // Si llegamos aquí, todos los intentos fallaron
  console.error(`[${requestId}] ❌ Todos los ${maxRetries} intentos fallaron`);
  
  return {
    placa,
    vehiculo: [
      `Error después de ${maxRetries} intentos: ${lastError?.message || 'Error desconocido'}`,
      'Todos los intentos fallaron en completar el primer clic',
      'Placa consultada: ' + placa
    ],
    cargos: ['No se pudieron obtener los cargos - Sistema no respondió'],
    subtotal: 'SUBTOTAL: Error - Sistema no respondió',
    totalAPagar: 'TOTAL A PAGAR: Error - Sistema no respondió',
    metadata: {
      tiempoTotal: `${((Date.now() - startTime) / 1000).toFixed(2)} segundos`,
      intentosRealizados: maxRetries,
      intentosTotales: maxRetries,
      ultimoIntentoExitoso: false,
      todosLosIntentosFallaron: true,
      primerClicCompletado: false,
      errores: timeline.attempts.map(a => a.error).filter(e => e)
    },
    rawLines: []
  };
}

// Middleware para verificar solicitudes simultáneas
function checkSimultaneousRequests(req, res, next) {
  requestQueue++;
  const requestId = ++currentRequestId;
  console.log(`[${requestId}] 📊 Solicitudes en cola: ${requestQueue}`);
  
  if (isProcessing) {
    requestQueue--;
    console.log(`[${requestId}] ❌ Solicitud rechazada - Ya hay una consulta en proceso`);
    return res.status(429).json({
      error: 'sin respuesta',
      mensaje: 'El sistema está procesando otra consulta. Intente nuevamente en unos momentos.',
      estado: 'ocupado',
      requestId,
      timestamp: new Date().toISOString(),
      colaActual: requestQueue
    });
  }
  
  isProcessing = true;
  req.requestId = requestId;
  req.startTime = Date.now();
  console.log(`[${requestId}] ✅ Solicitud aceptada - Iniciando proceso`);
  next();
}

// Endpoints de la API
app.get('/', (req, res) => {
  res.json({
    message: 'API de consulta de estado de cuenta vehicular',
    status: 'online',
    proxy: 'activado',
    configuracion: {
      maximoIntentos: 3,
      timeoutPrimerClic: '7 segundos por intento',
      timeoutChromiumLaunch: '5 segundos',
      timeoutTotalConsulta: '45 segundos máximo'
    },
    primerClic: 'Checkbox "Acepto bajo protesta de decir"',
    reintentos: 'Automáticos - Hasta 3 veces',
    solicitudes_simultaneas: '1 máximo',
    estado_actual: isProcessing ? 'procesando' : 'disponible',
    cola: requestQueue,
    endpoints: {
      consulta: 'GET /consulta?placa=ABC123',
      health: 'GET /health',
      status: 'GET /status'
    }
  });
});

app.get('/health', (req, res) => {
  const memUsage = process.memoryUsage();
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    proxy: 'configurado',
    procesando: isProcessing,
    cola: requestQueue,
    uptime: `${process.uptime().toFixed(2)} segundos`,
    memoria: {
      usada: `${Math.round(memUsage.heapUsed / 1024 / 1024)} MB`,
      total: `${Math.round(memUsage.heapTotal / 1024 / 1024)} MB`,
      rss: `${Math.round(memUsage.rss / 1024 / 1024)} MB`
    },
    service: 'consulta-vehicular-api'
  });
});

app.get('/status', (req, res) => {
  const memUsage = process.memoryUsage();
  res.json({
    status: isProcessing ? 'processing' : 'idle',
    requestQueue,
    currentRequestId,
    memory: {
      used: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
      total: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB',
      rss: Math.round(memUsage.rss / 1024 / 1024) + ' MB'
    },
    timestamp: new Date().toISOString()
  });
});

app.get('/consulta', checkSimultaneousRequests, async (req, res) => {
  const requestId = req.requestId;
  const startTime = req.startTime;
  
  try {
    const { placa } = req.query;
    
    if (!placa) {
      isProcessing = false;
      requestQueue--;
      return res.status(400).json({
        error: 'Placa requerida. Ejemplo: /consulta?placa=ABC123',
        requestId,
        timestamp: new Date().toISOString(),
        placa: 'No proporcionada'
      });
    }
    
    const placaLimpia = placa.trim().toUpperCase().replace(/\s+/g, '');
    
    if (!placaLimpia) {
      isProcessing = false;
      requestQueue--;
      return res.status(400).json({
        error: 'Placa requerida',
        requestId,
        timestamp: new Date().toISOString(),
        placa: 'Vacía después de limpiar'
      });
    }
    
    console.log(`[${requestId}] 🔍 Iniciando consulta para placa: ${placaLimpia}`);
    
    // Ejecutar con timeout total de 45 segundos (3 intentos × 15 segundos)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('TIMEOUT: Consulta total superó los 45 segundos'));
      }, 45000);
    });
    
    const automationPromise = runAutomationWithRetries(placaLimpia, requestId, 3);
    
    const resultados = await Promise.race([automationPromise, timeoutPromise]);
    const tiempoTotal = Date.now() - startTime;
    
    console.log(`[${requestId}] ✅ Proceso completado en ${tiempoTotal}ms`);
    
    // Respuesta COMPLETA siempre
    const respuesta = {
      ...resultados,
      requestId,
      timestamp: new Date().toISOString(),
      tiempoTotal: `${(tiempoTotal / 1000).toFixed(2)} segundos`,
      estado: resultados.metadata?.todosLosIntentosFallaron ? 'error' : 'completado',
      primerClic: 'Checkbox "Acepto bajo protesta de decir"',
      configuracion: {
        maximoIntentos: 3,
        timeoutPrimerClic: '7 segundos por intento',
        intentosRealizados: resultados.metadata?.intentosRealizados || 0
      },
      procesadoEn: new Date().toISOString()
    };
    
    res.json(respuesta);
    
  } catch (error) {
    const tiempoTotal = Date.now() - startTime;
    console.error(`[${requestId}] ❌ Error fatal en consulta:`, error.message);
    
    // Respuesta de error COMPLETA
    const placaLimpia = req.query?.placa ? 
      req.query.placa.trim().toUpperCase().replace(/\s+/g, '') : 'Desconocida';
    
    res.status(500).json({
      requestId,
      placa: placaLimpia,
      vehiculo: [
        `Error fatal en la consulta: ${error.message}`,
        'Tiempo transcurrido: ' + (tiempoTotal / 1000).toFixed(2) + ' segundos',
        'Estado: ABORTADO'
      ],
      cargos: ['No se pudieron obtener los cargos debido a un error fatal'],
      subtotal: 'SUBTOTAL: Error fatal - Proceso abortado',
      totalAPagar: 'TOTAL A PAGAR: Error fatal - Proceso abortado',
      timestamp: new Date().toISOString(),
      tiempoTotal: `${(tiempoTotal / 1000).toFixed(2)} segundos`,
      estado: 'error_fatal',
      error: true,
      mensajeError: error.message,
      primerClic: 'No se alcanzó el primer clic',
      configuracion: {
        maximoIntentos: 3,
        timeoutPrimerClic: '7 segundos por intento',
        intentosRealizados: 0
      },
      procesadoEn: new Date().toISOString(),
      metadata: {
        error: true,
        errorType: 'FATAL_ERROR',
        errorMessage: error.message
      }
    });
  } finally {
    isProcessing = false;
    requestQueue--;
    console.log(`[${requestId}] 🔄 Sistema liberado. Solicitudes en cola: ${requestQueue}`);
  }
});

app.listen(port, () => {
  console.log(`🚀 API de consulta vehicular iniciada`);
  console.log(`📡 Puerto: ${port}`);
  console.log(`🌐 Proxy: ${PROXY_CONFIG.server}`);
  console.log(`📧 Email: ${EMAIL}`);
  console.log(`🔄 Sistema de reintentos:`);
  console.log(`   • Máximo 3 intentos por solicitud`);
  console.log(`   • Timeout por intento: 7 segundos para primer clic`);
  console.log(`   • Timeout total: 45 segundos máximo`);
  console.log(`   • 1 segundo de espera entre intentos`);
  console.log(`🚫 Solicitudes simultáneas: 1 máximo`);
  console.log(`✅ Endpoints disponibles:`);
  console.log(`   GET  /consulta?placa=ABC123`);
  console.log(`   GET  /health`);
  console.log(`   GET  /status`);
});
