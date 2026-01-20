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

// Función para esperar con timeout
async function waitForElement(page, selector, timeout = 15000) {
  try {
    await page.waitForSelector(selector, { 
      state: 'visible', 
      timeout 
    });
    return true;
  } catch (error) {
    console.log(`❌ Elemento no encontrado: ${selector}`);
    return false;
  }
}

// Función para esperar elemento por rol
async function waitForRole(page, role, name, timeout = 15000) {
  try {
    const locator = page.getByRole(role, { name });
    await locator.waitFor({ state: 'visible', timeout });
    return locator;
  } catch (error) {
    console.log(`❌ Elemento por rol no encontrado: ${role} - ${name}`);
    return null;
  }
}

// Función para esperar elemento por placeholder
async function waitForPlaceholder(page, placeholder, timeout = 15000) {
  try {
    const locator = page.locator(`[placeholder*="${placeholder}"]`);
    await locator.waitFor({ state: 'visible', timeout });
    return locator;
  } catch (error) {
    console.log(`❌ Elemento por placeholder no encontrado: ${placeholder}`);
    return null;
  }
}

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
    console.log(`🔗 Conectando con proxy: ${PROXY_CONFIG.server}...`);
    
    // Navegar a la página con espera hasta que cargue completamente
    console.log('🌐 Navegando al sitio oficial...');
    await page.goto('https://icvnl.gob.mx:1080/estadoctav3/edoctaconsulta#no-back-button', {
      waitUntil: 'networkidle',
      timeout: 45000
    });
    
    console.log('✅ Página cargada. Esperando elementos...');
    await delay(WAIT_TIMES.medium);
    
    // ESPERA INTELIGENTE 1: Checkbox de términos
    console.log('⏳ Esperando checkbox de términos...');
    const checkboxTerminos = await waitForRole(page, 'checkbox', 'Acepto bajo protesta de decir', 20000);
    
    if (!checkboxTerminos) {
      // Intentar método alternativo
      const terminosAlt = await page.locator('input[type="checkbox"]').first();
      if (await terminosAlt.isVisible()) {
        await terminosAlt.check();
        console.log('✅ Checkbox de términos encontrado (método alternativo)');
      } else {
        throw new Error('No se pudo encontrar el checkbox de términos después de 20 segundos');
      }
    } else {
      await checkboxTerminos.check();
      console.log('✅ Checkbox de términos aceptado');
    }
    
    await delay(WAIT_TIMES.short);
    
    // ESPERA INTELIGENTE 2: Campo de placa
    console.log('⏳ Esperando campo de placa...');
    const campoPlaca = await waitForRole(page, 'textbox', 'Placa', 15000);
    
    if (!campoPlaca) {
      // Intentar método alternativo por placeholder
      const placaAlt = await waitForPlaceholder(page, 'Placa', 10000);
      if (placaAlt) {
        await placaAlt.click();
        await placaAlt.fill(placa);
        console.log('✅ Placa ingresada (método alternativo)');
      } else {
        throw new Error('No se pudo encontrar el campo de placa');
      }
    } else {
      await campoPlaca.click();
      await campoPlaca.fill(placa);
      console.log(`✅ Placa ${placa} ingresada`);
    }
    
    await delay(WAIT_TIMES.short);
    
    // ESPERA INTELIGENTE 3: Div para activar JavaScript
    console.log('⏳ Esperando elemento div para activación...');
    try {
      // Esperar a que el div esté disponible
      await page.waitForSelector('div:nth-child(4)', { 
        state: 'visible', 
        timeout: 15000 
      });
      await page.locator('div:nth-child(4)').click();
      console.log('✅ Elemento div activado');
    } catch (error) {
      console.log('⚠️  No se encontró el div específico, continuando...');
    }
    
    await delay(WAIT_TIMES.long);
    
    // ESPERA INTELIGENTE 4: Botón de consultar
    console.log('⏳ Esperando botón de consultar...');
    const botonConsultar = await waitForRole(page, 'button', 'Consultar', 15000);
    
    if (!botonConsultar) {
      // Intentar selector alternativo
      const consultarAlt = page.locator('button:has-text("Consultar")');
      if (await consultarAlt.isVisible()) {
        await consultarAlt.click();
        console.log('✅ Botón de consultar clickeado (método alternativo)');
      } else {
        throw new Error('No se pudo encontrar el botón de consultar');
      }
    } else {
      await botonConsultar.click();
      console.log('✅ Botón de consultar clickeado');
    }
    
    await delay(WAIT_TIMES.xlong);
    
    // ESPERA INTELIGENTE 5: CAPTCHA (si aparece)
    console.log('⏳ Verificando captcha...');
    try {
      // Esperar a que aparezca el captcha con timeout más corto
      await page.waitForSelector('input[name="robot"], input[type="checkbox"]', { 
        state: 'visible', 
        timeout: 10000 
      });
      
      const captchaCheckbox = await waitForRole(page, 'checkbox', 'No soy un robot', 8000);
      if (captchaCheckbox) {
        await captchaCheckbox.check();
        console.log('✅ Captcha resuelto');
      }
    } catch (error) {
      console.log('✅ No se encontró captcha o ya estaba resuelto');
    }
    
    await delay(WAIT_TIMES.long);
    
    // ESPERA INTELIGENTE 6: Campo de email (con verificación de habilitado)
    console.log('⏳ Esperando campo de email habilitado...');
    
    // Primero esperar a que el campo exista
    let campoEmail = null;
    const maxRetries = 10;
    let retryCount = 0;
    
    while (!campoEmail && retryCount < maxRetries) {
      campoEmail = await waitForRole(page, 'textbox', 'Email', 5000);
      
      if (!campoEmail) {
        // Intentar por placeholder
        campoEmail = await waitForPlaceholder(page, 'Email', 3000);
      }
      
      if (campoEmail) {
        // Verificar si está habilitado
        const isEnabled = await campoEmail.isEnabled();
        if (isEnabled) {
          console.log('✅ Campo de email habilitado encontrado');
          break;
        } else {
          console.log('⚠️  Campo de email encontrado pero deshabilitado, esperando...');
          campoEmail = null;
          await delay(1000);
        }
      } else {
        console.log(`⏳ Intento ${retryCount + 1}/${maxRetries}: Campo de email no encontrado, reintentando...`);
        await delay(1000);
      }
      
      retryCount++;
    }
    
    if (!campoEmail) {
      throw new Error('No se pudo encontrar el campo de email después de 10 intentos');
    }
    
    await campoEmail.click();
    await campoEmail.fill(EMAIL);
    console.log(`✅ Email ${EMAIL} ingresado`);
    
    await delay(WAIT_TIMES.short);
    
    // ESPERA INTELIGENTE 7: Botón de ver estado de cuenta
    console.log('⏳ Esperando botón "Ver estado de cuenta"...');
    const botonVerEstado = await waitForRole(page, 'button', 'Ver estado de cuenta', 15000);
    
    if (!botonVerEstado) {
      // Intentar selector alternativo
      const verEstadoAlt = page.locator('button:has-text("Ver estado de cuenta")');
      if (await verEstadoAlt.isVisible()) {
        await verEstadoAlt.click();
        console.log('✅ Botón "Ver estado de cuenta" clickeado (método alternativo)');
      } else {
        throw new Error('No se pudo encontrar el botón "Ver estado de cuenta"');
      }
    } else {
      await botonVerEstado.click();
      console.log('✅ Botón "Ver estado de cuenta" clickeado');
    }
    
    console.log('⏳ Cargando resultados...');
    await delay(WAIT_TIMES.xxlong);
    
    // ESPERA INTELIGENTE 8: Verificar que los resultados cargaron
    console.log('⏳ Verificando carga de resultados...');
    try {
      // Esperar a que aparezca algún contenido relevante
      await page.waitForSelector('body', { 
        state: 'visible', 
        timeout: 10000 
      });
      
      // Esperar contenido específico de resultados
      const tieneResultados = await page.evaluate(() => {
        const bodyText = document.body.textContent;
        return bodyText.includes('Marca:') || 
               bodyText.includes('Modelo:') || 
               bodyText.includes('TOTAL') || 
               bodyText.includes('SUBTOTAL');
      });
      
      if (!tieneResultados) {
        console.log('⚠️  No se detectaron patrones de resultados, continuando...');
      } else {
        console.log('✅ Resultados detectados');
      }
    } catch (error) {
      console.log('⚠️  No se pudo verificar resultados específicos, continuando con extracción...');
    }
    
    // Extraer datos limpios
    const pageContent = await page.textContent('body');
    const lines = pageContent.split('\n').map(line => line.trim()).filter(line => {
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
    
    // Procesar información del vehículo
    let vehicleInfo = [];
    let charges = [];
    let totalAPagar = '';
    let subtotal = '';
    
    // Encontrar información del vehículo
    const vehicleKeywords = ['Marca:', 'Modelo:', 'Linea:', 'Tipo:', 'Color:', 'NIV:'];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Capturar información del vehículo
      if (line.includes('Marca:')) {
        vehicleInfo.push('Marca:');
        if (i + 1 < lines.length && lines[i + 1].trim() && !lines[i + 1].includes(':')) {
          vehicleInfo.push(lines[i + 1]);
        }
      } else if (line.includes('Modelo:')) {
        vehicleInfo.push('Modelo:');
        if (i + 1 < lines.length && lines[i + 1].trim() && !lines[i + 1].includes(':')) {
          vehicleInfo.push(lines[i + 1]);
        }
      } else if (line.includes('Linea:')) {
        vehicleInfo.push('Linea:');
        if (i + 1 < lines.length && lines[i + 1].trim() && !lines[i + 1].includes(':')) {
          vehicleInfo.push(lines[i + 1]);
        }
      } else if (line.includes('Tipo:')) {
        vehicleInfo.push('Tipo:');
        if (i + 1 < lines.length && lines[i + 1].trim() && !lines[i + 1].includes(':')) {
          vehicleInfo.push(lines[i + 1]);
        }
      } else if (line.includes('Color:')) {
        vehicleInfo.push('Color:');
        if (i + 1 < lines.length && lines[i + 1].trim() && !lines[i + 1].includes(':')) {
          vehicleInfo.push(lines[i + 1]);
        }
      } else if (line.includes('NIV:')) {
        vehicleInfo.push('NIV:');
        if (i + 1 < lines.length && lines[i + 1].trim() && !lines[i + 1].includes(':')) {
          vehicleInfo.push(lines[i + 1]);
        }
      }
      
      // Capturar cargos
      if (line.match(/\d{4}\s+\$/)) {
        charges.push(line);
      }
      
      // Capturar subtotal
      if (line.includes('SUBTOTAL') && !subtotal) {
        subtotal = line;
      }
      
      // Capturar total a pagar
      if ((line.includes('TOTAL A PAGAR') || line.match(/TOTAL.*PAGAR/i)) && !totalAPagar) {
        totalAPagar = line;
      }
    }
    
    // Si no encontramos total a pagar, buscar patrones alternativos
    if (!totalAPagar) {
      for (const line of lines) {
        if (line.match(/PAGO\s*TOTAL/i) || line.match(/TOTAL.*\$\d/)) {
          totalAPagar = line;
          break;
        }
      }
    }
    
    // Si aún no hay total, buscar en el contenido completo
    if (!totalAPagar) {
      const totalMatch = pageContent.match(/TOTAL\s*A\s*PAGAR[^$\n]*\$?\s*[\d,]+\.?\d*/gi);
      if (totalMatch && totalMatch.length > 0) {
        totalAPagar = totalMatch[0].trim();
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
    console.error('❌ Error durante la automatización:', error.message);
    console.error('Stack trace:', error.stack);
    throw error;
  } finally {
    await browser.close();
    console.log('🔒 Navegador cerrado');
  }
}

// ... (el resto del código de endpoints se mantiene igual)

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

// Endpoints de la API (se mantienen igual que antes)
app.get('/', (req, res) => {
  res.json({
    message: 'API de consulta de estado de cuenta vehicular - Versión Optimizada',
    status: 'online',
    version: '2.0',
    caracteristicas: [
      'Esperas inteligentes por elemento',
      'Múltiples métodos de selección',
      'Verificación de habilitación',
      'Reintentos automáticos',
      'Logs detallados'
    ],
    proxy: 'activado',
    solicitudes_simultaneas: '1 máximo',
    estado_actual: isProcessing ? 'procesando' : 'disponible',
    cola: requestQueue
  });
});

// Los demás endpoints (GET /consulta, POST /consulta, etc.) se mantienen igual
// Solo se actualizó la función runAutomation

app.listen(port, () => {
  console.log(`🚀 API de consulta vehicular INICIADA - Versión Optimizada`);
  console.log(`📡 Puerto: ${port}`);
  console.log(`🌐 Proxy: ${PROXY_CONFIG.server}`);
  console.log(`📧 Email: ${EMAIL}`);
  console.log(`⏱️  Esperas inteligentes: ACTIVADAS`);
  console.log(`✅ Sistema optimizado para conexiones lentas`);
});
