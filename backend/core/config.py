from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')

    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    SALT: str
    FRONTEND_ORIGINS: str = (
        "http://localhost,http://127.0.0.1,http://localhost:5173,http://127.0.0.1:5173"
    )
    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 8000


settings = Settings()
