import time
import base64
import requests
import random
from fastapi import FastAPI, HTTPException, Query
from playwright.sync_api import sync_playwright

app = FastAPI()

# --- CONFIGURACIÓN ---
API_KEY_2CAPTCHA = 'a5a8c9ec5df7da6ff61efb8a6780ff60'
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
        image_b64 = base64.b64encode(image_buffer).decode('utf-8')
        payload = {'key': API_KEY_2CAPTCHA, 'method': 'base64', 'body': image_b64, 'json': 1}
        # Nota: Usamos proxies para la petición a 2Captcha como en tu script original
        response = requests.post("http://2captcha.com/in.php", data=payload, proxies=proxies_dict, timeout=30).json()
        
        if response.get("status") != 1: return None
        request_id = response.get("request")
        
        for _ in range(30):
            time.sleep(5)
            result = requests.get(f"http://2captcha.com/res.php?key={API_KEY_2CAPTCHA}&action=get&id={request_id}&json=1", proxies=proxies_dict).json()
            if result.get("status") == 1:
                return result.get("request")
    except:
        return None
    return None

@app.get("/consultar/{placa}")
def run_automation(placa: str):
    """
    Endpoint para consultar por placa usando la ruta: /consultar/PLACA
    """
    return execute_scraping(placa)

@app.get("/consulta")
def run_automation_query(placa: str = Query(...)):
    """
    Endpoint para consultar por parámetro: /consulta?placa=PLACA
    """
    return execute_scraping(placa)

def execute_scraping(placa: str):
    with sync_playwright() as p:
        # Argumentos críticos para que funcione en Railway (Headless y No-Sandbox)
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-setuid-sandbox",
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
        # Ocultar rastro de automatización
        page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")

        try:
            print(f"🌐 Iniciando consulta para placa: {placa}")
            page.goto('https://www.icvnl.gob.mx/EstadodeCuenta', wait_until='networkidle', timeout=60000)
            
            frame = page.frame_locator('iframe[name="estadodecuenta"]')
            frame.locator('body').wait_for(state="visible")
            human_delay(2000, 3000)

            # --- PARTE 1: Ingreso de Placa ---
            frame.get_by_role('checkbox', name='Acepto bajo protesta de decir').click()
            input_placa = frame.get_by_role('textbox', name='Placa')
            input_placa.click()
            human_type(input_placa, placa.upper())
            
            print("🔘 Resolviendo CAPTCHA 1...")
            frame.get_by_role('checkbox', name='No soy un robot').click(force=True)
            
            img_1 = frame.get_by_role('img', name='Retype the CAPTCHA code from')
            img_1.wait_for(state="visible", timeout=15000)
            
            res1 = solve_captcha_api(img_1.screenshot())
            if not res1:
                raise Exception("No se pudo resolver el primer CAPTCHA")
                
            human_type(frame.locator('#txt'), res1)
            human_delay(1000, 2000)
            frame.get_by_role('button', name='Consultar').click()

            # --- ESPERA DE CARGA ---
            page.wait_for_load_state("networkidle")
            frame.get_by_role("textbox", name="Email").wait_for(state="visible", timeout=20000)
            human_delay(2000, 3000)

            # --- PARTE 2: Email y Segundo CAPTCHA ---
            print("🔘 Resolviendo CAPTCHA 2...")
            cb_robot_2 = frame.get_by_role('checkbox', name='No soy un robot')
            cb_robot_2.scroll_into_view_if_needed()
            cb_robot_2.click(force=True)

            img_2 = frame.get_by_role('img', name='Retype the CAPTCHA code from')
            img_2.wait_for(state="visible", timeout=15000)
            
            res2 = solve_captcha_api(img_2.screenshot())
            if not res2:
                raise Exception("No se pudo resolver el segundo CAPTCHA")
                
            input_res2 = frame.locator('input[name="txt2"]')
            input_res2.click()
            human_type(input_res2, res2)

            # Ingreso de Email
            input_email = frame.get_by_role('textbox', name='Email')
            input_email.click()
            human_type(input_email, 'shshsghs67@gmail.com')
            human_delay(1500, 2000)

            # Click fuera para asegurar que se registre el texto
            frame.locator("body").click(position={"x": 10, "y": 10})
            human_delay(1000, 1500)

            print("🚀 Solicitando estado de cuenta...")
            btn_final = frame.locator('input[type="submit"][value*="estado"], button:has-text("Ver estado de cuenta")').first
            btn_final.click()
            
            # Espera a resultados
            time.sleep(6) 
            resultado_completo = frame.locator("body").inner_text()
            
            browser.close()
            return {
                "placa": placa,
                "fecha_consulta": time.strftime("%Y-%m-%d %H:%M:%S"),
                "resultado": resultado_completo
            }

        except Exception as e:
            if 'browser' in locals(): browser.close()
            print(f"❌ Error: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error en la automatización: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
