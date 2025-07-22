"""
Device Connection API Router
backend/app/routers/connections.py
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Dict, Optional
import asyncio
import logging
from datetime import datetime

# Local imports
from ..utils.ssh_connector import SSHConnector, NetworkDeviceManager
from ..json_db import get_devices

router = APIRouter(prefix="/connections", tags=["Device Connections"])
logger = logging.getLogger(__name__)

# Pydantic models
class ConnectionRequest(BaseModel):
    device_id: int
    username: str
    password: str
    port: Optional[int] = 22

class CommandRequest(BaseModel):
    device_id: int
    username: str
    password: str
    command: str
    port: Optional[int] = 22

class MultiCommandRequest(BaseModel):
    device_id: int
    username: str
    password: str
    commands: List[str]
    port: Optional[int] = 22
    delay: Optional[float] = 1.0

class HealthCheckRequest(BaseModel):
    device_id: int
    username: str  
    password: str
    port: Optional[int] = 22

# Helper function
def get_device_by_id(device_id: int):
    """Device ID'ye göre cihaz bilgilerini döner"""
    devices = get_devices()
    device = next((d for d in devices if d.get("id") == device_id), None)
    if not device:
        raise HTTPException(status_code=404, detail=f"Device with ID {device_id} not found")
    return device

@router.post("/test/{device_id}")
async def test_device_connection(device_id: int, connection: ConnectionRequest):
    """Cihaza SSH bağlantısını test eder - Tamamen dinamik"""
    try:
        device = get_device_by_id(device_id)
        device_type = device.get("type", "unknown")
        
        # Cihaz tipine göre uygun test komutları al
        from ..utils.ssh_connector import get_test_commands_for_device_type
        test_commands = get_test_commands_for_device_type(device_type)
        
        logger.info(f"Testing SSH connection to {device['name']} ({device['ip']}) with user {connection.username}")
        
        connector = SSHConnector()
        
        # Bağlantı testi
        success, message = await connector.connect(
            host=device["ip"],
            username=connection.username,
            password=connection.password,
            port=connection.port,
            timeout=15
        )
        
        if success:
            # Cihaz tipine uygun test komutlarını çalıştır
            logger.info(f"Connection successful, running {len(test_commands)} test commands")
            test_results = await connector.execute_multiple_commands(test_commands[:3])  # İlk 3 komutu test et
            connector.disconnect()
            
            successful_tests = sum(1 for r in test_results if r["success"])
            
            return {
                "status": "success",
                "message": f"SSH connection successful - {successful_tests}/{len(test_results)} tests passed",
                "device": {
                    "id": device["id"],
                    "name": device["name"],
                    "ip": device["ip"],
                    "type": device["type"]
                },
                "connection_info": {
                    "username": connection.username,
                    "port": connection.port,
                    "connected_at": datetime.now().isoformat()
                },
                "test_results": {
                    "total_tests": len(test_results),
                    "successful_tests": successful_tests,
                    "commands": test_results
                }
            }
        else:
            logger.warning(f"Connection failed to {device['name']}: {message}")
            return {
                "status": "error",
                "message": f"SSH connection failed: {message}",
                "device": {
                    "id": device["id"],
                    "name": device["name"],
                    "ip": device["ip"],
                    "type": device["type"]
                },
                "connection_info": {
                    "username": connection.username,
                    "port": connection.port,
                    "error_at": datetime.now().isoformat()
                }
            }
            
    except Exception as e:
        logger.error(f"Connection test error for device {device_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Connection test failed: {str(e)}")

@router.post("/execute/{device_id}")
async def execute_command(device_id: int, request: CommandRequest):
    """Cihazda tek komut çalıştırır"""
    try:
        device = get_device_by_id(device_id)
        
        connector = SSHConnector()
        
        # Bağlantı kur
        success, message = await connector.connect(
            host=device["ip"],
            username=request.username,
            password=request.password,
            port=request.port
        )
        
        if not success:
            raise HTTPException(status_code=400, detail=f"Connection failed: {message}")
        
        # Komut çalıştır
        start_time = datetime.now()
        cmd_success, stdout, stderr = await connector.execute_command(request.command)
        execution_time = (datetime.now() - start_time).total_seconds()
        
        connector.disconnect()
        
        return {
            "status": "completed",
            "device": {
                "id": device["id"],
                "name": device["name"],
                "ip": device["ip"],
                "type": device["type"]
            },
            "command": request.command,
            "result": {
                "success": cmd_success,
                "stdout": stdout,
                "stderr": stderr,
                "execution_time": execution_time,
                "timestamp": start_time.isoformat()
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Command execution error: {e}")
        raise HTTPException(status_code=500, detail=f"Command execution failed: {str(e)}")

@router.post("/execute-multiple/{device_id}")
async def execute_multiple_commands(device_id: int, request: MultiCommandRequest):
    """Cihazda birden fazla komut çalıştırır"""
    try:
        device = get_device_by_id(device_id)
        
        connector = SSHConnector()
        
        # Bağlantı kur
        success, message = await connector.connect(
            host=device["ip"],
            username=request.username,
            password=request.password,
            port=request.port
        )
        
        if not success:
            raise HTTPException(status_code=400, detail=f"Connection failed: {message}")
        
        # Komutları çalıştır
        start_time = datetime.now()
        results = await connector.execute_multiple_commands(request.commands, request.delay)
        total_time = (datetime.now() - start_time).total_seconds()
        
        connector.disconnect()
        
        return {
            "status": "completed",
            "device": {
                "id": device["id"],
                "name": device["name"],
                "ip": device["ip"],
                "type": device["type"]
            },
            "commands_count": len(request.commands),
            "total_execution_time": total_time,
            "start_time": start_time.isoformat(),
            "results": results
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Multiple command execution error: {e}")
        raise HTTPException(status_code=500, detail=f"Multiple command execution failed: {str(e)}")

@router.post("/health-check/{device_id}")
async def health_check_device(device_id: int, request: HealthCheckRequest):
    """Cihazın sağlık durumunu kontrol eder - Dinamik credentials"""
    try:
        device = get_device_by_id(device_id)
        device_type = device.get("type", "unknown")
        
        # Cihaz tipine göre sağlık kontrol komutlarını al
        health_commands = NetworkDeviceManager.get_health_check_commands(device_type)
        
        logger.info(f"Health check for {device['name']} ({device_type}) with {len(health_commands)} commands")
        
        connector = SSHConnector()
        
        # Bağlantı kur
        success, message = await connector.connect(
            host=device["ip"],
            username=request.username,
            password=request.password,
            port=request.port,
            timeout=20
        )
        
        if not success:
            return {
                "status": "unhealthy",
                "device": device,
                "connection_status": "failed",
                "error": message,
                "timestamp": datetime.now().isoformat(),
                "health_score": 0
            }
        
        # Sağlık komutlarını çalıştır
        logger.info(f"Running health check commands: {health_commands}")
        results = await connector.execute_multiple_commands(health_commands, delay=1.0)
        connector.disconnect()
        
        # Sağlık durumunu değerlendir
        successful_commands = sum(1 for r in results if r["success"])
        health_score = round((successful_commands / len(results)) * 100, 2)
        
        # Durum belirleme
        if health_score >= 80:
            status = "healthy"
            status_icon = "💚"
        elif health_score >= 50:
            status = "degraded" 
            status_icon = "💛"
        else:
            status = "unhealthy"
            status_icon = "❤️"
        
        logger.info(f"Health check completed: {status} ({health_score}%)")
        
        return {
            "status": status,
            "status_icon": status_icon,
            "device": device,
            "connection_status": "successful",
            "connection_info": {
                "username": request.username,
                "port": request.port
            },
            "health_score": health_score,
            "commands_executed": len(results),
            "successful_commands": successful_commands,
            "failed_commands": len(results) - successful_commands,
            "timestamp": datetime.now().isoformat(),
            "details": results,
            "summary": f"{status_icon} {status.upper()} - {health_score}% ({successful_commands}/{len(results)} commands successful)"
        }
        
    except Exception as e:
        logger.error(f"Health check error for device {device_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")

@router.get("/available-commands/{device_id}")
async def get_available_commands(device_id: int):
    """Cihaz tipine göre kullanılabilir komutları döner"""
    try:
        device = get_device_by_id(device_id)
        device_type = device.get("type", "unknown")
        
        available_commands = NetworkDeviceManager.get_device_commands(device_type)
        
        return {
            "device": {
                "id": device["id"],
                "name": device["name"],
                "type": device["type"]
            },
            "available_commands": available_commands,
            "commands_count": len(available_commands)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get available commands error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get available commands: {str(e)}")

@router.post("/quick-info/{device_id}")
async def get_quick_device_info(device_id: int, connection: ConnectionRequest):
    """Cihazdan hızlı bilgi toplar (version, interfaces vb.)"""
    try:
        device = get_device_by_id(device_id)
        device_type = device.get("type", "unknown")
        
        # Device type'a göre bilgi komutları
        info_commands = []
        if device_type == "cisco_ios":
            info_commands = ["show version", "show ip interface brief", "show inventory"]
        elif device_type == "mikrotik":
            info_commands = ["/system resource print", "/system identity print", "/interface print"]
        elif device_type == "ubuntu":
            info_commands = ["uname -a", "ip addr show", "uptime"]
        else:
            info_commands = ["echo 'Device info not available for this type'"]
        
        connector = SSHConnector()
        
        # Bağlantı kur
        success, message = await connector.connect(
            host=device["ip"],
            username=connection.username,
            password=connection.password,
            port=connection.port
        )
        
        if not success:
            raise HTTPException(status_code=400, detail=f"Connection failed: {message}")
        
        # Bilgi komutlarını çalıştır
        results = await connector.execute_multiple_commands(info_commands)
        connector.disconnect()
        
        return {
            "status": "completed",
            "device": device,
            "info_collected": datetime.now().isoformat(),
            "results": results
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Quick info collection error: {e}")
        raise HTTPException(status_code=500, detail=f"Quick info collection failed: {str(e)}")