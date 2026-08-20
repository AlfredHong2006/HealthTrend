"""Turning submitted data into observations the numerical core will accept.

The core is deliberately strict and deliberately narrow: kilograms only, timezone-aware
instants only, non-decreasing time order only, and it raises rather than silently repairing
anything (ADR-0001, ADR-0004). That strictness is only tolerable because some layer takes
responsibility for meeting it. This is that layer.

Milestone 2 ingests JSON. CSV and Apple Health export parsing are master plan section 39
stages and belong to a later milestone; they will add parsers here and reuse the same
normalisation.
"""

from app.ingestion.observations import normalise_observations

__all__ = ["normalise_observations"]
