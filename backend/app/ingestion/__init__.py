"""Turning submitted data into observations the numerical core will accept.

The core is deliberately strict and deliberately narrow: kilograms only, timezone-aware
instants only, non-decreasing time order only, and it raises rather than silently repairing
anything (ADR-0001, ADR-0004). That strictness is only tolerable because some layer takes
responsibility for meeting it. This is that layer.

Milestone 2 ingests JSON and Milestone 5 adds CSV (ADR-0010). Apple Health export parsing
is a later milestone; it will add a parser here and reuse the same normalisation.
"""

from app.ingestion.observations import normalise_observations

__all__ = ["normalise_observations"]
