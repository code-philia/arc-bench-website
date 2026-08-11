from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml


MODEL_OPTIONS = (
    "gpt-5.5",
    "gpt-5.6",
    "deepseek-v4-flash",
    "deepseek-v4-pro",
    "kimi-k3",
)
DEFAULT_MODEL_NAME = "gpt-5.6"


@dataclass(frozen=True)
class ModelProvider:
    name: str
    openai_api_key: str
    openai_base_url: str
    model: str


@dataclass(frozen=True)
class VisualProvider:
    api_key: str
    base_url: str
    model: str


class ModelProviderService:
    """Load the server-only model credentials used for runner containers."""

    def __init__(self, config_path: Path) -> None:
        self.config_path = Path(config_path)
        self._payload = self._load_payload()

    def resolve_model(self, model_name: str | None) -> ModelProvider:
        normalized = str(model_name or "").strip()
        if not normalized:
            raise ValueError("Choose a model before creating a submission")
        if normalized not in MODEL_OPTIONS:
            raise ValueError(f"Unsupported model: {normalized}")

        models = self._require_mapping(self._payload.get("models"), "models")
        model_payload = self._require_mapping(models.get(normalized), f"models.{normalized}")
        return ModelProvider(
            name=normalized,
            openai_api_key=self._require_value(model_payload, "OPENAI_API_KEY", f"models.{normalized}"),
            openai_base_url=self._require_value(model_payload, "OPENAI_BASE_URL", f"models.{normalized}"),
            model=self._require_value(model_payload, "MODEL", f"models.{normalized}"),
        )

    def resolve_visual_provider(self) -> VisualProvider:
        visual = self._require_mapping(self._payload.get("visual"), "visual")
        return VisualProvider(
            api_key=self._require_value(visual, "VISUAL_API_KEY", "visual"),
            base_url=self._require_value(visual, "VISUAL_BASE_URL", "visual"),
            model=self._require_value(visual, "VISUAL_MODEL", "visual"),
        )

    def build_container_environment(self, model_name: str | None) -> dict[str, str]:
        model = self.resolve_model(model_name)
        visual = self.resolve_visual_provider()
        return {
            "OPENAI_API_KEY": model.openai_api_key,
            "OPENAI_BASE_URL": model.openai_base_url,
            "MODEL": model.model,
            "VISUAL_API_KEY": visual.api_key,
            "VISUAL_BASE_URL": visual.base_url,
            "VISUAL_MODEL": visual.model,
            "ARC_DEBUG": "1",
        }

    def get_runner_dns_servers(self) -> list[str]:
        environment = self._require_mapping(self._payload.get("environment"), "environment")
        raw_value = environment.get("ARCBENCH_RUNNER_DNS_SERVERS", [])
        if isinstance(raw_value, list):
            return [str(item).strip() for item in raw_value if str(item).strip()]
        return [item.strip() for item in str(raw_value or "").replace(",", " ").split() if item.strip()]

    def _load_payload(self) -> dict[str, Any]:
        if not self.config_path.is_file():
            raise RuntimeError(
                f"Model provider configuration is missing: {self.config_path}. "
                "Copy config.example.yaml to config.yaml and fill in the credentials."
            )
        try:
            payload = yaml.safe_load(self.config_path.read_text(encoding="utf-8"))
        except yaml.YAMLError as exc:
            raise RuntimeError(f"Model provider configuration is invalid YAML: {self.config_path}") from exc
        if not isinstance(payload, dict):
            raise RuntimeError(f"Model provider configuration must be a YAML mapping: {self.config_path}")
        return payload

    @staticmethod
    def _require_mapping(value: object, label: str) -> dict[str, Any]:
        if not isinstance(value, dict):
            raise RuntimeError(f"Model provider configuration is missing the '{label}' mapping")
        return value

    @staticmethod
    def _require_value(payload: dict[str, Any], key: str, label: str) -> str:
        value = str(payload.get(key) or "").strip()
        if not value or value.startswith("CHANGE_ME"):
            raise RuntimeError(f"Model provider configuration requires {label}.{key}")
        return value
