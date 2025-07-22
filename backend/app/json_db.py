import json
from pathlib import Path
from typing import Dict, List
import logging

# Logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DB_PATH = Path(__file__).parent / "db.json"

def read_db() -> Dict:
    """JSON veritabanını okur, yoksa boş yapı döner"""
    try:
        if not DB_PATH.exists():
            logger.info(f"Database file not found at {DB_PATH}, creating empty structure")
            default_db = {"devices": [], "users": []}
            write_db(default_db)
            return default_db
        
        with open(DB_PATH, "r", encoding="utf-8") as f:
            content = f.read()
            if not content.strip():
                logger.warning("Database file is empty, returning default structure")
                return {"devices": [], "users": []}
            
            data = json.loads(content)
            logger.info(f"Successfully read database with {len(data.get('devices', []))} devices and {len(data.get('users', []))} users")
            return data
            
    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error: {e}")
        # Bozuk JSON dosyasını yedekle ve yeni oluştur
        backup_path = DB_PATH.with_suffix('.json.backup')
        DB_PATH.rename(backup_path)
        logger.info(f"Corrupted database backed up to {backup_path}")
        
        default_db = {"devices": [], "users": []}
        write_db(default_db)
        return default_db
        
    except Exception as e:
        logger.error(f"Unexpected error reading database: {e}")
        return {"devices": [], "users": []}

def write_db(data: Dict):
    """JSON veritabanına veri yazar"""
    try:
        # Dizin yoksa oluştur
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        
        with open(DB_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Database written successfully to {DB_PATH}")
        
    except Exception as e:
        logger.error(f"Error writing database: {e}")
        raise

def get_devices() -> List[Dict]:
    """Tüm cihazları döner"""
    try:
        db = read_db()
        devices = db.get("devices", [])
        logger.info(f"Retrieved {len(devices)} devices")
        return devices
    except Exception as e:
        logger.error(f"Error getting devices: {e}")
        return []

def get_users() -> List[Dict]:
    """Tüm kullanıcıları döner"""
    try:
        db = read_db()
        users = db.get("users", [])
        logger.info(f"Retrieved {len(users)} users")
        return users
    except Exception as e:
        logger.error(f"Error getting users: {e}")
        return []

def add_device(device: Dict):
    """Yeni cihaz ekler, otomatik ID atar"""
    try:
        db = read_db()
        
        # Auto-increment ID
        existing_devices = db.get("devices", [])
        max_id = max([d.get("id", 0) for d in existing_devices], default=0)
        device["id"] = max_id + 1
        
        # Validation
        required_fields = ["name", "ip", "type"]
        for field in required_fields:
            if field not in device or not device[field]:
                raise ValueError(f"Required field '{field}' is missing or empty")
        
        db["devices"].append(device)
        write_db(db)
        
        logger.info(f"Added device: {device['name']} (ID: {device['id']})")
        return device
        
    except Exception as e:
        logger.error(f"Error adding device: {e}")
        raise

def add_user(user: Dict):
    """Yeni kullanıcı ekler, otomatik ID atar"""
    try:
        db = read_db()
        
        # Auto-increment ID
        existing_users = db.get("users", [])
        max_id = max([u.get("id", 0) for u in existing_users], default=0)
        user["id"] = max_id + 1
        
        # Validation
        required_fields = ["username", "role"]
        for field in required_fields:
            if field not in user or not user[field]:
                raise ValueError(f"Required field '{field}' is missing or empty")
        
        # Username unique check
        if any(u.get("username") == user["username"] for u in existing_users):
            raise ValueError(f"Username '{user['username']}' already exists")
        
        db["users"].append(user)
        write_db(db)
        
        logger.info(f"Added user: {user['username']} (ID: {user['id']})")
        return user
        
    except Exception as e:
        logger.error(f"Error adding user: {e}")
        raise

def delete_device(device_id: int):
    """Cihaz siler"""
    try:
        db = read_db()
        devices = db.get("devices", [])
        
        device_to_remove = None
        for i, device in enumerate(devices):
            if device.get("id") == device_id:
                device_to_remove = devices.pop(i)
                break
        
        if device_to_remove is None:
            raise ValueError(f"Device with ID {device_id} not found")
        
        write_db(db)
        logger.info(f"Deleted device: {device_to_remove['name']} (ID: {device_id})")
        return device_to_remove
        
    except Exception as e:
        logger.error(f"Error deleting device: {e}")
        raise

def update_device(device_id: int, updated_data: Dict):
    """Cihaz günceller"""
    try:
        db = read_db()
        devices = db.get("devices", [])
        
        for device in devices:
            if device.get("id") == device_id:
                # ID değiştirilemez
                updated_data.pop("id", None)
                device.update(updated_data)
                write_db(db)
                logger.info(f"Updated device ID {device_id}")
                return device
        
        raise ValueError(f"Device with ID {device_id} not found")
        
    except Exception as e:
        logger.error(f"Error updating device: {e}")
        raise