"""Distribution quantiles, computed rather than transcribed.

NumPy ships no inverse CDFs and this package adds no dependency, so the handful of
quantiles the study needs are produced here.

Both chi-square constants are exact one-liners and are written as such rather than copied
from a table, because a transcribed constant fails silently:

- ``CHI2_1_95`` is ``Z_95**2``. A chi-square with one degree of freedom is the square of
  a standard normal, so its 95th percentile is the square of the normal's 97.5th -- the
  same :data:`app.core.types.Z_95` the product's intervals already use.
- ``CHI2_MIX_95`` is ``Z_90**2``, the 90th percentile of the same distribution. It is the
  critical value for a one-sided test at a boundary, where the likelihood-ratio statistic
  follows a 50:50 mixture of a point mass at zero and a chi-square with one degree of
  freedom, so the upper 5% of the mixture is the upper 10% of the chi-square. Used only
  for the ``q = 0`` test in E3, never for interval construction.
The Student-t quantiles are not closed-form in general, so :func:`student_t_ppf` inverts
the distribution function directly, via the regularised incomplete beta function.

That is a deliberate choice over a hardcoded lookup table, and the first run justified it:
a table written from memory had ``t(0.975, 49) = 2.00957523449`` where the true value is
``2.00957523713``, and ``t(0.975, 499) = 1.96471984`` where the truth is ``1.96472939``.
Both are wrong in the sixth or seventh digit -- invisible on inspection, and silently
present in every interval the study reports. The computed values round-trip through
:func:`student_t_sf_two_sided` to within ``5e-16`` of ``0.05`` at every degree of freedom
used here. Test ``EV4`` checks them against the two cases that *are* closed-form
(``df = 1``, the Cauchy quantile ``tan(pi (p - 1/2))``; and ``df = 2``,
``sqrt(2 / (4 p (1 - p)) - 2)``) and against the standard-normal limit, none of which
involve transcribing anything.

The t multiplier matters most where it is largest: at 30 clusters it is 2.045 against the
normal's 1.960, a 4% wider interval. Using the normal there would overstate precision by
exactly that much.
"""

from __future__ import annotations

import math
from typing import Final

from app.core.types import Z_95

Z_90: Final = 1.6448536269514722
"""One-sided 95% (two-sided 90%) standard-normal quantile."""

CHI2_1_95: Final = Z_95 * Z_95
"""95th percentile of chi-square with one degree of freedom, ``3.8414588...``.

The threshold for a two-sided profile-likelihood interval on a single parameter whose
true value is interior to the search space.
"""

CHI2_MIX_95: Final = Z_90 * Z_90
"""Critical value for a boundary likelihood-ratio test at the 5% level, ``2.7055434...``.

When the null puts a parameter on the edge of its space -- here ``sigma_accel = 0``, the
hypothesis that the trend never drifts -- the likelihood-ratio statistic is distributed as
a 50:50 mixture of a point mass at zero and a chi-square with one degree of freedom, not
as a plain chi-square. Using ``CHI2_1_95`` instead would make the test conservative and
understate how often the data can detect process noise at all.
"""

_BETACF_MAX_ITERATIONS: Final = 300
_BETACF_EPSILON: Final = 3.0e-16
_BETACF_TINY: Final = 1.0e-300

_PPF_LOWER_BOUND: Final = 0.5
_PPF_UPPER_BOUND: Final = 1.0e4
_PPF_ITERATIONS: Final = 200


def _beta_continued_fraction(a: float, b: float, x: float) -> float:
    """Evaluate the continued fraction for the incomplete beta function.

    Modified Lentz's method. The recurrence is the standard one for
    ``B_x(a, b)``; convergence is fast for ``x < (a + 1) / (a + b + 2)``, which is why
    :func:`regularised_incomplete_beta` reflects the argument when it is not.
    """
    qab = a + b
    qap = a + 1.0
    qam = a - 1.0
    c = 1.0
    d = 1.0 - qab * x / qap
    if abs(d) < _BETACF_TINY:
        d = _BETACF_TINY
    d = 1.0 / d
    h = d
    for m in range(1, _BETACF_MAX_ITERATIONS + 1):
        m2 = 2 * m
        # Even step.
        numerator = m * (b - m) * x / ((qam + m2) * (a + m2))
        d = 1.0 + numerator * d
        if abs(d) < _BETACF_TINY:
            d = _BETACF_TINY
        c = 1.0 + numerator / c
        if abs(c) < _BETACF_TINY:
            c = _BETACF_TINY
        d = 1.0 / d
        h *= d * c
        # Odd step.
        numerator = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
        d = 1.0 + numerator * d
        if abs(d) < _BETACF_TINY:
            d = _BETACF_TINY
        c = 1.0 + numerator / c
        if abs(c) < _BETACF_TINY:
            c = _BETACF_TINY
        d = 1.0 / d
        delta = d * c
        h *= delta
        if abs(delta - 1.0) < _BETACF_EPSILON:
            return h
    raise RuntimeError("the incomplete beta continued fraction did not converge")


def regularised_incomplete_beta(a: float, b: float, x: float) -> float:
    """Return ``I_x(a, b)``, the regularised incomplete beta function.

    Args:
        a: first shape parameter, positive.
        b: second shape parameter, positive.
        x: argument in ``[0, 1]``.
    """
    if a <= 0.0 or b <= 0.0:
        raise ValueError("beta shape parameters must be positive")
    if x <= 0.0:
        return 0.0
    if x >= 1.0:
        return 1.0
    log_front = (
        math.lgamma(a + b) - math.lgamma(a) - math.lgamma(b) + a * math.log(x) + b * math.log1p(-x)
    )
    front = math.exp(log_front)
    if x < (a + 1.0) / (a + b + 2.0):
        return front * _beta_continued_fraction(a, b, x) / a
    return 1.0 - front * _beta_continued_fraction(b, a, 1.0 - x) / b


def student_t_sf_two_sided(t: float, df: int) -> float:
    """Return ``P(|T| > t)`` for ``T`` distributed Student-t with ``df`` degrees of freedom.

    Uses the identity ``P(|T| > t) = I_{df / (df + t**2)}(df / 2, 1 / 2)``, which is exact
    and monotonically decreasing in ``t`` -- the property :func:`student_t_ppf` bisects on.
    """
    if df < 1:
        raise ValueError("degrees of freedom must be at least 1")
    magnitude = abs(float(t))
    x = df / (df + magnitude * magnitude)
    return regularised_incomplete_beta(0.5 * df, 0.5, x)


def student_t_ppf(p: float, df: int) -> float:
    """Return the ``p``-quantile of a Student-t distribution with ``df`` degrees of freedom.

    Only the upper tail is supported (``p > 0.5``), which is all the study needs.
    Bisection on :func:`student_t_sf_two_sided`, whose monotonicity makes the bracket
    unconditional; 200 halvings of ``[0.5, 10000]`` resolve the root far below the
    precision of anything it is used for.
    """
    if not 0.5 < p < 1.0:
        raise ValueError("p must lie strictly between 0.5 and 1.0")
    target = 2.0 * (1.0 - p)
    low = _PPF_LOWER_BOUND
    high = _PPF_UPPER_BOUND
    for _ in range(_PPF_ITERATIONS):
        middle = 0.5 * (low + high)
        if student_t_sf_two_sided(middle, df) > target:
            low = middle
        else:
            high = middle
    return 0.5 * (low + high)


def t_975(df: int) -> float:
    """Return the two-sided 97.5% Student-t quantile, the multiplier for a 95% interval.

    Degrees of freedom below one cannot support an interval, so the caller is asking the
    wrong question and gets an error rather than a fabricated number.
    """
    if df < 1:
        raise ValueError("a confidence interval needs at least two clusters")
    return student_t_ppf(0.975, df)
