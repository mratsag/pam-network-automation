from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .json_db import get_devices, add_device, get_users
from .routers import connections  # Yeni router
from pydantic import BaseModel
from typing import Optional
import json

app = FastAPI(
    title="PAM Network Device Management",
    description="Centralized network device management with PAM integration",
    version="1.0.0"
)

# CORS middleware ekle (frontend için)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Production'da spesifik domain'ler yazılmalı
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers ekle
app.include_router(connections.router)

class Device(BaseModel):
    name: str
    ip: str
    type: str
    vault_path: Optional[str] = None

class User(BaseModel):
    username: str
    role: str

# Root endpoint - health check
@app.get("/")
async def root():
    return {
        "message": "PAM Network Device Management API",
        "status": "running",
        "version": "1.0.0",
        "features": [
            "Device Management",
            "SSH Connections", 
            "Command Execution",
            "Health Monitoring"
        ]
    }

# Health check endpoint
@app.get("/health")
async def health_check():
    try:
        devices = get_devices()
        users = get_users() 
        return {
            "status": "healthy",
            "devices_count": len(devices),
            "users_count": len(users),
            "features": {
                "ssh_connections": True,
                "command_execution": True,
                "device_management": True
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")

# Device endpoints
@app.get("/devices")
async def list_devices():
    try:
        devices = get_devices()
        return {"devices": devices, "count": len(devices)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get devices: {str(e)}")

@app.post("/devices")
async def create_device(device: Device):
    try:
        # ID ataması json_db.py'de yapılacak
        device_dict = device.dict()
        add_device(device_dict)
        return {"status": "success", "message": "Device added successfully", "device": device_dict}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add device: {str(e)}")

@app.get("/devices/{device_id}")
async def get_device(device_id: int):
    try:
        devices = get_devices()
        device = next((d for d in devices if d.get("id") == device_id), None)
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")
        return device
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get device: {str(e)}")

# User endpoints
@app.get("/users")
async def list_users():
    try:
        users = get_users()
        return {"users": users, "count": len(users)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get users: {str(e)}")

# Info endpoint - API özellikleri
@app.get("/api/info")
async def api_info():
    return {
        "name": "PAM Network Device Management API",
        "version": "1.0.0",
        "description": "Centralized network device management with SSH connectivity",
        "endpoints": {
            "device_management": ["/devices", "/devices/{id}"],
            "ssh_connections": [
                "/connections/test/{device_id}",
                "/connections/execute/{device_id}",
                "/connections/health-check/{device_id}",
                "/connections/available-commands/{device_id}"
            ],
            "system": ["/health", "/api/info"]
        },
        "supported_device_types": [
            "cisco_ios",
            "cisco_asa", 
            "mikrotik",
            "ubuntu",
            "windows",
            "juniper"
        ]
    }

# Test endpoint - PAM bağlantısı test etmek için
@app.get("/test/pam")
async def test_pam_connection():
    return {
        "message": "PAM integration test endpoint",
        "status": "not_implemented",
        "note": "PAM integration will be added in next phase",
        "planned_features": [
            "CyberArk integration",
            "HashiCorp Vault integration",
            "Automatic credential retrieval"
        ]
    }