import time
import base64
import requests
import random
import asyncio
from typing import Dict, Any
from playwright.async_api import async_playwright, Playwright

# --- CONFIGURACIÓN (se obtiene de variables de entorno) ---
import os

API_KEY_2CAPTCHA = os.getenv('API_KEY_2CAPTCHA', 'a5a8c9ec5df7da6ff61efb8a6780ff60')
PROXY_HOST = os.getenv('PROXY_HOST', 'proxy.smartproxy.net')
PROXY_PORT = os.getenv('PROXY_PORT', '3120')
PROXY_USER = os.getenv('PROXY_USER', 'smart-acbga3s2e8o0_area-CA')
PROXY_PASS = os.getenv('PROXY_PASS', 'VGp2kCrlWmUem0b0')

# Configuración de proxies
proxies_dict = {
    "http": f"http://{PROXY_USER}:{PROXY_PASS}@{PROXY_HOST}:{PROXY_PORT}",
    "https": f"http://{PROXY_USER}:{PROXY_PASS}@{PROXY_HOST}:{PROXY_PORT}",
}

def human_delay(min_ms=1000, max_ms=3000):
    """Simula delay humano entre acciones"""
    time.sleep(random.uniform(min_ms, max_ms) / 1000)

async def human_type_async(element, text):
    """Escribe texto caracter por caracter como humano (async)"""
    for char in text:
        await element.type(char, delay=random.uniform(70, 150))
        if random.random() > 0.9:
            await asyncio.sleep(random.uniform(0.1, 0.3))

def solve_captcha_api(image_buffer: bytes) -> str:
    """
    Resuelve CAPTCHA usando 2Captcha API
    
    Args:
        image_buffer: Bytes de la imagen del CAPTCHA
        
    Returns:
        str: Texto del CAPTCHA resuelto o None si falla
    """
    try:
        print("🤖 Enviando CAPTCHA a 2Captcha...")
        image_b64 = base64.b64encode(image_buffer).decode('utf-8')
        
        payload = {
            'key': API_KEY_2CAPTCHA,
            'method': 'base64',
            'body': image_b64,
            'json': 1,
            'phrase': 0,
            'regsense': 0,
            'numeric': 0,
            'min_len': 0,
            'max_len': 0
        }
        
        # Enviar CAPTCHA para resolver
        response = requests.post(
            "http://2captcha.com/in.php",
            data=payload,
            proxies=proxies_dict,
            timeout=30
        ).json()
        
        if response.get("status") != 1:
            print(f"❌ Error al enviar CAPTCHA: {response}")
            return None
            
        request_id = response.get("request")
        print(f"✅ CAPTCHA enviado. Request ID: {request_id}")
        
        # Esperar por resultado (máximo 60 segundos)
        for attempt in range(12):
            time.sleep(5)  # Esperar 5 segundos entre intentos
            print(f"⏳ Intentando obtener resultado ({attempt + 1}/12)...")
            
            result_response = requests.get(
                f"http://2captcha.com/res.php?key={API_KEY_2CAPTCHA}&action=get&id={request_id}&json=1",
                proxies=proxies_dict,
                timeout=30
            ).json()
            
            if result_response.get("status") == 1:
                captcha_text = result_response.get("request")
                print(f"✅ CAPTCHA resuelto: {captcha_text}")
                return captcha_text
            elif result_response.get("request") == "CAPCHA_NOT_READY":
                continue  # Seguir intentando
            else:
                print(f"❌ Error en CAPTCHA: {result_response}")
                return None
                
        print("❌ Timeout esperando CAPTCHA")
        return None
        
    except requests.exceptions.Timeout:
        print("❌ Timeout en conexión con 2Captcha")
        return None
    except requests.exceptions.RequestException as e:
        print(f"❌ Error de red con 2Captcha: {e}")
        return None
    except Exception as e:
        print(f"❌ Error inesperado en solve_captcha_api: {e}")
        return None

async def run_automation(placa: str, email: str = "shshsghs67@gmail.com") -> Dict[str, Any]:
    """
    Ejecuta la automatización completa para consultar una placa
    
    Args:
        placa: Número de placa del vehículo
        email: Email para recibir resultados
        
    Returns:
        Dict con resultados de la consulta
    """
    resultado = {
        "placa": placa,
        "email": email,
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "status": "error",
        "message": "",
        "datos_vehiculo": {},
        "estado_cuenta": {},
        "raw_text": "",
        "metadata": {
            "tiempo_ejecucion": 0,
            "captchas_resueltos": 0,
            "errores": []
        }
    }
    
    start_time = time.time()
    
    try:
        print(f"🚀 Iniciando consulta para placa: {placa}")
        
        async with async_playwright() as p:
            # Configurar browser para Railway (headless)
            browser = await p.chromium.launch(
                headless=True,
                args=[
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-accelerated-2d-canvas",
                    "--disable-gpu",
                    "--window-size=1920,1080",
                    "--disable-blink-features=AutomationControlled"
                ]
            )
            
            # Configurar contexto con proxy
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={'width': 1920, 'height': 1080},
                locale="es-MX",
                timezone_id="America/Mexico_City",
                proxy={
                    "server": f"http://{PROXY_HOST}:{PROXY_PORT}",
                    "username": PROXY_USER,
                    "password": PROXY_PASS
                },
                java_script_enabled=True,
                bypass_csp=False
            )
            
            # Crear página y ocultar automatización
            page = await context.new_page()
            await page.add_init_script("""
                Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
                Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3, 4, 5]});
                Object.defineProperty(navigator, 'languages', {get: () => ['es-MX', 'es']});
            """)
            
            # --- PASO 1: Navegar al sitio ---
            print("🌐 Navegando a ICVNL...")
            try:
                await page.goto(
                    'https://www.icvnl.gob.mx/EstadodeCuenta', 
                    wait_until='networkidle',
                    timeout=60000
                )
            except Exception as e:
                print(f"❌ Error navegando: {e}")
                resultado["message"] = f"Error navegando al sitio: {str(e)}"
                resultado["metadata"]["errores"].append(f"Navegación: {str(e)}")
                await browser.close()
                return resultado
            
            # Buscar el frame principal
            frame_element = await page.wait_for_selector('iframe[name="estadodecuenta"]', timeout=30000)
            if not frame_element:
                print("❌ No se encontró el frame principal")
                resultado["message"] = "No se encontró el formulario en la página"
                await browser.close()
                return resultado
            
            frame = await frame_element.content_frame()
            if not frame:
                print("❌ No se pudo acceder al contenido del frame")
                resultado["message"] = "Error al cargar el formulario"
                await browser.close()
                return resultado
            
            # Esperar que el cuerpo sea visible
            await frame.wait_for_selector('body', state='visible', timeout=30000)
            human_delay(2000, 3000)
            
            # --- PASO 2: Aceptar términos y condiciones ---
            try:
                print("📝 Aceptando términos y condiciones...")
                checkbox = await frame.wait_for_selector(
                    'input[type="checkbox"][name*="acepto"], input[type="checkbox"][value*="acepto"]',
                    timeout=10000
                )
                if checkbox:
                    await checkbox.click()
                    human_delay(1000, 1500)
            except Exception as e:
                print(f"⚠️ Checkbox de términos no encontrado: {e}")
                # Continuar de todos modos
            
            # --- PASO 3: Ingresar placa ---
            print(f"🔤 Ingresando placa: {placa}")
            try:
                input_placa = await frame.wait_for_selector(
                    'input[name*="placa"], input[id*="placa"], input[placeholder*="placa" i]',
                    timeout=15000
                )
                if input_placa:
                    await input_placa.click()
                    await input_placa.fill('')  # Limpiar si hay algo
                    await human_type_async(input_placa, placa)
                    human_delay(1000, 1500)
            except Exception as e:
                print(f"❌ Error ingresando placa: {e}")
                resultado["message"] = f"Error ingresando placa: {str(e)}"
                resultado["metadata"]["errores"].append(f"Placa: {str(e)}")
                await browser.close()
                return resultado
            
            # --- PASO 4: Primer CAPTCHA ---
            print("🔘 Resolviendo primer CAPTCHA...")
            captcha_solved = False
            
            # Buscar checkbox de "No soy un robot"
            try:
                robot_checkbox = await frame.wait_for_selector(
                    'div.recaptcha-checkbox-border, [aria-label*="robot" i], [name*="robot" i]',
                    timeout=10000
                )
                if robot_checkbox:
                    await robot_checkbox.click(force=True)
                    human_delay(2000, 3000)
            except Exception as e:
                print(f"⚠️ Checkbox robot no encontrado: {e}")
            
            # Buscar imagen del CAPTCHA
            try:
                captcha_img = await frame.wait_for_selector(
                    'img[alt*="CAPTCHA"], img[src*="captcha"], img[alt*="código"]',
                    timeout=10000
                )
                
                if captcha_img:
                    # Tomar screenshot del CAPTCHA
                    captcha_bytes = await captcha_img.screenshot()
                    
                    # Resolver CAPTCHA
                    captcha_text = solve_captcha_api(captcha_bytes)
                    
                    if captcha_text:
                        # Buscar input para el CAPTCHA
                        captcha_input = await frame.wait_for_selector(
                            'input[name="txt"], input[id="txt"], input[type="text"]',
                            timeout=5000
                        )
                        
                        if captcha_input:
                            await captcha_input.click()
                            await captcha_input.fill('')
                            await human_type_async(captcha_input, captcha_text)
                            resultado["metadata"]["captchas_resueltos"] += 1
                            captcha_solved = True
                            human_delay(1500, 2000)
            except Exception as e:
                print(f"⚠️ Error con primer CAPTCHA: {e}")
            
            # --- PASO 5: Hacer clic en Consultar ---
            print("📤 Enviando formulario...")
            try:
                consultar_btn = await frame.wait_for_selector(
                    'button:has-text("Consultar"), input[value*="Consultar"], button[type="submit"]',
                    timeout=10000
                )
                
                if consultar_btn:
                    await consultar_btn.click()
                    
                    # Esperar a que cargue la siguiente parte
                    await page.wait_for_load_state('networkidle', timeout=30000)
                    human_delay(3000, 5000)
                    
                    # Verificar si apareció el segundo formulario
                    try:
                        email_input = await frame.wait_for_selector(
                            'input[type="email"], input[name*="email"], input[id*="email"]',
                            timeout=15000
                        )
                        
                        if email_input:
                            print("✅ Primer formulario enviado correctamente")
                            
                            # --- PASO 6: Segundo CAPTCHA ---
                            print("🔘 Resolviendo segundo CAPTCHA...")
                            
                            # Buscar segundo checkbox de robot
                            try:
                                robot_checkbox2 = await frame.wait_for_selector(
                                    'div.recaptcha-checkbox-border, [aria-label*="robot" i]',
                                    timeout=5000
                                )
                                if robot_checkbox2:
                                    await robot_checkbox2.click(force=True)
                                    human_delay(2000, 3000)
                            except:
                                pass
                            
                            # Buscar segundo CAPTCHA
                            try:
                                captcha_img2 = await frame.wait_for_selector(
                                    'img[alt*="CAPTCHA"], img[src*="captcha"]',
                                    timeout=8000
                                )
                                
                                if captcha_img2:
                                    captcha_bytes2 = await captcha_img2.screenshot()
                                    captcha_text2 = solve_captcha_api(captcha_bytes2)
                                    
                                    if captcha_text2:
                                        # Buscar input del segundo CAPTCHA
                                        captcha_input2 = await frame.wait_for_selector(
                                            'input[name="txt2"], input[name*="captcha"]',
                                            timeout=5000
                                        )
                                        
                                        if captcha_input2:
                                            await captcha_input2.click()
                                            await captcha_input2.fill('')
                                            await human_type_async(captcha_input2, captcha_text2)
                                            resultado["metadata"]["captchas_resueltos"] += 1
                                            human_delay(1500, 2000)
                            except Exception as e:
                                print(f"⚠️ Error con segundo CAPTCHA: {e}")
                            
                            # --- PASO 7: Ingresar email ---
                            print(f"📧 Ingresando email: {email}")
                            try:
                                await email_input.click()
                                await email_input.fill('')
                                await human_type_async(email_input, email)
                                human_delay(1000, 1500)
                            except Exception as e:
                                print(f"⚠️ Error ingresando email: {e}")
                            
                            # --- PASO 8: Enviar formulario final ---
                            print("🚀 Enviando formulario final...")
                            try:
                                submit_btn = await frame.wait_for_selector(
                                    'input[value*="estado"], button:has-text("estado"), input[type="submit"]',
                                    timeout=10000
                                )
                                
                                if submit_btn:
                                    # Hacer clic en un lugar aleatorio primero (simulación humana)
                                    body = await frame.wait_for_selector('body')
                                    if body:
                                        box = await body.bounding_box()
                                        if box:
                                            x = random.randint(int(box['x']), int(box['x'] + box['width'] - 10))
                                            y = random.randint(int(box['y']), int(box['y'] + box['height'] - 10))
                                            await page.mouse.click(x, y)
                                            human_delay(500, 1000)
                                    
                                    await submit_btn.click()
                                    
                                    # Esperar resultados
                                    await page.wait_for_load_state('networkidle', timeout=30000)
                                    human_delay(5000, 8000)
                                    
                                    # --- PASO 9: Extraer resultados ---
                                    print("📋 Extrayendo resultados...")
                                    
                                    # Obtener todo el texto del frame
                                    try:
                                        full_text = await frame.inner_text('body', timeout=10000)
                                        resultado["raw_text"] = full_text
                                        
                                        # Parsear información básica
                                        lines = [line.strip() for line in full_text.split('\n') if line.strip()]
                                        
                                        for line in lines:
                                            if ':' in line:
                                                key, value = line.split(':', 1)
                                                key = key.strip().lower()
                                                value = value.strip()
                                                
                                                # Clasificar la información
                                                vehiculo_keywords = ['placa', 'marca', 'modelo', 'año', 'color', 'serie', 'motor', 'vehículo']
                                                cuenta_keywords = ['adeudo', 'multa', 'vigencia', 'estado', 'total', 'pago', 'vencimiento']
                                                
                                                if any(keyword in key for keyword in vehiculo_keywords):
                                                    resultado["datos_vehiculo"][key] = value
                                                elif any(keyword in key for keyword in cuenta_keywords):
                                                    resultado["estado_cuenta"][key] = value
                                        
                                        # Si no se extrajo información estructurada, guardar todo
                                        if not resultado["datos_vehiculo"] and not resultado["estado_cuenta"]:
                                            resultado["datos_vehiculo"]["informacion_completa"] = full_text[:500] + "..." if len(full_text) > 500 else full_text
                                        
                                        resultado["status"] = "success"
                                        resultado["message"] = "Consulta completada exitosamente"
                                        print("✅ Consulta finalizada exitosamente")
                                        
                                    except Exception as e:
                                        print(f"⚠️ Error extrayendo texto: {e}")
                                        resultado["message"] = f"Consulta completada pero error extrayendo datos: {str(e)}"
                                        resultado["status"] = "partial_success"
                                        
                    except Exception as e:
                        print(f"❌ No apareció el segundo formulario: {e}")
                        resultado["message"] = f"Error en flujo del formulario: {str(e)}"
                        resultado["metadata"]["errores"].append(f"Segundo formulario: {str(e)}")
                        
            except Exception as e:
                print(f"❌ Error enviando formulario: {e}")
                resultado["message"] = f"Error enviando formulario: {str(e)}"
                resultado["metadata"]["errores"].append(f"Enviar formulario: {str(e)}")
            
            # Cerrar browser
            await browser.close()
            
    except Exception as e:
        print(f"❌ Error crítico en automatización: {e}")
        resultado["message"] = f"Error en automatización: {str(e)}"
        resultado["metadata"]["errores"].append(f"General: {str(e)}")
    
    # Calcular tiempo de ejecución
    end_time = time.time()
    resultado["metadata"]["tiempo_ejecucion"] = round(end_time - start_time, 2)
    
    # Si no hay mensaje, establecer uno por defecto
    if not resultado["message"]:
        if resultado["status"] == "success":
            resultado["message"] = "Consulta exitosa"
        else:
            resultado["message"] = "Consulta completada con observaciones"
    
    print(f"📊 Resultado: {resultado['status']} - Tiempo: {resultado['metadata']['tiempo_ejecucion']}s")
    
    return resultado

# Función síncrona para compatibilidad con el código existente
def run_automation_sync(placa: str, email: str = "shshsghs67@gmail.com") -> Dict[str, Any]:
    """
    Versión síncrona de run_automation para compatibilidad
    """
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(run_automation(placa, email))
    finally:
        loop.close()

# Para pruebas locales
if __name__ == "__main__":
    print("🧪 Ejecutando prueba de automatización...")
    resultado = run_automation_sync("RST957C")
    print("\n" + "="*50)
    print("RESULTADO DE PRUEBA:")
    print("="*50)
    print(f"Status: {resultado['status']}")
    print(f"Mensaje: {resultado['message']}")
    print(f"Datos vehículo: {resultado['datos_vehiculo']}")
    print(f"Estado cuenta: {resultado['estado_cuenta']}")
    print(f"Tiempo: {resultado['metadata']['tiempo_ejecucion']}s")
    print("="*50)
