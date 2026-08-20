"""Channel adapter base + shared types."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from app.schemas import InboundMessage, OutboundMessage


class ChannelAdapter(ABC):
    """Normalize inbound payloads and send outbound replies."""

    @abstractmethod
    def to_inbound(self, payload: dict[str, Any]) -> list[InboundMessage]:
        """Parse provider webhook payload into zero or more InboundMessage."""

    @abstractmethod
    async def send_outbound(self, message: OutboundMessage) -> bool:
        """Deliver a reply via the channel API (may be stubbed). True = sent."""
