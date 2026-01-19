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
    
    // Analizar directamente el HTML
    const resultados = await analyzeHTMLDirectly(htmlContent, placa);
    
    return resultados;
    
  } catch (error) {
    console.error('Error durante la automatización:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

async function analyzeHTMLDirectly(htmlContent, placa) {
  console.log('=== ANÁLISIS DIRECTO DEL HTML ===');
  
  // Limpiar el HTML y extraer texto
  const cleanHtml = htmlContent.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                              .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
                              .replace(/<!--.*?-->/gs, '')
                              .replace(/\s+/g, ' ');
  
  // Extraer información del vehículo
  const vehicleInfo = extractVehicleInfo(cleanHtml);
  
  // Verificar si hay adeudos
  const tieneAdeudos = cleanHtml.includes('adeudos pendientes') || 
                       cleanHtml.includes('adeudos') ||
                       cleanHtml.includes('REFRENDO PTE') ||
                       cleanHtml.includes('DONATIVOS');
  
  // Extraer datos financieros
  const { cargos, subsidios, totales } = extractFinancialData(cleanHtml);
  
  return {
    placa,
    vehiculo: vehicleInfo,
    tieneAdeudos,
    cargos,
    subsidios,
    totales,
    rawHtmlLength: htmlContent.length,
    extractedAt: new Date().toISOString()
  };
}

function extractVehicleInfo(html) {
  console.log('Extrayendo información del vehículo...');
  
  const vehicleInfo = {};
  
  // Buscar patrones específicos para cada campo
  const patterns = {
    marca: /Marca:\s*[^>]*>([^<]+)/i,
    modelo: /Modelo:\s*[^>]*>([^<]+)/i,
    linea: /Linea:\s*[^>]*>([^<]+)/i,
    tipo: /Tipo:\s*[^>]*>([^<]+)/i,
    color: /Color:\s*[^>]*>([^<]+)/i,
    niv: /NIV:\s*[^>]*>([^<]+)/i
  };
  
  for (const [key, pattern] of Object.entries(patterns)) {
    const match = html.match(pattern);
    if (match && match[1]) {
      let value = match[1].trim();
      
      // Limpiar el valor
      value = value.replace(/\\n/g, '')
                   .replace(/\s+/g, ' ')
                   .trim();
      
      if (value && value !== '************13110') {
        vehicleInfo[key] = value;
        console.log(`${key}: ${value}`);
      }
    }
  }
  
  // Si no encontramos información, buscar de otra manera
  if (Object.keys(vehicleInfo).length === 0) {
    console.log('Buscando información del vehículo con método alternativo...');
    
    // Buscar todas las ocurrencias de texto que contengan información del vehículo
    const vehicleTextMatch = html.match(/Marca:[^<]+Modelo:[^<]+Linea:[^<]+Tipo:[^<]+Color:[^<]+NIV:[^<]+/i);
    if (vehicleTextMatch) {
      const vehicleText = vehicleTextMatch[0];
      
      const marcaMatch = vehicleText.match(/Marca:\s*([^<]+)/i);
      if (marcaMatch) vehicleInfo.marca = marcaMatch[1].trim();
      
      const modeloMatch = vehicleText.match(/Modelo:\s*([^<]+)/i);
      if (modeloMatch) vehicleInfo.modelo = modeloMatch[1].trim();
      
      const lineaMatch = vehicleText.match(/Linea:\s*([^<]+)/i);
      if (lineaMatch) vehicleInfo.linea = lineaMatch[1].trim();
      
      const tipoMatch = vehicleText.match(/Tipo:\s*([^<]+)/i);
      if (tipoMatch) vehicleInfo.tipo = tipoMatch[1].trim();
      
      const colorMatch = vehicleText.match(/Color:\s*([^<]+)/i);
      if (colorMatch) vehicleInfo.color = colorMatch[1].trim();
      
      const nivMatch = vehicleText.match(/NIV:\s*([^<]+)/i);
      if (nivMatch) vehicleInfo.niv = nivMatch[1].trim();
    }
  }
  
  return vehicleInfo;
}

function extractFinancialData(html) {
  console.log('Extrayendo datos financieros...');
  
  const financialData = {
    cargos: [],
    subsidios: [],
    totales: {}
  };
  
  // Buscar la sección de CARGOS
  const cargosSectionMatch = html.match(/CARGOS[^>]*>([\s\S]*?)SUBSIDIO/si);
  if (cargosSectionMatch) {
    const cargosSection = cargosSectionMatch[1];
    extractCargosFromSection(cargosSection, financialData.cargos);
  }
  
  // Buscar la sección de SUBSIDIO
  const subsidioSectionMatch = html.match(/SUBSIDIO[^>]*>([\s\S]*?)TOTAL A PAGAR/si) || 
                               html.match(/SUBSIDIO[^>]*>([\s\S]*?)SUBTOTAL MONTO SUBSIDIO/si);
  if (subsidioSectionMatch) {
    const subsidioSection = subsidioSectionMatch[1];
    extractSubsidiosFromSection(subsidioSection, financialData.subsidios);
  }
  
  // Extraer totales
  extractTotals(html, financialData.totales);
  
  // Si no encontramos cargos en secciones, buscar directamente en todo el HTML
  if (financialData.cargos.length === 0) {
    console.log('Buscando cargos directamente en el HTML...');
    extractCargosDirectly(html, financialData.cargos);
  }
  
  if (financialData.subsidios.length === 0) {
    console.log('Buscando subsidios directamente en el HTML...');
    extractSubsidiosDirectly(html, financialData.subsidios);
  }
  
  return financialData;
}

function extractCargosFromSection(section, cargosArray) {
  // Buscar filas de tabla con datos de cargos
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let match;
  
  while ((match = rowRegex.exec(section)) !== null) {
    const row = match[1];
    
    // Extraer celdas
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells = [];
    let cellMatch;
    
    while ((cellMatch = cellRegex.exec(row)) !== null) {
      cells.push(cellMatch[1]);
    }
    
    if (cells.length >= 3) {
      const descripcion = cleanText(cells[0]);
      const anio = cleanText(cells[1]);
      const monto = cleanText(cells[2]);
      
      // Validar que sea un cargo válido
      if (descripcion && descripcion.length > 2 && anio && monto && monto.includes('$')) {
        cargosArray.push({
          descripcion: descripcion.replace(/\\n/g, '').trim(),
          anio: anio.replace(/\\n/g, '').trim(),
          monto: extractAmount(monto)
        });
      }
    }
  }
}

function extractSubsidiosFromSection(section, subsidiosArray) {
  // Buscar filas de tabla con datos de subsidios
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let match;
  
  while ((match = rowRegex.exec(section)) !== null) {
    const row = match[1];
    
    // Extraer celdas
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells = [];
    let cellMatch;
    
    while ((cellMatch = cellRegex.exec(row)) !== null) {
      cells.push(cellMatch[1]);
    }
    
    if (cells.length >= 3) {
      const descripcion = cleanText(cells[0]);
      const anio = cleanText(cells[1]);
      const monto = cleanText(cells[2]);
      
      // Validar que sea un subsidio válido (con monto negativo)
      if (descripcion && descripcion.length > 2 && anio && monto && (monto.includes('-$') || monto.includes('-'))) {
        subsidiosArray.push({
          descripcion: descripcion.replace(/\\n/g, '').trim(),
          anio: anio.replace(/\\n/g, '').trim(),
          monto: extractAmount(monto)
        });
      }
    }
  }
}

function extractCargosDirectly(html, cargosArray) {
  // Buscar patrones como "REFRENDO PTE.AÑO2026$3,960.00"
  const cargoPattern = /([A-Z\s\.ÑÁÉÍÓÚ]+?)(\d{4})(\$\s*[\d,]+\.\d{2})/g;
  let match;
  
  while ((match = cargoPattern.exec(html)) !== null) {
    const descripcion = match[1].trim();
    const anio = match[2];
    const monto = match[3];
    
    // Filtrar descripciones demasiado cortas o que sean títulos
    if (descripcion.length > 5 && !descripcion.includes('Descripción') && !descripcion.includes('Año')) {
      cargosArray.push({
        descripcion,
        anio,
        monto
      });
    }
  }
  
  // También buscar en formato "Descripción | Año | Monto"
  const cargoPattern2 = /([^|]+)\|([^|]+)\|([^|]+)/g;
  const matches2 = html.matchAll(cargoPattern2);
  
  for (const match of matches2) {
    const descripcion = match[1].trim();
    const anio = match[2].trim();
    const monto = match[3].trim();
    
    if (descripcion && anio && monto && monto.includes('$') && 
        !descripcion.includes('Descripción') && descripcion.length > 3) {
      cargosArray.push({
        descripcion,
        anio,
        monto
      });
    }
  }
}

function extractSubsidiosDirectly(html, subsidiosArray) {
  // Buscar patrones de subsidios (montos negativos)
  const subsidioPattern = /([A-Z\s\.ÑÁÉÍÓÚ]+?)(\d{4})(-\$\s*[\d,]+\.\d{2})/g;
  let match;
  
  while ((match = subsidioPattern.exec(html)) !== null) {
    const descripcion = match[1].trim();
    const anio = match[2];
    const monto = match[3];
    
    if (descripcion.length > 5 && descripcion.toLowerCase().includes('subsidio')) {
      subsidiosArray.push({
        descripcion,
        anio,
        monto
      });
    }
  }
}

function extractTotals(html, totales) {
  // Buscar subtotal de cargos
  const subtotalCargosMatch = html.match(/SUBTOTAL MONTO CARGOS:\s*[^>]*>([^<]+)/i);
  if (subtotalCargosMatch) {
    totales.subtotalCargos = extractAmount(subtotalCargosMatch[1]);
  }
  
  // Buscar subtotal de subsidio
  const subtotalSubsidioMatch = html.match(/SUBTOTAL MONTO SUBSIDIO:\s*[^>]*>([^<]+)/i);
  if (subtotalSubsidioMatch) {
    totales.subtotalSubsidio = extractAmount(subtotalSubsidioMatch[1]);
  }
  
  // Buscar total a pagar
  const totalAPagarMatch = html.match(/TOTAL A PAGAR:\s*[^>]*>([^<]+)/i);
  if (totalAPagarMatch) {
    totales.totalAPagar = extractAmount(totalAPagarMatch[1]);
  }
  
  // Si no encontramos con ese patrón, buscar de otra manera
  if (!totales.totalAPagar) {
    const totalMatch = html.match(/\$[\d,]+\.\d{2}(?=[^>]*<\/strong>)/);
    if (totalMatch) {
      totales.totalAPagar = totalMatch[0];
    }
  }
}

function cleanText(html) {
  return html.replace(/<[^>]*>/g, '')
             .replace(/\\n/g, '')
             .replace(/\s+/g, ' ')
             .trim();
}

function extractAmount(text) {
  if (!text) return '';
  
  // Buscar patrones de dinero
  const amountPattern = /\$[\d,]+\.\d{2}|-\$[\d,]+\.\d{2}/;
  const match = text.match(amountPattern);
  
  return match ? match[0] : '';
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
    message: 'API de consulta de estado de cuenta vehicular - ANÁLISIS DIRECTO',
    status: 'online',
    proxy: 'activado',
    solicitudes_simultaneas: '1 máximo',
    estado_actual: isProcessing ? 'procesando' : 'disponible',
    cola: requestQueue,
    endpoints: {
      consulta: 'GET /consulta?placa=ABC123',
      consultaPost: 'POST /consulta con JSON body { "placa": "ABC123" }',
      health: 'GET /health'
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
    version: '4.0 - Análisis directo HTML'
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
    console.log(`\n🚀 INICIANDO CONSULTA PARA PLACA: ${placaLimpia}`);
    console.log(`🔗 Usando proxy: ${PROXY_CONFIG.server}`);
    
    const resultados = await runAutomation(placaLimpia);
    const tiempo = ((Date.now() - startTime) / 1000).toFixed(2);
    
    const respuesta = {
      ...resultados,
      tiempoConsulta: `${tiempo} segundos`,
      consultadoEn: new Date().toISOString()
    };
    
    console.log(`✅ Consulta completada en ${tiempo} segundos`);
    console.log(`📊 Resultados:`);
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
    console.log(`\n🚀 INICIANDO CONSULTA PARA PLACA: ${placaLimpia}`);
    
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

// Endpoint para debug
app.get('/debug/:placa', checkSimultaneousRequests, async (req, res) => {
  try {
    const { placa } = req.params;
    
    if (!placa) {
      isProcessing = false;
      requestQueue--;
      return res.status(400).json({
        error: 'Placa requerida. Ejemplo: /debug/ABC123'
      });
    }
    
    const placaLimpia = placa.trim().toUpperCase().replace(/\s+/g, '');
    
    const browser = await chromium.launch({ 
      headless: true,
      proxy: PROXY_CONFIG
    });
    
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      proxy: PROXY_CONFIG
    });
    
    const page = await context.newPage();
    
    try {
      await page.goto('https://icvnl.gob.mx:1080/estadoctav3/edoctaconsulta#no-back-button', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      
      // Realizar el proceso completo
      await delay(WAIT_TIMES.medium);
      await page.getByRole('checkbox', { name: 'Acepto bajo protesta de decir' }).check();
      await delay(WAIT_TIMES.short);
      await page.getByRole('textbox', { name: 'Placa' }).click();
      await page.getByRole('textbox', { name: 'Placa' }).fill(placaLimpia);
      await delay(WAIT_TIMES.short);
      await page.locator('div:nth-child(4)').click();
      await delay(WAIT_TIMES.long);
      await page.getByRole('button', { name: 'Consultar' }).click();
      await delay(WAIT_TIMES.xlong);
      
      // Obtener HTML
      const htmlContent = await page.content();
      
      res.json({
        placa: placaLimpia,
        htmlLength: htmlContent.length,
        htmlPreview: htmlContent.substring(0, 5000) + '...',
        tieneAdeudosText: htmlContent.includes('adeudos pendientes') ? 'Sí' : 'No',
        tieneCargosText: htmlContent.includes('CARGOS') ? 'Sí' : 'No',
        tieneSubsidioText: htmlContent.includes('SUBSIDIO') ? 'Sí' : 'No'
      });
      
    } finally {
      await browser.close();
    }
    
  } catch (error) {
    console.error('Error en debug:', error);
    res.status(500).json({
      error: 'Error en debug',
      message: error.message
    });
  } finally {
    isProcessing = false;
    requestQueue--;
  }
});

app.listen(port, () => {
  console.log(`🚀 API DE CONSULTA VEHICULAR - ANÁLISIS DIRECTO HTML`);
  console.log(`📡 Puerto: ${port}`);
  console.log(`🌐 Proxy: ${PROXY_CONFIG.server}`);
  console.log(`📧 Email: ${EMAIL}`);
  console.log(`🚫 Solicitudes simultáneas: 1 máximo`);
  console.log(`\n✅ ENDPOINTS DISPONIBLES:`);
  console.log(`   GET  /consulta?placa=ABC123`);
  console.log(`   POST /consulta`);
  console.log(`   GET  /debug/ABC123 (para diagnóstico)`);
  console.log(`   GET  /health`);
  console.log(`   GET  /`);
  console.log(`\n🔍 SISTEMA DE ANÁLISIS DIRECTO:`);
  console.log(`   • Regex directo sobre HTML`);
  console.log(`   • No dependencia de selectores específicos`);
  console.log(`   • Búsqueda de patrones en texto crudo`);
  console.log(`   • Múltiples métodos de extracción`);
});
