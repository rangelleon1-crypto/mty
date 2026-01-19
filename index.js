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
    
    // Obtener todo el contenido HTML de la página
    const htmlContent = await page.content();
    
    // Extraer datos estructurados de manera específica
    const resultados = await extractStructuredData(page, htmlContent, placa);
    
    return resultados;
    
  } catch (error) {
    console.error('Error durante la automatización:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

async function extractStructuredData(page, htmlContent, placa) {
  console.log('=== EXTRACCIÓN ESTRUCTURADA DE DATOS ===');
  
  // Extraer información limpia del vehículo
  const vehicleInfo = await extractCleanVehicleInfo(page);
  
  // Extraer cargos y subsidios estructurados
  const financialData = await extractStructuredFinancialData(page, htmlContent);
  
  // Determinar si tiene adeudos
  const tieneAdeudos = await page.locator('text=Este vehículo cuenta con adeudos pendientes').count() > 0;
  
  return {
    placa,
    vehiculo: vehicleInfo,
    tieneAdeudos,
    cargos: financialData.cargos,
    subsidios: financialData.subsidios,
    totales: financialData.totales
  };
}

async function extractCleanVehicleInfo(page) {
  console.log('Extrayendo información del vehículo...');
  
  const vehicleInfo = {};
  
  try {
    // Buscar el contenedor principal de información del vehículo
    const vehicleContainer = await page.locator('text=Marca:').first().locator('xpath=ancestor::div[contains(@class, "container") or contains(@class, "vehicle") or contains(@class, "info")]').first();
    
    // Extraer cada campo específicamente
    const fields = [
      { key: 'marca', selector: 'text=Marca:', type: 'label' },
      { key: 'modelo', selector: 'text=Modelo:', type: 'label' },
      { key: 'linea', selector: 'text=Linea:', type: 'label' },
      { key: 'tipo', selector: 'text=Tipo:', type: 'label' },
      { key: 'color', selector: 'text=Color:', type: 'label' },
      { key: 'niv', selector: 'text=NIV:', type: 'label' }
    ];
    
    for (const field of fields) {
      try {
        const labelElement = await page.locator(field.selector).first();
        if (await labelElement.count() > 0) {
          // Obtener el valor después del label
          const value = await labelElement.evaluate((el) => {
            // Buscar el siguiente elemento hermano que contenga texto
            let nextElement = el.nextSibling;
            while (nextElement && (!nextElement.textContent || nextElement.textContent.trim() === '')) {
              nextElement = nextElement.nextSibling;
            }
            return nextElement ? nextElement.textContent.trim() : '';
          });
          
          if (value) {
            // Limpiar el valor
            const cleanValue = value.replace(/\s+/g, ' ').trim();
            vehicleInfo[field.key] = cleanValue;
            console.log(`${field.key}: ${cleanValue}`);
          }
        }
      } catch (error) {
        console.log(`Error extrayendo ${field.key}:`, error.message);
      }
    }
    
    // Si no encontramos información, intentar método alternativo
    if (Object.keys(vehicleInfo).length === 0) {
      console.log('Usando método alternativo para extraer información del vehículo...');
      await extractVehicleFromHTMLContent(htmlContent, vehicleInfo);
    }
    
  } catch (error) {
    console.log('Error en extracción de vehículo:', error.message);
  }
  
  return vehicleInfo;
}

async function extractVehicleFromHTMLContent(htmlContent, vehicleInfo) {
  // Extraer información del vehículo del HTML directamente
  const patterns = [
    { regex: /Marca:\s*<[^>]*>([^<]+)/i, key: 'marca' },
    { regex: /Modelo:\s*<[^>]*>([^<]+)/i, key: 'modelo' },
    { regex: /Linea:\s*<[^>]*>([^<]+)/i, key: 'linea' },
    { regex: /Tipo:\s*<[^>]*>([^<]+)/i, key: 'tipo' },
    { regex: /Color:\s*<[^>]*>([^<]+)/i, key: 'color' },
    { regex: /NIV:\s*<[^>]*>([^<]+)/i, key: 'niv' }
  ];
  
  for (const pattern of patterns) {
    const match = htmlContent.match(pattern.regex);
    if (match && match[1]) {
      const value = match[1].trim();
      if (value && value !== '************13110') { // Filtrar valores enmascarados
        vehicleInfo[pattern.key] = value;
      }
    }
  }
}

async function extractStructuredFinancialData(page, htmlContent) {
  console.log('Extrayendo datos financieros estructurados...');
  
  const financialData = {
    cargos: [],
    subsidios: [],
    totales: {}
  };
  
  try {
    // Buscar la sección de CARGOS
    const cargoSection = await page.locator('text=CARGOS').first();
    if (await cargoSection.count() > 0) {
      // Encontrar la tabla de cargos
      const cargoTable = await cargoSection.locator('xpath=following::table[1]').first();
      
      if (await cargoTable.count() > 0) {
        // Extraer filas de la tabla
        const rows = await cargoTable.locator('tr').all();
        
        for (let i = 1; i < rows.length; i++) { // Empezar desde 1 para saltar el encabezado
          const row = rows[i];
          const cells = await row.locator('td').allTextContents();
          
          if (cells.length >= 3) {
            const descripcion = cells[0].trim();
            const anio = cells[1].trim();
            const monto = cells[2].trim();
            
            // Validar que sea un cargo válido (no vacío y con monto)
            if (descripcion && anio && monto && monto.includes('$')) {
              financialData.cargos.push({
                descripcion,
                anio,
                monto
              });
              console.log(`Cargo: ${descripcion} | ${anio} | ${monto}`);
            }
          }
        }
      }
    }
    
    // Buscar la sección de SUBSIDIO
    const subsidioSection = await page.locator('text=SUBSIDIO').first();
    if (await subsidioSection.count() > 0) {
      // Encontrar la tabla de subsidios
      const subsidioTable = await subsidioSection.locator('xpath=following::table[1]').first();
      
      if (await subsidioTable.count() > 0) {
        // Extraer filas de la tabla
        const rows = await subsidioTable.locator('tr').all();
        
        for (let i = 1; i < rows.length; i++) { // Empezar desde 1 para saltar el encabezado
          const row = rows[i];
          const cells = await row.locator('td').allTextContents();
          
          if (cells.length >= 3) {
            const descripcion = cells[0].trim();
            const anio = cells[1].trim();
            const monto = cells[2].trim();
            
            // Validar que sea un subsidio válido
            if (descripcion && anio && monto && monto.includes('$')) {
              financialData.subsidios.push({
                descripcion,
                anio,
                monto
              });
              console.log(`Subsidio: ${descripcion} | ${anio} | ${monto}`);
            }
          }
        }
      }
    }
    
    // Extraer totales específicos
    await extractSpecificTotals(page, financialData);
    
  } catch (error) {
    console.log('Error extrayendo datos financieros:', error.message);
    // Si falla el método de tablas, intentar extraer del texto
    await extractFinancialDataFromText(htmlContent, financialData);
  }
  
  return financialData;
}

async function extractSpecificTotals(page, financialData) {
  // Buscar subtotal de cargos
  const subtotalCargosElement = await page.locator('text=SUBTOTAL MONTO CARGOS:').first();
  if (await subtotalCargosElement.count() > 0) {
    const subtotalText = await subtotalCargosElement.textContent();
    const montoMatch = subtotalText.match(/\$\s*[\d,]+\.\d{2}/);
    if (montoMatch) {
      financialData.totales.subtotalCargos = montoMatch[0];
    }
  }
  
  // Buscar subtotal de subsidio
  const subtotalSubsidioElement = await page.locator('text=SUBTOTAL MONTO SUBSIDIO:').first();
  if (await subtotalSubsidioElement.count() > 0) {
    const subtotalText = await subtotalSubsidioElement.textContent();
    const montoMatch = subtotalText.match(/\$\s*[\d,]+\.\d{2}/);
    if (montoMatch) {
      financialData.totales.subtotalSubsidio = montoMatch[0];
    }
  }
  
  // Buscar total a pagar
  const totalAPagarElement = await page.locator('text=TOTAL A PAGAR:').first();
  if (await totalAPagarElement.count() > 0) {
    const totalText = await totalAPagarElement.textContent();
    const montoMatch = totalText.match(/\$\s*[\d,]+\.\d{2}/);
    if (montoMatch) {
      financialData.totales.totalAPagar = montoMatch[0];
    }
  }
}

async function extractFinancialDataFromText(htmlContent, financialData) {
  console.log('Extrayendo datos financieros del texto...');
  
  // Dividir el HTML en líneas
  const lines = htmlContent.split('\n');
  
  let inCargosSection = false;
  let inSubsidioSection = false;
  
  for (const line of lines) {
    const cleanLine = line.replace(/<[^>]*>/g, '').trim();
    
    if (!cleanLine) continue;
    
    // Detectar secciones
    if (cleanLine.includes('CARGOS') && cleanLine.includes('DescripciónAñoMonto')) {
      inCargosSection = true;
      inSubsidioSection = false;
      continue;
    }
    
    if (cleanLine.includes('SUBSIDIO') && cleanLine.includes('DescripciónAñoMonto')) {
      inCargosSection = false;
      inSubsidioSection = true;
      continue;
    }
    
    // Extraer datos de cargos
    if (inCargosSection && !cleanLine.includes('SUBTOTAL')) {
      // Patrón para líneas de cargo: DESCRIPCIÓN2026$3,960.00
      const cargoMatch = cleanLine.match(/^([A-Z\s\.]+)(\d{4})(\$\s*[\d,]+\.\d{2})$/);
      if (cargoMatch) {
        financialData.cargos.push({
          descripcion: cargoMatch[1].trim(),
          anio: cargoMatch[2],
          monto: cargoMatch[3]
        });
      }
    }
    
    // Extraer datos de subsidios
    if (inSubsidioSection && !cleanLine.includes('SUBTOTAL')) {
      // Patrón para líneas de subsidio: DESCRIPCIÓN2026-$198.00
      const subsidioMatch = cleanLine.match(/^([A-Z\s\.]+)(\d{4})(-\$\s*[\d,]+\.\d{2})$/);
      if (subsidioMatch) {
        financialData.subsidios.push({
          descripcion: subsidioMatch[1].trim(),
          anio: subsidioMatch[2],
          monto: subsidioMatch[3]
        });
      }
    }
    
    // Extraer totales
    if (cleanLine.includes('SUBTOTAL MONTO CARGOS:')) {
      const montoMatch = cleanLine.match(/\$\s*[\d,]+\.\d{2}/);
      if (montoMatch) {
        financialData.totales.subtotalCargos = montoMatch[0];
      }
    }
    
    if (cleanLine.includes('SUBTOTAL MONTO SUBSIDIO:')) {
      const montoMatch = cleanLine.match(/\$\s*[\d,]+\.\d{2}/);
      if (montoMatch) {
        financialData.totales.subtotalSubsidio = montoMatch[0];
      }
    }
    
    if (cleanLine.includes('TOTAL A PAGAR:')) {
      const montoMatch = cleanLine.match(/\$\s*[\d,]+\.\d{2}/);
      if (montoMatch) {
        financialData.totales.totalAPagar = montoMatch[0];
      }
    }
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

// Endpoints de la API
app.get('/', (req, res) => {
  res.json({
    message: 'API de consulta de estado de cuenta vehicular - ESTRUCTURADA',
    status: 'online',
    proxy: 'activado',
    solicitudes_simultaneas: '1 máximo',
    estado_actual: isProcessing ? 'procesando' : 'disponible',
    cola: requestQueue,
    endpoints: {
      consulta: 'GET /consulta?placa=ABC123',
      consultaPost: 'POST /consulta con JSON body { "placa": "ABC123" }',
      health: 'GET /health',
      consola: 'GET /consulta-consola/:placa'
    },
    ejemplo_respuesta: {
      "placa": "SVB133B",
      "vehiculo": {
        "marca": "CHIREY",
        "modelo": "2024",
        "linea": "CHIREY",
        "tipo": "TIGGO 2 PRO LUXURY",
        "color": "NEGRO MEDIANOCHE",
        "niv": "************13110"
      },
      "tieneAdeudos": true,
      "cargos": [
        {"descripcion": "REFRENDO PTE.AÑO", "anio": "2026", "monto": "$3,960.00"},
        {"descripcion": "DONATIVOS PARA CRUZ ROJA", "anio": "2026", "monto": "$20.00"},
        {"descripcion": "DONATIVOS PARA PAT. DE BOMBEROS", "anio": "2026", "monto": "$20.00"}
      ],
      "subsidios": [
        {"descripcion": "SUBSIDIO REFRENDO PRONTO PAGO", "anio": "2026", "monto": "-$198.00"}
      ],
      "totales": {
        "subtotalCargos": "$4,000.00",
        "subtotalSubsidio": "-$198.00",
        "totalAPagar": "$3,802.00"
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
    version: '3.0 - Estructurada'
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
    console.log(`\n🚀 INICIANDO CONSULTA ESTRUCTURADA PARA PLACA: ${placaLimpia}`);
    console.log(`🔗 Usando proxy: ${PROXY_CONFIG.server}`);
    
    const resultados = await runAutomation(placaLimpia);
    const tiempo = ((Date.now() - startTime) / 1000).toFixed(2);
    
    const respuesta = {
      ...resultados,
      tiempoConsulta: `${tiempo} segundos`,
      consultadoEn: new Date().toISOString(),
      metadata: {
        metodo: 'Extracción estructurada v3.0',
        proxyUtilizado: PROXY_CONFIG.server,
        userAgent: 'Chrome 120'
      }
    };
    
    console.log(`✅ Consulta completada en ${tiempo} segundos`);
    console.log(`📊 Datos extraídos:`);
    console.log(`   • Vehículo: ${Object.keys(resultados.vehiculo).length > 0 ? 'Sí' : 'No'}`);
    console.log(`   • Cargos: ${resultados.cargos.length}`);
    console.log(`   • Subsidios: ${resultados.subsidios.length}`);
    console.log(`   • Total a pagar: ${resultados.totales.totalAPagar || 'No disponible'}`);
    
    res.json(respuesta);
    
  } catch (error) {
    console.error('❌ Error en la consulta:', error);
    res.status(500).json({
      error: 'Error en la consulta',
      message: error.message,
      detalles: 'Verifique: 1. Conexión a internet, 2. Proxy disponible, 3. Placa correcta',
      solucion: 'Intente nuevamente en 30 segundos'
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
    console.log(`\n🚀 INICIANDO CONSULTA ESTRUCTURADA PARA PLACA: ${placaLimpia}`);
    
    const resultados = await runAutomation(placaLimpia);
    const tiempo = ((Date.now() - startTime) / 1000).toFixed(2);
    
    const respuesta = {
      ...resultados,
      tiempoConsulta: `${tiempo} segundos`,
      consultadoEn: new Date().toISOString()
    };
    
    console.log(`✅ Consulta completada en ${tiempo} segundos`);
    
    res.json(respuesta);
    
  } catch (error) {
    console.error('❌ Error en la consulta:', error);
    res.status(500).json({
      error: 'Error en la consulta',
      message: error.message
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
    
    console.log(`\nIniciando consulta estructurada para placa: ${placaLimpia}`);
    
    const resultados = await runAutomation(placaLimpia);
    const tiempo = ((Date.now() - startTime) / 1000).toFixed(2);
    
    // Formatear respuesta para consola
    let respuesta = '';
    respuesta += '\n' + '='.repeat(70) + '\n';
    respuesta += `CONSULTA ESTRUCTURADA PARA PLACA: ${resultados.placa}\n`;
    respuesta += '='.repeat(70) + '\n';
    
    respuesta += '\nINFORMACIÓN DEL VEHÍCULO:\n';
    respuesta += '-'.repeat(40) + '\n';
    
    for (const [key, value] of Object.entries(resultados.vehiculo)) {
      respuesta += `${key.charAt(0).toUpperCase() + key.slice(1).padEnd(10)}: ${value}\n`;
    }
    
    respuesta += `Adeudos pendientes: ${resultados.tieneAdeudos ? 'SÍ' : 'NO'}\n`;
    
    // Cargos
    if (resultados.cargos && resultados.cargos.length > 0) {
      respuesta += '\nCARGOS DETECTADOS:\n';
      respuesta += '-'.repeat(60) + '\n';
      resultados.cargos.forEach((cargo, index) => {
        respuesta += `${(index + 1).toString().padStart(2)}. ${cargo.descripcion.padEnd(35)} ${cargo.anio} ${cargo.monto.padStart(12)}\n`;
      });
    }
    
    // Subsidios
    if (resultados.subsidios && resultados.subsidios.length > 0) {
      respuesta += '\nSUBSIDIOS DETECTADOS:\n';
      respuesta += '-'.repeat(60) + '\n';
      resultados.subsidios.forEach((subsidio, index) => {
        respuesta += `${(index + 1).toString().padStart(2)}. ${subsidio.descripcion.padEnd(35)} ${subsidio.anio} ${subsidio.monto.padStart(12)}\n`;
      });
    }
    
    // Totales
    respuesta += '\n' + '='.repeat(70) + '\n';
    respuesta += 'RESUMEN FINANCIERO\n';
    respuesta += '='.repeat(70) + '\n';
    
    if (resultados.totales.subtotalCargos) {
      respuesta += `Subtotal cargos:    ${resultados.totales.subtotalCargos.padStart(15)}\n`;
    }
    
    if (resultados.totales.subtotalSubsidio) {
      respuesta += `Subtotal subsidio:  ${resultados.totales.subtotalSubsidio.padStart(15)}\n`;
    }
    
    if (resultados.totales.totalAPagar) {
      respuesta += '-'.repeat(40) + '\n';
      respuesta += `TOTAL A PAGAR:      ${resultados.totales.totalAPagar.padStart(15)}\n`;
    }
    
    respuesta += `\n⏱️  Tiempo de consulta: ${tiempo} segundos\n`;
    respuesta += `✅ Proceso completado\n`;
    
    res.set('Content-Type', 'text/plain');
    res.send(respuesta);
    
  } catch (error) {
    console.error('Error en la consulta:', error);
    res.status(500).send(`Error en la consulta. Verifique:\n1. Conexión a internet\n2. Proxy disponible\n3. Placa correcta\n\nDetalle: ${error.message}\n`);
  } finally {
    isProcessing = false;
    requestQueue--;
    console.log(`🔄 Sistema liberado. Estado: disponible`);
  }
});

app.listen(port, () => {
  console.log(`🚀 API DE CONSULTA VEHICULAR - ESTRUCTURADA`);
  console.log(`📡 Puerto: ${port}`);
  console.log(`🌐 Proxy: ${PROXY_CONFIG.server}`);
  console.log(`📧 Email: ${EMAIL}`);
  console.log(`🚫 Solicitudes simultáneas: 1 máximo`);
  console.log(`\n✅ ENDPOINTS DISPONIBLES:`);
  console.log(`   GET  /consulta?placa=ABC123`);
  console.log(`   POST /consulta`);
  console.log(`   GET  /consulta-consola/ABC123`);
  console.log(`   GET  /health`);
  console.log(`   GET  /`);
  console.log(`\n🔍 SISTEMA DE EXTRACCIÓN ESTRUCTURADA:`);
  console.log(`   • Información específica del vehículo`);
  console.log(`   • Tablas de cargos y subsidios`);
  console.log(`   • Total a pagar exacto`);
  console.log(`   • Formato JSON limpio y ordenado`);
});
