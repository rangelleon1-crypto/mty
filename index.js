const { chromium } = require('playwright');
const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Endpoint principal
app.get('/', (req, res) => {
  res.json({
    message: 'API de consulta vehicular funcionando',
    endpoints: {
      consulta: 'GET /consulta?placa=TUPLACA',
      health: 'GET /health'
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'consulta-vehicular-api'
  });
});

// Endpoint de consulta
app.get('/consulta', async (req, res) => {
  try {
    const { placa } = req.query;
    
    if (!placa) {
      return res.status(400).json({
        success: false,
        error: 'La placa es requerida. Ejemplo: /consulta?placa=ABC123'
      });
    }
    
    const placaLimpia = placa.trim().toUpperCase().replace(/\s+/g, '');
    
    console.log(`Iniciando consulta para placa: ${placaLimpia}`);
    
    // Configuración del navegador
    const browser = await chromium.launch({ 
      headless: true,
      args: [
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-setuid-sandbox',
        '--no-sandbox'
      ]
    });
    
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });
    
    const page = await context.newPage();
    
    // Tu lógica de automatización aquí (simplificada)
    await page.goto('https://icvnl.gob.mx:1080/estadoctav3/edoctaconsulta', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    
    // Simular consulta
    await page.waitForTimeout(2000);
    
    const resultado = {
      success: true,
      placa: placaLimpia,
      message: 'Consulta completada (modo de prueba)',
      datos: {
        vehiculo: 'Información del vehículo',
        total: '$1,500.00 MXN'
      },
      timestamp: new Date().toISOString()
    };
    
    await browser.close();
    
    res.json(resultado);
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      error: 'Error en la consulta',
      message: error.message
    });
  }
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor'
  });
});

app.listen(port, () => {
  console.log(`🚀 Servidor API iniciado en puerto ${port}`);
  console.log(`📡 Health check disponible en http://localhost:${port}/health`);
});
