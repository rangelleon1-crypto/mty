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
    
    // Extraer datos de manera robusta usando múltiples métodos
    const resultados = await extractAllData(page, htmlContent, placa);
    
    return resultados;
    
  } catch (error) {
    console.error('Error durante la automatización:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

async function extractAllData(page, htmlContent, placa) {
  // Método 1: Extraer de elementos específicos usando selectores CSS
  const vehicleInfo = await extractVehicleInfo(page);
  const allCharges = await extractChargesWithMultipleMethods(page, htmlContent);
  
  // Método 2: Buscar patrones en todo el contenido HTML
  const patterns = extractWithPatterns(htmlContent);
  
  // Método 3: Extraer tablas si existen
  const tableData = await extractTableData(page);
  
  // Combinar todos los resultados
  const combinedResults = combineResults(
    vehicleInfo,
    allCharges,
    patterns,
    tableData,
    placa
  );
  
  return combinedResults;
}

async function extractVehicleInfo(page) {
  const vehicleInfo = [];
  
  // Selectores específicos para información del vehículo
  const vehicleSelectors = [
    { label: 'Marca:', selector: '[class*="marca"], [id*="marca"], :text("Marca:") + *' },
    { label: 'Modelo:', selector: '[class*="modelo"], [id*="modelo"], :text("Modelo:") + *' },
    { label: 'Linea:', selector: '[class*="linea"], [id*="linea"], :text("Linea:") + *' },
    { label: 'Tipo:', selector: '[class*="tipo"], [id*="tipo"], :text("Tipo:") + *' },
    { label: 'Color:', selector: '[class*="color"], [id*="color"], :text("Color:") + *' },
    { label: 'NIV:', selector: '[class*="niv"], [id*="niv"], :text("NIV:") + *' }
  ];
  
  for (const item of vehicleSelectors) {
    try {
      // Intentar múltiples métodos de extracción
      let value = '';
      
      // Método 1: Buscar elemento después del texto
      const labelElement = await page.locator(`:text("${item.label}")`).first();
      if (await labelElement.count() > 0) {
        const nextElement = await labelElement.locator('xpath=following-sibling::*[1]');
        if (await nextElement.count() > 0) {
          value = (await nextElement.textContent()).trim();
        } else {
          // Si no hay elemento hermano, buscar en el mismo elemento
          const parentText = await labelElement.textContent();
          const match = parentText.match(new RegExp(`${item.label}\\s*(.*)`));
          if (match && match[1]) {
            value = match[1].trim();
          }
        }
      }
      
      // Método 2: Buscar por selectores CSS
      if (!value) {
        for (const sel of item.selector.split(', ')) {
          try {
            const element = await page.locator(sel).first();
            if (await element.count() > 0) {
              const text = (await element.textContent()).trim();
              if (text && !text.includes(item.label)) {
                value = text;
                break;
              }
            }
          } catch (e) {
            // Continuar con el siguiente selector
          }
        }
      }
      
      if (value) {
        vehicleInfo.push(item.label);
        vehicleInfo.push(value);
      }
    } catch (error) {
      console.log(`No se pudo extraer ${item.label}:`, error.message);
    }
  }
  
  return vehicleInfo;
}

async function extractChargesWithMultipleMethods(page, htmlContent) {
  const charges = [];
  
  // Método 1: Buscar elementos que contengan signos de dinero
  const moneyElements = await page.locator(':text("$"), :text("MXN"), :text("pesos")').all();
  for (const element of moneyElements) {
    try {
      const text = await element.textContent();
      if (text && text.includes('$')) {
        const cleanText = text.replace(/\s+/g, ' ').trim();
        if (cleanText.length < 100) { // Evitar textos muy largos
          charges.push(cleanText);
        }
      }
    } catch (e) {
      // Continuar
    }
  }
  
  // Método 2: Buscar patrones específicos en HTML
  const chargePatterns = [
    /\d{4}\s+\$[\d,]+\.?\d*/g,  // Año seguido de monto
    /\$\s*[\d,]+\.?\d*/g,       // Signo $ seguido de número
    /Monto:\s*\$?[\d,]+\.?\d*/gi,
    /Importe:\s*\$?[\d,]+\.?\d*/gi,
    /Cargo.*?\$[\d,]+\.?\d*/gi,
    /Pago.*?\$[\d,]+\.?\d*/gi,
    /[\d,]+\.?\d*\s*(?:MXN|USD|pesos)/gi
  ];
  
  for (const pattern of chargePatterns) {
    const matches = htmlContent.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const cleanMatch = match.replace(/<\/?[^>]+(>|$)/g, '').trim();
        if (cleanMatch && !charges.includes(cleanMatch)) {
          charges.push(cleanMatch);
        }
      });
    }
  }
  
  // Método 3: Buscar en tablas
  const tableCharges = await extractTableCharges(page);
  tableCharges.forEach(charge => {
    if (!charges.includes(charge)) {
      charges.push(charge);
    }
  });
  
  // Eliminar duplicados y ordenar
  const uniqueCharges = [...new Set(charges)]
    .filter(charge => charge && charge.trim() !== '')
    .sort();
  
  return uniqueCharges;
}

async function extractTableCharges(page) {
  const tableCharges = [];
  
  try {
    // Buscar todas las tablas
    const tables = await page.locator('table').all();
    
    for (const table of tables) {
      const rows = await table.locator('tr').all();
      
      for (const row of rows) {
        try {
          const cells = await row.locator('td, th').allTextContents();
          const rowText = cells.join(' | ').trim();
          
          // Buscar montos en la fila
          if (rowText.includes('$') || rowText.match(/\d{4}\s+\$/)) {
            tableCharges.push(rowText);
          }
          
          // Extraer información específica de cada celda
          for (const cell of cells) {
            if (cell && (cell.includes('$') || cell.match(/\d{4}/))) {
              tableCharges.push(cell.trim());
            }
          }
        } catch (e) {
          // Continuar con la siguiente fila
        }
      }
    }
  } catch (error) {
    console.log('Error extrayendo tablas:', error.message);
  }
  
  return tableCharges;
}

function extractWithPatterns(htmlContent) {
  const patterns = {
    subtotal: [],
    total: [],
    descuentos: [],
    impuestos: [],
    otros: []
  };
  
  // Patrones para subtotal
  const subtotalPatterns = [
    /SUBTOTAL[^$\n]*\$?\s*[\d,]+\.?\d*/gi,
    /Subtotal[^$\n]*\$?\s*[\d,]+\.?\d*/gi,
    /Sub-total[^$\n]*\$?\s*[\d,]+\.?\d*/gi,
    /MONTO\s*SUBSIDIO[^$\n]*\$?\s*[\d,]+\.?\d*/gi,
    /SUBSIDIO[^$\n]*\$?\s*[\d,]+\.?\d*/gi
  ];
  
  // Patrones para total
  const totalPatterns = [
    /TOTAL\s*A\s*PAGAR[^$\n]*\$?\s*[\d,]+\.?\d*/gi,
    /PAGO\s*TOTAL[^$\n]*\$?\s*[\d,]+\.?\d*/gi,
    /TOTAL[^$\n]*\$?\s*[\d,]+\.?\d*/gi,
    /MONTO\s*TOTAL[^$\n]*\$?\s*[\d,]+\.?\d*/gi,
    /PAGAR[^$\n]*\$?\s*[\d,]+\.?\d*/gi,
    /importe\s*FINAL[^$\n]*\$?\s*[\d,]+\.?\d*/gi,
    /FINAL[^$\n]*\$?\s*[\d,]+\.?\d*/gi
  ];
  
  // Patrones para descuentos
  const descuentoPatterns = [
    /DESCUENTO[^$\n]*\$?\s*[\d,]+\.?\d*/gi,
    /DISCOUNT[^$\n]*\$?\s*[\d,]+\.?\d*/gi,
    /BONIFICACION[^$\n]*\$?\s*[\d,]+\.?\d*/gi,
    /REDUCCION[^$\n]*\$?\s*[\d,]+\.?\d*/gi
  ];
  
  // Patrones para impuestos
  const impuestoPatterns = [
    /IVA[^$\n]*\$?\s*[\d,]+\.?\d*/gi,
    /IMPUESTO[^$\n]*\$?\s*[\d,]+\.?\d*/gi,
    /TAX[^$\n]*\$?\s*[\d,]+\.?\d*/gi,
    /ISR[^$\n]*\$?\s*[\d,]+\.?\d*/gi
  ];
  
  // Extraer con cada patrón
  extractPattern(subtotalPatterns, htmlContent, patterns.subtotal);
  extractPattern(totalPatterns, htmlContent, patterns.total);
  extractPattern(descuentoPatterns, htmlContent, patterns.descuentos);
  extractPattern(impuestoPatterns, htmlContent, patterns.impuestos);
  
  // Extraer otros montos no capturados
  const otherMoney = htmlContent.match(/\$\s*[\d,]+\.?\d*/g);
  if (otherMoney) {
    patterns.otros.push(...otherMoney.map(m => m.trim()));
  }
  
  return patterns;
}

function extractPattern(patterns, htmlContent, resultArray) {
  for (const pattern of patterns) {
    const matches = htmlContent.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const cleanMatch = match.replace(/<\/?[^>]+(>|$)/g, '').trim();
        if (cleanMatch && !resultArray.includes(cleanMatch)) {
          resultArray.push(cleanMatch);
        }
      });
    }
  }
}

async function extractTableData(page) {
  const tableData = {
    rows: [],
    summary: []
  };
  
  try {
    // Buscar tablas de resumen o totales
    const summaryTables = await page.locator('table:has(:text("TOTAL")), table:has(:text("SUBTOTAL")), table:has(:text("PAGAR"))').all();
    
    for (const table of summaryTables) {
      const rows = await table.locator('tr').allTextContents();
      tableData.rows.push(...rows.filter(r => r.trim()));
    }
    
    // Buscar elementos de resumen fuera de tablas
    const summaryElements = await page.locator('div:has(:text("TOTAL")), div:has(:text("SUBTOTAL")), div:has(:text("PAGAR")), span:has(:text("TOTAL")), span:has(:text("SUBTOTAL"))').all();
    
    for (const element of summaryElements) {
      const text = await element.textContent();
      if (text && text.length < 200) { // Evitar textos muy largos
        tableData.summary.push(text.trim());
      }
    }
  } catch (error) {
    console.log('Error extrayendo datos de tablas:', error.message);
  }
  
  return tableData;
}

function combineResults(vehicleInfo, charges, patterns, tableData, placa) {
  // Procesar subtotal - priorizar el primero encontrado
  let subtotal = patterns.subtotal[0] || 
                 tableData.summary.find(s => s.includes('SUBTOTAL')) ||
                 tableData.rows.find(r => r.includes('SUBTOTAL')) ||
                 'SUBTOTAL: No disponible';
  
  // Procesar total a pagar - priorizar el primero encontrado
  let totalAPagar = patterns.total[0] ||
                    tableData.summary.find(s => s.includes('TOTAL A PAGAR') || s.includes('PAGO TOTAL') || (s.includes('TOTAL') && s.includes('$'))) ||
                    tableData.rows.find(r => r.includes('TOTAL A PAGAR') || r.includes('PAGO TOTAL')) ||
                    patterns.otros.find(o => o.includes('TOTAL') || o.match(/PAGAR.*\$/i)) ||
                    'TOTAL A PAGAR: No disponible';
  
  // Si el total a pagar no tiene etiqueta, agregarla
  if (totalAPagar !== 'TOTAL A PAGAR: No disponible' && !totalAPagar.includes('TOTAL') && !totalAPagar.includes('PAGAR')) {
    totalAPagar = `TOTAL A PAGAR: ${totalAPagar}`;
  }
  
  // Filtrar cargos para eliminar duplicados de montos
  const filteredCharges = [];
  const seenAmounts = new Set();
  
  for (const charge of charges) {
    // Extraer el monto numérico
    const amountMatch = charge.match(/[\d,]+\.?\d*/);
    if (amountMatch) {
      const amount = amountMatch[0];
      if (!seenAmounts.has(amount)) {
        seenAmounts.add(amount);
        filteredCharges.push(charge);
      }
    } else {
      // Si no tiene monto, agregarlo igual
      filteredCharges.push(charge);
    }
  }
  
  // Agregar descuentos e impuestos a los cargos si no están incluidos
  if (patterns.descuentos.length > 0) {
    patterns.descuentos.forEach(desc => {
      if (!filteredCharges.some(c => c.includes(desc))) {
        filteredCharges.push(desc);
      }
    });
  }
  
  if (patterns.impuestos.length > 0) {
    patterns.impuestos.forEach(imp => {
      if (!filteredCharges.some(c => c.includes(imp))) {
        filteredCharges.push(imp);
      }
    });
  }
  
  // Ordenar cargos
  filteredCharges.sort((a, b) => {
    // Priorizar cargos con años primero
    const hasYearA = a.match(/\d{4}/);
    const hasYearB = b.match(/\d{4}/);
    if (hasYearA && !hasYearB) return -1;
    if (!hasYearA && hasYearB) return 1;
    return a.localeCompare(b);
  });
  
  return {
    placa,
    vehiculo: vehicleInfo.length > 0 ? vehicleInfo : ['No se encontró información del vehículo'],
    cargos: filteredCharges.length > 0 ? filteredCharges : ['No se encontraron cargos'],
    subtotal: subtotal,
    totalAPagar: totalAPagar,
    informacionAdicional: {
      descuentos: patterns.descuentos,
      impuestos: patterns.impuestos,
      otrasCantidades: patterns.otros.filter(o => !o.includes('TOTAL') && !o.includes('SUBTOTAL')),
      tablasEncontradas: tableData.rows.length,
      resumenEncontrado: tableData.summary.length
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
      consola: 'GET /consulta-consola/:placa'
    },
    ejemplo: {
      url: '/consulta?placa=ABC123',
      respuesta: {
        placa: "ABC123",
        vehiculo: ["Marca:", "TOYOTA", "Modelo:", "2025", "Linea:", "SIENNA HÍBRIDO", "Tipo:", "XLE, MINI VAN, SISTE", "Color:", "GRIS", "NIV:", "************45180"],
        cargos: ["No se encontraron cargos"],
        subtotal: "SUBTOTAL MONTO SUBSIDIO: -$198.00",
        totalAPagar: "TOTAL A PAGAR: $3,802.00"
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
      extraccion: {
        metodosUsados: 4,
        cargosEncontrados: resultados.cargos.length,
        exitoso: resultados.totalAPagar !== 'TOTAL A PAGAR: No disponible'
      }
    };
    
    console.log(`Consulta completada en ${tiempo} segundos`);
    console.log(`Cargos encontrados: ${resultados.cargos.length}`);
    console.log(`Total a pagar: ${resultados.totalAPagar}`);
    
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
      extraccion: {
        metodosUsados: 4,
        cargosEncontrados: resultados.cargos.length,
        exitoso: resultados.totalAPagar !== 'TOTAL A PAGAR: No disponible'
      }
    };
    
    console.log(`Consulta completada en ${tiempo} segundos`);
    console.log(`Cargos encontrados: ${resultados.cargos.length}`);
    console.log(`Total a pagar: ${resultados.totalAPagar}`);
    
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
    respuesta += '\n' + '='.repeat(60) + '\n';
    respuesta += `RESULTADOS PARA PLACA: ${resultados.placa}\n`;
    respuesta += '='.repeat(60) + '\n';
    
    respuesta += '\nINFORMACION DEL VEHICULO:\n';
    respuesta += '-'.repeat(40) + '\n';
    
    // Formatear la información del vehículo
    let currentKey = '';
    for (let i = 0; i < resultados.vehiculo.length; i++) {
      const item = resultados.vehiculo[i];
      if (item.endsWith(':')) {
        currentKey = item;
        respuesta += currentKey.padEnd(12);
      } else if (currentKey && i > 0 && resultados.vehiculo[i - 1].endsWith(':')) {
        respuesta += item + '\n';
      } else {
        respuesta += item + '\n';
      }
    }
    
    respuesta += '\nCARGOS ENCONTRADOS:\n';
    respuesta += '-'.repeat(40) + '\n';
    if (resultados.cargos && resultados.cargos.length > 0) {
      resultados.cargos.forEach((cargo, index) => {
        respuesta += `${(index + 1).toString().padStart(3)}. ${cargo}\n`;
      });
    } else {
      respuesta += 'No se encontraron cargos\n';
    }
    
    respuesta += '\nRESUMEN FINANCIERO:\n';
    respuesta += '-'.repeat(40) + '\n';
    respuesta += `${resultados.subtotal}\n`;
    respuesta += `${resultados.totalAPagar}\n`;
    
    if (resultados.informacionAdicional.descuentos.length > 0) {
      respuesta += '\nDESCUENTOS APLICADOS:\n';
      respuesta += '-'.repeat(30) + '\n';
      resultados.informacionAdicional.descuentos.forEach(desc => {
        respuesta += `• ${desc}\n`;
      });
    }
    
    if (resultados.informacionAdicional.impuestos.length > 0) {
      respuesta += '\nIMPUESTOS:\n';
      respuesta += '-'.repeat(30) + '\n';
      resultados.informacionAdicional.impuestos.forEach(imp => {
        respuesta += `• ${imp}\n`;
      });
    }
    
    respuesta += `\n⏱️  Tiempo de consulta: ${tiempo} segundos\n`;
    respuesta += `📊 Cargos encontrados: ${resultados.cargos.length}\n`;
    respuesta += `✅ Extracción: ${resultados.extraccion.exitoso ? 'EXITOSA' : 'PARCIAL'}\n`;
    
    res.set('Content-Type', 'text/plain');
    res.send(respuesta);
    
  } catch (error) {
    console.error('Error en la consulta:', error);
    res.status(500).send(`Error en la consulta. Verifique:\n1. Conexión a internet\n2. Proxy disponible\n3. Placa correcta\n\nDetalle del error: ${error.message}\n`);
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
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Consulta Vehicular - ${resultados.placa}</title>
        <style>
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            margin: 20px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
          }
          .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
          }
          .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
          }
          .header h1 { 
            margin: 0; 
            font-size: 2.5em; 
            font-weight: 300;
          }
          .header p { 
            margin: 10px 0 0; 
            opacity: 0.9;
            font-size: 1.1em;
          }
          .section { 
            margin: 30px; 
            padding: 25px;
            background: #f8f9fa;
            border-radius: 10px;
            border-left: 5px solid #667eea;
          }
          .section-title { 
            font-weight: bold; 
            color: #333; 
            font-size: 1.4em;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
          }
          .section-title:before {
            content: "▶";
            margin-right: 10px;
            color: #667eea;
          }
          .content { 
            background: white; 
            padding: 20px; 
            border-radius: 8px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.05);
          }
          .vehicle-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 15px;
          }
          .vehicle-item {
            background: #f0f4ff;
            padding: 15px;
            border-radius: 8px;
            border: 1px solid #e0e6ff;
          }
          .vehicle-label {
            font-weight: bold;
            color: #667eea;
            margin-bottom: 5px;
            font-size: 0.9em;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .vehicle-value {
            font-size: 1.1em;
            color: #333;
          }
          .cargo-item { 
            margin: 12px 0; 
            padding: 12px;
            background: linear-gradient(to right, #f8f9ff, #ffffff);
            border-left: 4px solid #4CAF50;
            border-radius: 6px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: transform 0.2s;
          }
          .cargo-item:hover {
            transform: translateX(5px);
            background: linear-gradient(to right, #f0f4ff, #ffffff);
          }
          .cargo-number {
            background: #667eea;
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 0.9em;
          }
          .cargo-text {
            flex-grow: 1;
            margin-left: 15px;
            color: #333;
          }
          .cargo-amount {
            font-weight: bold;
            color: #2E7D32;
            font-size: 1.1em;
            background: #e8f5e9;
            padding: 5px 15px;
            border-radius: 20px;
            min-width: 120px;
            text-align: center;
          }
          .summary { 
            background: linear-gradient(135deg, #2c3e50 0%, #4CA1AF 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin: 30px;
          }
          .summary-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 15px 0;
            padding: 15px;
            background: rgba(255,255,255,0.1);
            border-radius: 8px;
          }
          .summary-label {
            font-size: 1.1em;
            opacity: 0.9;
          }
          .summary-value {
            font-size: 1.8em;
            font-weight: bold;
            color: #4CAF50;
          }
          .total-value {
            font-size: 2.2em;
            color: #FFEB3B;
            text-shadow: 0 2px 4px rgba(0,0,0,0.3);
          }
          .footer {
            text-align: center;
            padding: 20px;
            color: #666;
            font-size: 0.9em;
            border-top: 1px solid #eee;
          }
          .stats {
            display: flex;
            justify-content: space-around;
            margin-top: 20px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 10px;
          }
          .stat-item {
            text-align: center;
          }
          .stat-value {
            font-size: 1.8em;
            font-weight: bold;
            color: #667eea;
          }
          .stat-label {
            font-size: 0.9em;
            color: #666;
            margin-top: 5px;
          }
          @media (max-width: 768px) {
            .vehicle-grid { grid-template-columns: 1fr; }
            .stats { flex-direction: column; gap: 15px; }
            .section { margin: 15px; padding: 15px; }
            .summary { margin: 15px; padding: 20px; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Consulta Vehicular</h1>
            <p>Resultados para placa: <strong>${resultados.placa}</strong> | Consultado el: ${new Date().toLocaleString()}</p>
          </div>
          
          <div class="section">
            <div class="section-title">📋 Información del Vehículo</div>
            <div class="content">
              <div class="vehicle-grid">
                ${formatVehicleInfoHTML(resultados.vehiculo)}
              </div>
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">💰 Cargos y Conceptos</div>
            <div class="content">
              ${formatChargesHTML(resultados.cargos)}
            </div>
          </div>
          
          <div class="summary">
            <div class="summary-item">
              <div class="summary-label">SUBTOTAL</div>
              <div class="summary-value">${extractAmountHTML(resultados.subtotal)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">TOTAL A PAGAR</div>
              <div class="summary-value total-value">${extractAmountHTML(resultados.totalAPagar)}</div>
            </div>
          </div>
          
          ${formatAdditionalInfoHTML(resultados.informacionAdicional)}
          
          <div class="stats">
            <div class="stat-item">
              <div class="stat-value">${resultados.cargos.length}</div>
              <div class="stat-label">Cargos Encontrados</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">${resultados.extraccion.metodosUsados}</div>
              <div class="stat-label">Métodos de Extracción</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">${resultados.extraccion.exitoso ? '✅' : '⚠️'}</div>
              <div class="stat-label">Estado</div>
            </div>
          </div>
          
          <div class="footer">
            <p>Consulta realizada mediante API automatizada | Sistema de extracción robusta</p>
            <p>Tiempo de consulta: ${resultados.tiempoConsulta} | Fecha: ${new Date(resultados.consultadoEn).toLocaleDateString()}</p>
          </div>
        </div>
        
        <script>
          // Resaltar montos en cargos
          document.querySelectorAll('.cargo-text').forEach(el => {
            const text = el.textContent;
            const amountMatch = text.match(/\\$[\\d,]+(?:\\.\\d+)?/);
            if (amountMatch) {
              el.innerHTML = text.replace(amountMatch[0], '<strong style="color: #2E7D32;">' + amountMatch[0] + '</strong>');
            }
          });
        </script>
      </body>
      </html>
    `;
    
    res.set('Content-Type', 'text/html');
    res.send(html);
    
  } catch (error) {
    res.status(500).send('<h1>Error en la consulta</h1><p>Verifique la placa e intente nuevamente.</p>');
  } finally {
    isProcessing = false;
    requestQueue--;
  }
});

// Funciones auxiliares para formato HTML
function formatVehicleInfoHTML(vehicleInfo) {
  let html = '';
  let currentLabel = '';
  
  for (let i = 0; i < vehicleInfo.length; i++) {
    const item = vehicleInfo[i];
    if (item.endsWith(':')) {
      currentLabel = item.replace(':', '');
    } else if (currentLabel) {
      html += `
        <div class="vehicle-item">
          <div class="vehicle-label">${currentLabel}</div>
          <div class="vehicle-value">${item}</div>
        </div>
      `;
      currentLabel = '';
    }
  }
  
  return html;
}

function formatChargesHTML(charges) {
  if (charges.length === 0 || (charges.length === 1 && charges[0] === 'No se encontraron cargos')) {
    return '<p style="text-align: center; color: #666; padding: 20px;">No se encontraron cargos registrados</p>';
  }
  
  let html = '';
  charges.forEach((cargo, index) => {
    const amountMatch = cargo.match(/\$[\d,]+(?:\.\d+)?/);
    const amount = amountMatch ? amountMatch[0] : '';
    const description = amount ? cargo.replace(amount, '').trim() : cargo;
    
    html += `
      <div class="cargo-item">
        <div class="cargo-number">${index + 1}</div>
        <div class="cargo-text">${description}</div>
        ${amount ? `<div class="cargo-amount">${amount}</div>` : ''}
      </div>
    `;
  });
  
  return html;
}

function extractAmountHTML(text) {
  const amountMatch = text.match(/\$[\d,]+(?:\.\d+)?/);
  if (amountMatch) {
    return amountMatch[0];
  }
  return text;
}

function formatAdditionalInfoHTML(info) {
  let html = '';
  
  if (info.descuentos.length > 0 || info.impuestos.length > 0) {
    html += '<div class="section"><div class="section-title">📊 Detalles Adicionales</div><div class="content">';
    
    if (info.descuentos.length > 0) {
      html += '<h4>Descuentos Aplicados:</h4><ul>';
      info.descuentos.forEach(desc => {
        html += `<li>${desc}</li>`;
      });
      html += '</ul>';
    }
    
    if (info.impuestos.length > 0) {
      html += '<h4>Impuestos:</h4><ul>';
      info.impuestos.forEach(imp => {
        html += `<li>${imp}</li>`;
      });
      html += '</ul>';
    }
    
    html += '</div></div>';
  }
  
  return html;
}

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
  console.log(`   GET  /consulta-html/ABC123`);
  console.log(`   GET  /health`);
  console.log(`   GET  /`);
  console.log(`\n🔍 Sistema de extracción mejorado:`);
  console.log(`   • 4 métodos de extracción simultáneos`);
  console.log(`   • Búsqueda por patrones avanzados`);
  console.log(`   • Análisis de tablas HTML`);
  console.log(`   • Detección de montos con múltiples formatos`);
});
