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
    
    // Verificar carga de página con timeout de 7 segundos
    await page.goto('https://icvnl.gob.mx:1080/estadoctav3/edoctaconsulta#no-back-button', {
      waitUntil: 'domcontentloaded',
      timeout: 7000 // 7 segundos máximo para cargar la página
    }).catch(error => {
      console.log('❌ Timeout: La página no cargó en 7 segundos');
      throw new Error('La página no cargó en el tiempo esperado. Por favor intente nuevamente.');
    });
    
    await delay(WAIT_TIMES.medium);
    
    await page.getByRole('checkbox', { name: 'Acepto bajo protesta de decir' }).check();
    await delay(WAIT_TIMES.short);
    
    // Verificar que el campo de placa esté disponible en menos de 7 segundos
    const placaField = await page.getByRole('textbox', { name: 'Placa' }).waitFor({
      state: 'visible',
      timeout: 7000 // 7 segundos máximo para que aparezca el campo
    }).catch(error => {
      console.log('❌ Timeout: No se pudo encontrar el campo de placa en 7 segundos');
      throw new Error('El sistema no respondió a tiempo. Por favor intente nuevamente.');
    });
    
    await placaField.click();
    await placaField.fill(placa);
    await delay(WAIT_TIMES.short);
    
    await page.locator('div:nth-child(4)').click();
    await delay(WAIT_TIMES.long);
    
    await page.getByRole('button', { name: 'Consultar' }).click();
    await delay(WAIT_TIMES.xlong);
    
    // Verificar si aparece el campo de email (si no aparece, es placa sin adeudo)
    try {
      // Esperar máximo 5 segundos para ver si aparece el campo de email
      await page.waitForSelector('input[name="Email"], input[placeholder*="email"], input[type="email"]', { 
        timeout: 5000 
      });
      
      // Si llegamos aquí, el campo de email está presente (hay adeudo)
      console.log('✅ Campo de email detectado - Hay adeudo');
      
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
        totalAPagar: totalAPagar || 'TOTAL A PAGAR: No disponible',
        estado: 'con_adeudo'
      };
      
    } catch (emailError) {
      // Si no aparece el campo de email, es placa sin adeudo
      console.log('ℹ️ No se encontró campo de email - Placa sin adeudo');
      
      // Intentar capturar información básica del vehículo si está disponible
      const pageContent = await page.textContent('body');
      const lines = pageContent.split('\n').map(line => line.trim()).filter(line => line.trim());
      
      let vehicleInfo = [];
      let vehicleKeywords = ['Marca:', 'Modelo:', 'Linea:', 'Tipo:', 'Color:', 'NIV:'];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
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
        }
      }
      
      return {
        placa,
        vehiculo: vehicleInfo.filter(line => line && line.trim()),
        cargos: ['No se encontraron cargos'],
        subtotal: 'SUBTOTAL: $0.00',
        totalAPagar: 'TOTAL A PAGAR: $0.00',
        mensaje: 'Placa sin adeudo',
        estado: 'sin_adeudo'
      };
    }
    
  } catch (error) {
    console.error('Error durante la automatización:', error.message);
    
    // Si es un timeout, devolver mensaje específico
    if (error.message.includes('timeout') || error.message.includes('tiempo')) {
      throw new Error('El sistema no respondió a tiempo. Por favor intente nuevamente.');
    }
    
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

// Endpoints de la API
app.get('/', (req, res) => {
  res.json({
    message: 'API de consulta de estado de cuenta vehicular',
    status: 'online',
    proxy: 'activado',
    solicitudes_simultaneas: '1 máximo',
    timeout_placa: '7 segundos',
    estado_actual: isProcessing ? 'procesando' : 'disponible',
    cola: requestQueue,
    endpoints: {
      consulta: 'GET /consulta?placa=ABC123',
      consultaPost: 'POST /consulta con JSON body { "placa": "ABC123" }',
      health: 'GET /health',
      consola: 'GET /consulta-consola/:placa'
    },
    respuestas_posibles: {
      con_adeudo: 'Muestra información completa del vehículo y cargos',
      sin_adeudo: 'Retorna "Placa sin adeudo" con total $0.00',
      timeout: 'Error si no responde en 7 segundos'
    },
    ejemplo_sin_adeudo: {
      placa: "ABC123",
      vehiculo: ["Marca:", "TOYOTA"],
      cargos: ["No se encontraron cargos"],
      subtotal: "SUBTOTAL: $0.00",
      totalAPagar: "TOTAL A PAGAR: $0.00",
      mensaje: "Placa sin adeudo",
      estado: "sin_adeudo"
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
    timeout_placa: '7 segundos',
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
    console.log(`\n⏱️ Iniciando consulta para placa: ${placaLimpia}`);
    console.log(`🌐 Usando proxy: ${PROXY_CONFIG.server}`);
    console.log(`⏳ Timeout máximo: 7 segundos para carga inicial`);
    
    const resultados = await runAutomation(placaLimpia);
    const tiempo = ((Date.now() - startTime) / 1000).toFixed(2);
    
    const respuesta = {
      ...resultados,
      tiempoConsulta: `${tiempo} segundos`,
      consultadoEn: new Date().toISOString()
    };
    
    console.log(`✅ Consulta completada en ${tiempo} segundos`);
    console.log(`📊 Estado: ${resultados.estado || 'con_adeudo'}`);
    
    res.json(respuesta);
    
  } catch (error) {
    console.error('❌ Error en la consulta:', error.message);
    
    // Determinar el tipo de error
    let errorCode = 500;
    let errorMessage = error.message;
    let errorType = 'error_general';
    
    if (error.message.includes('tiempo') || error.message.includes('timeout')) {
      errorCode = 408; // Request Timeout
      errorType = 'timeout';
      errorMessage = 'El sistema no respondió a tiempo. Por favor intente nuevamente.';
    }
    
    res.status(errorCode).json({
      error: 'Error en la consulta',
      tipo: errorType,
      message: errorMessage,
      detalles: 'Verifique: 1. Conexión a internet, 2. Proxy disponible, 3. Placa correcta',
      recomendacion: 'Intente nuevamente en unos momentos'
    });
  } finally {
    // Liberar para siguiente solicitud
    isProcessing = false;
    requestQueue--;
    console.log(`🔄 Sistema liberado. Estado: disponible`);
    console.log(`📊 Solicitudes restantes en cola: ${requestQueue}`);
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
    console.log(`\n⏱️ Iniciando consulta para placa: ${placaLimpia}`);
    console.log(`🌐 Usando proxy: ${PROXY_CONFIG.server}`);
    console.log(`⏳ Timeout máximo: 7 segundos para carga inicial`);
    
    const resultados = await runAutomation(placaLimpia);
    const tiempo = ((Date.now() - startTime) / 1000).toFixed(2);
    
    const respuesta = {
      ...resultados,
      tiempoConsulta: `${tiempo} segundos`,
      consultadoEn: new Date().toISOString()
    };
    
    console.log(`✅ Consulta completada en ${tiempo} segundos`);
    console.log(`📊 Estado: ${resultados.estado || 'con_adeudo'}`);
    
    res.json(respuesta);
    
  } catch (error) {
    console.error('❌ Error en la consulta:', error.message);
    
    // Determinar el tipo de error
    let errorCode = 500;
    let errorMessage = error.message;
    let errorType = 'error_general';
    
    if (error.message.includes('tiempo') || error.message.includes('timeout')) {
      errorCode = 408; // Request Timeout
      errorType = 'timeout';
      errorMessage = 'El sistema no respondió a tiempo. Por favor intente nuevamente.';
    }
    
    res.status(errorCode).json({
      error: 'Error en la consulta',
      tipo: errorType,
      message: errorMessage,
      detalles: 'Verifique: 1. Conexión a internet, 2. Proxy disponible, 3. Placa correcta',
      recomendacion: 'Intente nuevamente en unos momentos'
    });
  } finally {
    // Liberar para siguiente solicitud
    isProcessing = false;
    requestQueue--;
    console.log(`🔄 Sistema liberado. Estado: disponible`);
    console.log(`📊 Solicitudes restantes en cola: ${requestQueue}`);
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
    
    console.log(`\n⏱️ Iniciando consulta para placa: ${placaLimpia}`);
    console.log(`🌐 Usando proxy: ${PROXY_CONFIG.server}`);
    console.log(`⏳ Timeout máximo: 7 segundos para carga inicial`);
    
    const resultados = await runAutomation(placaLimpia);
    const tiempo = ((Date.now() - startTime) / 1000).toFixed(2);
    
    // Formatear respuesta como en la consola
    let respuesta = '';
    respuesta += '\n' + '='.repeat(50) + '\n';
    respuesta += `RESULTADOS PARA PLACA: ${resultados.placa}\n`;
    respuesta += '='.repeat(50) + '\n';
    
    respuesta += '\nINFORMACION DEL VEHICULO:\n';
    respuesta += '-'.repeat(30) + '\n';
    
    // Formatear la información del vehículo
    if (resultados.vehiculo && resultados.vehiculo.length > 0) {
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
    } else {
      respuesta += 'Información del vehículo no disponible\n';
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
    
    // Mostrar mensaje especial si es sin adeudo
    if (resultados.mensaje === 'Placa sin adeudo') {
      respuesta += `\n📢 ${resultados.mensaje.toUpperCase()}\n`;
    }
    
    respuesta += `\n⏱️ Tiempo de consulta: ${tiempo} segundos\n`;
    respuesta += `📊 Estado: ${resultados.estado || 'con_adeudo'}\n`;
    
    res.set('Content-Type', 'text/plain');
    res.send(respuesta);
    
  } catch (error) {
    console.error('❌ Error en la consulta:', error.message);
    
    let errorMessage = 'Error en la consulta. Verifique:\n1. Conexión a internet\n2. Proxy disponible\n3. Placa correcta\n';
    
    if (error.message.includes('tiempo') || error.message.includes('timeout')) {
      errorMessage = '⏰ ERROR: El sistema no respondió a tiempo.\n';
      errorMessage += 'El tiempo máximo de espera para cargar la página es de 7 segundos.\n';
      errorMessage += 'Por favor intente nuevamente en unos momentos.\n';
    } else {
      errorMessage += `Detalle del error: ${error.message}\n`;
    }
    
    res.status(500).send(errorMessage);
  } finally {
    isProcessing = false;
    requestQueue--;
    console.log(`🔄 Sistema liberado. Estado: disponible`);
    console.log(`📊 Solicitudes restantes en cola: ${requestQueue}`);
  }
});

app.listen(port, () => {
  console.log(`🚀 API de consulta vehicular iniciada`);
  console.log(`📡 Puerto: ${port}`);
  console.log(`🌐 Proxy: ${PROXY_CONFIG.server}`);
  console.log(`📧 Email: ${EMAIL}`);
  console.log(`⏱️ Timeout placa: 7 segundos máximo`);
  console.log(`🚫 Solicitudes simultáneas: 1 máximo`);
  console.log(`✅ Endpoints disponibles:`);
  console.log(`   GET  /consulta?placa=ABC123`);
  console.log(`   POST /consulta`);
  console.log(`   GET  /consulta-consola/ABC123`);
  console.log(`   GET  /health`);
  console.log(`\n📝 Respuestas posibles:`);
  console.log(`   ✅ Con adeudo: Muestra información completa`);
  console.log(`   ✅ Sin adeudo: Retorna "Placa sin adeudo"`);
  console.log(`   ❌ Timeout: Error 408 si supera 7 segundos`);
});
