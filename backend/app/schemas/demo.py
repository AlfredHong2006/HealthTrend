"""The demo catalogue and the demo analysis response.

A demo analysis returns exactly the shape ``POST /api/analyse`` returns, plus one extra
``scenario`` block. That is a deliberate constraint: the frontend milestone should need one
renderer, not two, and the demo should be the same product surface rather than a special
case of it.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.core.types import AnalysisResult
from app.demo.scenarios import DemoSeries, ScenarioSpec
from app.schemas.analysis import AnalysisResponse, analysis_fields


class DemoScenarioOut(BaseModel):
    """What a demo scenario is, and exactly what generated it."""

    id: str
    title: str
    description: str
    label: str = Field(description="Provenance label. Always identifies the data as synthetic.")
    seed: int
    parameters: dict[str, float | int | str] = Field(
        description="The generator arguments, published so the series can be reproduced."
    )

    @classmethod
    def from_spec(cls, spec: ScenarioSpec) -> DemoScenarioOut:
        """Adapt a :class:`app.demo.scenarios.ScenarioSpec`."""
        return cls(
            id=spec.scenario_id,
            title=spec.title,
            description=spec.description,
            label=spec.label,
            seed=spec.seed,
            parameters=dict(spec.parameters),
        )


class DemoCatalogueResponse(BaseModel):
    """The list of scenarios available to try."""

    synthetic: Literal[True] = Field(
        default=True,
        description="Every scenario here is generated. None of it is measured health data.",
    )
    scenarios: list[DemoScenarioOut]


class DemoAnalysisResponse(AnalysisResponse):
    """An analysis of a generated scenario: the standard response plus its provenance."""

    scenario: DemoScenarioOut

    @classmethod
    def from_result_and_series(
        cls, result: AnalysisResult, series: DemoSeries
    ) -> DemoAnalysisResponse:
        """Adapt a core result together with the scenario that produced its input."""
        return cls(
            **analysis_fields(result, source="demo"),
            scenario=DemoScenarioOut.from_spec(series.spec),
        )
