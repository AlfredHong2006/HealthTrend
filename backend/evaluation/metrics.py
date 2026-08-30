"""Calibration diagnostics, and the one form of uncertainty this study reports.

**Series are the unit of inference, not observations.** Every diagnostic here is computed
per series first and only then averaged, because the quantities within a series are not
independent: consecutive posteriors describe overlapping information about one trajectory,
and consecutive innovations share the state that produced them. Pooling 30,000 posteriors
from 500 series and dividing by the square root of 30,000 counts 500 independent
replications as 30,000. How much that understates the standard error depends on which
statistic is being averaged: in E2's daily configuration the clustered standard error is
about 2.3 times the naive one for coverage and about 3.2 times for NEES, while for NIS the
two agree to within 1%. The correction is real, it is not one number, and a calibration
study whose own intervals are wrong is worse than no calibration study.

So the estimator of every summary is the mean over series, and its standard error is the
standard deviation *across* series divided by the square root of their count -- a
cluster-robust interval in its simplest valid form, which is all that independent
replications require. No sandwich estimators, no bootstrap: the series really are
independent, so the ordinary interval over their means is already the right one.

Three diagnostics, deliberately overlapping, because they answer different questions:

``coverage``
    Does the truth fall inside the published 95% interval 95% of the time? This is the
    user-facing claim, one dimension at a time, and the only one of the three that
    corresponds to something the product actually says.
``NIS``
    Are the normalised innovations standard normal? Computed from
    :attr:`FilterStep.normalized_innovation`, which the filter already records. This is the
    only diagnostic here that would still be computable on real data, where no truth
    exists -- which makes it the one worth keeping an eye on beyond M6.
``NEES``
    Is the *joint* state error consistent with the full covariance, cross-covariance
    included? Coverage checks the diagonal of ``P`` twice; NEES checks all of it. A filter
    whose ``P_wv`` was wrong could pass both coverage checks and fail this one.
"""

from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

import numpy as np
from numpy.typing import NDArray

from app.core.types import Z_95, FilterResult
from evaluation.constants import t_975
from testing.synthetic import SyntheticSeries


@dataclass(frozen=True, slots=True)
class ClusterSummary:
    """A mean over independent series, with the interval that unit of clustering implies.

    Attributes:
        mean: the average across series.
        sd: the standard deviation across series, with Bessel's correction.
        se: the standard error of the mean, ``sd / sqrt(n_clusters)``.
        ci_lo: lower end of the 95% interval, ``mean - t * se``.
        ci_hi: upper end of the 95% interval.
        n_clusters: how many series contributed.
    """

    mean: float
    sd: float
    se: float
    ci_lo: float
    ci_hi: float
    n_clusters: int

    def contains(self, value: float) -> bool:
        """Return whether ``value`` lies inside the interval."""
        return self.ci_lo <= value <= self.ci_hi

    def deviation_in_se(self, nominal: float) -> float:
        """Return the signed distance from ``nominal`` in standard errors.

        The stop criterion in E2 is stated in these units rather than in interval
        misses, because with several statistics checked at once an occasional marginal
        miss is expected of a perfectly correct implementation, while a deviation of four
        standard errors is not.
        """
        if self.se == 0.0:
            return 0.0
        return (self.mean - nominal) / self.se

    def to_dict(self) -> dict[str, float | int]:
        """Return a JSON-serialisable view."""
        return {
            "mean": self.mean,
            "sd": self.sd,
            "se": self.se,
            "ci_lo": self.ci_lo,
            "ci_hi": self.ci_hi,
            "n_clusters": self.n_clusters,
        }


def cluster_summary(values: Sequence[float] | NDArray[np.float64]) -> ClusterSummary:
    """Summarise one per-series statistic across series.

    Raises:
        ValueError: if fewer than two series are supplied. One series carries no
            information about the spread between series, so there is no honest interval to
            report and returning a point estimate as though there were would be worse than
            failing.
    """
    array = np.asarray(values, dtype=np.float64)
    count = int(array.size)
    if count < 2:
        raise ValueError("a cluster-robust interval needs at least two series")
    mean = float(np.mean(array))
    sd = float(np.std(array, ddof=1))
    se = sd / math.sqrt(count)
    half_width = t_975(count - 1) * se
    return ClusterSummary(
        mean=mean,
        sd=sd,
        se=se,
        ci_lo=mean - half_width,
        ci_hi=mean + half_width,
        n_clusters=count,
    )


def nees(error: NDArray[np.float64], P: NDArray[np.float64]) -> float:
    """Return ``e' P^-1 e`` for a 2x2 covariance, inverted in closed form.

    Written out rather than delegated to ``np.linalg.solve`` because a 2x2 inverse is three
    multiplications and because the explicit form makes visible that the cross-covariance
    enters -- which is the whole reason NEES says something the two coverage checks do not.

    Raises:
        ValueError: if the covariance is singular.
    """
    determinant = float(P[0, 0] * P[1, 1] - P[0, 1] * P[1, 0])
    if determinant <= 0.0:
        raise ValueError("the covariance is singular; NEES is undefined")
    e_w = float(error[0])
    e_v = float(error[1])
    quadratic = (
        float(P[1, 1]) * e_w * e_w - 2.0 * float(P[0, 1]) * e_w * e_v + float(P[0, 0]) * e_v * e_v
    )
    return quadratic / determinant


@dataclass(frozen=True, slots=True)
class SeriesDiagnostics:
    """Calibration diagnostics for one series, each already averaged within it.

    Attributes:
        coverage_w: fraction of posteriors whose 95% latent-weight interval held the truth.
        coverage_v: the same for the velocity interval.
        anis: average normalised innovation squared; one under a correct model.
        anees: average normalised estimation error squared; two under a correct model.
        inside_w: count behind ``coverage_w``, kept so pooled rates can be reported too.
        inside_v: count behind ``coverage_v``.
        n_posteriors: how many posteriors the coverage figures average over.
        n_steps: how many innovations ``anis`` averages over, one fewer than the above.
    """

    coverage_w: float
    coverage_v: float
    anis: float
    anees: float
    inside_w: int
    inside_v: int
    n_posteriors: int
    n_steps: int


def series_diagnostics(series: SyntheticSeries, result: FilterResult) -> SeriesDiagnostics:
    """Compute every calibration diagnostic for one filtered series.

    The initial state is included in the coverage and NEES figures, which is correct rather
    than convenient: initialisation consumes the first observation, so its posterior is a
    genuine estimate with a genuine covariance. Under a model-consistent draw its error is
    ``(-measurement noise, initial velocity)``, distributed exactly ``N(0, P_0)`` -- so the
    first posterior is not a special case that has to be excused, it is the one case where
    the claim can be checked in closed form.

    It contributes no innovation, so ``anis`` averages over one fewer term. That asymmetry
    is the same one in :attr:`FilterResult.loglik`, and for the same reason.
    """
    posteriors = result.posteriors
    if len(posteriors) != series.n_obs:
        raise ValueError("the filter result does not match the series it came from")

    inside_w = 0
    inside_v = 0
    total_nees = 0.0
    for index, posterior in enumerate(posteriors):
        error_w = series.true_weight_kg[index] - posterior.w_kg
        error_v = series.true_velocity_kg_per_day[index] - posterior.v_kg_per_day
        if abs(error_w) <= Z_95 * posterior.w_sd:
            inside_w += 1
        if abs(error_v) <= Z_95 * posterior.v_sd:
            inside_v += 1
        total_nees += nees(np.array([error_w, error_v], dtype=np.float64), posterior.P)

    n_posteriors = len(posteriors)
    n_steps = len(result.steps)
    total_nis = math.fsum(step.normalized_innovation**2 for step in result.steps)
    return SeriesDiagnostics(
        coverage_w=inside_w / n_posteriors,
        coverage_v=inside_v / n_posteriors,
        anis=total_nis / n_steps if n_steps else math.nan,
        anees=total_nees / n_posteriors,
        inside_w=inside_w,
        inside_v=inside_v,
        n_posteriors=n_posteriors,
        n_steps=n_steps,
    )


def quantiles(values: Sequence[float], probabilities: tuple[float, ...]) -> dict[str, float]:
    """Return empirical quantiles, labelled by probability.

    Descriptive only. The spread of a diagnostic across series says something a mean cannot
    -- a filter can average correctly while being wrong in both directions -- but it
    supports no test here and is reported as such.
    """
    array = np.asarray(values, dtype=np.float64)
    return {
        f"q{probability:g}": float(np.quantile(array, probability)) for probability in probabilities
    }


def summarise_checks(checks: dict[str, tuple[ClusterSummary, float]]) -> dict[str, Any]:
    """Package a set of ``(summary, nominal)`` pairs with their interval and deviation tests.

    Returns the per-statistic intervals, whether each contains its nominal value, and the
    deviation in standard errors -- which is what the stop criterion actually reads.
    """
    return {
        "summaries": {name: summary.to_dict() for name, (summary, _) in checks.items()},
        "nominal": {name: nominal for name, (_, nominal) in checks.items()},
        "ci_contains_nominal": {
            name: summary.contains(nominal) for name, (summary, nominal) in checks.items()
        },
        "deviation_in_se": {
            name: summary.deviation_in_se(nominal) for name, (summary, nominal) in checks.items()
        },
    }
