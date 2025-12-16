from app.config import settings
from app.services.ai.base import AIProvider


class AIProviderFactory:
    """Factory for creating AI provider instances."""

    @staticmethod
    def create(provider_name: str | None = None) -> AIProvider:
        """
        Create an AI provider instance.

        Args:
            provider_name: Provider to use. Defaults to config DEFAULT_AI_PROVIDER.

        Returns:
            AIProvider instance

        Raises:
            ValueError: If provider name is unknown
        """
        name = provider_name or settings.DEFAULT_AI_PROVIDER

        if name == "mock":
            from app.services.ai.mock import MockProvider
            return MockProvider()

        elif name == "gemini":
            from app.services.ai.gemini import GeminiProvider
            return GeminiProvider()

        elif name == "openai":
            # Placeholder for future implementation
            raise ValueError("OpenAI provider not yet implemented")

        elif name == "anthropic":
            # Placeholder for future implementation
            raise ValueError("Anthropic provider not yet implemented")

        else:
            raise ValueError(f"Unknown AI provider: {name}")
