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
    
    // Extraer datos de manera robusta con desglose detallado
    const resultados = await extractAllDataWithBreakdown(page, htmlContent, placa);
    
    return resultados;
    
  } catch (error) {
    console.error('Error durante la automatización:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

async function extractAllDataWithBreakdown(page, htmlContent, placa) {
  // Extraer información del vehículo
  const vehicleInfo = await extractVehicleInfo(page);
  
  // Extraer TODOS los datos financieros con desglose detallado
  const financialData = await extractCompleteFinancialData(page, htmlContent);
  
  return {
    placa,
    vehiculo: vehicleInfo.length > 0 ? vehicleInfo : ['No se encontró información del vehículo'],
    desgloseCompleto: financialData,
    resumen: {
      subtotal: financialData.subtotal?.monto || 'No disponible',
      descuentos: financialData.descuentos?.total || 'No disponible',
      impuestos: financialData.impuestos?.total || 'No disponible',
      totalAPagar: financialData.total?.monto || 'No disponible',
      totalDetectado: financialData.calculos?.totalCalculado || 'No disponible'
    }
  };
}

async function extractVehicleInfo(page) {
  const vehicleInfo = [];
  
  // Selectores específicos para información del vehículo
  const vehicleSelectors = [
    { label: 'Marca:', selector: '[class*="marca"], [id*="marca"], :text("Marca:")' },
    { label: 'Modelo:', selector: '[class*="modelo"], [id*="modelo"], :text("Modelo:")' },
    { label: 'Linea:', selector: '[class*="linea"], [id*="linea"], :text("Linea:")' },
    { label: 'Tipo:', selector: '[class*="tipo"], [id*="tipo"], :text("Tipo:")' },
    { label: 'Color:', selector: '[class*="color"], [id*="color"], :text("Color:")' },
    { label: 'NIV:', selector: '[class*="niv"], [id*="niv"], :text("NIV:")' }
  ];
  
  for (const item of vehicleSelectors) {
    try {
      // Buscar por texto
      const labelElement = await page.locator(`text=${item.label}`).first();
      if (await labelElement.count() > 0) {
        // Obtener el texto completo y extraer el valor
        const parentText = await labelElement.evaluate(el => {
          let text = '';
          let currentNode = el.parentElement;
          
          // Buscar en el contenedor padre
          if (currentNode) {
            text = currentNode.textContent || '';
            // Limpiar el texto
            text = text.replace(/\s+/g, ' ').trim();
            
            // Extraer el valor después de la etiqueta
            const regex = new RegExp(`${item.label}\\s*(.*?)(?=\\s*[A-Z]+:|$)`);
            const match = text.match(regex);
            if (match && match[1]) {
              return match[1].trim();
            }
          }
          return '';
        });
        
        if (parentText) {
          vehicleInfo.push(item.label);
          vehicleInfo.push(parentText);
        }
      }
    } catch (error) {
      console.log(`No se pudo extraer ${item.label}:`, error.message);
    }
  }
  
  return vehicleInfo;
}

async function extractCompleteFinancialData(page, htmlContent) {
  const financialData = {
    // Cargos por año con desglose detallado
    cargosPorAnio: [],
    
    // Multas y recargos
    multas: [],
    recargos: [],
    
    // Derechos e impuestos
    derechos: [],
    impuestos: [],
    
    // Subsidios y descuentos
    subsidios: [],
    descuentos: [],
    
    // Totales
    subtotal: null,
    total: null,
    
    // Cálculos
    calculos: {
      sumaCargos: 0,
      sumaMultas: 0,
      sumaRecargos: 0,
      sumaDerechos: 0,
      sumaImpuestos: 0,
      sumaDescuentos: 0,
      totalCalculado: 0
    }
  };
  
  // Extraer todas las tablas de la página
  const tables = await page.locator('table').all();
  console.log(`Encontradas ${tables.length} tablas`);
  
  // Procesar cada tabla
  for (let tableIndex = 0; tableIndex < tables.length; tableIndex++) {
    try {
      const table = tables[tableIndex];
      const rows = await table.locator('tr').all();
      
      console.log(`Tabla ${tableIndex + 1}: ${rows.length} filas`);
      
      // Procesar cada fila de la tabla
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex];
        const cells = await row.locator('td, th').allTextContents();
        const rowText = cells.join(' | ').trim();
        
        // Analizar el contenido de la fila
        await analyzeRowContent(rowText, cells, financialData);
      }
    } catch (error) {
      console.log(`Error procesando tabla ${tableIndex + 1}:`, error.message);
    }
  }
  
  // Buscar información adicional en todo el contenido HTML
  await extractFromHTMLContent(htmlContent, financialData);
  
  // Realizar cálculos finales
  calculateFinancialTotals(financialData);
  
  return financialData;
}

async function analyzeRowContent(rowText, cells, financialData) {
  // Normalizar el texto
  const normalizedText = rowText.toLowerCase().replace(/\s+/g, ' ');
  
  // Buscar patrones específicos
  
  // 1. Cargos por año (ej: 2024 $1,200.00)
  const yearChargePattern = /(\d{4})\s*.*?(\$\s*[\d,]+\.?\d*)/i;
  const yearMatch = normalizedText.match(yearChargePattern);
  if (yearMatch) {
    const year = yearMatch[1];
    const monto = extractAmount(yearMatch[2]);
    
    // Determinar el tipo de cargo basado en palabras clave
    let tipo = 'Cargo anual';
    let concepto = 'Tenencia/Refrendo';
    
    if (normalizedText.includes('refrendo')) concepto = 'Refrendo';
    if (normalizedText.includes('tenencia')) concepto = 'Tenencia';
    if (normalizedText.includes('placa')) concepto = 'Placas';
    if (normalizedText.includes('derecho')) concepto = 'Derecho';
    if (normalizedText.includes('verific')) concepto = 'Verificación';
    
    financialData.cargosPorAnio.push({
      año: year,
      concepto: concepto,
      tipo: tipo,
      monto: monto,
      descripcion: rowText.trim()
    });
    
    financialData.calculos.sumaCargos += parseFloat(monto.replace(/[$,]/g, '')) || 0;
  }
  
  // 2. Multas
  if (normalizedText.includes('multa') || normalizedText.includes('infracción') || normalizedText.includes('sanción')) {
    const amount = extractAmount(rowText);
    if (amount) {
      financialData.multas.push({
        concepto: 'Multa',
        descripcion: rowText.trim(),
        monto: amount,
        fecha: extractDate(rowText)
      });
      
      financialData.calculos.sumaMultas += parseFloat(amount.replace(/[$,]/g, '')) || 0;
    }
  }
  
  // 3. Recargos
  if (normalizedText.includes('recargo') || normalizedText.includes('moratorio') || normalizedText.includes('interés')) {
    const amount = extractAmount(rowText);
    if (amount) {
      financialData.recargos.push({
        concepto: 'Recargo',
        descripcion: rowText.trim(),
        monto: amount,
        tipo: normalizedText.includes('interés') ? 'Interés moratorio' : 'Recargo'
      });
      
      financialData.calculos.sumaRecargos += parseFloat(amount.replace(/[$,]/g, '')) || 0;
    }
  }
  
  // 4. Derechos
  if (normalizedText.includes('derecho') && !normalizedText.includes('derechos humanos')) {
    const amount = extractAmount(rowText);
    if (amount) {
      financialData.derechos.push({
        concepto: 'Derecho',
        descripcion: rowText.trim(),
        monto: amount,
        tipo: normalizedText.includes('expedición') ? 'Expedición' : 'Derecho administrativo'
      });
      
      financialData.calculos.sumaDerechos += parseFloat(amount.replace(/[$,]/g, '')) || 0;
    }
  }
  
  // 5. Impuestos
  if (normalizedText.includes('iva') || normalizedText.includes('impuesto')) {
    const amount = extractAmount(rowText);
    if (amount) {
      financialData.impuestos.push({
        concepto: 'Impuesto',
        descripcion: rowText.trim(),
        monto: amount,
        tipo: normalizedText.includes('iva') ? 'IVA' : 'Impuesto'
      });
      
      financialData.calculos.sumaImpuestos += parseFloat(amount.replace(/[$,]/g, '')) || 0;
    }
  }
  
  // 6. Subsidios y descuentos (montos negativos)
  if (normalizedText.includes('subsidio') || normalizedText.includes('descuento') || 
      normalizedText.includes('bonificación') || rowText.includes('-$')) {
    const amount = extractAmount(rowText);
    if (amount && (amount.includes('-$') || normalizedText.includes('descuento'))) {
      financialData.descuentos.push({
        concepto: normalizedText.includes('subsidio') ? 'Subsidio' : 'Descuento',
        descripcion: rowText.trim(),
        monto: amount,
        tipo: 'Bonificación'
      });
      
      const amountValue = parseFloat(amount.replace(/[$,]/g, '')) || 0;
      financialData.calculos.sumaDescuentos += Math.abs(amountValue);
    }
  }
  
  // 7. Subtotal
  if (normalizedText.includes('subtotal') && !financialData.subtotal) {
    const amount = extractAmount(rowText);
    if (amount) {
      financialData.subtotal = {
        concepto: 'Subtotal',
        monto: amount,
        descripcion: rowText.trim()
      };
    }
  }
  
  // 8. Total
  if ((normalizedText.includes('total a pagar') || normalizedText.includes('pago total') || 
       (normalizedText.includes('total') && normalizedText.includes('pagar'))) && !financialData.total) {
    const amount = extractAmount(rowText);
    if (amount) {
      financialData.total = {
        concepto: 'Total a Pagar',
        monto: amount,
        descripcion: rowText.trim()
      };
    }
  }
}

async function extractFromHTMLContent(htmlContent, financialData) {
  // Buscar patrones específicos en todo el HTML
  
  // Dividir por líneas
  const lines = htmlContent.split('\n');
  
  for (const line of lines) {
    const cleanLine = line.replace(/<[^>]*>/g, '').trim();
    if (!cleanLine) continue;
    
    const normalizedLine = cleanLine.toLowerCase();
    
    // Buscar montos sueltos que no se capturaron en tablas
    const amountMatches = cleanLine.match(/(\$\s*[\d,]+\.?\d*)|([\d,]+\.?\d*\s*(?:MXN|USD|pesos))/gi);
    
    if (amountMatches) {
      for (const match of amountMatches) {
        const amount = extractAmount(match);
        
        // Clasificar según contexto
        if (normalizedLine.includes('multa') && !isAlreadyAdded(financialData.multas, amount)) {
          financialData.multas.push({
            concepto: 'Multa',
            descripcion: cleanLine,
            monto: amount
          });
        } else if (normalizedLine.includes('recargo') && !isAlreadyAdded(financialData.recargos, amount)) {
          financialData.recargos.push({
            concepto: 'Recargo',
            descripcion: cleanLine,
            monto: amount
          });
        } else if (normalizedLine.includes('derecho') && !isAlreadyAdded(financialData.derechos, amount)) {
          financialData.derechos.push({
            concepto: 'Derecho',
            descripcion: cleanLine,
            monto: amount
          });
        } else if ((normalizedLine.includes('iva') || normalizedLine.includes('impuesto')) && 
                  !isAlreadyAdded(financialData.impuestos, amount)) {
          financialData.impuestos.push({
            concepto: 'Impuesto',
            descripcion: cleanLine,
            monto: amount
          });
        }
      }
    }
  }
  
  // Buscar años y sus montos
  const yearPattern = /(\d{4})\s*[^$]*(\$\s*[\d,]+\.?\d*)/gi;
  let yearMatch;
  while ((yearMatch = yearPattern.exec(htmlContent)) !== null) {
    const year = yearMatch[1];
    const amount = extractAmount(yearMatch[2]);
    
    if (!financialData.cargosPorAnio.some(item => item.año === year && item.monto === amount)) {
      financialData.cargosPorAnio.push({
        año: year,
        concepto: 'Cargo vehicular',
        tipo: 'Anual',
        monto: amount,
        descripcion: `Cargo del año ${year}`
      });
    }
  }
}

function extractAmount(text) {
  if (!text) return '';
  
  // Buscar patrones de dinero
  const patterns = [
    /\$\s*[\d,]+\.?\d*/,
    /[\d,]+\.?\d*\s*(?:MXN|USD|pesos)/i,
    /-\$\s*[\d,]+\.?\d*/,
    /[\d,]+\.?\d*/
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0].trim();
    }
  }
  
  return '';
}

function extractDate(text) {
  const datePatterns = [
    /\d{2}\/\d{2}\/\d{4}/,
    /\d{2}-\d{2}-\d{4}/,
    /\d{4}-\d{2}-\d{2}/
  ];
  
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }
  
  return '';
}

function isAlreadyAdded(array, amount) {
  return array.some(item => item.monto === amount);
}

function calculateFinancialTotals(financialData) {
  const calc = financialData.calculos;
  
  // Sumar todos los cargos positivos
  const totalCargos = calc.sumaCargos + calc.sumaMultas + calc.sumaRecargos + 
                     calc.sumaDerechos + calc.sumaImpuestos;
  
  // Restar descuentos
  const totalFinal = totalCargos - calc.sumaDescuentos;
  
  calc.totalCalculado = totalFinal > 0 ? `$${totalFinal.toFixed(2)}` : '$0.00';
  
  // Agregar resumen por categoría
  financialData.resumenCategorias = {
    cargosAnuales: `$${calc.sumaCargos.toFixed(2)}`,
    multas: `$${calc.sumaMultas.toFixed(2)}`,
    recargos: `$${calc.sumaRecargos.toFixed(2)}`,
    derechos: `$${calc.sumaDerechos.toFixed(2)}`,
    impuestos: `$${calc.sumaImpuestos.toFixed(2)}`,
    descuentos: `-$${calc.sumaDescuentos.toFixed(2)}`,
    totalCalculado: calc.totalCalculado
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
      health: 'GET /health',
      consola: 'GET /consulta-consola/:placa',
      desglose: 'GET /desglose/:placa'
    },
    ejemplo: {
      url: '/consulta?placa=ABC123',
      respuesta: {
        placa: "ABC123",
        vehiculo: ["Marca:", "TOYOTA", "Modelo:", "2025", "Linea:", "SIENNA HÍBRIDO"],
        desgloseCompleto: {
          cargosPorAnio: [
            { año: "2024", concepto: "Tenencia", monto: "$1,200.00" },
            { año: "2024", concepto: "Refrendo", monto: "$800.00" }
          ],
          multas: [{ concepto: "Multa por exceso de velocidad", monto: "$500.00" }],
          resumen: { totalAPagar: "$2,500.00" }
        }
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
    
    const respuesta = {
      ...resultados,
      tiempoConsulta: `${tiempo} segundos`,
      consultadoEn: new Date().toISOString(),
      estadisticas: {
        cargosEncontrados: resultados.desgloseCompleto.cargosPorAnio?.length || 0,
        multasEncontradas: resultados.desgloseCompleto.multas?.length || 0,
        descuentosEncontrados: resultados.desgloseCompleto.descuentos?.length || 0
      }
    };
    
    console.log(`Consulta completada en ${tiempo} segundos`);
    console.log(`Desglose obtenido: ${resultados.desgloseCompleto.cargosPorAnio?.length || 0} cargos`);
    
    res.json(respuesta);
    
  } catch (error) {
    console.error('Error en la consulta:', error);
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
    console.log(`\nIniciando consulta para placa: ${placaLimpia}`);
    console.log(`Usando proxy: ${PROXY_CONFIG.server}`);
    
    const resultados = await runAutomation(placaLimpia);
    const tiempo = ((Date.now() - startTime) / 1000).toFixed(2);
    
    const respuesta = {
      ...resultados,
      tiempoConsulta: `${tiempo} segundos`,
      consultadoEn: new Date().toISOString(),
      estadisticas: {
        cargosEncontrados: resultados.desgloseCompleto.cargosPorAnio?.length || 0,
        multasEncontradas: resultados.desgloseCompleto.multas?.length || 0,
        descuentosEncontrados: resultados.desgloseCompleto.descuentos?.length || 0
      }
    };
    
    console.log(`Consulta completada en ${tiempo} segundos`);
    
    res.json(respuesta);
    
  } catch (error) {
    console.error('Error en la consulta:', error);
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

// Nuevo endpoint para desglose detallado
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
    
    console.log(`\nIniciando desglose detallado para placa: ${placaLimpia}`);
    
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
        descuentos: resultados.desgloseCompleto.descuentos || []
      },
      resumenFinanciero: resultados.desgloseCompleto.resumenCategorias || {},
      totales: resultados.resumen,
      tiempoConsulta: `${tiempo} segundos`,
      consultadoEn: new Date().toISOString()
    };
    
    res.json(respuesta);
    
  } catch (error) {
    console.error('Error en el desglose:', error);
    res.status(500).json({
      error: 'Error en el desglose',
      message: error.message
    });
  } finally {
    isProcessing = false;
    requestQueue--;
  }
});

// Endpoint para formato de consola con desglose
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
    
    const resultados = await runAutomation(placaLimpia);
    const tiempo = ((Date.now() - startTime) / 1000).toFixed(2);
    
    // Formatear respuesta para consola
    let respuesta = '';
    respuesta += '\n' + '='.repeat(70) + '\n';
    respuesta += `DESGLOSE COMPLETO PARA PLACA: ${resultados.placa}\n`;
    respuesta += '='.repeat(70) + '\n';
    
    respuesta += '\nINFORMACIÓN DEL VEHÍCULO:\n';
    respuesta += '-'.repeat(40) + '\n';
    
    // Formatear información del vehículo
    for (let i = 0; i < resultados.vehiculo.length; i += 2) {
      if (resultados.vehiculo[i] && resultados.vehiculo[i + 1]) {
        respuesta += `${resultados.vehiculo[i].padEnd(10)} ${resultados.vehiculo[i + 1]}\n`;
      }
    }
    
    const desglose = resultados.desgloseCompleto;
    
    // Cargos por año
    if (desglose.cargosPorAnio && desglose.cargosPorAnio.length > 0) {
      respuesta += '\nCARGOS POR AÑO:\n';
      respuesta += '-'.repeat(40) + '\n';
      desglose.cargosPorAnio.forEach((cargo, index) => {
        respuesta += `${(index + 1).toString().padStart(2)}. ${cargo.año} - ${cargo.concepto.padEnd(20)} ${cargo.monto.padStart(12)}\n`;
        if (cargo.descripcion && cargo.descripcion.length > 30) {
          respuesta += `    ${cargo.descripcion.substring(0, 60)}...\n`;
        }
      });
    }
    
    // Multas
    if (desglose.multas && desglose.multas.length > 0) {
      respuesta += '\nMULTAS:\n';
      respuesta += '-'.repeat(40) + '\n';
      desglose.multas.forEach((multa, index) => {
        respuesta += `${(index + 1).toString().padStart(2)}. ${multa.concepto.padEnd(25)} ${multa.monto.padStart(12)}\n`;
        if (multa.descripcion) {
          respuesta += `    ${multa.descripcion.substring(0, 50)}\n`;
        }
      });
    }
    
    // Recargos
    if (desglose.recargos && desglose.recargos.length > 0) {
      respuesta += '\nRECARGOS E INTERESES:\n';
      respuesta += '-'.repeat(40) + '\n';
      desglose.recargos.forEach((recargo, index) => {
        respuesta += `${(index + 1).toString().padStart(2)}. ${recargo.tipo?.padEnd(25) || 'Recargo'} ${recargo.monto.padStart(12)}\n`;
      });
    }
    
    // Descuentos
    if (desglose.descuentos && desglose.descuentos.length > 0) {
      respuesta += '\nDESCUENTOS Y SUBSIDIOS:\n';
      respuesta += '-'.repeat(40) + '\n';
      desglose.descuentos.forEach((descuento, index) => {
        respuesta += `${(index + 1).toString().padStart(2)}. ${descuento.concepto.padEnd(25)} ${descuento.monto.padStart(12)}\n`;
      });
    }
    
    // Resumen financiero
    respuesta += '\n' + '='.repeat(70) + '\n';
    respuesta += 'RESUMEN FINANCIERO\n';
    respuesta += '='.repeat(70) + '\n';
    
    if (desglose.resumenCategorias) {
      const resumen = desglose.resumenCategorias;
      respuesta += `Cargos anuales:    ${resumen.cargosAnuales?.padStart(15) || '$0.00'.padStart(15)}\n`;
      respuesta += `Multas:            ${resumen.multas?.padStart(15) || '$0.00'.padStart(15)}\n`;
      respuesta += `Recargos:          ${resumen.recargos?.padStart(15) || '$0.00'.padStart(15)}\n`;
      respuesta += `Derechos:          ${resumen.derechos?.padStart(15) || '$0.00'.padStart(15)}\n`;
      respuesta += `Impuestos:         ${resumen.impuestos?.padStart(15) || '$0.00'.padStart(15)}\n`;
      respuesta += `Descuentos:        ${resumen.descuentos?.padStart(15) || '$0.00'.padStart(15)}\n`;
      respuesta += '-'.repeat(40) + '\n';
      respuesta += `TOTAL CALCULADO:   ${resumen.totalCalculado?.padStart(15) || '$0.00'.padStart(15)}\n`;
    }
    
    respuesta += '\nTOTALES ENCONTRADOS:\n';
    respuesta += '-'.repeat(40) + '\n';
    respuesta += `Subtotal:          ${resultados.resumen.subtotal?.padStart(15) || 'No disponible'.padStart(15)}\n`;
    respuesta += `Total a pagar:     ${resultados.resumen.totalAPagar?.padStart(15) || 'No disponible'.padStart(15)}\n`;
    
    respuesta += `\n⏱️  Tiempo de consulta: ${tiempo} segundos\n`;
    respuesta += `📊 Cargos analizados: ${desglose.cargosPorAnio?.length || 0}\n`;
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

function formatVehicleInfo(vehicleArray) {
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
  console.log(`🚀 API de consulta vehicular iniciada`);
  console.log(`📡 Puerto: ${port}`);
  console.log(`🌐 Proxy: ${PROXY_CONFIG.server}`);
  console.log(`📧 Email: ${EMAIL}`);
  console.log(`🚫 Solicitudes simultáneas: 1 máximo`);
  console.log(`\n✅ Endpoints disponibles:`);
  console.log(`   GET  /consulta?placa=ABC123`);
  console.log(`   POST /consulta`);
  console.log(`   GET  /desglose/ABC123          (NUEVO - Desglose detallado)`);
  console.log(`   GET  /consulta-consola/ABC123`);
  console.log(`   GET  /health`);
  console.log(`   GET  /`);
  console.log(`\n🔍 Sistema de desglose mejorado:`);
  console.log(`   • Categorización automática de cargos`);
  console.log(`   • Separación por año y concepto`);
  console.log(`   • Identificación de multas y recargos`);
  console.log(`   • Detección de descuentos e impuestos`);
  console.log(`   • Cálculo automático de totales`);
});
