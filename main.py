from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
import uuid
import asyncio
from datetime import datetime
import json
from automation import run_automation

app = FastAPI(
    title="ICVNL API",
    description="API para consultar estado de cuenta de vehículos en ICVNL",
    version="1.0.0"
)

# Modelo para las solicitudes
class ConsultaRequest(BaseModel):
    placa: str
    email: Optional[str] = "shshsghs67@gmail.com"

# Almacenamiento temporal de resultados (en producción usar Redis/DB)
results_db = {}

@app.get("/")
async def root():
    return {
        "message": "ICVNL API - Consulta de estado de cuenta",
        "endpoints": {
            "POST /consultar": "Inicia una consulta",
            "GET /resultado/{job_id}": "Obtiene resultado de consulta"
        },
        "status": "operativo"
    }

@app.post("/consultar")
async def iniciar_consulta(request: ConsultaRequest, background_tasks: BackgroundTasks):
    """
    Inicia una consulta para una placa específica
    """
    job_id = str(uuid.uuid4())
    
    # Validar placa
    if not request.placa or len(request.placa) < 5:
        raise HTTPException(status_code=400, detail="Placa inválida")
    
    # Guardar trabajo en progreso
    results_db[job_id] = {
        "status": "processing",
        "placa": request.placa,
        "email": request.email,
        "started_at": datetime.now().isoformat(),
        "result": None,
        "error": None
    }
    
    # Ejecutar automatización en segundo plano
    background_tasks.add_task(
        execute_automation,
        job_id=job_id,
        placa=request.placa,
        email=request.email
    )
    
    return {
        "job_id": job_id,
        "status": "processing",
        "message": "Consulta iniciada. Use GET /resultado/{job_id} para obtener resultados.",
        "estimated_time": "1-2 minutos"
    }

@app.get("/resultado/{job_id}")
async def obtener_resultado(job_id: str):
    """
    Obtiene el resultado de una consulta por job_id
    """
    if job_id not in results_db:
        raise HTTPException(status_code=404, detail="Job ID no encontrado")
    
    job_data = results_db[job_id]
    
    # Limpiar resultados antiguos (opcional)
    if job_data["status"] in ["completed", "error"]:
        # Opcional: puedes programar limpieza periódica
        pass
    
    return {
        "job_id": job_id,
        "status": job_data["status"],
        "placa": job_data["placa"],
        "started_at": job_data["started_at"],
        "completed_at": datetime.now().isoformat() if job_data["status"] != "processing" else None,
        "result": job_data["result"],
        "error": job_data["error"]
    }

@app.get("/status")
async def status():
    """
    Estado del sistema
    """
    processing = sum(1 for v in results_db.values() if v["status"] == "processing")
    completed = sum(1 for v in results_db.values() if v["status"] == "completed")
    
    return {
        "total_jobs": len(results_db),
        "processing": processing,
        "completed": completed,
        "system": "operational"
    }

async def execute_automation(job_id: str, placa: str, email: str):
    """
    Ejecuta la automatización en segundo plano
    """
    try:
        print(f"🔍 Iniciando consulta para placa: {placa}")
        
        # Ejecutar la automatización
        resultado = await asyncio.to_thread(
            run_automation,
            placa=placa,
            email=email
        )
        
        # Actualizar resultado exitoso
        results_db[job_id].update({
            "status": "completed",
            "result": resultado,
            "completed_at": datetime.now().isoformat()
        })
        
        print(f"✅ Consulta completada para placa: {placa}")
        
    except Exception as e:
        print(f"❌ Error en consulta para placa {placa}: {str(e)}")
        
        # Actualizar resultado con error
        results_db[job_id].update({
            "status": "error",
            "error": str(e),
            "completed_at": datetime.now().isoformat()
        })

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
