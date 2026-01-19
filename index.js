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
    
    // Guardar HTML para debug (opcional)
    // require('fs').writeFileSync(`debug_${placa}.html`, htmlContent);
    
    // Extraer datos de manera FORZADA
    const resultados = await extractAllDataForcibly(page, htmlContent, placa);
    
    return resultados;
    
  } catch (error) {
    console.error('Error durante la automatización:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

async function extractAllDataForcibly(page, htmlContent, placa) {
  console.log('=== INICIANDO EXTRACCIÓN FORZADA DE DATOS ===');
  
  // Extraer información del vehículo de manera forzada
  const vehicleInfo = await extractVehicleInfoForcibly(page);
  
  // Extraer TODOS los datos financieros de manera forzada
  const financialData = await extractFinancialDataForcibly(page, htmlContent);
  
  // Extraer texto completo de la página para análisis
  const allText = await extractAllTextForcibly(page);
  
  // Procesar texto para encontrar montos y datos
  const processedData = processAllText(allText);
  
  // Combinar todos los datos
  const finalData = {
    placa,
    vehiculo: vehicleInfo.length > 0 ? vehicleInfo : extractVehicleFromText(allText),
    desgloseCompleto: mergeFinancialData(financialData, processedData),
    textoCompleto: allText.substring(0, 5000) + '...', // Primeros 5000 caracteres para debug
    resumen: generateSummary(mergeFinancialData(financialData, processedData))
  };
  
  console.log('=== EXTRACCIÓN COMPLETADA ===');
  console.log('Datos del vehículo encontrados:', vehicleInfo.length);
  console.log('Montos encontrados:', processedData.allAmounts.length);
  
  return finalData;
}

async function extractVehicleInfoForcibly(page) {
  const vehicleInfo = [];
  
  try {
    // Método 1: Buscar por todos los elementos que puedan contener info del vehículo
    const possibleElements = await page.locator('div, span, td, th, p, li, strong, b').all();
    
    const vehicleKeywords = [
      'marca', 'modelo', 'linea', 'tipo', 'color', 'niv', 
      'año', 'serie', 'motor', 'placas', 'vehículo', 'carro',
      'automóvil', 'propietario', 'dueño', 'tarjeta', 'circulación'
    ];
    
    for (const element of possibleElements.slice(0, 100)) { // Limitar a primeros 100 elementos
      try {
        const text = await element.textContent();
        if (text && text.trim()) {
          const lowerText = text.toLowerCase();
          for (const keyword of vehicleKeywords) {
            if (lowerText.includes(keyword)) {
              vehicleInfo.push(text.trim());
              break;
            }
          }
        }
      } catch (e) {
        // Ignorar errores en elementos específicos
      }
    }
    
    // Método 2: Buscar tablas específicas
    const tables = await page.locator('table').all();
    for (const table of tables) {
      const rows = await table.locator('tr').all();
      for (const row of rows) {
        const cells = await row.locator('td, th').allTextContents();
        const rowText = cells.join(' | ').trim();
        if (rowText) {
          vehicleInfo.push(rowText);
        }
      }
    }
    
  } catch (error) {
    console.log('Error extrayendo info del vehículo:', error.message);
  }
  
  return [...new Set(vehicleInfo)].slice(0, 20); // Limitar a 20 elementos únicos
}

async function extractFinancialDataForcibly(page, htmlContent) {
  console.log('Extrayendo datos financieros...');
  
  const financialData = {
    cargosPorAnio: [],
    multas: [],
    recargos: [],
    derechos: [],
    impuestos: [],
    subsidios: [],
    descuentos: [],
    otrosCargos: [],
    subtotal: null,
    total: null,
    calculos: {
      sumaCargos: 0,
      sumaMultas: 0,
      sumaRecargos: 0,
      sumaDerechos: 0,
      sumaImpuestos: 0,
      sumaDescuentos: 0,
      sumaOtros: 0,
      totalCalculado: 0
    }
  };
  
  // Extraer TODOS los montos del HTML
  const amountPatterns = [
    /\$\s*\d{1,3}(?:,\d{3})*(?:\.\d{2})?/g, // $1,234.56
    /\$\s*\d+(?:\.\d{2})?/g, // $1234.56
    /-\$\s*\d{1,3}(?:,\d{3})*(?:\.\d{2})?/g, // -$1,234.56
    /\d{1,3}(?:,\d{3})*(?:\.\d{2})?\s*(?:MXN|USD|pesos)/gi,
    /total.*?\$\s*\d{1,3}(?:,\d{3})*(?:\.\d{2})?/gi,
    /subtotal.*?\$\s*\d{1,3}(?:,\d{3})*(?:\.\d{2})?/gi,
    /pagar.*?\$\s*\d{1,3}(?:,\d{3})*(?:\.\d{2})?/gi
  ];
  
  let allAmounts = [];
  for (const pattern of amountPatterns) {
    const matches = htmlContent.match(pattern) || [];
    allAmounts = [...allAmounts, ...matches];
  }
  
  // Eliminar duplicados y limpiar
  allAmounts = [...new Set(allAmounts)].map(amount => amount.trim());
  
  console.log('Montos encontrados en HTML:', allAmounts.length);
  
  // Extraer todo el texto visible
  const allText = await page.evaluate(() => {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          // Filtrar nodos vacíos y scripts/estilos
          if (node.parentElement.tagName === 'SCRIPT' || 
              node.parentElement.tagName === 'STYLE' ||
              node.parentElement.tagName === 'NOSCRIPT') {
            return NodeFilter.FILTER_REJECT;
          }
          if (node.textContent.trim().length > 0) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_REJECT;
        }
      }
    );
    
    const texts = [];
    let node;
    while (node = walker.nextNode()) {
      texts.push(node.textContent.trim());
    }
    return texts.join('\n');
  });
  
  // Procesar el texto para encontrar datos estructurados
  const lines = allText.split('\n').filter(line => line.trim().length > 0);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lowerLine = line.toLowerCase();
    
    // Buscar años (2020, 2021, 2022, 2023, 2024, 2025)
    const yearMatch = line.match(/(20\d{2})/);
    if (yearMatch) {
      const year = yearMatch[1];
      // Buscar montos cerca del año
      for (const amount of allAmounts) {
        if (Math.abs(lines.indexOf(line) - i) < 3) {
          financialData.cargosPorAnio.push({
            año: year,
            concepto: 'Cargo vehicular',
            monto: amount,
            descripcion: line
          });
          
          const amountNum = parseFloat(amount.replace(/[^0-9.-]+/g, ''));
          if (!isNaN(amountNum)) {
            financialData.calculos.sumaCargos += Math.abs(amountNum);
          }
        }
      }
    }
    
    // Categorizar por palabras clave
    if (lowerLine.includes('multa') || lowerLine.includes('infracción')) {
      const amount = findAmountInLine(line, allAmounts);
      if (amount) {
        financialData.multas.push({
          concepto: 'Multa',
          monto: amount,
          descripcion: line
        });
        
        const amountNum = parseFloat(amount.replace(/[^0-9.-]+/g, ''));
        if (!isNaN(amountNum)) {
          financialData.calculos.sumaMultas += Math.abs(amountNum);
        }
      }
    }
    
    if (lowerLine.includes('recargo') || lowerLine.includes('moratorio') || lowerLine.includes('interés')) {
      const amount = findAmountInLine(line, allAmounts);
      if (amount) {
        financialData.recargos.push({
          concepto: 'Recargo',
          monto: amount,
          descripcion: line
        });
        
        const amountNum = parseFloat(amount.replace(/[^0-9.-]+/g, ''));
        if (!isNaN(amountNum)) {
          financialData.calculos.sumaRecargos += Math.abs(amountNum);
        }
      }
    }
    
    if (lowerLine.includes('derecho')) {
      const amount = findAmountInLine(line, allAmounts);
      if (amount) {
        financialData.derechos.push({
          concepto: 'Derecho',
          monto: amount,
          descripcion: line
        });
        
        const amountNum = parseFloat(amount.replace(/[^0-9.-]+/g, ''));
        if (!isNaN(amountNum)) {
          financialData.calculos.sumaDerechos += Math.abs(amountNum);
        }
      }
    }
    
    if (lowerLine.includes('subtotal')) {
      const amount = findAmountInLine(line, allAmounts);
      if (amount && !financialData.subtotal) {
        financialData.subtotal = {
          concepto: 'Subtotal',
          monto: amount,
          descripcion: line
        };
      }
    }
    
    if (lowerLine.includes('total') && (lowerLine.includes('pagar') || lowerLine.includes('final'))) {
      const amount = findAmountInLine(line, allAmounts);
      if (amount && !financialData.total) {
        financialData.total = {
          concepto: 'Total a Pagar',
          monto: amount,
          descripcion: line
        };
      }
    }
    
    // Buscar cualquier monto que no haya sido categorizado
    for (const amount of allAmounts) {
      if (line.includes(amount.replace('$', '').trim())) {
        // Verificar si ya fue agregado
        const alreadyAdded = [
          ...financialData.cargosPorAnio,
          ...financialData.multas,
          ...financialData.recargos,
          ...financialData.derechos
        ].some(item => item.monto === amount);
        
        if (!alreadyAdded) {
          financialData.otrosCargos.push({
            concepto: 'Cargo no identificado',
            monto: amount,
            descripcion: line
          });
          
          const amountNum = parseFloat(amount.replace(/[^0-9.-]+/g, ''));
          if (!isNaN(amountNum)) {
            financialData.calculos.sumaOtros += Math.abs(amountNum);
          }
        }
      }
    }
  }
  
  // Calcular total
  const totalCalculado = 
    financialData.calculos.sumaCargos +
    financialData.calculos.sumaMultas +
    financialData.calculos.sumaRecargos +
    financialData.calculos.sumaDerechos +
    financialData.calculos.sumaImpuestos +
    financialData.calculos.sumaOtros -
    financialData.calculos.sumaDescuentos;
  
  financialData.calculos.totalCalculado = totalCalculado;
  
  return financialData;
}

async function extractAllTextForcibly(page) {
  try {
    // Extraer todo el texto de la página usando múltiples métodos
    
    // Método 1: textContent de body
    const bodyText = await page.evaluate(() => document.body.textContent);
    
    // Método 2: Todos los elementos visibles
    const allText = await page.evaluate(() => {
      const elements = document.querySelectorAll('body *');
      const texts = [];
      
      elements.forEach(el => {
        if (el.offsetWidth > 0 && el.offsetHeight > 0) { // Solo elementos visibles
          const text = el.textContent;
          if (text && text.trim()) {
            texts.push(text.trim());
          }
        }
      });
      
      return texts.join('\n');
    });
    
    // Método 3: Usar getTextContent en toda la página
    const pageText = await page.textContent('body');
    
    // Combinar todos los métodos y eliminar duplicados
    const combinedText = [bodyText, allText, pageText]
      .filter(text => text && text.trim())
      .join('\n\n---\n\n');
    
    return combinedText;
    
  } catch (error) {
    console.log('Error extrayendo texto:', error.message);
    return '';
  }
}

function processAllText(text) {
  console.log('Procesando texto completo...');
  
  const result = {
    allAmounts: [],
    years: [],
    vehicleInfo: [],
    lines: []
  };
  
  // Extraer todas las líneas de texto
  const lines = text.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
  
  result.lines = lines;
  
  // Extraer todos los montos
  const amountRegex = /\$\s*\d{1,3}(?:,\d{3})*(?:\.\d{2})?|-\$\s*\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d{1,3}(?:,\d{3})*(?:\.\d{2})?\s*(?:MXN|USD|pesos)/gi;
  const matches = text.match(amountRegex) || [];
  result.allAmounts = [...new Set(matches.map(m => m.trim()))];
  
  // Extraer años
  const yearRegex = /20\d{2}/g;
  const years = text.match(yearRegex) || [];
  result.years = [...new Set(years)];
  
  // Extraer información del vehículo
  const vehicleKeywords = ['marca', 'modelo', 'año', 'color', 'niv', 'serie', 'motor', 'placa', 'vehículo'];
  result.vehicleInfo = lines.filter(line => {
    const lowerLine = line.toLowerCase();
    return vehicleKeywords.some(keyword => lowerLine.includes(keyword));
  });
  
  return result;
}

function findAmountInLine(line, allAmounts) {
  for (const amount of allAmounts) {
    // Eliminar $ y espacios para comparación
    const cleanAmount = amount.replace(/[$\s]/g, '');
    const cleanLine = line.replace(/[$\s]/g, '');
    
    if (cleanLine.includes(cleanAmount)) {
      return amount;
    }
  }
  return null;
}

function extractVehicleFromText(text) {
  const vehicleInfo = [];
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  
  // Patrones específicos para información del vehículo
  const patterns = [
    { regex: /marca[:\s]*([^\n]+)/i, key: 'Marca:' },
    { regex: /modelo[:\s]*([^\n]+)/i, key: 'Modelo:' },
    { regex: /año[:\s]*([^\n]+)/i, key: 'Año:' },
    { regex: /color[:\s]*([^\n]+)/i, key: 'Color:' },
    { regex: /niv[:\s]*([^\n]+)/i, key: 'NIV:' },
    { regex: /serie[:\s]*([^\n]+)/i, key: 'Serie:' },
    { regex: /motor[:\s]*([^\n]+)/i, key: 'Motor:' },
    { regex: /placa[:\s]*([^\n]+)/i, key: 'Placa:' },
    { regex: /vehículo[:\s]*([^\n]+)/i, key: 'Vehículo:' }
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern.regex);
    if (match && match[1]) {
      const value = match[1].trim();
      if (value.length > 0 && value.length < 100) { // Filtrar valores muy largos
        vehicleInfo.push(pattern.key);
        vehicleInfo.push(value);
      }
    }
  }
  
  return vehicleInfo.length > 0 ? vehicleInfo : ['No se encontró información del vehículo'];
}

function mergeFinancialData(financialData, processedData) {
  // Asegurarnos de que tenemos todos los montos
  const allUniqueAmounts = [...new Set([
    ...processedData.allAmounts,
    ...financialData.cargosPorAnio.map(item => item.monto),
    ...financialData.multas.map(item => item.monto),
    ...financialData.recargos.map(item => item.monto),
    ...financialData.derechos.map(item => item.monto),
    ...financialData.otrosCargos.map(item => item.monto)
  ].filter(Boolean))];
  
  // Si no tenemos cargos por año pero tenemos años y montos, intentar crear
  if (financialData.cargosPorAnio.length === 0 && processedData.years.length > 0) {
    processedData.years.forEach(year => {
      // Buscar montos cerca de años en el texto
      const yearIndex = processedData.lines.findIndex(line => line.includes(year));
      if (yearIndex !== -1) {
        // Buscar montos en líneas cercanas
        for (let i = Math.max(0, yearIndex - 2); i < Math.min(processedData.lines.length, yearIndex + 3); i++) {
          const line = processedData.lines[i];
          const amount = findAmountInLine(line, allUniqueAmounts);
          if (amount) {
            financialData.cargosPorAnio.push({
              año: year,
              concepto: 'Cargo vehicular',
              monto: amount,
              descripcion: line
            });
          }
        }
      }
    });
  }
  
  return financialData;
}

function generateSummary(financialData) {
  const totalAPagar = financialData.total?.monto || 
                     (financialData.calculos.totalCalculado > 0 ? 
                      `$${financialData.calculos.totalCalculado.toFixed(2)}` : 
                      'No disponible');
  
  return {
    subtotal: financialData.subtotal?.monto || 'No disponible',
    descuentos: financialData.descuentos.length > 0 ? 
                `-$${financialData.calculos.sumaDescuentos.toFixed(2)}` : 
                'No disponible',
    impuestos: financialData.impuestos.length > 0 ? 
               `$${financialData.calculos.sumaImpuestos.toFixed(2)}` : 
               'No disponible',
    totalAPagar: totalAPagar,
    totalDetectado: `$${financialData.calculos.totalCalculado.toFixed(2)}`,
    estadisticas: {
      cargosAnuales: financialData.cargosPorAnio.length,
      multas: financialData.multas.length,
      recargos: financialData.recargos.length,
      otrosCargos: financialData.otrosCargos.length,
      montosEncontrados: financialData.calculos.totalCalculado > 0 ? 'Sí' : 'No'
    }
  };
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

// Endpoints de la API (mantener igual que antes)
app.get('/', (req, res) => {
  res.json({
    message: 'API de consulta de estado de cuenta vehicular - EXTRACCIÓN FORZADA',
    status: 'online',
    proxy: 'activado',
    solicitudes_simultaneas: '1 máximo',
    estado_actual: isProcessing ? 'procesando' : 'disponible',
    cola: requestQueue,
    endpoints: {
      consulta: 'GET /consulta?placa=ABC123',
      consultaPost: 'POST /consulta con JSON body { "placa": "ABC123" }',
      health: 'GET /health',
      consola: 'GET /consulta-consola/:placa',
      desglose: 'GET /desglose/:placa'
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
    version: '2.0 - Extracción forzada'
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
    console.log(`\n🚀 INICIANDO CONSULTA FORZADA PARA PLACA: ${placaLimpia}`);
    console.log(`🔗 Usando proxy: ${PROXY_CONFIG.server}`);
    
    const resultados = await runAutomation(placaLimpia);
    const tiempo = ((Date.now() - startTime) / 1000).toFixed(2);
    
    const respuesta = {
      ...resultados,
      tiempoConsulta: `${tiempo} segundos`,
      consultadoEn: new Date().toISOString(),
      metadata: {
        metodo: 'Extracción forzada v2.0',
        proxyUtilizado: PROXY_CONFIG.server,
        userAgent: 'Chrome 120'
      }
    };
    
    console.log(`✅ Consulta completada en ${tiempo} segundos`);
    console.log(`📊 Datos encontrados:`);
    console.log(`   • Info vehículo: ${resultados.vehiculo.length > 1 ? 'Sí' : 'No'}`);
    console.log(`   • Cargos anuales: ${resultados.desgloseCompleto.cargosPorAnio.length}`);
    console.log(`   • Montos totales: $${resultados.desgloseCompleto.calculos.totalCalculado.toFixed(2)}`);
    
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
    console.log(`\n🚀 INICIANDO CONSULTA FORZADA PARA PLACA: ${placaLimpia}`);
    
    const resultados = await runAutomation(placaLimpia);
    const tiempo = ((Date.now() - startTime) / 1000).toFixed(2);
    
    const respuesta = {
      ...resultados,
      tiempoConsulta: `${tiempo} segundos`,
      consultadoEn: new Date().toISOString(),
      metadata: {
        metodo: 'Extracción forzada v2.0',
        proxyUtilizado: PROXY_CONFIG.server
      }
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

// Endpoint para desglose detallado
app.get('/desglose/:placa', checkSimultaneousRequests, async (req, res) => {
  try {
    const { placa } = req.params;
    
    if (!placa) {
      isProcessing = false;
      requestQueue--;
      return res.status(400).json({
        error: 'Placa requerida. Ejemplo: /desglose/ABC123'
      });
    }
    
    const placaLimpia = placa.trim().toUpperCase().replace(/\s+/g, '');
    const startTime = Date.now();
    
    console.log(`\n🔍 INICIANDO DESGLOSE FORZADO PARA PLACA: ${placaLimpia}`);
    
    const resultados = await runAutomation(placaLimpia);
    const tiempo = ((Date.now() - startTime) / 1000).toFixed(2);
    
    // Formatear respuesta para desglose
    const respuesta = {
      placa: resultados.placa,
      vehiculo: formatVehicleInfo(resultados.vehiculo),
      desgloseDetallado: {
        cargosPorAnio: resultados.desgloseCompleto.cargosPorAnio || [],
        multas: resultados.desgloseCompleto.multas || [],
        recargos: resultados.desgloseCompleto.recargos || [],
        derechos: resultados.desgloseCompleto.derechos || [],
        impuestos: resultados.desgloseCompleto.impuestos || [],
        subsidios: resultados.desgloseCompleto.subsidios || [],
        descuentos: resultados.desgloseCompleto.descuentos || [],
        otrosCargos: resultados.desgloseCompleto.otrosCargos || []
      },
      totales: resultados.resumen,
      tiempoConsulta: `${tiempo} segundos`,
      consultadoEn: new Date().toISOString(),
      analisis: {
        lineasProcesadas: resultados.textoCompleto ? resultados.textoCompleto.split('\n').length : 0,
        montosEncontrados: resultados.desgloseCompleto.calculos.totalCalculado > 0 ? 'Sí' : 'No'
      }
    };
    
    res.json(respuesta);
    
  } catch (error) {
    console.error('❌ Error en el desglose:', error);
    res.status(500).json({
      error: 'Error en el desglose',
      message: error.message
    });
  } finally {
    isProcessing = false;
    requestQueue--;
  }
});

function formatVehicleInfo(vehicleArray) {
  if (vehicleArray.length === 1 && vehicleArray[0] === 'No se encontró información del vehículo') {
    return { mensaje: 'No se encontró información del vehículo' };
  }
  
  const vehicleObj = {};
  for (let i = 0; i < vehicleArray.length; i += 2) {
    if (vehicleArray[i] && vehicleArray[i + 1]) {
      const key = vehicleArray[i].replace(':', '').trim().toLowerCase();
      vehicleObj[key] = vehicleArray[i + 1];
    }
  }
  return vehicleObj;
}

app.listen(port, () => {
  console.log(`🚀 API DE CONSULTA VEHICULAR - EXTRACCIÓN FORZADA`);
  console.log(`📡 Puerto: ${port}`);
  console.log(`🌐 Proxy: ${PROXY_CONFIG.server}`);
  console.log(`📧 Email: ${EMAIL}`);
  console.log(`🚫 Solicitudes simultáneas: 1 máximo`);
  console.log(`\n✅ ENDPOINTS DISPONIBLES:`);
  console.log(`   GET  /consulta?placa=ABC123`);
  console.log(`   POST /consulta`);
  console.log(`   GET  /desglose/ABC123`);
  console.log(`   GET  /health`);
  console.log(`   GET  /`);
  console.log(`\n🔍 SISTEMA DE EXTRACCIÓN FORZADA:`);
  console.log(`   • Extracción agresiva de montos`);
  console.log(`   • Búsqueda por patrones de años`);
  console.log(`   • Análisis de texto completo`);
  console.log(`   • Categorización inteligente`);
  console.log(`   • Debug de HTML disponible`);
});
