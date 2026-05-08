"""
Swappable LLM adapter.
Isti interface za OpenAI, Anthropic i lokalni Ollama.
"""

import json
import logging
from abc import ABC, abstractmethod
from typing import Any

logger = logging.getLogger(__name__)


class BaseLLMProvider(ABC):
    @abstractmethod
    def complete(self, messages: list[dict[str, str]], response_format: str = "json") -> str:
        ...


class OpenAIProvider(BaseLLMProvider):
    def __init__(self, model: str, api_key: str):
        from openai import OpenAI
        self._client = OpenAI(api_key=api_key)
        self.model = model

    def complete(self, messages: list[dict[str, str]], response_format: str = "json") -> str:
        kwargs: dict[str, Any] = {"model": self.model, "messages": messages, "temperature": 0.3}
        if response_format == "json":
            kwargs["response_format"] = {"type": "json_object"}
        response = self._client.chat.completions.create(**kwargs)
        return response.choices[0].message.content or ""


class AnthropicProvider(BaseLLMProvider):
    def __init__(self, model: str, api_key: str):
        import anthropic
        self._client = anthropic.Anthropic(api_key=api_key)
        self.model = model

    def complete(self, messages: list[dict[str, str]], response_format: str = "json") -> str:
        # Odvoji system message od user/assistant poruka
        system = ""
        chat_messages = []
        for m in messages:
            if m["role"] == "system":
                system = m["content"]
            else:
                chat_messages.append(m)

        json_hint = "\n\nVrati ISKLJUČIVO validan JSON objekat, bez teksta izvan JSON-a." if response_format == "json" else ""
        response = self._client.messages.create(
            model=self.model,
            max_tokens=4096,
            system=system + json_hint,
            messages=chat_messages,
        )
        return response.content[0].text


class OllamaProvider(BaseLLMProvider):
    """Lokalni LLM putem Ollama (OpenAI-compatible API)."""

    def __init__(self, model: str, base_url: str = "http://localhost:11434/v1"):
        from openai import OpenAI
        self._client = OpenAI(api_key="ollama", base_url=base_url)
        self.model = model

    def complete(self, messages: list[dict[str, str]], response_format: str = "json") -> str:
        response = self._client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=0.3,
        )
        return response.choices[0].message.content or ""


_PROVIDERS = {
    "openai": OpenAIProvider,
    "anthropic": AnthropicProvider,
    "local": OllamaProvider,
}


class LLMClient:
    def __init__(self, provider: BaseLLMProvider):
        self._provider = provider

    @classmethod
    def from_settings(cls) -> "LLMClient":
        from app.config import settings
        provider_cls = _PROVIDERS.get(settings.LLM_PROVIDER)
        if not provider_cls:
            raise ValueError(f"Nepoznati LLM_PROVIDER: {settings.LLM_PROVIDER}")

        if settings.LLM_PROVIDER == "local":
            provider = OllamaProvider(model=settings.LLM_MODEL)
        elif settings.LLM_PROVIDER == "anthropic":
            provider = AnthropicProvider(model=settings.LLM_MODEL, api_key=settings.OPENAI_API_KEY)
        else:
            provider = OpenAIProvider(model=settings.LLM_MODEL, api_key=settings.OPENAI_API_KEY)

        return cls(provider)

    def complete_json(self, messages: list[dict[str, str]]) -> dict:
        raw = self._provider.complete(messages, response_format="json")
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            logger.warning("LLM nije vratio validan JSON, pokušavam ručno parsirati")
            # Pokušaj izvući JSON iz teksta
            import re
            match = re.search(r"\{.*\}", raw, re.DOTALL)
            if match:
                return json.loads(match.group())
            raise ValueError(f"LLM response nije validan JSON: {raw[:200]}")

    def complete_text(self, messages: list[dict[str, str]]) -> str:
        return self._provider.complete(messages, response_format="text")
