import time
import base64
import requests
import random
from playwright.sync_api import sync_playwright

# --- CONFIGURACIÓN ---
API_KEY_2CAPTCHA = 'a5a8c9ec5df7da6ff61efb8a6780ff60'

# --- SMARTPROXY CONFIG ---
PROXY_HOST = "proxy.smartproxy.net"
PROXY_PORT = "3120"
PROXY_USER = "smart-acbga3s2e8o0_area-CA"
PROXY_PASS = "VGp2kCrlWmUem0b0"

proxies_dict = {
    "http": f"http://{PROXY_USER}:{PROXY_PASS}@{PROXY_HOST}:{PROXY_PORT}",
    "https": f"http://{PROXY_USER}:{PROXY_PASS}@{PROXY_HOST}:{PROXY_PORT}",
}

def human_delay(min_ms=1000, max_ms=3000):
    time.sleep(random.uniform(min_ms, max_ms) / 1000)

def human_type(element, text):
    for char in text:
        element.type(char, delay=random.uniform(70, 150))
        if random.random() > 0.9:
            time.sleep(random.uniform(0.1, 0.3))

def solve_captcha_api(image_buffer):
    try:
        print("🤖 Enviando a 2Captcha...")
        image_b64 = base64.b64encode(image_buffer).decode('utf-8')
        payload = {'key': API_KEY_2CAPTCHA, 'method': 'base64', 'body': image_b64, 'json': 1}
        response = requests.post("http://2captcha.com/in.php", data=payload, proxies=proxies_dict, timeout=30).json()
        
        if response.get("status") != 1: return None
        request_id = response.get("request")
        
        for _ in range(30):
            time.sleep(5)
            result = requests.get(f"http://2captcha.com/res.php?key={API_KEY_2CAPTCHA}&action=get&id={request_id}&json=1", proxies=proxies_dict).json()
            if result.get("status") == 1:
                return result.get("request")
    except Exception as e:
        print(f"Error en captcha: {e}")
        return None
    return None

def run_automation(placa: str, email: str = "shshsghs67@gmail.com"):
    """
    Ejecuta la automatización para consultar una placa específica
    """
    resultado = {
        "placa": placa,
        "email": email,
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "datos_vehiculo": {},
        "estado_cuenta": {},
        "raw_text": "",
        "status": "error",
        "message": ""
    }
    
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu"
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

            print(f"🌐 Navegando a ICVNL para placa: {placa}")
            page.goto('https://www.icvnl.gob.mx/EstadodeCuenta', wait_until='networkidle', timeout=60000)
            frame = page.frame_locator('iframe[name="estadodecuenta"]')
            frame.locator('body').wait_for(state="visible", timeout=30000)
            human_delay(2000, 3000)

            # --- PARTE 1 ---
            frame.get_by_role('checkbox', name='Acepto bajo protesta de decir').click()
            input_placa = frame.get_by_role('textbox', name='Placa')
            input_placa.click()
            human_type(input_placa, placa)
            
            print("🔘 Click en reCAPTCHA 1...")
            frame.get_by_role('checkbox', name='No soy un robot').click(force=True)
            
            img_1 = frame.get_by_role('img', name='Retype the CAPTCHA code from')
            img_1.wait_for(state="visible", timeout=12000)
            
            res1 = solve_captcha_api(img_1.screenshot())
            if res1:
                human_type(frame.locator('#txt'), res1)
                human_delay(1000, 2000)
                frame.get_by_role('button', name='Consultar').click()

            # --- ESPERA DE CARGA ---
            print("⏳ Esperando datos del vehículo...")
            page.wait_for_load_state("networkidle")
            frame.get_by_role("textbox", name="Email").wait_for(state="visible", timeout=15000)
            human_delay(2000, 3000)

            # --- PARTE 2 ---
            print("🔘 Click en reCAPTCHA 2...")
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

            # Email
            input_email = frame.get_by_role('textbox', name='Email')
            input_email.click()
            human_type(input_email, email)
            human_delay(1500, 2000)

            frame.locator("body").click(position={"x": random.randint(1, 20), "y": random.randint(1, 20)})
            human_delay(1000, 1500)

            print("🚀 Enviando formulario final...")
            btn_final = frame.locator('input[type="submit"][value*="estado"], button:has-text("Ver estado de cuenta")').first
            btn_final.click()
            
            # --- EXTRACCIÓN DE RESULTADOS ---
            print("📋 Extrayendo información...")
            time.sleep(5)
            
            # Capturar todo el texto
            resultado_completo = frame.locator("body").inner_text(timeout=10000)
            resultado["raw_text"] = resultado_completo
            
            # Intentar parsear información estructurada
            lines = resultado_completo.split('\n')
            for i, line in enumerate(lines):
                line = line.strip()
                if ':' in line:
                    key, value = line.split(':', 1)
                    key = key.strip().lower()
                    value = value.strip()
                    
                    # Clasificar en datos_vehiculo o estado_cuenta
                    vehiculo_keys = ['placa', 'marca', 'modelo', 'año', 'color', 'serie']
                    cuenta_keys = ['adeudo', 'multas', 'vigencia', 'estado']
                    
                    if any(vk in key for vk in vehiculo_keys):
                        resultado["datos_vehiculo"][key] = value
                    elif any(ck in key for ck in cuenta_keys):
                        resultado["estado_cuenta"][key] = value
            
            resultado["status"] = "success"
            resultado["message"] = "Consulta completada exitosamente"
            
            print(f"✅ Automatización completada para placa: {placa}")
            
            browser.close()
            
    except Exception as e:
        error_msg = str(e)
        resultado["status"] = "error"
        resultado["message"] = f"Error en automatización: {error_msg}"
        print(f"❌ Error: {error_msg}")
    
    return resultado
