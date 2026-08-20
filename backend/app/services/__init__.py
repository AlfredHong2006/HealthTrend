"""Application services: the layer that orchestrates the core for a caller.

A service takes already-validated input, decides what to ask the numerical core, and
adapts the answer into a response model. It is the only layer that knows what "now" means
-- the core is forbidden from reading the clock, so the current instant arrives here as an
injected :class:`app.services.clock.Clock`.

Dependency direction is ``api -> services -> core``, with services reaching sideways into
:mod:`app.ingestion` for HTTP-supplied observations and :mod:`app.demo` for synthetic
ones. Nothing here imports FastAPI.
"""
