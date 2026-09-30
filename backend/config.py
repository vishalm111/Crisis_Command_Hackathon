import os
from pathlib import Path
from typing import List
from dotenv import load_dotenv

# Load .env file from project root if it exists
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(_PROJECT_ROOT / ".env")


class Settings:
    """Application settings read strictly from environment variables.
    
    Hard rule: XAI_API_KEY is never logged or printed.
    """

    def __init__(self) -> None:
        raw_llm = os.getenv("LLM_ENABLED", "false").strip().lower()
        self.llm_enabled: bool = raw_llm in ("true", "1", "yes", "on")
        self.xai_api_key: str = os.getenv("XAI_API_KEY", "").strip()
        self.xai_base_url: str = os.getenv("XAI_BASE_URL", "https://api.x.ai/v1").strip()
        self.xai_model: str = os.getenv("XAI_MODEL", "grok-4-1-fast-non-reasoning").strip()

        try:
            self.llm_timeout_seconds: float = float(os.getenv("LLM_TIMEOUT_SECONDS", "8.0"))
        except ValueError:
            self.llm_timeout_seconds = 8.0

        port_val = os.getenv("PORT") or os.getenv("BACKEND_PORT", "8000")
        try:
            self.backend_port: int = int(port_val)
        except ValueError:
            self.backend_port = 8000

        raw_cors = os.getenv("CORS_ORIGINS", "*")
        if raw_cors == "*":
            self.cors_origins: List[str] = ["*"]
        else:
            self.cors_origins: List[str] = [
                origin.strip() for origin in raw_cors.split(",") if origin.strip()
            ]
            if "*" not in self.cors_origins:
                # Always ensure localhost dev origins are present
                for dev_orig in ("http://localhost:5173", "http://localhost:3000"):
                    if dev_orig not in self.cors_origins:
                        self.cors_origins.append(dev_orig)

    def __repr__(self) -> str:
        # Never log or expose API key in representations
        return (
            f"Settings(llm_enabled={self.llm_enabled}, "
            f"xai_api_key='***', "
            f"xai_base_url='{self.xai_base_url}', "
            f"xai_model='{self.xai_model}', "
            f"llm_timeout_seconds={self.llm_timeout_seconds}, "
            f"backend_port={self.backend_port}, "
            f"cors_origins={self.cors_origins})"
        )


_settings_instance: Settings | None = None


def get_settings() -> Settings:
    global _settings_instance
    if _settings_instance is None:
        _settings_instance = Settings()
    return _settings_instance


# Convenience exports
def is_llm_enabled() -> bool:
    s = get_settings()
    return s.llm_enabled and bool(s.xai_api_key)
