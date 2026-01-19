const { chromium } = require('playwright');
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

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

// Configuración de OpenAI
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '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';

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// Variable para controlar solicitudes simultáneas
let isProcessing = false;
let requestQueue = 0;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Función para analizar los datos con GPT
async function analizarConGPT(resultados) {
  try {
    console.log('🤖 Enviando datos a GPT para análisis...');
    
    const prompt = `
Eres un experto en análisis de datos vehiculares y financieros en México. 
Analiza el siguiente JSON con información de un vehículo y sus adeudos, y genera un resumen detallado y estructurado.

JSON a analizar:
${JSON.stringify(resultados, null, 2)}

INSTRUCCIONES:
1. **INFORMACIÓN DEL VEHÍCULO COMPLETA**: Desglosa cada campo encontrado (Marca, Modelo, Línea, Tipo, Color, NIV) de manera clara.
2. **ANÁLISIS DE ADEUDOS**: 
   - Si hay cargos listados, desglósalos uno por uno con su descripción y monto.
   - Si no hay cargos, explícalo claramente.
3. **RESUMEN FINANCIERO**:
   - Detalla el subtotal (si está disponible)
   - Muestra el total a pagar
   - Calcula diferencias si hay descuentos o subsidios
4. **RECOMENDACIONES**: 
   - Proporciona recomendaciones sobre el pago
   - Sugiere pasos a seguir según los adeudos encontrados
5. **NOTAS IMPORTANTES**:
   - Usa formato claro y fácil de leer
   - Incluye emojis relevantes para mejorar la legibilidad
   - Mantén un tono profesional pero accesible
   - Si algún dato no está disponible, indícalo

Responde ÚNICAMENTE con el análisis en formato de texto estructurado, sin incluir "Análisis:" o títulos similares al inicio.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "Eres un experto en análisis de datos vehiculares, financieros y de trámites automotrices en México. Tu trabajo es analizar información de vehículos y adeudos, proporcionando resúmenes claros, detallados y útiles para el usuario."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 1500,
      temperature: 0.7,
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error('Error al analizar con GPT:', error.message);
    return '⚠️ No se pudo generar el análisis automatizado en este momento. Se muestran los datos originales.';
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
      estado: 'CON ADEUDO'
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
    message: 'API de consulta de estado de cuenta vehicular con GPT',
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
    caracteristicas: {
      gpt_analisis: 'Activado - Análisis inteligente de datos',
      proxy: 'Configurado',
      tiempos_optimizados: 'Sí',
      formato_respuesta: 'JSON con datos brutos + análisis GPT'
    },
    ejemplo: {
      url: '/consulta?placa=ABC123',
      respuesta: {
        placa: "ABC123",
        vehiculo: ["Marca:", "TOYOTA", "Modelo:", "2025", "Linea:", "SIENNA HÍBRIDO", "Tipo:", "XLE, MINI VAN, SISTE", "Color:", "GRIS", "NIV:", "************45180"],
        cargos: ["No se encontraron cargos"],
        subtotal: "SUBTOTAL MONTO SUBSIDIO: -$198.00",
        totalAPagar: "TOTAL A PAGAR: $3,802.00",
        estado: "CON ADEUDO",
        analisis_gpt: "Análisis detallado generado por IA...",
        tiempoConsulta: "18.5 segundos",
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
    gpt: 'disponible',
    procesando: isProcessing,
    cola: requestQueue,
    service: 'consulta-vehicular-api-gpt'
  });
});

app.get('/consulta', checkSimultaneousRequests, async (req, res) => {
  let startTime;
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
    
    startTime = Date.now();
    console.log(`\n🚀 Iniciando consulta para placa: ${placaLimpia}`);
    console.log(`🌐 Usando proxy: ${PROXY_CONFIG.server}`);
    
    const resultados = await runAutomation(placaLimpia);
    const tiempo = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`📊 Datos obtenidos, enviando a GPT para análisis...`);
    
    // Analizar los datos con GPT
    const analisisGPT = await analizarConGPT(resultados);
    
    const respuesta = {
      ...resultados,
      analisis_gpt: analisisGPT,
      tiempoConsulta: `${tiempo} segundos`,
      consultadoEn: new Date().toISOString(),
      metadata: {
        version: '2.0-gpt',
        fuente: 'https://icvnl.gob.mx',
        procesado_con: 'OpenAI GPT-3.5 Turbo'
      }
    };
    
    console.log(`✅ Consulta completada en ${tiempo} segundos`);
    
    res.json(respuesta);
    
  } catch (error) {
    console.error('Error en la consulta:', error.message);
    
    const tiempo = startTime ? ((Date.now() - startTime) / 1000).toFixed(2) : 'Desconocido';
    res.status(500).json({
      error: 'Error en la consulta',
      message: error.message,
      detalles: 'Verifique: 1. Conexión a internet, 2. Proxy disponible, 3. Placa correcta',
      tiempoConsulta: `${tiempo} segundos`
    });
  } finally {
    isProcessing = false;
    requestQueue--;
    console.log(`🔄 Sistema liberado. Estado: disponible`);
  }
});

app.post('/consulta', checkSimultaneousRequests, async (req, res) => {
  let startTime;
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
    
    startTime = Date.now();
    console.log(`\n🚀 Iniciando consulta para placa: ${placaLimpia}`);
    console.log(`🌐 Usando proxy: ${PROXY_CONFIG.server}`);
    
    const resultados = await runAutomation(placaLimpia);
    const tiempo = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`📊 Datos obtenidos, enviando a GPT para análisis...`);
    
    // Analizar los datos con GPT
    const analisisGPT = await analizarConGPT(resultados);
    
    const respuesta = {
      ...resultados,
      analisis_gpt: analisisGPT,
      tiempoConsulta: `${tiempo} segundos`,
      consultadoEn: new Date().toISOString(),
      metadata: {
        version: '2.0-gpt',
        fuente: 'https://icvnl.gob.mx',
        procesado_con: 'OpenAI GPT-3.5 Turbo'
      }
    };
    
    console.log(`✅ Consulta completada en ${tiempo} segundos`);
    
    res.json(respuesta);
    
  } catch (error) {
    console.error('Error en la consulta:', error.message);
    
    const tiempo = startTime ? ((Date.now() - startTime) / 1000).toFixed(2) : 'Desconocido';
    res.status(500).json({
      error: 'Error en la consulta',
      message: error.message,
      detalles: 'Verifique: 1. Conexión a internet, 2. Proxy disponible, 3. Placa correcta',
      tiempoConsulta: `${tiempo} segundos`
    });
  } finally {
    isProcessing = false;
    requestQueue--;
    console.log(`🔄 Sistema liberado. Estado: disponible`);
  }
});

// Endpoint para formato de consola (similar al script original)
app.get('/consulta-consola/:placa', checkSimultaneousRequests, async (req, res) => {
  let startTime;
  try {
    const { placa } = req.params;
    
    if (!placa) {
      isProcessing = false;
      requestQueue--;
      return res.status(400).send('Error: Placa requerida\n');
    }
    
    const placaLimpia = placa.trim().toUpperCase().replace(/\s+/g, '');
    startTime = Date.now();
    
    console.log(`\n🚀 Iniciando consulta para placa: ${placaLimpia}`);
    console.log(`🌐 Usando proxy: ${PROXY_CONFIG.server}`);
    
    const resultados = await runAutomation(placaLimpia);
    const tiempo = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`📊 Datos obtenidos, enviando a GPT para análisis...`);
    
    // Analizar los datos con GPT
    const analisisGPT = await analizarConGPT(resultados);
    
    // Formatear respuesta como en la consola
    let respuesta = '';
    respuesta += '\n' + '='.repeat(60) + '\n';
    respuesta += `🚗 RESULTADOS PARA PLACA: ${resultados.placa}\n`;
    respuesta += '='.repeat(60) + '\n';
    
    respuesta += '\n📋 INFORMACIÓN DEL VEHÍCULO:\n';
    respuesta += '-'.repeat(35) + '\n';
    
    // Formatear la información del vehículo
    let currentKey = '';
    for (let i = 0; i < resultados.vehiculo.length; i++) {
      const item = resultados.vehiculo[i];
      if (item.endsWith(':')) {
        currentKey = item;
        respuesta += currentKey + ' ';
      } else if (currentKey && i > 0 && resultados.vehiculo[i - 1].endsWith(':')) {
        respuesta += item + '\n';
      } else {
        respuesta += item + '\n';
      }
    }
    
    respuesta += '\n💰 CARGOS Y ADEUDOS:\n';
    respuesta += '-'.repeat(35) + '\n';
    if (resultados.cargos && resultados.cargos.length > 0) {
      if (resultados.cargos[0] === 'No se encontraron cargos') {
        respuesta += '✅ No se encontraron cargos\n';
      } else {
        resultados.cargos.forEach((cargo, index) => {
          respuesta += `${index + 1}. ${cargo}\n`;
        });
      }
    } else {
      respuesta += '✅ No se encontraron cargos\n';
    }
    
    respuesta += '\n🧾 RESUMEN FINANCIERO:\n';
    respuesta += '-'.repeat(35) + '\n';
    respuesta += `${resultados.subtotal}\n`;
    respuesta += `💵 ${resultados.totalAPagar}\n`;
    
    respuesta += '\n🤖 ANÁLISIS INTELIGENTE (GPT):\n';
    respuesta += '-'.repeat(35) + '\n';
    respuesta += analisisGPT + '\n';
    
    respuesta += '\n' + '='.repeat(60) + '\n';
    respuesta += `⏱️  Tiempo total de consulta: ${tiempo} segundos\n`;
    respuesta += `📅 Consultado: ${new Date().toLocaleString()}\n`;
    respuesta += '='.repeat(60) + '\n';
    
    res.set('Content-Type', 'text/plain');
    res.send(respuesta);
    
  } catch (error) {
    console.error('Error en la consulta:', error.message);
    
    const tiempo = startTime ? ((Date.now() - startTime) / 1000).toFixed(2) : 'Desconocido';
    res.status(500).send(`Error en la consulta. Verifique:\n1. Conexión a internet\n2. Proxy disponible\n3. Placa correcta\nDetalle del error: ${error.message}\nTiempo: ${tiempo} segundos\n`);
  } finally {
    isProcessing = false;
    requestQueue--;
    console.log(`🔄 Sistema liberado. Estado: disponible`);
  }
});

// Endpoint para formato HTML con análisis GPT
app.get('/consulta-html/:placa', checkSimultaneousRequests, async (req, res) => {
  let startTime;
  try {
    const { placa } = req.params;
    
    if (!placa) {
      isProcessing = false;
      requestQueue--;
      return res.status(400).send('<h1>Error: Placa requerida</h1>');
    }
    
    const placaLimpia = placa.trim().toUpperCase().replace(/\s+/g, '');
    startTime = Date.now();
    
    const resultados = await runAutomation(placaLimpia);
    const tiempo = ((Date.now() - startTime) / 1000).toFixed(2);
    
    // Analizar los datos con GPT
    const analisisGPT = await analizarConGPT(resultados);
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Consulta Vehicular - ${resultados.placa}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            min-height: 100vh;
            padding: 20px;
          }
          
          .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            overflow: hidden;
          }
          
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
          }
          
          .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
          }
          
          .header .placa {
            font-size: 3rem;
            font-weight: bold;
            letter-spacing: 3px;
            background: rgba(255,255,255,0.2);
            display: inline-block;
            padding: 10px 30px;
            border-radius: 10px;
            margin: 20px 0;
          }
          
          .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            padding: 30px;
          }
          
          .card {
            background: white;
            border-radius: 10px;
            padding: 25px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.05);
            border-left: 5px solid #667eea;
            transition: transform 0.3s ease;
          }
          
          .card:hover {
            transform: translateY(-5px);
          }
          
          .card h2 {
            color: #667eea;
            margin-bottom: 20px;
            font-size: 1.5rem;
            display: flex;
            align-items: center;
            gap: 10px;
          }
          
          .card h2 i {
            font-size: 1.8rem;
          }
          
          .vehicle-info {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
          }
          
          .info-item {
            display: flex;
            flex-direction: column;
          }
          
          .info-label {
            font-weight: bold;
            color: #666;
            font-size: 0.9rem;
            margin-bottom: 5px;
          }
          
          .info-value {
            font-size: 1.1rem;
            color: #333;
            padding: 8px;
            background: #f8f9fa;
            border-radius: 5px;
          }
          
          .charges-list {
            list-style: none;
          }
          
          .charge-item {
            padding: 10px;
            margin-bottom: 10px;
            background: #f8f9fa;
            border-radius: 5px;
            border-left: 4px solid #28a745;
          }
          
          .charge-item.no-charges {
            border-left-color: #6c757d;
            background: #e9ecef;
          }
          
          .financial-summary {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
            margin-top: 20px;
            padding-top: 20px;
            border-top: 2px solid #e9ecef;
          }
          
          .total {
            grid-column: span 2;
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
            color: white;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
          }
          
          .total h3 {
            font-size: 1.3rem;
            margin-bottom: 10px;
          }
          
          .total-amount {
            font-size: 2.5rem;
            font-weight: bold;
          }
          
          .gpt-analysis {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
            padding: 25px;
            margin: 20px 30px;
            border-radius: 10px;
          }
          
          .gpt-analysis h2 {
            color: white;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            gap: 10px;
          }
          
          .analysis-content {
            background: rgba(255,255,255,0.1);
            padding: 20px;
            border-radius: 8px;
            font-size: 1.1rem;
            line-height: 1.8;
            white-space: pre-line;
          }
          
          .footer {
            background: #343a40;
            color: white;
            padding: 20px;
            text-align: center;
            margin-top: 30px;
          }
          
          .metadata {
            display: flex;
            justify-content: space-around;
            flex-wrap: wrap;
            gap: 20px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 10px;
            margin: 20px 30px;
          }
          
          .metadata-item {
            text-align: center;
          }
          
          .metadata-label {
            font-weight: bold;
            color: #666;
            font-size: 0.9rem;
          }
          
          .metadata-value {
            font-size: 1.1rem;
            color: #333;
          }
          
          @media (max-width: 768px) {
            .info-grid {
              grid-template-columns: 1fr;
            }
            
            .vehicle-info {
              grid-template-columns: 1fr;
            }
            
            .financial-summary {
              grid-template-columns: 1fr;
            }
            
            .total {
              grid-column: span 1;
            }
            
            .header h1 {
              font-size: 2rem;
            }
            
            .header .placa {
              font-size: 2rem;
            }
          }
        </style>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1><i class="fas fa-car"></i> Consulta Vehicular</h1>
            <div class="placa">${resultados.placa}</div>
            <p>Consulta de estado de cuenta con análisis inteligente</p>
          </div>
          
          <div class="metadata">
            <div class="metadata-item">
              <div class="metadata-label">Tiempo de consulta</div>
              <div class="metadata-value">${tiempo} segundos</div>
            </div>
            <div class="metadata-item">
              <div class="metadata-label">Fecha y hora</div>
              <div class="metadata-value">${new Date().toLocaleString()}</div>
            </div>
            <div class="metadata-item">
              <div class="metadata-label">Estado</div>
              <div class="metadata-value">${resultados.estado}</div>
            </div>
            <div class="metadata-item">
              <div class="metadata-label">Procesado con</div>
              <div class="metadata-value">OpenAI GPT-3.5</div>
            </div>
          </div>
          
          <div class="info-grid">
            <div class="card">
              <h2><i class="fas fa-info-circle"></i> Información del Vehículo</h2>
              <div class="vehicle-info">
                ${resultados.vehiculo.filter((item, index) => item.endsWith(':')).map(label => {
                  const valueIndex = resultados.vehiculo.indexOf(label) + 1;
                  const value = valueIndex < resultados.vehiculo.length ? resultados.vehiculo[valueIndex] : 'No disponible';
                  return `
                    <div class="info-item">
                      <div class="info-label">${label.replace(':', '')}</div>
                      <div class="info-value">${value}</div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
            
            <div class="card">
              <h2><i class="fas fa-file-invoice-dollar"></i> Cargos y Adeudos</h2>
              <ul class="charges-list">
                ${resultados.cargos.map((cargo, index) => `
                  <li class="charge-item">
                    <strong>Cargo ${index + 1}:</strong> ${cargo}
                  </li>
                `).join('')}
              </ul>
              
              <div class="financial-summary">
                <div class="info-item">
                  <div class="info-label">Subtotal</div>
                  <div class="info-value">${resultados.subtotal}</div>
                </div>
                <div class="total">
                  <h3>TOTAL A PAGAR</h3>
                  <div class="total-amount">${resultados.totalAPagar.replace('TOTAL A PAGAR:', '').trim()}</div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="gpt-analysis">
            <h2><i class="fas fa-robot"></i> Análisis Inteligente por GPT</h2>
            <div class="analysis-content">
              ${analisisGPT}
            </div>
          </div>
          
          <div class="footer">
            <p>© ${new Date().getFullYear()} API de Consulta Vehicular | Procesado con IA | Fuente: ICVNL</p>
            <p><small>Este análisis fue generado automáticamente por inteligencia artificial y debe ser verificado con las autoridades correspondientes.</small></p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    res.set('Content-Type', 'text/html');
    res.send(html);
    
  } catch (error) {
    console.error('Error en la consulta HTML:', error.message);
    
    const htmlError = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Error en la consulta</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 50px;
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
          }
          .error-container {
            background: rgba(255,255,255,0.1);
            padding: 40px;
            border-radius: 15px;
            max-width: 600px;
            margin: 0 auto;
            backdrop-filter: blur(10px);
          }
          h1 {
            font-size: 3rem;
            margin-bottom: 20px;
          }
          p {
            font-size: 1.2rem;
            margin-bottom: 20px;
          }
          .error-details {
            background: rgba(0,0,0,0.2);
            padding: 20px;
            border-radius: 10px;
            text-align: left;
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="error-container">
          <h1>⚠️ Error en la Consulta</h1>
          <p>No se pudo procesar la solicitud para la placa: ${req.params.placa}</p>
          <div class="error-details">
            <h3>Posibles causas:</h3>
            <ul>
              <li>La placa no es válida</li>
              <li>Problemas de conexión con el proxy</li>
              <li>El servicio de consulta está temporalmente no disponible</li>
              <li>Error en la API de OpenAI</li>
            </ul>
            <p><strong>Detalle del error:</strong> ${error.message}</p>
          </div>
          <p style="margin-top: 30px;">Intente nuevamente o verifique la placa ingresada.</p>
        </div>
      </body>
      </html>
    `;
    
    res.status(500).send(htmlError);
  } finally {
    isProcessing = false;
    requestQueue--;
  }
});

app.listen(port, () => {
  console.log(`🚀 API de consulta vehicular con GPT INICIADA`);
  console.log(`📡 Puerto: ${port}`);
  console.log(`🌐 Proxy: ${PROXY_CONFIG.server}`);
  console.log(`📧 Email: ${EMAIL}`);
  console.log(`🤖 OpenAI: Configurado (GPT-3.5 Turbo)`);
  console.log(`🚫 Solicitudes simultáneas: 1 máximo`);
  console.log(`✅ Endpoints disponibles:`);
  console.log(`   GET  /consulta?placa=ABC123`);
  console.log(`   POST /consulta`);
  console.log(`   GET  /consulta-consola/ABC123`);
  console.log(`   GET  /consulta-html/ABC123`);
  console.log(`   GET  /health`);
  console.log(`   GET  /`);
  console.log(`\n🤖 CARACTERÍSTICAS GPT:`);
  console.log(`   • Análisis inteligente de datos del vehículo`);
  console.log(`   • Desglose detallado de adeudos`);
  console.log(`   • Recomendaciones personalizadas`);
  console.log(`   • Formato HTML mejorado con IA`);
  console.log(`   • Respuestas en JSON enriquecidas`);
  console.log(`\n⚠️  NOTA: El análisis con GPT añade ~2-3 segundos al tiempo total de consulta`);
});
