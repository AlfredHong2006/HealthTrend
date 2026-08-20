"""The analysis request and response contract.

The request is deliberately narrow: timestamped weights, a unit, and a choice of forecast
origin. There is no goal field, because goal projection is a later milestone and the
estimator is structurally goal-neutral (master plan section 4). There is no model-parameter
field either, because the priors are unfitted and inviting callers to tune them would imply
an accuracy claim the project has not earned (``docs/privacy.md``).

Validation here is structural only -- types, bounds, list length, timezone-awareness --
because a Pydantic validation failure is reported back to the caller and must never carry a
submitted value. Domain rules that need to look at the series as a whole, such as a
measurement dated in the future, belong to :mod:`app.services.analysis`, where the response
message comes from an explicit table instead of an exception string.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, Final, Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

from app.core.time_axis import DEFAULT_TIME_AXIS
from app.core.types import (
    AnalysisResult,
    ForecastPoint,
    ModelParams,
    Observation,
    StateEstimate,
)

MAX_OBSERVATIONS: Final = 10_000
"""Largest series accepted in one request.

Ten years of weighing in five times a day is roughly 18,000 readings, so this covers any
plausible personal history while bounding the work one request can cause.
"""

FORECAST_HORIZONS_DAYS: Final = (7.0, 30.0, 90.0)
"""The three published horizons (master plan section 9). Fixed, not caller-selectable.

30 days is the primary consumer forecast; 7 gives short-term trajectory; 90 shows
direction while visibly carrying much greater uncertainty.
"""

MAX_HORIZON_DAYS: Final = max(FORECAST_HORIZONS_DAYS)
"""The furthest horizon, and therefore how far the forecast path is drawn."""

FORECAST_STEP_DAYS: Final = 1.0
"""Granularity of the forecast band.

Daily points, so every published horizon lands on the grid exactly and can be read back
with :meth:`app.core.types.ForecastResult.point_at`.
"""

MAX_OBSERVATION_TIMESTAMP: Final = datetime(9999, 1, 1, tzinfo=UTC)
"""Latest observation timestamp accepted.

An arithmetic bound, not a claim about plausible data. Python datetimes end at
9999-12-31, and a forecast propagates the state up to :data:`MAX_HORIZON_DAYS` past an
observation, so a timestamp too close to that ceiling makes the propagation arithmetic
overflow -- which would surface as a 500 on a syntactically valid request. This bound
keeps ``timestamp + MAX_HORIZON_DAYS`` representable with almost a year of margin.
Rejection happens in validation, where the caller learns which field was wrong.
"""

ForecastFrom = Literal["now", "last_observation"]
"""Which instant forecast horizons are measured from."""

AnalysisSource = Literal["submitted", "demo"]
"""Where the analysed observations came from, as far as the server can know.

``demo`` means this API generated them: a synthetic scenario, never a measurement.
``submitted`` means the caller provided them; the server cannot know their provenance, so
this value deliberately claims nothing about whether they are real or synthetic.
"""


class ObservationIn(BaseModel):
    """One submitted weight measurement."""

    model_config = ConfigDict(extra="forbid")

    timestamp: AwareDatetime = Field(
        le=MAX_OBSERVATION_TIMESTAMP,
        description=(
            "ISO-8601 instant of the weigh-in. Must carry a timezone offset, and must not "
            "be so late that a 90-day forecast from it is unrepresentable."
        ),
    )
    weight: float = Field(
        gt=0.0,
        allow_inf_nan=False,
        description="The measured value, in the unit given by the unit field.",
    )
    unit: Literal["kg", "lb"] = Field(default="kg", description="Unit of the weight field.")


class AnalysisRequest(BaseModel):
    """A series of weigh-ins to analyse."""

    model_config = ConfigDict(extra="forbid")

    observations: list[ObservationIn] = Field(
        min_length=1,
        max_length=MAX_OBSERVATIONS,
        description="Weigh-ins in any order; they are sorted chronologically on ingestion.",
    )
    forecast_from: ForecastFrom = Field(
        default="now",
        description=(
            "The value now measures horizons from the current instant, so a stale series "
            "carries the extra elapsed uncertainty. The value last_observation measures "
            "them from the final weigh-in."
        ),
    )


class ModelParamsOut(BaseModel):
    """The model parameters used, echoed for transparency.

    These are documented priors, not values fitted to this or any data. They are published
    so that a caller can see what produced the numbers, not so that they can be tuned.
    """

    sigma_obs_kg: float
    sigma_accel: float
    sigma_v0: float
    weekly_rate_drift_kg_per_week: float
    initial_weekly_rate_spread_kg_per_week: float

    @classmethod
    def from_core(cls, params: ModelParams) -> ModelParamsOut:
        """Adapt :class:`app.core.types.ModelParams`."""
        return cls(**params.to_dict())


class ObservationOut(BaseModel):
    """One normalised observation, in kilograms and UTC."""

    timestamp: datetime
    weight_kg: float

    @classmethod
    def from_core(cls, observation: Observation) -> ObservationOut:
        """Adapt :class:`app.core.types.Observation`."""
        return cls(timestamp=observation.timestamp, weight_kg=observation.weight_kg)


class TrajectoryPointOut(BaseModel):
    """One point on the estimated latent-weight path."""

    timestamp: datetime
    w_kg: float
    w_sd: float
    w_lower95: float
    w_upper95: float


class CurrentEstimateOut(BaseModel):
    """The estimate as of the last observation: weight, uncertainty and weekly rate."""

    timestamp: datetime
    w_kg: float
    w_sd: float
    w_lower95: float
    w_upper95: float
    weekly_rate_kg: float
    weekly_rate_sd_kg: float

    @classmethod
    def from_core(cls, state: StateEstimate) -> CurrentEstimateOut:
        """Adapt :class:`app.core.types.StateEstimate`.

        The raw velocity in kg/day and the state covariance are deliberately not
        published: users think in kg/week (master plan section 17), and the covariance
        belongs to the model inspector of section 51.
        """
        lower, upper = state.w_ci95
        return cls(
            timestamp=state.timestamp,
            w_kg=state.w_kg,
            w_sd=state.w_sd,
            w_lower95=lower,
            w_upper95=upper,
            weekly_rate_kg=state.weekly_rate_kg,
            weekly_rate_sd_kg=state.weekly_rate_sd_kg,
        )


class ForecastPointOut(BaseModel):
    """The predictive distribution of latent weight at one horizon."""

    timestamp: datetime
    horizon_days: float
    w_kg: float
    w_sd: float
    w_lower95: float
    w_upper95: float

    @classmethod
    def from_core(cls, point: ForecastPoint) -> ForecastPointOut:
        """Adapt :class:`app.core.types.ForecastPoint`."""
        return cls(
            timestamp=point.timestamp,
            horizon_days=point.horizon_days,
            w_kg=point.w_kg,
            w_sd=point.w_sd,
            w_lower95=point.w_lower95,
            w_upper95=point.w_upper95,
        )


class ForecastOut(BaseModel):
    """The forecast, and enough context to label it honestly.

    Three quantities matter here and all three are published. ``origin_timestamp`` is what
    the horizons are measured from; ``last_observation_timestamp`` is the most recent real
    measurement; ``lead_days`` is the gap between them. A client that renders "30-day
    forecast" without knowing the lead cannot tell the user whether that means 30 days from
    their last weigh-in or 30 days from today (ADR-0005).
    """

    origin_timestamp: datetime
    last_observation_timestamp: datetime
    lead_days: float
    includes_observation_noise: bool
    horizons: list[ForecastPointOut]
    path: list[ForecastPointOut]


class AnalysisMetaOut(BaseModel):
    """Statements about what the numbers mean, so that a client need not assume."""

    source: AnalysisSource = Field(
        description=(
            "Where the observations came from. demo: generated by this API, synthetic by "
            "construction. submitted: provided by the caller; the server cannot know "
            "their provenance and makes no claim about it."
        )
    )
    filtered_not_smoothed: bool = Field(
        default=True,
        description=(
            "The trajectory is the online estimate: each point reflects only the data "
            "available at that instant, so it never changes retroactively (ADR-0005)."
        ),
    )
    interval_describes: Literal["latent_weight"] = Field(
        default="latent_weight",
        description=(
            "Intervals describe the underlying weight, not what a scale would read. The "
            "latter is wider by the measurement variance and answers a different question."
        ),
    )


class AnalysisResponse(BaseModel):
    """Everything the analysis produces from a series of weigh-ins."""

    n_obs: int
    span_days: float
    params: ModelParamsOut
    observations: list[ObservationOut]
    trajectory: list[TrajectoryPointOut]
    current: CurrentEstimateOut
    forecast: ForecastOut
    meta: AnalysisMetaOut

    @classmethod
    def from_result(cls, result: AnalysisResult, *, source: AnalysisSource) -> AnalysisResponse:
        """Adapt an :class:`app.core.types.AnalysisResult` for the wire."""
        return cls(**analysis_fields(result, source=source))


def analysis_fields(result: AnalysisResult, *, source: AnalysisSource) -> dict[str, Any]:
    """Build the common response fields, so that subclasses can extend them.

    A function rather than a classmethod because
    :class:`app.schemas.demo.DemoAnalysisResponse` adds scenario provenance to this same
    field set, and round-tripping through ``model_dump`` to do that would revalidate the
    entire payload for no reason.
    """
    forecast = result.forecast
    return {
        "n_obs": result.n_obs,
        "span_days": result.span_days,
        "params": ModelParamsOut.from_core(result.params),
        "observations": [ObservationOut.from_core(obs) for obs in result.observations],
        "trajectory": [
            TrajectoryPointOut(
                timestamp=point.timestamp,
                w_kg=point.w_kg,
                w_sd=point.w_sd,
                w_lower95=point.w_lower95,
                w_upper95=point.w_upper95,
            )
            for point in result.trajectory
        ],
        "current": CurrentEstimateOut.from_core(result.current),
        "forecast": ForecastOut(
            origin_timestamp=forecast.origin_timestamp,
            last_observation_timestamp=result.current.timestamp,
            lead_days=DEFAULT_TIME_AXIS.elapsed_days(
                result.current.timestamp, forecast.origin_timestamp
            ),
            includes_observation_noise=forecast.includes_observation_noise,
            horizons=[
                ForecastPointOut.from_core(forecast.point_at(horizon))
                for horizon in FORECAST_HORIZONS_DAYS
            ],
            path=[ForecastPointOut.from_core(point) for point in forecast.points],
        ),
        "meta": AnalysisMetaOut(source=source),
    }
