"""Milestone 6: the evaluation harness for the state-space estimator.

This package is **not** part of the application. It is the reduced M6 evaluation:
five synthetic-only experiments that measure what the shipped estimator actually does,
so that ``docs/privacy.md`` can stop saying "no experiments say so" about specific,
named claims -- and can keep saying it about everything else.

Five experiments, in dependency order:

``E1`` independent exact likelihood verification
    An ``O(n**3)`` joint-Gaussian likelihood computed from the model's marginal
    covariance, compared against the filter's ``O(n)`` innovations recursion. It is an
    oracle, never a fitting objective. Every downstream experiment that touches a
    likelihood is only as trustworthy as this one, so it gates the rest.

``E2`` model-consistent calibration
    Coverage of the latent weight and velocity intervals, NIS and NEES, over many
    independent short draws from the model's own assumptions, with cluster-robust
    intervals because diagnostics within one series are not independent.

``E3``/``E4`` identifiability and parameter recovery
    Maximum likelihood over a grid of calendar span and observation count, with
    profile-likelihood intervals, censoring accounting, and the ``q -> 0`` boundary.
    Fitting happens **here and only here**: production parameters remain documented
    priors, and nothing in this package feeds back into ``app``.

``E5`` baseline comparison
    The shipped estimator against time-aware LOCF, moving average, EWMA and Holt across
    eight regimes including curvature, a level jump and outlier contamination. Simple
    baselines are expected to win somewhere; that result is published, not suppressed.

Rules this package lives by, none of them optional:

- **Synthetic data only.** Every series comes from :mod:`testing.synthetic`, whose
  :class:`~testing.synthetic.SyntheticSeries` refuses to exist without a label saying
  so. No real health data has been used for any evaluation.
- **The estimator is not modified.** ``app.core`` is imported and measured, never
  changed. A result that would be nicer with different priors is a finding, not a
  licence to retune.
- **Determinism.** Every generator takes an explicit seed; seed ranges are disjoint by
  construction (:data:`evaluation.common.SEED_BASES`) so no experiment can accidentally
  evaluate on data another one tuned against.
- **No web framework, no HTTP, no clock.** This package may import ``app.core`` and
  ``testing`` and nothing else from the project; ``tests/test_layering.py`` enforces it.

Run an experiment from ``backend/``::

    uv run python -m evaluation.run e1          # writes evaluation/results/
    uv run python -m evaluation.run all --smoke # fast, writes nothing
    uv run python -m evaluation.run tables      # regenerates docs/evaluation/results.md

Full-scale runs take tens of minutes and are deliberately not part of the test suite.
What CI runs is the smoke scale, which exercises every code path at a size that proves
nothing statistically and everything structurally.
"""

from __future__ import annotations
