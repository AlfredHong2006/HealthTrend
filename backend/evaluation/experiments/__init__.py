"""The five M6 experiments, one module each.

Every module exposes ``run(scale)`` returning ``{"_config": RunConfig, "results": {...}}``,
where ``results`` is JSON-serialisable and unrounded. Nothing here writes a file:
:mod:`evaluation.run` owns rounding and serialisation, so the smoke scale can exercise the
whole computation without leaving a partial artefact behind, and so every pass criterion
is decided on full-precision values before anything is truncated for the page.

``scale`` is ``"full"`` for the committed study or ``"smoke"`` for a structurally
complete run at a size that proves nothing statistically. The smoke scale exists so CI
can prove the pipeline works without spending tens of minutes on it.
"""

from __future__ import annotations
