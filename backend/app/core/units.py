"""Unit conversions and prior-interpretation helpers.

The numerical core works in exactly one system of units:

* weight in kilograms (``kg``)
* time in fractional days (``day``)
* trend velocity in ``kg/day``
* process-noise intensity in ``kg * day**-1.5`` (see :func:`sigma_accel_from_weekly_rate_drift`)

Every conversion to or from anything else -- pounds, weeks, human-readable priors --
lives in this module and nowhere else, so no other part of the core has to reason
about units. This module has no dependencies.
"""

from __future__ import annotations

import math
from typing import Final

KG_PER_LB: Final = 0.45359237
"""Exact international avoirdupois pound, by definition."""

DAYS_PER_WEEK: Final = 7.0

_SQRT_DAYS_PER_WEEK: Final = math.sqrt(DAYS_PER_WEEK)


def lb_to_kg(pounds: float) -> float:
    """Convert pounds to kilograms."""
    return pounds * KG_PER_LB


def kg_to_lb(kilograms: float) -> float:
    """Convert kilograms to pounds."""
    return kilograms / KG_PER_LB


def per_day_to_per_week(rate_kg_per_day: float) -> float:
    """Convert a rate in kg/day to the kg/week figure shown to users (master plan section 17)."""
    return rate_kg_per_day * DAYS_PER_WEEK


def per_week_to_per_day(rate_kg_per_week: float) -> float:
    """Convert a rate in kg/week to the kg/day used internally."""
    return rate_kg_per_week / DAYS_PER_WEEK


def sigma_accel_from_weekly_rate_drift(drift_kg_per_week_per_week: float) -> float:
    """Convert a human-readable process-noise prior into ``sigma_accel``.

    ``sigma_accel`` has units of ``kg * day**-1.5``, which nobody can sanity-check by
    eye. This helper lets the prior be stated in product terms instead:

        "the weekly rate of change can itself wander by ``d`` kg/week over the
        course of one week"

    Under the continuous white-noise-acceleration model, velocity is a Wiener process
    with diffusion coefficient ``sigma_accel``, so the standard deviation of the change
    in velocity across an interval of ``dt`` days is ``sigma_accel * sqrt(dt)`` kg/day.
    Taking ``dt = 7`` days and expressing the result as a weekly rate (multiplying
    kg/day by 7) gives::

        d = 7 * sigma_accel * sqrt(7)

    and therefore ``sigma_accel = d / (7 * sqrt(7))``.

    Args:
        drift_kg_per_week_per_week: how far the weekly rate may drift in one week.

    Returns:
        The equivalent ``sigma_accel`` in ``kg * day**-1.5``.
    """
    return drift_kg_per_week_per_week / (DAYS_PER_WEEK * _SQRT_DAYS_PER_WEEK)


def weekly_rate_drift_from_sigma_accel(sigma_accel: float) -> float:
    """Inverse of :func:`sigma_accel_from_weekly_rate_drift`."""
    return sigma_accel * DAYS_PER_WEEK * _SQRT_DAYS_PER_WEEK
