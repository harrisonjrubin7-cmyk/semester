from __future__ import annotations

from typing import Protocol, TypeVar

from pydantic import BaseModel

from app.llm.schemas import FactList, GeneratedAsset

T = TypeVar("T", bound=BaseModel)


class StructuredLLMClient(Protocol):
    def complete_json(self, *, system: str, user: str, response_model: type[T]) -> T: ...


class DevelopmentFakeLLM:
    """Deterministic offline adapter. It never manufactures course facts."""

    def complete_json(self, *, system: str, user: str, response_model: type[T]) -> T:
        if response_model is FactList:
            return response_model.model_validate({"facts": []})
        if response_model is GeneratedAsset:
            return response_model.model_validate({
                "title": "Draft study asset", "sections": [], "items": [],
                "gaps": ["No confirmed, citation-linked source evidence was supplied."],
            })
        raise ValueError(f"Fake LLM has no fixture for {response_model.__name__}")


class ProviderAdapterPlaceholder:
    def __init__(self, api_key: str | None, model: str) -> None:
        self.api_key, self.model = api_key, model

    def complete_json(self, *, system: str, user: str, response_model: type[T]) -> T:
        raise RuntimeError("Configure a production structured-output provider adapter")
