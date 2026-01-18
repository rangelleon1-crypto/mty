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
    
    // ESPERAR 2 SEGUNDOS Y VERIFICAR SI APARECE EL CAMPO DE EMAIL
    await delay(2.5); // Espera específica de 2 segundos después del click
    
    // Verificar si el campo de email está presente después de 2 segundos
    const emailFieldVisible = await page.getByRole('textbox', { name: 'Email' }).isVisible().catch(() => false);
    
    // Si el campo de email NO está visible después de 2 segundos, la placa no tiene adeudo
    if (!emailFieldVisible) {
      // Verificar si hay algún mensaje de "sin adeudo" o similar
      const pageContent = await page.textContent('body');
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
        // Verificar si hay algún mensaje específico de éxito o confirmación
        const mensajeExito = await page.locator('text=/pago realizado/i, text=/comprobante/i, text=/éxito/i').isVisible().catch(() => false);
        
        if (!mensajeExito) {
          throw new Error('PLACA SIN ADEUDO');
        }
      }
    }
    
    // Si llegamos aquí, continuar con el proceso normal (la placa tiene adeudo)
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
      consultadoEn: new Date().toISOString()
    };
    
    console.log(`Consulta completada en ${tiempo} segundos`);
    
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
        nota: 'La placa no tiene adeudos registrados en el sistema'
      };
      
      res.json(respuesta);
    } else {
      res.status(500).json({
        error: 'Error en la consulta',
        message: error.message,
        detalles: 'Verifique: 1. Conexión a internet, 2. Proxy disponible, 3. Placa correcta'
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
    console.log(`\nIniciando consulta para placa: ${placaLimpia}`);
    console.log(`Usando proxy: ${PROXY_CONFIG.server}`);
    
    const resultados = await runAutomation(placaLimpia);
    const tiempo = ((Date.now() - startTime) / 1000).toFixed(2);
    
    const respuesta = {
      ...resultados,
      tiempoConsulta: `${tiempo} segundos`,
      consultadoEn: new Date().toISOString()
    };
    
    console.log(`Consulta completada en ${tiempo} segundos`);
    
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
        nota: 'La placa no tiene adeudos registrados en el sistema'
      };
      
      res.json(respuesta);
    } else {
      res.status(500).json({
        error: 'Error en la consulta',
        message: error.message,
        detalles: 'Verifique: 1. Conexión a internet, 2. Proxy disponible, 3. Placa correcta'
      });
    }
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
    respuesta += '\n' + '='.repeat(50) + '\n';
    respuesta += `RESULTADOS PARA PLACA: ${resultados.placa}\n`;
    respuesta += '='.repeat(50) + '\n';
    
    respuesta += '\nINFORMACION DEL VEHICULO:\n';
    respuesta += '-'.repeat(30) + '\n';
    
    // Formatear la información del vehículo
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
    respuesta += `\nTiempo de consulta: ${tiempo} segundos\n`;
    
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
      respuesta += '⚠️  PLACA SIN ADEUDO ⚠️\n\n';
      respuesta += 'La placa consultada no tiene adeudos registrados en el sistema.\n';
      respuesta += 'No se encontraron deudas pendientes de pago.\n\n';
      respuesta += '='.repeat(50) + '\n';
      
      res.set('Content-Type', 'text/plain');
      res.send(respuesta);
    } else {
      res.status(500).send(`Error en la consulta. Verifique:\n1. Conexión a internet\n2. Proxy disponible\n3. Placa correcta\nDetalle del error: ${error.message}\n`);
    }
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
        <title>Consulta Vehicular - ${resultados.placa}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { background: #f0f0f0; padding: 15px; border-radius: 5px; }
          .section { margin: 20px 0; }
          .title { font-weight: bold; color: #333; }
          .content { background: #f9f9f9; padding: 15px; border-radius: 5px; }
          .cargo { margin: 5px 0; }
          .total { font-weight: bold; color: #d9534f; }
          .sin-adeudo { background: #dff0d8; color: #3c763d; padding: 20px; border-radius: 5px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Resultados para placa: ${resultados.placa}</h1>
          <p>Consultado el: ${new Date().toLocaleString()}</p>
        </div>
        
        <div class="section">
          <h2 class="title">Información del Vehículo</h2>
          <div class="content">
            ${resultados.vehiculo.map(item => `<p>${item}</p>`).join('')}
          </div>
        </div>
        
        <div class="section">
          <h2 class="title">Cargos</h2>
          <div class="content">
            ${resultados.cargos.map((cargo, index) => `<div class="cargo">${index + 1}. ${cargo}</div>`).join('')}
          </div>
        </div>
        
        <div class="section">
          <h2 class="title">Resumen</h2>
          <div class="content">
            <p><strong>${resultados.subtotal}</strong></p>
            <p class="total">${resultados.totalAPagar}</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    res.set('Content-Type', 'text/html');
    res.send(html);
    
  } catch (error) {
    // Manejar específicamente el caso de "PLACA SIN ADEUDO"
    if (error.message === 'PLACA SIN ADEUDO') {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Consulta Vehicular - ${req.params.placa.toUpperCase()}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; text-align: center; }
            .sin-adeudo { background: #dff0d8; color: #3c763d; padding: 40px; border-radius: 10px; margin: 50px auto; max-width: 600px; }
            h1 { color: #3c763d; }
            .icon { font-size: 48px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="sin-adeudo">
            <div class="icon">✅</div>
            <h1>PLACA SIN ADEUDO</h1>
            <h2>Placa: ${req.params.placa.toUpperCase()}</h2>
            <p>La placa consultada no tiene adeudos registrados en el sistema.</p>
            <p>No se encontraron deudas pendientes de pago.</p>
            <p><strong>Estado: Sin deudas pendientes</strong></p>
            <p>Consultado el: ${new Date().toLocaleString()}</p>
          </div>
        </body>
        </html>
      `;
      
      res.set('Content-Type', 'text/html');
      res.send(html);
    } else {
      res.status(500).send('<h1>Error en la consulta</h1><p>Verifique la placa e intente nuevamente.</p>');
    }
  } finally {
    isProcessing = false;
    requestQueue--;
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
  console.log(`   GET  /consulta-html/ABC123`);
  console.log(`   GET  /health`);
  console.log(`   GET  /`);
  console.log(`\n⚠️  NOTA: Si una placa no tiene adeudo, se mostrará el mensaje "PLACA SIN ADEUDO"`);
});
 PARA OBTENER LA RESPUESTA FINAL ESTA DEMORANDO 18 SEGUNDOS const { chromium } = require('playwright');
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
    
    // ESPERAR 2 SEGUNDOS Y VERIFICAR SI APARECE EL CAMPO DE EMAIL
    await delay(6000); // Espera específica de 2 segundos después del click
    
    // Verificar si el campo de email está presente después de 2 segundos
    const emailFieldVisible = await page.getByRole('textbox', { name: 'Email' }).isVisible().catch(() => false);
    
    // Si el campo de email NO está visible después de 2 segundos, la placa no tiene adeudo
    if (!emailFieldVisible) {
      // Verificar si hay algún mensaje de "sin adeudo" o similar
      const pageContent = await page.textContent('body');
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
        // Verificar si hay algún mensaje específico de éxito o confirmación
        const mensajeExito = await page.locator('text=/pago realizado/i, text=/comprobante/i, text=/éxito/i').isVisible().catch(() => false);
        
        if (!mensajeExito) {
          throw new Error('PLACA SIN ADEUDO');
        }
      }
    }
    
    // Si llegamos aquí, continuar con el proceso normal (la placa tiene adeudo)
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
      consultadoEn: new Date().toISOString()
    };
    
    console.log(`Consulta completada en ${tiempo} segundos`);
    
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
        nota: 'La placa no tiene adeudos registrados en el sistema'
      };
      
      res.json(respuesta);
    } else {
      res.status(500).json({
        error: 'Error en la consulta',
        message: error.message,
        detalles: 'Verifique: 1. Conexión a internet, 2. Proxy disponible, 3. Placa correcta'
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
    console.log(`\nIniciando consulta para placa: ${placaLimpia}`);
    console.log(`Usando proxy: ${PROXY_CONFIG.server}`);
    
    const resultados = await runAutomation(placaLimpia);
    const tiempo = ((Date.now() - startTime) / 1000).toFixed(2);
    
    const respuesta = {
      ...resultados,
      tiempoConsulta: `${tiempo} segundos`,
      consultadoEn: new Date().toISOString()
    };
    
    console.log(`Consulta completada en ${tiempo} segundos`);
    
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
        nota: 'La placa no tiene adeudos registrados en el sistema'
      };
      
      res.json(respuesta);
    } else {
      res.status(500).json({
        error: 'Error en la consulta',
        message: error.message,
        detalles: 'Verifique: 1. Conexión a internet, 2. Proxy disponible, 3. Placa correcta'
      });
    }
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
    respuesta += '\n' + '='.repeat(50) + '\n';
    respuesta += `RESULTADOS PARA PLACA: ${resultados.placa}\n`;
    respuesta += '='.repeat(50) + '\n';
    
    respuesta += '\nINFORMACION DEL VEHICULO:\n';
    respuesta += '-'.repeat(30) + '\n';
    
    // Formatear la información del vehículo
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
    respuesta += `\nTiempo de consulta: ${tiempo} segundos\n`;
    
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
      respuesta += '⚠️  PLACA SIN ADEUDO ⚠️\n\n';
      respuesta += 'La placa consultada no tiene adeudos registrados en el sistema.\n';
      respuesta += 'No se encontraron deudas pendientes de pago.\n\n';
      respuesta += '='.repeat(50) + '\n';
      
      res.set('Content-Type', 'text/plain');
      res.send(respuesta);
    } else {
      res.status(500).send(`Error en la consulta. Verifique:\n1. Conexión a internet\n2. Proxy disponible\n3. Placa correcta\nDetalle del error: ${error.message}\n`);
    }
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
        <title>Consulta Vehicular - ${resultados.placa}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { background: #f0f0f0; padding: 15px; border-radius: 5px; }
          .section { margin: 20px 0; }
          .title { font-weight: bold; color: #333; }
          .content { background: #f9f9f9; padding: 15px; border-radius: 5px; }
          .cargo { margin: 5px 0; }
          .total { font-weight: bold; color: #d9534f; }
          .sin-adeudo { background: #dff0d8; color: #3c763d; padding: 20px; border-radius: 5px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Resultados para placa: ${resultados.placa}</h1>
          <p>Consultado el: ${new Date().toLocaleString()}</p>
        </div>
        
        <div class="section">
          <h2 class="title">Información del Vehículo</h2>
          <div class="content">
            ${resultados.vehiculo.map(item => `<p>${item}</p>`).join('')}
          </div>
        </div>
        
        <div class="section">
          <h2 class="title">Cargos</h2>
          <div class="content">
            ${resultados.cargos.map((cargo, index) => `<div class="cargo">${index + 1}. ${cargo}</div>`).join('')}
          </div>
        </div>
        
        <div class="section">
          <h2 class="title">Resumen</h2>
          <div class="content">
            <p><strong>${resultados.subtotal}</strong></p>
            <p class="total">${resultados.totalAPagar}</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    res.set('Content-Type', 'text/html');
    res.send(html);
    
  } catch (error) {
    // Manejar específicamente el caso de "PLACA SIN ADEUDO"
    if (error.message === 'PLACA SIN ADEUDO') {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Consulta Vehicular - ${req.params.placa.toUpperCase()}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; text-align: center; }
            .sin-adeudo { background: #dff0d8; color: #3c763d; padding: 40px; border-radius: 10px; margin: 50px auto; max-width: 600px; }
            h1 { color: #3c763d; }
            .icon { font-size: 48px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="sin-adeudo">
            <div class="icon">✅</div>
            <h1>PLACA SIN ADEUDO</h1>
            <h2>Placa: ${req.params.placa.toUpperCase()}</h2>
            <p>La placa consultada no tiene adeudos registrados en el sistema.</p>
            <p>No se encontraron deudas pendientes de pago.</p>
            <p><strong>Estado: Sin deudas pendientes</strong></p>
            <p>Consultado el: ${new Date().toLocaleString()}</p>
          </div>
        </body>
        </html>
      `;
      
      res.set('Content-Type', 'text/html');
      res.send(html);
    } else {
      res.status(500).send('<h1>Error en la consulta</h1><p>Verifique la placa e intente nuevamente.</p>');
    }
  } finally {
    isProcessing = false;
    requestQueue--;
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
  console.log(`   GET  /consulta-html/ABC123`);
  console.log(`   GET  /health`);
  console.log(`   GET  /`);
  console.log(`\n⚠️  NOTA: Si una placa no tiene adeudo, se mostrará el mensaje "PLACA SIN ADEUDO"`);
});
