import sys
from pathlib import Path
import json
import pytest
import httpx
import openai
from unittest.mock import MagicMock

# Ensure repo root is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from backend.services.llm import LLMClient, LLMResult, strip_code_fences, complete_json


def test_strip_code_fences():
    # Plain JSON
    assert strip_code_fences('{"a": 1}') == '{"a": 1}'
    
    # Fenced with json
    fenced_json = '```json\n{"a": 1}\n```'
    assert strip_code_fences(fenced_json) == '{"a": 1}'

    # Fenced without language
    fenced_plain = '```\n{"a": 1}\n```'
    assert strip_code_fences(fenced_plain) == '{"a": 1}'

    # Embedded in conversational response
    embedded = 'Here is your data:\n```json\n{"a": 1}\n```\nHope that helps!'
    assert strip_code_fences(embedded) == '{"a": 1}'


def test_llm_result_initialization():
    # Positional args
    r1 = LLMResult(True, {"key": "val"}, False, None)
    assert r1.ok is True
    assert r1.data == {"key": "val"}
    assert r1.fallback_used is False
    assert r1.error is None

    # Keyword args
    r2 = LLMResult(ok=False, fallback_used=True, error="Some error")
    assert r2.ok is False
    assert r2.data is None
    assert r2.fallback_used is True
    assert r2.error == "Some error"


def test_llm_disabled(monkeypatch):
    monkeypatch.setenv("LLM_ENABLED", "false")
    monkeypatch.setenv("XAI_API_KEY", "dummy-key")

    client = LLMClient()
    result = client.complete_json(system="System prompt", user="User input")

    assert result.ok is False
    assert result.fallback_used is True
    assert result.data is None
    assert "disabled" in result.error.lower()


def test_llm_no_key(monkeypatch):
    monkeypatch.setenv("LLM_ENABLED", "true")
    monkeypatch.setenv("XAI_API_KEY", "")

    client = LLMClient()
    result = client.complete_json(system="System prompt", user="User input")

    assert result.ok is False
    assert result.fallback_used is True
    assert result.data is None
    assert "empty" in result.error.lower()


def test_llm_timeout(monkeypatch):
    monkeypatch.setenv("LLM_ENABLED", "true")
    monkeypatch.setenv("XAI_API_KEY", "test-key")

    # Mock OpenAI client create method to raise APITimeoutError
    def mock_create(*args, **kwargs):
        raise openai.APITimeoutError(request=httpx.Request("POST", "https://api.x.ai/v1/chat/completions"))

    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = mock_create
    monkeypatch.setattr(openai, "OpenAI", lambda *args, **kwargs: mock_client)

    client = LLMClient()
    result = client.complete_json(system="System", user="User")

    assert result.ok is False
    assert result.fallback_used is True
    assert result.data is None
    assert "timeout" in result.error.lower()


def test_llm_http_401(monkeypatch):
    monkeypatch.setenv("LLM_ENABLED", "true")
    monkeypatch.setenv("XAI_API_KEY", "bad-key")

    def mock_create(*args, **kwargs):
        response = httpx.Response(status_code=401, request=httpx.Request("POST", "https://api.x.ai/v1/chat/completions"))
        raise openai.AuthenticationError(
            message="Invalid API Key",
            response=response,
            body={"error": "unauthorized"}
        )

    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = mock_create
    monkeypatch.setattr(openai, "OpenAI", lambda *args, **kwargs: mock_client)

    client = LLMClient()
    result = client.complete_json(system="System", user="User")

    assert result.ok is False
    assert result.fallback_used is True
    assert result.data is None
    assert "401" in result.error


def test_llm_invalid_json(monkeypatch):
    monkeypatch.setenv("LLM_ENABLED", "true")
    monkeypatch.setenv("XAI_API_KEY", "test-key")

    mock_choice = MagicMock()
    mock_choice.message.content = "Sorry, I am not generating JSON for you: {malformed"
    mock_response = MagicMock(choices=[mock_choice])

    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = mock_response
    monkeypatch.setattr(openai, "OpenAI", lambda *args, **kwargs: mock_client)

    client = LLMClient()
    result = client.complete_json(system="System", user="User")

    assert result.ok is False
    assert result.fallback_used is True
    assert result.data is None
    assert "invalid json" in result.error.lower()


def test_llm_valid_json(monkeypatch):
    monkeypatch.setenv("LLM_ENABLED", "true")
    monkeypatch.setenv("XAI_API_KEY", "test-key")

    mock_choice = MagicMock()
    mock_choice.message.content = '{"incident": "I1", "severity": 4, "confirmed": true}'
    mock_response = MagicMock(choices=[mock_choice])

    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = mock_response
    monkeypatch.setattr(openai, "OpenAI", lambda *args, **kwargs: mock_client)

    client = LLMClient()
    result = client.complete_json(system="System", user="User", schema_hint='{"incident": str}')

    assert result.ok is True
    assert result.fallback_used is False
    assert result.data == {"incident": "I1", "severity": 4, "confirmed": True}
    assert result.error is None


def test_llm_valid_json_with_code_fences(monkeypatch):
    monkeypatch.setenv("LLM_ENABLED", "true")
    monkeypatch.setenv("XAI_API_KEY", "test-key")

    mock_choice = MagicMock()
    mock_choice.message.content = '```json\n{\n  "status": "ready",\n  "count": 10\n}\n```'
    mock_response = MagicMock(choices=[mock_choice])

    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = mock_response
    monkeypatch.setattr(openai, "OpenAI", lambda *args, **kwargs: mock_client)

    result = complete_json(system="System", user="User")

    assert result.ok is True
    assert result.fallback_used is False
    assert result.data == {"status": "ready", "count": 10}
    assert result.error is None


def test_llm_never_raises_on_unexpected_exception(monkeypatch):
    monkeypatch.setenv("LLM_ENABLED", "true")
    monkeypatch.setenv("XAI_API_KEY", "test-key")

    def mock_create(*args, **kwargs):
        raise RuntimeError("Severe internal driver crash")

    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = mock_create
    monkeypatch.setattr(openai, "OpenAI", lambda *args, **kwargs: mock_client)

    client = LLMClient()
    result = client.complete_json(system="System", user="User")

    assert result.ok is False
    assert result.fallback_used is True
    assert result.data is None
    assert "Severe internal driver crash" in result.error
