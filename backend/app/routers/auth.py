"""
Authentication API Router
backend/app/routers/auth.py
"""

from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import List, Dict, Optional
import jwt
import hashlib
import secrets
from datetime import datetime, timedelta
import logging
import json

# Local imports
from ..json_db import get_users, add_user, update_user, read_db, write_db

router = APIRouter(prefix="/auth", tags=["Authentication"])
logger = logging.getLogger(__name__)

# Security
security = HTTPBearer()
SECRET_KEY = "your-secret-key-change-in-production"  # Production'da environment variable kullanın
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours

# Pydantic models
class LoginRequest(BaseModel):
    username: str
    password: str
    remember_me: Optional[bool] = False

class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: Dict
    expires_in: int

class UserCreate(BaseModel):
    username: str
    password: str
    full_name: str
    email: EmailStr
    role: str = "operator"
    permissions: List[str] = ["device_view"]

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    permissions: Optional[List[str]] = None
    is_active: Optional[bool] = None

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

class UserResponse(BaseModel):
    id: int
    username: str
    full_name: str
    email: str
    role: str
    permissions: List[str]
    is_active: bool
    created_at: str
    last_login: Optional[str] = None

# Demo users - Production'da veritabanından alınacak
DEMO_USERS = {
    "admin": {
        "id": 1,
        "username": "admin",
        "password_hash": "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9",  # admin123
        "full_name": "System Administrator",
        "email": "admin@company.com",
        "role": "administrator",
        "permissions": ["all"],
        "is_active": True,
        "created_at": "2024-01-01T00:00:00Z",
        "last_login": None
    },
    "network": {
        "id": 2,
        "username": "network",
        "password_hash": "ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f",  # network123
        "full_name": "Network Administrator",
        "email": "network@company.com",
        "role": "network_admin",
        "permissions": ["network_read", "network_write", "device_manage"],
        "is_active": True,
        "created_at": "2024-01-01T00:00:00Z",
        "last_login": None
    },
    "support": {
        "id": 3,
        "username": "support",
        "password_hash": "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",  # support123
        "full_name": "Technical Support",
        "email": "support@company.com",
        "role": "support",
        "permissions": ["network_read", "device_view"],
        "is_active": True,
        "created_at": "2024-01-01T00:00:00Z",
        "last_login": None
    },
    "operator": {
        "id": 4,
        "username": "operator",
        "password_hash": "13d249f2cb4127b40cfa757f07a726e6962b5e5a7a1b64b7b6e87e4b9f8c52a4",  # operator123
        "full_name": "Network Operator",
        "email": "operator@company.com",
        "role": "operator",
        "permissions": ["device_view"],
        "is_active": True,
        "created_at": "2024-01-01T00:00:00Z",
        "last_login": None
    }
}

# Helper functions
def hash_password(password: str) -> str:
    """Şifreyi hash'le"""
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    """Şifreyi doğrula"""
    return hash_password(password) == hashed

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """JWT token oluştur"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire, "iat": datetime.utcnow()})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str):
    """JWT token'ı çöz"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired"
        )
    except jwt.JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )

def get_user_by_username(username: str) -> Optional[Dict]:
    """Kullanıcıyı kullanıcı adıyla bul"""
    # Demo implementation - Production'da veritabanından alınacak
    return DEMO_USERS.get(username)

def update_last_login(username: str):
    """Son giriş zamanını güncelle"""
    # Demo implementation - Production'da veritabanını güncelleyecek
    if username in DEMO_USERS:
        DEMO_USERS[username]["last_login"] = datetime.utcnow().isoformat() + "Z"

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Mevcut kullanıcıyı token'dan al"""
    try:
        payload = decode_access_token(credentials.credentials)
        username = payload.get("sub")
        if username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
        
        user = get_user_by_username(username)
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )
        
        return user
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )

def check_permission(user: Dict, required_permission: str) -> bool:
    """Kullanıcının yetkisini kontrol et"""
    if not user.get("is_active", False):
        return False
    
    permissions = user.get("permissions", [])
    return "all" in permissions or required_permission in permissions

def require_permission(permission: str):
    """Yetki kontrolü decorator'ı"""
    async def permission_checker(user: Dict = Depends(get_current_user)):
        if not check_permission(user, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission '{permission}' required"
            )
        return user
    return permission_checker

# Routes

@router.post("/login", response_model=LoginResponse)
async def login(login_data: LoginRequest):
    """Kullanıcı girişi"""
    try:
        user = get_user_by_username(login_data.username)
        
        if not user or not verify_password(login_data.password, user["password_hash"]):
            logger.warning(f"Failed login attempt for username: {login_data.username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Kullanıcı adı veya şifre hatalı"
            )
        
        if not user.get("is_active", False):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Hesap devre dışı"
            )
        
        # JWT token oluştur
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user["username"], "role": user["role"]},
            expires_delta=access_token_expires
        )
        
        # Son giriş zamanını güncelle
        update_last_login(login_data.username)
        
        # Şifreyi response'dan çıkar
        user_data = {k: v for k, v in user.items() if k != "password_hash"}
        user_data["login_time"] = datetime.utcnow().isoformat() + "Z"
        user_data["session_id"] = f"session_{datetime.utcnow().timestamp()}_{secrets.token_hex(8)}"
        
        logger.info(f"Successful login for user: {login_data.username}")
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": user_data,
            "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Giriş işlemi başarısız"
        )

@router.post("/logout")
async def logout(user: Dict = Depends(get_current_user)):
    """Kullanıcı çıkışı"""
    logger.info(f"User logged out: {user['username']}")
    return {"message": "Çıkış başarılı"}

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(user: Dict = Depends(get_current_user)):
    """Mevcut kullanıcı bilgilerini al"""
    user_data = {k: v for k, v in user.items() if k != "password_hash"}
    return user_data

@router.put("/me", response_model=UserResponse)
async def update_current_user(
    user_update: UserUpdate,
    user: Dict = Depends(get_current_user)
):
    """Mevcut kullanıcı bilgilerini güncelle"""
    # Demo implementation - Production'da veritabanını güncelleyecek
    updated_user = user.copy()
    
    if user_update.full_name:
        updated_user["full_name"] = user_update.full_name
    if user_update.email:
        updated_user["email"] = user_update.email
    
    # Role ve permissions sadece admin değiştirebilir
    if user["role"] == "administrator":
        if user_update.role:
            updated_user["role"] = user_update.role
        if user_update.permissions:
            updated_user["permissions"] = user_update.permissions
    
    DEMO_USERS[user["username"]] = updated_user
    
    user_data = {k: v for k, v in updated_user.items() if k != "password_hash"}
    return user_data

@router.post("/change-password")
async def change_password(
    password_data: PasswordChange,
    user: Dict = Depends(get_current_user)
):
    """Şifre değiştir"""
    if not verify_password(password_data.current_password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mevcut şifre yanlış"
        )
    
    if len(password_data.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Yeni şifre en az 6 karakter olmalı"
        )
    
    # Demo implementation - Production'da veritabanını güncelleyecek
    DEMO_USERS[user["username"]]["password_hash"] = hash_password(password_data.new_password)
    
    logger.info(f"Password changed for user: {user['username']}")
    return {"message": "Şifre başarıyla değiştirildi"}

@router.get("/users", response_model=List[UserResponse])
async def list_users(user: Dict = Depends(require_permission("user_manage"))):
    """Tüm kullanıcıları listele (sadece admin)"""
    users_data = []
    for username, user_data in DEMO_USERS.items():
        clean_user = {k: v for k, v in user_data.items() if k != "password_hash"}
        users_data.append(clean_user)
    
    return users_data

@router.post("/users", response_model=UserResponse)
async def create_user(
    user_data: UserCreate,
    current_user: Dict = Depends(require_permission("user_manage"))
):
    """Yeni kullanıcı oluştur (sadece admin)"""
    if user_data.username in DEMO_USERS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kullanıcı adı zaten mevcut"
        )
    
    if len(user_data.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Şifre en az 6 karakter olmalı"
        )
    
    new_user = {
        "id": len(DEMO_USERS) + 1,
        "username": user_data.username,
        "password_hash": hash_password(user_data.password),
        "full_name": user_data.full_name,
        "email": user_data.email,
        "role": user_data.role,
        "permissions": user_data.permissions,
        "is_active": True,
        "created_at": datetime.utcnow().isoformat() + "Z",
        "last_login": None
    }
    
    DEMO_USERS[user_data.username] = new_user
    
    logger.info(f"User created: {user_data.username} by {current_user['username']}")
    
    clean_user = {k: v for k, v in new_user.items() if k != "password_hash"}
    return clean_user

@router.put("/users/{username}", response_model=UserResponse)
async def update_user_by_username(
    username: str,
    user_update: UserUpdate,
    current_user: Dict = Depends(require_permission("user_manage"))
):
    """Kullanıcı bilgilerini güncelle (sadece admin)"""
    if username not in DEMO_USERS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kullanıcı bulunamadı"
        )
    
    target_user = DEMO_USERS[username].copy()
    
    if user_update.full_name:
        target_user["full_name"] = user_update.full_name
    if user_update.email:
        target_user["email"] = user_update.email
    if user_update.role:
        target_user["role"] = user_update.role
    if user_update.permissions:
        target_user["permissions"] = user_update.permissions
    if user_update.is_active is not None:
        target_user["is_active"] = user_update.is_active
    
    DEMO_USERS[username] = target_user
    
    logger.info(f"User updated: {username} by {current_user['username']}")
    
    clean_user = {k: v for k, v in target_user.items() if k != "password_hash"}
    return clean_user

@router.delete("/users/{username}")
async def delete_user(
    username: str,
    current_user: Dict = Depends(require_permission("user_manage"))
):
    """Kullanıcı sil (sadece admin)"""
    if username not in DEMO_USERS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kullanıcı bulunamadı"
        )
    
    if username == current_user["username"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kendi hesabınızı silemezsiniz"
        )
    
    del DEMO_USERS[username]
    
    logger.info(f"User deleted: {username} by {current_user['username']}")
    
    return {"message": f"Kullanıcı {username} başarıyla silindi"}

@router.get("/validate-token")
async def validate_token(user: Dict = Depends(get_current_user)):
    """Token geçerliliğini kontrol et"""
    return {
        "valid": True,
        "user": {k: v for k, v in user.items() if k != "password_hash"},
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }

@router.get("/permissions")
async def get_available_permissions():
    """Mevcut yetkileri listele"""
    return {
        "permissions": [
            {
                "name": "all",
                "description": "Tüm yetkiler",
                "category": "system"
            },
            {
                "name": "network_read",
                "description": "Ağ cihazlarını görüntüleme",
                "category": "network"
            },
            {
                "name": "network_write",
                "description": "Ağ cihazlarını yönetme",
                "category": "network"
            },
            {
                "name": "device_manage",
                "description": "Cihaz ekleme/silme",
                "category": "device"
            },
            {
                "name": "device_view",
                "description": "Cihazları görüntüleme",
                "category": "device"
            },
            {
                "name": "user_manage",
                "description": "Kullanıcı yönetimi",
                "category": "admin"
            },
            {
                "name": "audit_read",
                "description": "Audit loglarını görüntüleme",
                "category": "audit"
            }
        ]
    }

@router.get("/roles")
async def get_available_roles():
    """Mevcut rolleri listele"""
    return {
        "roles": [
            {
                "name": "administrator",
                "description": "Sistem Yöneticisi",
                "default_permissions": ["all"]
            },
            {
                "name": "network_admin",
                "description": "Ağ Yöneticisi",
                "default_permissions": ["network_read", "network_write", "device_manage"]
            },
            {
                "name": "support",
                "description": "Teknik Destek",
                "default_permissions": ["network_read", "device_view"]
            },
            {
                "name": "operator",
                "description": "Operatör",
                "default_permissions": ["device_view"]
            }
        ]
    }

@router.post("/refresh-token")
async def refresh_token(user: Dict = Depends(get_current_user)):
    """Token yenile"""
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["username"], "role": user["role"]},
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60
    }

# Session management
@router.get("/sessions")
async def get_active_sessions(user: Dict = Depends(get_current_user)):
    """Aktif oturumları listele"""
    # Demo implementation - Production'da gerçek session store kullanılacak
    return {
        "sessions": [
            {
                "session_id": f"session_{datetime.utcnow().timestamp()}",
                "user_id": user["id"],
                "created_at": user.get("last_login", datetime.utcnow().isoformat() + "Z"),
                "ip_address": "127.0.0.1",
                "user_agent": "PAM Network Management",
                "is_current": True
            }
        ]
    }

@router.delete("/sessions/{session_id}")
async def revoke_session(
    session_id: str,
    user: Dict = Depends(get_current_user)
):
    """Oturumu sonlandır"""
    # Demo implementation - Production'da session store'dan silinecek
    logger.info(f"Session revoked: {session_id} by {user['username']}")
    return {"message": "Oturum sonlandırıldı"}