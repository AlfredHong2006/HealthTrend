"""The liveness response."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Confirmation that the service is running.

    Deliberately contains no data, no timestamp and no dependency check: the point of a
    liveness endpoint is that it cannot fail for an interesting reason.
    """

    status: Literal["ok"] = "ok"
    version: str = Field(description="The API version.")
