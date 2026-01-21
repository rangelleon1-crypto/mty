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
        response = requests.post("http://2captcha.com/in.php", data=payload, proxies=proxies_dict, timeout=30).json()
        if response.get("status") != 1: return None
        request_id = response.get("request")
        for _ in range(30):
            time.sleep(5)
            result = requests.get(f"http://2captcha.com/res.php?key={API_KEY_2CAPTCHA}&action=get&id={request_id}&json=1", proxies=proxies_dict).json()
            if result.get("status") == 1:
                return result.get("request")
    except: return None
    return None

@app.get("/consulta")
def run_automation_query(placa: str = Query(...)):
    with sync_playwright() as p:
        # Argumentos optimizados para Railway
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--single-process"
            ]
        )
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            proxy={"server": f"http://{PROXY_HOST}:{PROXY_PORT}", "username": PROXY_USER, "password": PROXY_PASS}
        )
        page = context.new_page()
        page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")

        try:
            page.goto('https://www.icvnl.gob.mx/EstadodeCuenta', wait_until='networkidle', timeout=60000)
            frame = page.frame_locator('iframe[name="estadodecuenta"]')
            frame.locator('body').wait_for(state="visible")
            
            # PARTE 1
            frame.get_by_role('checkbox', name='Acepto bajo protesta de decir').click()
            input_placa = frame.get_by_role('textbox', name='Placa')
            human_type(input_placa, placa.upper())
            frame.get_by_role('checkbox', name='No soy un robot').click(force=True)
            
            img_1 = frame.get_by_role('img', name='Retype the CAPTCHA code from')
            img_1.wait_for(state="visible", timeout=15000)
            res1 = solve_captcha_api(img_1.screenshot())
            if not res1: raise Exception("Captcha 1 fallido")
            
            human_type(frame.locator('#txt'), res1)
            frame.get_by_role('button', name='Consultar').click()

            # PARTE 2
            page.wait_for_load_state("networkidle")
            frame.get_by_role("textbox", name="Email").wait_for(state="visible", timeout=20000)
            
            cb_robot_2 = frame.get_by_role('checkbox', name='No soy un robot')
            cb_robot_2.click(force=True)
            img_2 = frame.get_by_role('img', name='Retype the CAPTCHA code from')
            img_2.wait_for(state="visible", timeout=15000)
            res2 = solve_captcha_api(img_2.screenshot())
            if not res2: raise Exception("Captcha 2 fallido")
            
            input_res2 = frame.locator('input[name="txt2"]')
            human_type(input_res2, res2)
            human_type(frame.get_by_role('textbox', name='Email'), 'shshsghs67@gmail.com')
            
            frame.locator('input[type="submit"][value*="estado"]').first.click()
            
            time.sleep(6) 
            resultado = frame.locator("body").inner_text()
            browser.close()
            return {"placa": placa, "resultado": resultado}

        except Exception as e:
            browser.close()
            raise HTTPException(status_code=500, detail=str(e))
