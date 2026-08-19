"""Shared fixtures for the core test suite."""

from __future__ import annotations

import pytest

from app.core.types import ModelParams


@pytest.fixture
def params() -> ModelParams:
    """The documented default priors, which most tests exercise."""
    return ModelParams.default()


@pytest.fixture
def loose_params() -> ModelParams:
    """Parameters that adapt fast, for tests that need a responsive filter."""
    return ModelParams.from_interpretable_priors(
        sigma_obs_kg=0.3,
        weekly_rate_drift_kg_per_week=1.0,
        initial_weekly_rate_spread_kg_per_week=2.0,
    )
