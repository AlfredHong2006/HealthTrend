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


# ---------------------------------------------------------------------------
# Milestone 7A: the distributions the plan-alignment study needs
# ---------------------------------------------------------------------------
#
# The same rule as above applies: computed, not transcribed. The normal CDF is a one-liner
# on ``math.erfc``; its quantile is a bisection on that CDF, checked against ``Z_95`` and
# ``Z_90`` by test ``EV14``. The chi-square CDF is the regularised lower incomplete gamma
# function, checked against the two closed forms that exist (``k = 1`` through ``Z_95``, and
# ``k = 2``, whose CDF is ``1 - exp(-x / 2)``).

_GAMMA_MAX_ITERATIONS: Final = 500
_GAMMA_EPSILON: Final = 3.0e-16
_NORMAL_PPF_BRACKET: Final = 40.0
_CHI2_PPF_ITERATIONS: Final = 200


def normal_cdf(x: float) -> float:
    """Return ``Phi(x)``, the standard-normal distribution function."""
    return 0.5 * math.erfc(-float(x) / math.sqrt(2.0))


def normal_pdf(x: float) -> float:
    """Return ``phi(x)``, the standard-normal density."""
    value = float(x)
    return math.exp(-0.5 * value * value) / math.sqrt(2.0 * math.pi)


def normal_ppf(p: float) -> float:
    """Return the ``p``-quantile of the standard normal, by bisection on :func:`normal_cdf`."""
    if not 0.0 < p < 1.0:
        raise ValueError("p must lie strictly between 0 and 1")
    low = -_NORMAL_PPF_BRACKET
    high = _NORMAL_PPF_BRACKET
    for _ in range(_PPF_ITERATIONS):
        middle = 0.5 * (low + high)
        if normal_cdf(middle) < p:
            low = middle
        else:
            high = middle
    return 0.5 * (low + high)


def student_t_cdf(t: float, df: int) -> float:
    """Return ``P(T <= t)`` for Student-t with ``df`` degrees of freedom.

    Built from :func:`student_t_sf_two_sided` by symmetry, so it shares that function's
    verification rather than introducing a second implementation to trust.
    """
    tail = 0.5 * student_t_sf_two_sided(t, df)
    return 1.0 - tail if t >= 0.0 else tail


def regularised_lower_gamma(a: float, x: float) -> float:
    """Return ``P(a, x)``, the regularised lower incomplete gamma function.

    The series for ``x < a + 1`` and the continued fraction (modified Lentz) otherwise,
    which is where each converges quickly.
    """
    if a <= 0.0:
        raise ValueError("the gamma shape parameter must be positive")
    if x <= 0.0:
        return 0.0
    log_front = a * math.log(x) - x - math.lgamma(a)
    if x < a + 1.0:
        term = 1.0 / a
        total = term
        denominator = a
        for _ in range(_GAMMA_MAX_ITERATIONS):
            denominator += 1.0
            term *= x / denominator
            total += term
            if abs(term) < abs(total) * _GAMMA_EPSILON:
                return min(1.0, total * math.exp(log_front))
        raise RuntimeError("the incomplete gamma series did not converge")
    b = x + 1.0 - a
    c = 1.0 / _BETACF_TINY
    d = 1.0 / b
    h = d
    for i in range(1, _GAMMA_MAX_ITERATIONS + 1):
        an = -i * (i - a)
        b += 2.0
        d = an * d + b
        if abs(d) < _BETACF_TINY:
            d = _BETACF_TINY
        c = b + an / c
        if abs(c) < _BETACF_TINY:
            c = _BETACF_TINY
        d = 1.0 / d
        delta = d * c
        h *= delta
        if abs(delta - 1.0) < _GAMMA_EPSILON:
            return max(0.0, 1.0 - math.exp(log_front) * h)
    raise RuntimeError("the incomplete gamma continued fraction did not converge")


def chi2_cdf(x: float, df: int) -> float:
    """Return ``P(X <= x)`` for a chi-square with ``df`` degrees of freedom."""
    if df < 1:
        raise ValueError("degrees of freedom must be at least 1")
    return regularised_lower_gamma(0.5 * df, 0.5 * float(x))


def chi2_ppf(p: float, df: int) -> float:
    """Return the ``p``-quantile of a chi-square with ``df`` degrees of freedom.

    Bisection on :func:`chi2_cdf`. The upper bracket is grown until it holds the quantile,
    so no degrees of freedom are out of range.
    """
    if not 0.0 < p < 1.0:
        raise ValueError("p must lie strictly between 0 and 1")
    low = 0.0
    high = max(1.0, 2.0 * df)
    while chi2_cdf(high, df) < p:
        high *= 2.0
    for _ in range(_CHI2_PPF_ITERATIONS):
        middle = 0.5 * (low + high)
        if chi2_cdf(middle, df) < p:
            low = middle
        else:
            high = middle
    return 0.5 * (low + high)


def clipped_normal_second_moment(c: float) -> float:
    """Return ``E[clip(Z, -c, c)**2]`` for ``Z`` standard normal.

    ``E[Z**2; |Z| < c] + c**2 P(|Z| >= c)``, where the truncated second moment is
    ``(2 Phi(c) - 1) - 2 c phi(c)``. Test ``EV14`` checks it against numerical integration.
    """
    if c <= 0.0:
        raise ValueError("the clipping constant must be positive")
    inside = (2.0 * normal_cdf(c) - 1.0) - 2.0 * c * normal_pdf(c)
    return inside + 2.0 * c * c * (1.0 - normal_cdf(c))
