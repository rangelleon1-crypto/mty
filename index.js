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
    
    // Esperar a que carguen los datos
    await delay(WAIT_TIMES.xlong);
    
    // Extraer datos de manera más robusta
    const vehicleInfo = [];
    const charges = [];
    let subtotal = '';
    let totalAPagar = '';
    
    // 1. Extraer información del vehículo usando selectores más específicos
    try {
      // Buscar elementos que contengan información del vehículo
      const vehicleElements = await page.$$eval('td, span, div, label', elements => 
        elements
          .map(el => el.textContent.trim())
          .filter(text => text.length > 0)
          .filter(text => {
            const patterns = [
              /Marca:/i,
              /Modelo:/i,
              /Línea:/i,
              /Linea:/i,
              /Tipo:/i,
              /Color:/i,
              /NIV:/i,
              /Placa:/i,
              /Año:/i,
              /Verificado/i
            ];
            return patterns.some(pattern => pattern.test(text));
          })
      );
      
      vehicleInfo.push(...vehicleElements);
    } catch (error) {
      console.log('Error extrayendo información del vehículo:', error.message);
    }
    
    // 2. Extraer cargos - buscar tablas o listas de cargos
    try {
      // Intentar encontrar tablas de cargos
      const tableData = await page.$$eval('table, tbody, tr, td', elements => {
        const results = [];
        elements.forEach(el => {
          const text = el.textContent.trim();
          // Buscar patrones de cargos (año seguido de $)
          if (text.match(/\d{4}\s*\$[\d,]+\.?\d*/) || text.match(/\$\s*[\d,]+\.?\d*/)) {
            results.push(text);
          }
        });
        return results;
      });
      
      // Filtrar y limpiar los cargos encontrados
      const filteredCharges = tableData.filter(charge => {
        // Excluir líneas que no son cargos reales
        const excludePatterns = [
          /TOTAL/i,
          /SUBTOTAL/i,
          /PAGAR/i,
          /CARGANDO/i,
          /Verificado/i,
          /Email/i
        ];
        return !excludePatterns.some(pattern => pattern.test(charge));
      });
      
      charges.push(...filteredCharges);
      
      // Si no encontramos cargos, buscar en todo el texto
      if (charges.length === 0) {
        const allText = await page.textContent('body');
        const lines = allText.split('\n');
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          // Buscar líneas que parezcan cargos (contienen año y signo de dólar)
          if (trimmedLine.match(/\d{4}.*\$/) || trimmedLine.match(/\$\s*[\d,]+\.?\d*/)) {
            // Filtrar líneas no deseadas
            if (!trimmedLine.includes('TOTAL') && 
                !trimmedLine.includes('SUBTOTAL') && 
                !trimmedLine.includes('MONTO CARGOS')) {
              charges.push(trimmedLine);
            }
          }
        }
      }
    } catch (error) {
      console.log('Error extrayendo cargos:', error.message);
    }
    
    // 3. Buscar SUBTOTAL y TOTAL A PAGAR de manera más agresiva
    try {
      const allText = await page.textContent('body');
      const lines = allText.split('\n');
      
      // Buscar SUBTOTAL
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.match(/SUBTOTAL/i)) {
          subtotal = trimmedLine;
          break;
        }
      }
      
      // Buscar TOTAL A PAGAR con varios patrones
      const totalPatterns = [
        /TOTAL\s*A\s*PAGAR/i,
        /TOTAL\s+PAGAR/i,
        /PAGO\s+TOTAL/i,
        /TOTAL\s+MONTO\s+CARGOS/i,
        /MONTO\s+TOTAL/i
      ];
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        for (const pattern of totalPatterns) {
          if (pattern.test(trimmedLine)) {
            totalAPagar = trimmedLine;
            break;
          }
        }
        if (totalAPagar) break;
      }
      
      // Si aún no encontramos, buscar cualquier línea que empiece con TOTAL y tenga signo de dólar
      if (!totalAPagar) {
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine.match(/^TOTAL/i) && trimmedLine.match(/\$/)) {
            totalAPagar = trimmedLine;
            break;
          }
        }
      }
      
      // Último recurso: buscar cualquier signo de dólar que pueda ser el total
      if (!totalAPagar) {
        const dollarMatches = allText.match(/\$\s*[\d,]+\.?\d*/g);
        if (dollarMatches && dollarMatches.length > 0) {
          // Tomar el último monto de dólar como posible total
          totalAPagar = `TOTAL APROXIMADO: ${dollarMatches[dollarMatches.length - 1]}`;
        }
      }
    } catch (error) {
      console.log('Error buscando totales:', error.message);
    }
    
    // 4. Si no encontramos información suficiente, intentar un enfoque diferente
    if (vehicleInfo.length === 0 || charges.length === 0) {
      console.log('Información insuficiente, intentando método alternativo...');
      
      // Tomar captura del HTML completo para análisis
      const pageContent = await page.content();
      
      // Buscar información usando regex más agresivos
      const marcaMatch = pageContent.match(/Marca:([^<]+)/i);
      const modeloMatch = pageContent.match(/Modelo:([^<]+)/i);
      const lineaMatch = pageContent.match(/L[ií]nea:([^<]+)/i);
      const tipoMatch = pageContent.match(/Tipo:([^<]+)/i);
      const colorMatch = pageContent.match(/Color:([^<]+)/i);
      const nivMatch = pageContent.match(/NIV:([^<]+)/i);
      
      if (marcaMatch) vehicleInfo.push(`Marca: ${marcaMatch[1].trim()}`);
      if (modeloMatch) vehicleInfo.push(`Modelo: ${modeloMatch[1].trim()}`);
      if (lineaMatch) vehicleInfo.push(`Línea: ${lineaMatch[1].trim()}`);
      if (tipoMatch) vehicleInfo.push(`Tipo: ${tipoMatch[1].trim()}`);
      if (colorMatch) vehicleInfo.push(`Color: ${colorMatch[1].trim()}`);
      if (nivMatch) vehicleInfo.push(`NIV: ${nivMatch[1].trim()}`);
      
      // Buscar cargos con regex
      const cargoRegex = /\d{4}[^$]*\$[\d,]+\.?\d*/gi;
      const cargoMatches = pageContent.match(cargoRegex);
      if (cargoMatches) {
        charges.push(...cargoMatches.map(c => c.trim()));
      }
    }
    
    // Asegurar que siempre haya datos
    if (vehicleInfo.length === 0) {
      vehicleInfo.push('Información del vehículo no disponible');
    }
    
    if (charges.length === 0) {
      charges.push('No se encontraron cargos registrados');
    }
    
    if (!subtotal) {
      subtotal = 'SUBTOTAL: No disponible';
    }
    
    if (!totalAPagar) {
      totalAPagar = 'TOTAL A PAGAR: No disponible';
    }
    
    return {
      placa,
      vehiculo: vehicleInfo.filter((line, index, arr) => line && arr.indexOf(line) === index),
      cargos: charges,
      subtotal,
      totalAPagar
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
  
  // Guardar referencia para limpiar al finalizar
  req._processing = true;
  
  next();
}

// Endpoints de la API
app.get('/', (req, res) => {
  res.json({
    message: 'API de consulta de estado de cuenta vehicular',
    status: 'online',
    proxy: 'activado',
    solicitudes_simultaneas: '1 máximo',
    estado_actual: isProcessing ? 'procesando' : 'disponible',
    cola: requestQueue,
    endpoints: {
      consulta: 'GET /consulta?placa=ABC123',
      consultaPost: 'POST /consulta con JSON body { "placa": "ABC123" }',
      health: 'GET /health'
    },
    ejemplo: {
      url: '/consulta?placa=ABC123',
      respuesta: {
        placa: "ABC123",
        vehiculo: ["Marca: TOYOTA", "Modelo: COROLLA"],
        cargos: ["2024 $1,500.00"],
        subtotal: "SUBTOTAL: $1,500.00",
        totalAPagar: "TOTAL A PAGAR: $1,500.00"
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
    service: 'consulta-vehicular-api'
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
    console.log(`\nIniciando consulta para placa: ${placaLimpia}`);
    console.log(`Usando proxy: ${PROXY_CONFIG.server}`);
    
    const resultados = await runAutomation(placaLimpia);
    const tiempo = ((Date.now() - startTime) / 1000).toFixed(2);
    
    // Agregar tiempo de consulta como campo extra (opcional)
    const respuesta = {
      ...resultados,
      tiempoConsulta: `${tiempo} segundos`,
      consultadoEn: new Date().toISOString()
    };
    
    console.log(`Consulta completada en ${tiempo} segundos`);
    
    res.json(respuesta);
    
  } catch (error) {
    console.error('Error en la consulta:', error);
    res.status(500).json({
      error: 'Error en la consulta',
      message: error.message,
      detalles: 'Verifique: 1. Conexión a internet, 2. Proxy disponible, 3. Placa correcta'
    });
  } finally {
    // Liberar para siguiente solicitud
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
    console.log(`\nIniciando consulta para placa: ${placaLimpia}`);
    console.log(`Usando proxy: ${PROXY_CONFIG.server}`);
    
    const resultados = await runAutomation(placaLimpia);
    const tiempo = ((Date.now() - startTime) / 1000).toFixed(2);
    
    // Agregar tiempo de consulta como campo extra (opcional)
    const respuesta = {
      ...resultados,
      tiempoConsulta: `${tiempo} segundos`,
      consultadoEn: new Date().toISOString()
    };
    
    console.log(`Consulta completada en ${tiempo} segundos`);
    
    res.json(respuesta);
    
  } catch (error) {
    console.error('Error en la consulta:', error);
    res.status(500).json({
      error: 'Error en la consulta',
      message: error.message,
      detalles: 'Verifique: 1. Conexión a internet, 2. Proxy disponible, 3. Placa correcta'
    });
  } finally {
    // Liberar para siguiente solicitud
    isProcessing = false;
    requestQueue--;
    console.log(`🔄 Sistema liberado. Estado: disponible`);
  }
});

// Endpoint para formato de consola (similar al script original)
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
    
    console.log(`\nIniciando consulta para placa: ${placaLimpia}`);
    console.log(`Usando proxy: ${PROXY_CONFIG.server}`);
    
    const resultados = await runAutomation(placaLimpia);
    const tiempo = ((Date.now() - startTime) / 1000).toFixed(2);
    
    // Formatear respuesta como en la consola
    let respuesta = '';
    respuesta += '\n' + '='.repeat(50) + '\n';
    respuesta += `RESULTADOS PARA PLACA: ${resultados.placa}\n`;
    respuesta += '='.repeat(50) + '\n';
    
    respuesta += '\nINFORMACION DEL VEHICULO:\n';
    respuesta += '-'.repeat(30) + '\n';
    if (resultados.vehiculo.length > 0) {
      resultados.vehiculo.forEach(linea => respuesta += linea + '\n');
    } else {
      respuesta += 'No se encontró información del vehículo\n';
    }
    
    respuesta += '\nCARGOS:\n';
    respuesta += '-'.repeat(30) + '\n';
    if (resultados.cargos.length > 0) {
      resultados.cargos.forEach((cargo, index) => {
        respuesta += `${index + 1}. ${cargo}\n`;
      });
    } else {
      respuesta += 'No se encontraron cargos\n';
    }
    
    respuesta += '\nRESUMEN:\n';
    respuesta += '-'.repeat(30) + '\n';
    respuesta += `SUBTOTAL: ${resultados.subtotal}\n`;
    respuesta += `TOTAL A PAGAR: ${resultados.totalAPagar}\n`;
    respuesta += `\nTiempo de consulta: ${tiempo} segundos\n`;
    
    res.set('Content-Type', 'text/plain');
    res.send(respuesta);
    
  } catch (error) {
    console.error('Error en la consulta:', error);
    res.status(500).send(`Error en la consulta. Verifique:\n1. Conexión a internet\n2. Proxy disponible\n3. Placa correcta\nDetalle del error: ${error.message}\n`);
  } finally {
    // Liberar para siguiente solicitud
    isProcessing = false;
    requestQueue--;
    console.log(`🔄 Sistema liberado. Estado: disponible`);
  }
});

app.listen(port, () => {
  console.log(`🚀 API de consulta vehicular iniciada`);
  console.log(`📡 Puerto: ${port}`);
  console.log(`🌐 Proxy: ${PROXY_CONFIG.server}`);
  console.log(`📧 Email: ${EMAIL}`);
  console.log(`🚫 Solicitudes simultáneas: 1 máximo`);
  console.log(`✅ Endpoints disponibles:`);
  console.log(`   GET  /consulta?placa=ABC123`);
  console.log(`   POST /consulta`);
  console.log(`   GET  /consulta-consola/ABC123`);
  console.log(`   GET  /health`);
});
