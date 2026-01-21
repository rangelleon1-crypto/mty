import time
import base64
import requests
import random
import json
import os
from datetime import datetime
from playwright.sync_api import sync_playwright
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any
import uvicorn
import logging
from contextlib import asynccontextmanager
from enum import Enum

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- CONFIGURACIÓN DESDE VARIABLES DE ENTORNO ---
API_KEY_2CAPTCHA = os.getenv('API_KEY_2CAPTCHA', 'a5a8c9ec5df7da6ff61efb8a6780ff60')
PROXY_HOST = os.getenv('PROXY_HOST', 'proxy.smartproxy.net')
PROXY_PORT = os.getenv('PROXY_PORT', '3120')
PROXY_USER = os.getenv('PROXY_USER', 'smart-acbga3s2e8o0_area-CA')
PROXY_PASS = os.getenv('PROXY_PASS', 'VGp2kCrlWmUem0b0')

# Almacenamiento en memoria para resultados
results_cache = {}

proxies_dict = {
    "http": f"http://{PROXY_USER}:{PROXY_PASS}@{PROXY_HOST}:{PROXY_PORT}",
    "https": f"http://{PROXY_USER}:{PROXY_PASS}@{PROXY_HOST}:{PROXY_PORT}",
}

# Modelos Pydantic
class VehicleRequest(BaseModel):
    placa: str
    email: Optional[str] = "shshsghs67@gmail.com"

class TaskStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class TaskResponse(BaseModel):
    task_id: str
    status: TaskStatus
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    timestamp: str

def human_delay(min_ms=1000, max_ms=3000):
    time.sleep(random.uniform(min_ms, max_ms) / 1000)

def human_type(element, text):
    for char in text:
        element.type(char, delay=random.uniform(70, 150))
        if random.random() > 0.9:
            time.sleep(random.uniform(0.1, 0.3))

def solve_captcha_api(image_buffer):
    try:
        logger.info("🤖 Enviando captcha a 2Captcha...")
        image_b64 = base64.b64encode(image_buffer).decode('utf-8')
        payload = {'key': API_KEY_2CAPTCHA, 'method': 'base64', 'body': image_b64, 'json': 1}
        response = requests.post("http://2captcha.com/in.php", data=payload, proxies=proxies_dict, timeout=30).json()
        
        if response.get("status") != 1:
            logger.error(f"Error 2Captcha: {response}")
            return None
            
        request_id = response.get("request")
        
        for _ in range(30):
            time.sleep(5)
            result = requests.get(f"http://2captcha.com/res.php?key={API_KEY_2CAPTCHA}&action=get&id={request_id}&json=1", proxies=proxies_dict).json()
            if result.get("status") == 1:
                return result.get("request")
    except Exception as e:
        logger.error(f"Error en solve_captcha_api: {e}")
        return None
    return None

def run_vehicle_check(placa: str, email: str = "shshsghs67@gmail.com"):
    """Función principal que ejecuta la automatización"""
    logger.info(f"Iniciando verificación para placa: {placa}")
    
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,  # Modo headless para servidor
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                    "--window-size=1920,1080"
                ]
            )
            
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={'width': 1920, 'height': 1080},
                locale="es-MX",
                timezone_id="America/Mexico_City",
                proxy={
                    "server": f"http://{PROXY_HOST}:{PROXY_PORT}",
                    "username": PROXY_USER,
                    "password": PROXY_PASS
                }
            )
            
            page = context.new_page()
            page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")

            try:
                logger.info("🌐 Navegando al sitio...")
                page.goto('https://www.icvnl.gob.mx/EstadodeCuenta', wait_until='networkidle', timeout=60000)
                
                frame = page.frame_locator('iframe[name="estadodecuenta"]')
                frame.locator('body').wait_for(state="visible")
                human_delay(2000, 3000)

                # --- PARTE 1 ---
                frame.get_by_role('checkbox', name='Acepto bajo protesta de decir').click()
                input_placa = frame.get_by_role('textbox', name='Placa')
                input_placa.click()
                human_type(input_placa, placa)
                
                logger.info("🔘 Click en reCAPTCHA 1...")
                frame.get_by_role('checkbox', name='No soy un robot').click(force=True)
                
                img_1 = frame.get_by_role('img', name='Retype the CAPTCHA code from')
                img_1.wait_for(state="visible", timeout=12000)
                
                res1 = solve_captcha_api(img_1.screenshot())
                if res1:
                    human_type(frame.locator('#txt'), res1)
                    human_delay(1000, 2000)
                    frame.get_by_role('button', name='Consultar').click()
                else:
                    raise Exception("No se pudo resolver el primer captcha")

                # --- ESPERA DE CARGA ---
                logger.info("⏳ Esperando carga de datos...")
                page.wait_for_load_state("networkidle")
                frame.get_by_role("textbox", name="Email").wait_for(state="visible", timeout=15000)
                human_delay(2000, 3000)

                # --- PARTE 2 ---
                logger.info("🔘 Click en reCAPTCHA 2...")
                cb_robot_2 = frame.get_by_role('checkbox', name='No soy un robot')
                cb_robot_2.scroll_into_view_if_needed()
                cb_robot_2.click(force=True)

                img_2 = frame.get_by_role('img', name='Retype the CAPTCHA code from')
                img_2.wait_for(state="visible", timeout=10000)
                
                res2 = solve_captcha_api(img_2.screenshot())
                if res2:
                    input_res2 = frame.locator('input[name="txt2"]')
                    input_res2.click()
                    human_type(input_res2, res2)
                else:
                    raise Exception("No se pudo resolver el segundo captcha")

                # Email
                input_email = frame.get_by_role('textbox', name='Email')
                input_email.click()
                human_type(input_email, email)
                human_delay(1500, 2000)

                frame.locator("body").click(position={"x": random.randint(1, 20), "y": random.randint(1, 20)})
                human_delay(1000, 1500)

                logger.info("🚀 Ver estado de cuenta...")
                btn_final = frame.locator('input[type="submit"][value*="estado"], button:has-text("Ver estado de cuenta")').first
                btn_final.click()
                
                # --- EXTRACCIÓN DE RESULTADOS ---
                logger.info("📋 Extrayendo información...")
                time.sleep(5)
                
                # Intentar diferentes selectores para capturar la información
                selectors = [
                    "body",
                    "table",
                    ".resultado",
                    "#resultado",
                    ".contenido",
                    "#contenido"
                ]
                
                resultado_completo = ""
                for selector in selectors:
                    try:
                        if frame.locator(selector).count() > 0:
                            resultado_completo = frame.locator(selector).first.inner_text(timeout=5000)
                            if resultado_completo and len(resultado_completo.strip()) > 100:
                                break
                    except:
                        continue
                
                if not resultado_completo:
                    resultado_completo = frame.locator("body").inner_text()
                
                # Procesar y estructurar los datos
                processed_data = process_vehicle_data(resultado_completo)
                
                return {
                    "success": True,
                    "placa": placa,
                    "raw_data": resultado_completo,
                    "processed_data": processed_data,
                    "timestamp": datetime.now().isoformat()
                }

            except Exception as e:
                logger.error(f"Error durante la automatización: {e}")
                # Tomar screenshot del error
                try:
                    screenshot = page.screenshot(type='png')
                    screenshot_b64 = base64.b64encode(screenshot).decode('utf-8')
                except:
                    screenshot_b64 = None
                    
                return {
                    "success": False,
                    "placa": placa,
                    "error": str(e),
                    "screenshot": screenshot_b64,
                    "timestamp": datetime.now().isoformat()
                }
                
            finally:
                browser.close()
                
    except Exception as e:
        logger.error(f"Error general: {e}")
        return {
            "success": False,
            "placa": placa,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

def process_vehicle_data(raw_text: str) -> Dict[str, Any]:
    """Procesa el texto crudo y extrae información estructurada"""
    processed = {"raw_text": raw_text}
    
    # Intentar extraer información específica usando patrones
    lines = raw_text.split('\n')
    
    # Buscar información común
    for i, line in enumerate(lines):
        line_lower = line.lower()
        
        if any(keyword in line_lower for keyword in ['placa', 'matrícula']):
            processed['placa'] = line.split(':')[-1].strip() if ':' in line else line
            
        elif any(keyword in line_lower for keyword in ['modelo', 'año']):
            processed['modelo'] = line
            
        elif any(keyword in line_lower for keyword in ['marca', 'fabricante']):
            processed['marca'] = line
            
        elif any(keyword in line_lower for keyword in ['adeudo', 'deuda', 'monto']):
            processed['adeudo'] = line
            
        elif any(keyword in line_lower for keyword in ['vigencia', 'vencimiento']):
            processed['vigencia'] = line
            
        elif any(keyword in line_lower for keyword in ['propietario', 'titular']):
            processed['propietario'] = line
    
    return processed

def background_vehicle_check(task_id: str, placa: str, email: str):
    """Ejecuta la verificación en segundo plano"""
    results_cache[task_id] = {
        "status": TaskStatus.PROCESSING,
        "started_at": datetime.now().isoformat()
    }
    
    try:
        result = run_vehicle_check(placa, email)
        results_cache[task_id] = {
            "status": TaskStatus.COMPLETED if result["success"] else TaskStatus.FAILED,
            "result": result,
            "completed_at": datetime.now().isoformat()
        }
    except Exception as e:
        results_cache[task_id] = {
            "status": TaskStatus.FAILED,
            "error": str(e),
            "completed_at": datetime.now().isoformat()
        }

# Inicializar FastAPI
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("🚀 API Vehicle Check iniciada")
    yield
    # Shutdown
    logger.info("👋 API Vehicle Check detenida")

app = FastAPI(
    title="Vehicle Check API",
    description="API para verificar estado de cuenta de vehículos",
    version="1.0.0",
    lifespan=lifespan
)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {
        "message": "Vehicle Check API",
        "status": "active",
        "endpoints": {
            "POST /check": "Verificar una placa",
            "GET /status/{task_id}": "Consultar estado de una tarea",
            "GET /health": "Health check"
        }
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.post("/check", response_model=TaskResponse)
async def check_vehicle(request: VehicleRequest, background_tasks: BackgroundTasks):
    """Inicia una verificación de vehículo"""
    import uuid
    
    task_id = str(uuid.uuid4())
    
    results_cache[task_id] = {
        "status": TaskStatus.PENDING,
        "created_at": datetime.now().isoformat(),
        "placa": request.placa
    }
    
    # Ejecutar en segundo plano
    background_tasks.add_task(
        background_vehicle_check,
        task_id,
        request.placa,
        request.email or "shshsghs67@gmail.com"
    )
    
    return TaskResponse(
        task_id=task_id,
        status=TaskStatus.PENDING,
        timestamp=datetime.now().isoformat()
    )

@app.get("/status/{task_id}", response_model=TaskResponse)
async def get_task_status(task_id: str):
    """Consulta el estado de una tarea"""
    if task_id not in results_cache:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    
    task_data = results_cache[task_id]
    
    return TaskResponse(
        task_id=task_id,
        status=task_data["status"],
        result=task_data.get("result"),
        error=task_data.get("error"),
        timestamp=task_data.get("completed_at", task_data.get("created_at", datetime.now().isoformat()))
    )

@app.post("/check/sync")
async def check_vehicle_sync(request: VehicleRequest):
    """Verificación síncrona (para pruebas)"""
    result = run_vehicle_check(request.placa, request.email or "shshsghs67@gmail.com")
    
    if result["success"]:
        return {
            "success": True,
            "placa": request.placa,
            "data": result["processed_data"],
            "timestamp": result["timestamp"]
        }
    else:
        raise HTTPException(
            status_code=500,
            detail={
                "error": result["error"],
                "placa": request.placa
            }
        )

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
