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
const PROXY_CONFIG = process.env.PROXY_ENABLED === 'true' ? {
  server: process.env.PROXY_SERVER,
  username: process.env.PROXY_USERNAME,
  password: process.env.PROXY_PASSWORD
} : null;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runAutomation(placa) {
  const launchOptions = {
    headless: true,
    args: [
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-setuid-sandbox',
      '--no-sandbox',
      '--disable-accelerated-2d-canvas',
      '--disable-web-security',
      '--disable-features=site-per-process'
    ]
  };

  // Agregar proxy si está configurado
  if (PROXY_CONFIG) {
    launchOptions.proxy = PROXY_CONFIG;
    launchOptions.args.push(`--proxy-server=${PROXY_CONFIG.server}`);
  }

  const browser = await chromium.launch(launchOptions);
  
  const contextOptions = {
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  };

  // Agregar proxy al contexto si está configurado
  if (PROXY_CONFIG) {
    contextOptions.proxy = PROXY_CONFIG;
  }

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  
  try {
    console.log(`Iniciando consulta para placa: ${placa}`);
    
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
      console.log('No se encontró captcha');
    }
    
    await page.getByRole('textbox', { name: 'Email' }).click();
    await page.getByRole('textbox', { name: 'Email' }).fill(process.env.EMAIL || 'hdhdhd78@gmail.com');
    await delay(WAIT_TIMES.short);
    
    await page.getByRole('button', { name: 'Ver estado de cuenta' }).click();
    await delay(WAIT_TIMES.xxlong);
    
    // Extraer datos
    const pageContent = await page.textContent('body');
    const lines = pageContent.split('\n').filter(line => {
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
    
    // Procesar información
    let vehicleInfo = [];
    let charges = [];
    let totalAPagar = '';
    let subtotal = '';
    let inVehicleSection = false;
    let inChargesSection = false;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.includes('Marca:') || trimmedLine.includes('Modelo:')) {
        inVehicleSection = true;
        inChargesSection = false;
      }
      
      if (trimmedLine.includes('CARGOS DescripciónAñoMonto')) {
        inVehicleSection = false;
        inChargesSection = true;
        continue;
      }
      
      if (trimmedLine.includes('SUBTOTAL')) {
        subtotal = trimmedLine;
        continue;
      }
      
      if (trimmedLine.match(/TOTAL\s*A\s*PAGAR/i) || 
          trimmedLine.match(/TOTAL\s+.*PAGAR/i) ||
          trimmedLine.match(/PAGO\s*TOTAL/i)) {
        totalAPagar = trimmedLine;
        inChargesSection = false;
        continue;
      }
      
      if (trimmedLine.includes('TOTAL MONTO CARGOS:')) {
        if (!totalAPagar) {
          totalAPagar = trimmedLine;
        }
        inChargesSection = false;
        continue;
      }
      
      if (trimmedLine.startsWith('TOTAL') && !totalAPagar && 
          !trimmedLine.includes('MONTO CARGOS') && 
          trimmedLine.match(/[\d,]+\.?\d*$/)) {
        totalAPagar = trimmedLine;
        inChargesSection = false;
        continue;
      }
      
      if (inVehicleSection && trimmedLine.includes('Este vehículo')) {
        inVehicleSection = false;
      }
      
      if (inVehicleSection && trimmedLine) {
        vehicleInfo.push(trimmedLine);
      }
      
      if (inChargesSection && trimmedLine && trimmedLine.match(/\d{4}\$/)) {
        charges.push(trimmedLine);
      }
    }
    
    // Buscar total si no se encontró
    if (!totalAPagar) {
      const totalAPagarRegex = /TOTAL\s*A\s*PAGAR[^$\n]*\$?\s*[\d,]+\.?\d*/gi;
      const totalAPagarMatch = pageContent.match(totalAPagarRegex);
      if (totalAPagarMatch && totalAPagarMatch.length > 0) {
        totalAPagar = totalAPagarMatch[0].trim();
      }
    }
    
    return {
      success: true,
      placa,
      vehiculo: vehicleInfo.filter((line, index, arr) => line && arr.indexOf(line) === index),
      cargos: charges,
      subtotal: subtotal || 'No disponible',
      totalAPagar: totalAPagar || 'TOTAL A PAGAR: No disponible',
      rawContent: process.env.DEBUG === 'true' ? pageContent : undefined
    };
    
  } catch (error) {
    console.error('Error en la automatización:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

// Endpoints de la API
app.get('/', (req, res) => {
  res.json({
    message: 'API de consulta de estado de cuenta vehicular',
    endpoints: {
      consulta: 'GET /consulta?placa=ABC123',
      health: 'GET /health'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/consulta', async (req, res) => {
  try {
    const { placa } = req.query;
    
    if (!placa) {
      return res.status(400).json({
        success: false,
        error: 'Placa es requerida'
      });
    }
    
    const placaLimpia = placa.trim().toUpperCase().replace(/\s+/g, '');
    const startTime = Date.now();
    
    const resultado = await runAutomation(placaLimpia);
    const tiempo = ((Date.now() - startTime) / 1000).toFixed(2);
    
    resultado.tiempoConsulta = `${tiempo} segundos`;
    
    res.json(resultado);
    
  } catch (error) {
    console.error('Error en la API:', error);
    res.status(500).json({
      success: false,
      error: 'Error en la consulta',
      message: error.message
    });
  }
});

app.post('/consulta', async (req, res) => {
  try {
    const { placa } = req.body;
    
    if (!placa) {
      return res.status(400).json({
        success: false,
        error: 'Placa es requerida en el body'
      });
    }
    
    const placaLimpia = placa.trim().toUpperCase().replace(/\s+/g, '');
    const startTime = Date.now();
    
    const resultado = await runAutomation(placaLimpia);
    const tiempo = ((Date.now() - startTime) / 1000).toFixed(2);
    
    resultado.tiempoConsulta = `${tiempo} segundos`;
    
    res.json(resultado);
    
  } catch (error) {
    console.error('Error en la API:', error);
    res.status(500).json({
      success: false,
      error: 'Error en la consulta',
      message: error.message
    });
  }
});

app.listen(port, () => {
  console.log(`API escuchando en puerto ${port}`);
  console.log(`Proxy habilitado: ${PROXY_CONFIG ? 'Sí' : 'No'}`);
});
