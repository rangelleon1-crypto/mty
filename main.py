# En main.py, modifica la función execute_automation:
async def execute_automation(job_id: str, placa: str, email: str):
    """
    Ejecuta la automatización en segundo plano
    """
    try:
        print(f"🔍 Iniciando consulta para placa: {placa}")
        
        # Ejecutar la automatización (ahora es async)
        resultado = await run_automation(placa=placa, email=email)
        
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
