import json
import logging
import os
import re
from typing import Any, Optional
from dotenv import load_dotenv
import openai
from pydantic import BaseModel

# Load environment variables from .env if present
load_dotenv()

logger = logging.getLogger(__name__)


class LLMResult(BaseModel):
    """Result container for LLM completion calls."""
    ok: bool = False
    data: Any = None
    fallback_used: bool = True
    error: Optional[str] = None

    def __init__(
        self,
        ok: bool = False,
        data: Any = None,
        fallback_used: bool = True,
        error: Optional[str] = None,
        **kwargs: Any,
    ):
        super().__init__(ok=ok, data=data, fallback_used=fallback_used, error=error, **kwargs)


def strip_code_fences(text: str) -> str:
    """Strip markdown code fence blocks if present."""
    if not text:
        return ""
    stripped = text.strip()

    # Exact fenced block (```json ... ``` or ``` ... ```)
    fence_pattern = r"^```(?:[a-zA-Z0-9_-]+)?\s*\n?([\s\S]*?)\n?```$"
    match = re.match(fence_pattern, stripped)
    if match:
        return match.group(1).strip()

    # Embedded fenced block inside surrounding text
    embedded_pattern = r"```(?:[a-zA-Z0-9_-]+)?\s*\n?([\s\S]*?)\n?```"
    embedded_match = re.search(embedded_pattern, stripped)
    if embedded_match:
        return embedded_match.group(1).strip()

    return stripped


def get_llm_config() -> dict[str, Any]:
    """Retrieve LLM configuration from backend.config or environment variables."""
    # Check if backend.config has settings defined
    try:
        from backend import config
        enabled = getattr(config, "LLM_ENABLED", None)
        api_key = getattr(config, "XAI_API_KEY", None)
        base_url = getattr(config, "XAI_BASE_URL", None)
        model = getattr(config, "XAI_MODEL", None)
        timeout = getattr(config, "LLM_TIMEOUT_SECONDS", None)
    except (ImportError, Exception):
        enabled, api_key, base_url, model, timeout = None, None, None, None, None

    # Fall back to environment variables
    if enabled is None:
        val = os.getenv("LLM_ENABLED", "true").strip().lower()
        enabled = val not in ("false", "0", "no", "off")

    if api_key is None:
        api_key = os.getenv("XAI_API_KEY", "")

    if base_url is None:
        base_url = os.getenv("XAI_BASE_URL", "https://api.x.ai/v1")

    if model is None:
        model = os.getenv("XAI_MODEL", "grok-4-1-fast-non-reasoning")

    if timeout is None:
        try:
            timeout = float(os.getenv("LLM_TIMEOUT_SECONDS", "8"))
        except (ValueError, TypeError):
            timeout = 8.0

    return {
        "enabled": enabled,
        "api_key": api_key,
        "base_url": base_url,
        "model": model,
        "timeout": timeout,
    }


class LLMClient:
    """Client for xAI Grok (OpenAI-compatible API) with strict fallback and safety."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        timeout: Optional[float] = None,
        enabled: Optional[bool] = None,
    ):
        self._base_url = base_url
        self._api_key = api_key
        self._model = model
        self._timeout = timeout
        self._enabled = enabled

    @property
    def enabled(self) -> bool:
        if self._enabled is not None:
            return self._enabled
        return bool(get_llm_config()["enabled"])

    @property
    def api_key(self) -> str:
        if self._api_key is not None:
            return self._api_key
        return str(get_llm_config()["api_key"])

    @property
    def base_url(self) -> str:
        if self._base_url is not None:
            return self._base_url
        return str(get_llm_config()["base_url"])

    @property
    def model(self) -> str:
        if self._model is not None:
            return self._model
        return str(get_llm_config()["model"])

    @property
    def timeout(self) -> float:
        if self._timeout is not None:
            return self._timeout
        return float(get_llm_config()["timeout"])

    def complete_json(
        self,
        system: str,
        user: str,
        schema_hint: Optional[str] = None,
    ) -> LLMResult:
        """
        Request JSON completion from LLM.
        Returns LLMResult(ok, data, fallback_used, error).
        Never raises. Never logs sensitive keys or secret contents.
        """
        if not self.enabled:
            return LLMResult(
                ok=False,
                data=None,
                fallback_used=True,
                error="LLM is disabled (LLM_ENABLED=false)",
            )

        if not self.api_key or not self.api_key.strip():
            return LLMResult(
                ok=False,
                data=None,
                fallback_used=True,
                error="LLM API key is empty",
            )

        try:
            client = openai.OpenAI(
                base_url=self.base_url,
                api_key=self.api_key,
                timeout=self.timeout,
            )

            system_prompt = system
            if schema_hint:
                system_prompt = f"{system}\nExpected JSON structure:\n{schema_hint}"
            system_prompt += "\nYou must output valid JSON only."

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user},
            ]

            response = client.chat.completions.create(
                model=self.model,
                messages=messages,
                response_format={"type": "json_object"},
            )

            if not response.choices:
                return LLMResult(
                    ok=False,
                    data=None,
                    fallback_used=True,
                    error="Empty response choices from LLM",
                )

            choice = response.choices[0]
            raw_content = choice.message.content or ""
            cleaned_content = strip_code_fences(raw_content)

            try:
                data = json.loads(cleaned_content)
                return LLMResult(
                    ok=True,
                    data=data,
                    fallback_used=False,
                    error=None,
                )
            except (json.JSONDecodeError, ValueError) as json_err:
                logger.warning("LLM response JSON parsing failed: %s", str(json_err))
                return LLMResult(
                    ok=False,
                    data=None,
                    fallback_used=True,
                    error=f"Invalid JSON: {json_err}",
                )

        except openai.APITimeoutError as e:
            logger.warning("LLM request timed out")
            return LLMResult(
                ok=False,
                data=None,
                fallback_used=True,
                error=f"Timeout: {e}",
            )
        except openai.APIStatusError as e:
            status_code = getattr(e, "status_code", "unknown")
            logger.warning("LLM HTTP error: status_code=%s", status_code)
            return LLMResult(
                ok=False,
                data=None,
                fallback_used=True,
                error=f"HTTP {status_code}: {e}",
            )
        except Exception as e:
            logger.warning("LLM call failed: %s", type(e).__name__)
            return LLMResult(
                ok=False,
                data=None,
                fallback_used=True,
                error=str(e),
            )


def complete_json(
    system: str,
    user: str,
    schema_hint: Optional[str] = None,
) -> LLMResult:
    """Convenience module-level function using default LLMClient."""
    return LLMClient().complete_json(system=system, user=user, schema_hint=schema_hint)
