import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    DB_HOST: str = '127.0.0.1'
    DB_PORT: int = 3306
    DB_NAME: str = 'atm_system'
    DB_USER: str = 'root'
    DB_PASSWORD: str = ''
    
    API_PORT: int = 8000
    API_HOST: str = '127.0.0.1'
    JWT_SECRET: str = 'super_secret_jwt_key_here_bank_atm_2026'
    JWT_ALGORITHM: str = 'HS256'
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    
    SERIAL_PORT: str = 'COM3'
    SERIAL_BAUDRATE: int = 115200
    ESP32_IP: str = '192.168.1.50'
    MOCK_HARDWARE: bool = True
    
    TXT_STORAGE_PATH: str = './data/storage_txt/'
    
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000"
    ]
    ALLOW_DEMO_MFA: bool = False

    model_config = SettingsConfigDict(env_file='.env', extra='ignore')

settings = Settings()
