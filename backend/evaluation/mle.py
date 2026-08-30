"""Maximum likelihood machinery, used by E3, E4 and E5 and by nothing that ships.

Fitting lives here and only here. The product's parameters are documented priors and stay
that way: nothing in this module feeds back into ``app``, no request can reach it, and no
per-user estimate is ever produced. What it exists for is to answer questions the priors
cannot answer about themselves -- how much data it takes to identify ``sigma_accel`` at
all, how badly ``sigma_v0`` distorts the other two if it is wrong, and how a
best-case fitted filter compares with the shipped one.

**The objective is a lean innovations recursion, not the oracle.**
:func:`evaluation.exact_likelihood.direct_loglik` costs ``O(n**3)`` and allocates an
``n``-by-``n`` matrix; :func:`app.core.filter.run_filter` costs ``O(n)`` but builds two
frozen dataclasses, two read-only covariance arrays and a :class:`FilterStep` per
observation, none of which an optimiser evaluating the likelihood thousands of times has
any use for. :func:`innovations_loglik` is the same recursion on plain floats, with the
2x2 algebra written out. It is roughly two orders of magnitude faster than the filter and
that is the difference between a study that runs in half an hour and one that does not.

Being fast is worthless if it is wrong, so it is checked twice, from both directions:

- E1 evaluates it against the ``O(n**3)`` oracle across the whole battery -- every
  parameter combination, every gap pattern, every length.
- :func:`fit` asserts it agrees with :attr:`FilterResult.loglik` at every fitted optimum,
  so the number an estimate was actually chosen by is tied to the shipped code path.

Parameters are fitted in ``log10`` units. The scales differ by two orders of magnitude
(``sigma_obs`` is 0.5, ``sigma_accel`` is 0.008), both are strictly positive, and the
likelihood is far closer to quadratic in the logarithm than in the parameter -- so a
simplex that takes equal steps in both coordinates is taking sensible steps in both.
``sigma_v0`` is never estimated: one series realises one initial velocity, which carries
no information about the spread of the distribution it came from.
"""

from __future__ import annotations

import math
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from itertools import pairwise
from typing import Final

from app.core.time_axis import DEFAULT_TIME_AXIS, TimeAxis
from app.core.types import Observation

_LOG_2PI: Final = math.log(2.0 * math.pi)


@dataclass(frozen=True, slots=True)
class PreparedSeries:
    """One series reduced to the two sequences the recursion actually reads.

    Timestamps become gaps once, at preparation time, rather than on every one of the
    thousands of likelihood evaluations a fit performs. Plain tuples of Python floats are
    used rather than NumPy arrays because indexing an array yields a boxed ``np.float64``,
    and in a scalar loop that boxing dominates the arithmetic.

    Attributes:
        dt_days: gaps between consecutive observations; length ``n_obs - 1``.
        y_kg: the measurements; length ``n_obs``.
    """

    dt_days: tuple[float, ...]
    y_kg: tuple[float, ...]

    def __post_init__(self) -> None:
        """Check the two sequences describe the same series."""
        if len(self.dt_days) + 1 != len(self.y_kg):
            raise ValueError("dt_days must have exactly one fewer entry than y_kg")
        if any(gap < 0.0 for gap in self.dt_days):
            raise ValueError("observations must be in non-decreasing time order")

    @property
    def n_obs(self) -> int:
        """Number of observations."""
        return len(self.y_kg)


def prepare_series(
    observations: Sequence[Observation],
    *,
    time_axis: TimeAxis = DEFAULT_TIME_AXIS,
) -> PreparedSeries:
    """Reduce observations to gaps and values.

    Per-observation variance overrides are deliberately not carried through: nothing in
    the study sets one, and silently ignoring a field that had been set would be worse
    than not supporting it.

    Raises:
        ValueError: if any observation carries a variance override.
    """
    if any(observation.obs_variance is not None for observation in observations):
        raise ValueError(
            "the fitting objective assumes a single shared observation variance; "
            "a per-observation override would be silently ignored"
        )
    gaps = tuple(
        time_axis.elapsed_days(previous.timestamp, current.timestamp)
        for previous, current in pairwise(observations)
    )
    return PreparedSeries(
        dt_days=gaps,
        y_kg=tuple(float(observation.weight_kg) for observation in observations),
    )


def prepare_dataset(
    dataset: Sequence[Sequence[Observation]],
    *,
    time_axis: TimeAxis = DEFAULT_TIME_AXIS,
) -> tuple[PreparedSeries, ...]:
    """Reduce a group of series, whose likelihoods will be pooled by summation."""
    return tuple(prepare_series(series, time_axis=time_axis) for series in dataset)


def innovations_loglik(
    prepared: PreparedSeries,
    sigma_obs_kg: float,
    sigma_accel: float,
    sigma_v0: float,
) -> float:
    """Return the log-likelihood of one series, conditional on its first observation.

    The same recursion :func:`app.core.filter.run_filter` performs, with the 2x2 predict
    and Joseph-form update written out in scalars. The covariance is carried as its three
    distinct entries (``Pww``, ``Pwv``, ``Pvv``) because it is symmetric, and the
    innovation variance is a scalar because ``H`` selects one component -- so there is no
    matrix inversion here either.

    Returns ``0.0`` for a single observation, which initialises the prior and contributes
    no predictive density.
    """
    values = prepared.y_kg
    if len(values) < 2:
        return 0.0

    obs_variance = sigma_obs_kg * sigma_obs_kg
    intensity = sigma_accel * sigma_accel

    w = values[0]
    v = 0.0
    p_ww = obs_variance
    p_wv = 0.0
    p_vv = sigma_v0 * sigma_v0

    loglik = 0.0
    for index, dt in enumerate(prepared.dt_days, start=1):
        # Predict: x <- F x, P <- F P F' + Q. Both expanded; F P F' is symmetric and Q is
        # symmetric, so only three entries are carried.
        w += v * dt
        dt2 = dt * dt
        prior_ww = p_ww + 2.0 * dt * p_wv + dt2 * p_vv + intensity * dt2 * dt / 3.0
        prior_wv = p_wv + dt * p_vv + intensity * dt2 / 2.0
        prior_vv = p_vv + intensity * dt

        # Update. S is scalar; the gain is two scalars.
        innovation_var = prior_ww + obs_variance
        innovation = values[index] - w
        gain_w = prior_ww / innovation_var
        gain_v = prior_wv / innovation_var

        w += gain_w * innovation
        v += gain_v * innovation

        # Joseph form, (I - K H) P (I - K H)' + K R K', expanded. Written this way rather
        # than as the shorter (I - K H) P for the same reason the core does: it stays
        # symmetric and positive semi-definite under rounding over long series.
        one_minus = 1.0 - gain_w
        off_diagonal = prior_wv - gain_v * prior_ww
        p_ww = one_minus * one_minus * prior_ww + gain_w * gain_w * obs_variance
        p_wv = one_minus * off_diagonal + gain_w * gain_v * obs_variance
        p_vv = prior_vv - gain_v * prior_wv - gain_v * off_diagonal + gain_v * gain_v * obs_variance

        loglik -= 0.5 * (
            _LOG_2PI + math.log(innovation_var) + innovation * innovation / innovation_var
        )

    return loglik


def dataset_loglik(
    dataset: Sequence[PreparedSeries],
    sigma_obs_kg: float,
    sigma_accel: float,
    sigma_v0: float,
) -> float:
    """Return the pooled log-likelihood of independent series.

    The series are independent replications, so their log-likelihoods add. Each is
    conditional on its own first observation, which means the total is comparable across
    parameter values for a fixed dataset but not across datasets of different sizes.
    """
    return math.fsum(
        innovations_loglik(series, sigma_obs_kg, sigma_accel, sigma_v0) for series in dataset
    )


# ---------------------------------------------------------------------------
# The parameter space
# ---------------------------------------------------------------------------

SEARCH_BOX: Final[tuple[tuple[float, float], tuple[float, float]]] = ((-3.0, 1.0), (-6.0, 0.0))
"""Bounds on ``(log10 sigma_obs, log10 sigma_accel)``.

Measurement noise from a gram to ten kilograms, and process-noise intensity across six
orders of magnitude. Both are far wider than any plausible estimate, which is what makes an
estimate landing *on* a bound informative rather than an artefact of a cramped search: it
means the likelihood is still increasing at a value nobody would defend, which is what
non-identifiability looks like from the inside.

The lower bound on ``sigma_accel``, ``1e-6``, is the study's proxy for ``q = 0``. Over the
longest span considered its contribution to the state covariance is ``1e-12 t**3 / 3``,
about ``4e-6`` kg squared at a year -- five orders of magnitude below the measurement
variance, and so not distinguishable from exactly zero by anything here.
"""

BOUNDARY_MARGIN: Final = 0.05
"""How close to a bound, in ``log10`` units, counts as being at it: about 12%."""

_GRID_OBS_POINTS: Final = 9
_GRID_ACCEL_POINTS: Final = 13
_NELDER_MEAD_STEP: Final = 0.25
_NELDER_MEAD_MAX_ITERATIONS: Final = 400
_NELDER_MEAD_FTOL: Final = 1e-10
_NELDER_MEAD_XTOL: Final = 1e-7

_GOLDEN_RATIO: Final = (math.sqrt(5.0) - 1.0) / 2.0
_GOLDEN_TOLERANCE: Final = 1e-5
_GOLDEN_MAX_ITERATIONS: Final = 100

_PROFILE_STEP: Final = 0.2
_PROFILE_MAX_STEPS: Final = 60
_PROFILE_BISECTIONS: Final = 30
_PROFILE_TOLERANCE: Final = 1e-4


@dataclass(frozen=True, slots=True)
class FitResult:
    """One maximum-likelihood fit.

    Attributes:
        log10_sigma_obs: fitted measurement-noise standard deviation, base-ten logarithm.
        log10_sigma_accel: fitted process-noise intensity, base-ten logarithm.
        sigma_v0: the initial-velocity prior held fixed throughout, never estimated.
        loglik: the maximised pooled log-likelihood.
        at_lower_bound: whether each parameter came to rest on its lower bound.
        at_upper_bound: whether each parameter came to rest on its upper bound.
        n_evaluations: likelihood evaluations spent, for the runtime budget.
    """

    log10_sigma_obs: float
    log10_sigma_accel: float
    sigma_v0: float
    loglik: float
    at_lower_bound: tuple[bool, bool]
    at_upper_bound: tuple[bool, bool]
    n_evaluations: int

    @property
    def sigma_obs_kg(self) -> float:
        """The fitted measurement noise on its natural scale."""
        return float(10.0**self.log10_sigma_obs)

    @property
    def sigma_accel(self) -> float:
        """The fitted process-noise intensity on its natural scale."""
        return float(10.0**self.log10_sigma_accel)

    @property
    def theta(self) -> tuple[float, float]:
        """The fitted point in the search space."""
        return (self.log10_sigma_obs, self.log10_sigma_accel)

    def to_dict(self) -> dict[str, object]:
        """Return a JSON-serialisable view."""
        return {
            "log10_sigma_obs": self.log10_sigma_obs,
            "log10_sigma_accel": self.log10_sigma_accel,
            "sigma_obs_kg": self.sigma_obs_kg,
            "sigma_accel": self.sigma_accel,
            "sigma_v0": self.sigma_v0,
            "loglik": self.loglik,
            "at_lower_bound": list(self.at_lower_bound),
            "at_upper_bound": list(self.at_upper_bound),
            "n_evaluations": self.n_evaluations,
        }


@dataclass(frozen=True, slots=True)
class ProfileCI:
    """A profile-likelihood interval for one parameter, in ``log10`` units.

    Attributes:
        lo: lower endpoint, or the search bound if the profile never crossed the threshold.
        hi: upper endpoint, likewise.
        lo_censored: whether ``lo`` is the search bound rather than a crossing.
        hi_censored: whether ``hi`` is the search bound rather than a crossing.

    A censored endpoint is reported at the bound and never dropped. For ``sigma_accel`` at
    short spans this is the common case and the finding itself: the data cannot rule out
    arbitrarily small process noise, so the interval runs off the bottom of the search
    space. Counting such an interval as covering the truth can only make coverage look
    better than it is, which is the conservative direction and is stated as such in the
    report rather than corrected for.
    """

    lo: float
    hi: float
    lo_censored: bool
    hi_censored: bool

    @property
    def width(self) -> float:
        """Interval width in ``log10`` units, orders of magnitude."""
        return self.hi - self.lo

    def contains(self, value: float) -> bool:
        """Return whether ``value`` lies inside the interval."""
        return self.lo <= value <= self.hi

    def to_dict(self) -> dict[str, object]:
        """Return a JSON-serialisable view."""
        return {
            "lo": self.lo,
            "hi": self.hi,
            "width": self.width,
            "lo_censored": self.lo_censored,
            "hi_censored": self.hi_censored,
        }


def _clip(value: float, bounds: tuple[float, float]) -> float:
    """Confine ``value`` to ``bounds``."""
    return min(max(value, bounds[0]), bounds[1])


class _Objective:
    """The negative pooled log-likelihood, counting its own evaluations.

    A callable object rather than a closure so that the evaluation count is available
    afterwards: the runtime of E3 and E4 is entirely this count, and reporting it is what
    makes a slow run diagnosable instead of merely slow.
    """

    __slots__ = ("dataset", "n_evaluations", "sigma_v0")

    def __init__(self, dataset: Sequence[PreparedSeries], sigma_v0: float) -> None:
        self.dataset = dataset
        self.sigma_v0 = sigma_v0
        self.n_evaluations = 0

    def __call__(self, log10_sigma_obs: float, log10_sigma_accel: float) -> float:
        """Return the negative pooled log-likelihood at one point, clipped into the box."""
        self.n_evaluations += 1
        sigma_obs = 10.0 ** _clip(log10_sigma_obs, SEARCH_BOX[0])
        sigma_accel = 10.0 ** _clip(log10_sigma_accel, SEARCH_BOX[1])
        return -dataset_loglik(self.dataset, sigma_obs, sigma_accel, self.sigma_v0)


def nelder_mead(
    objective: _Objective,
    start: tuple[float, float],
    *,
    step: float = _NELDER_MEAD_STEP,
    max_iterations: int = _NELDER_MEAD_MAX_ITERATIONS,
) -> tuple[tuple[float, float], float]:
    """Minimise a two-dimensional objective by the Nelder-Mead simplex method.

    Deterministic throughout: the initial simplex is ``start`` plus one ``step`` along each
    axis, ties break on index, and no randomness enters anywhere. Two runs on the same
    input give bit-identical answers, which test ``EV5`` asserts -- a study whose estimates
    moved between runs could not support any of the claims made from them.

    Points are clipped into :data:`SEARCH_BOX` inside the objective rather than rejected, so
    the simplex may sit partly outside the box while every evaluated likelihood is inside
    it. The optimum is clipped on the way out.
    """
    simplex = [
        (start[0], start[1]),
        (start[0] + step, start[1]),
        (start[0], start[1] + step),
    ]
    values = [objective(*point) for point in simplex]

    for _ in range(max_iterations):
        order = sorted(range(3), key=lambda index: values[index])
        simplex = [simplex[index] for index in order]
        values = [values[index] for index in order]

        spread = abs(values[2] - values[0])
        diameter = max(
            max(abs(simplex[i][0] - simplex[0][0]), abs(simplex[i][1] - simplex[0][1]))
            for i in (1, 2)
        )
        if spread < _NELDER_MEAD_FTOL and diameter < _NELDER_MEAD_XTOL:
            break

        centroid = (
            (simplex[0][0] + simplex[1][0]) / 2.0,
            (simplex[0][1] + simplex[1][1]) / 2.0,
        )
        worst = simplex[2]

        reflected = (
            centroid[0] + (centroid[0] - worst[0]),
            centroid[1] + (centroid[1] - worst[1]),
        )
        reflected_value = objective(*reflected)

        if reflected_value < values[0]:
            expanded = (
                centroid[0] + 2.0 * (centroid[0] - worst[0]),
                centroid[1] + 2.0 * (centroid[1] - worst[1]),
            )
            expanded_value = objective(*expanded)
            if expanded_value < reflected_value:
                simplex[2], values[2] = expanded, expanded_value
            else:
                simplex[2], values[2] = reflected, reflected_value
            continue

        if reflected_value < values[1]:
            simplex[2], values[2] = reflected, reflected_value
            continue

        contracted = (
            centroid[0] + 0.5 * (worst[0] - centroid[0]),
            centroid[1] + 0.5 * (worst[1] - centroid[1]),
        )
        contracted_value = objective(*contracted)
        if contracted_value < values[2]:
            simplex[2], values[2] = contracted, contracted_value
            continue

        for index in (1, 2):
            shrunk = (
                simplex[0][0] + 0.5 * (simplex[index][0] - simplex[0][0]),
                simplex[0][1] + 0.5 * (simplex[index][1] - simplex[0][1]),
            )
            simplex[index] = shrunk
            values[index] = objective(*shrunk)

    best = min(range(3), key=lambda index: values[index])
    point = (
        _clip(simplex[best][0], SEARCH_BOX[0]),
        _clip(simplex[best][1], SEARCH_BOX[1]),
    )
    return point, values[best]


def _golden_section_min(
    evaluate: Callable[[float], float],
    lo: float,
    hi: float,
) -> tuple[float, float]:
    """Minimise a unimodal one-dimensional function on ``[lo, hi]``.

    Used to profile out the nuisance parameter. The profile of a Gaussian likelihood in one
    parameter with the other fixed is unimodal in practice over this box; golden section
    needs no derivative and cannot overshoot, which matters more here than speed.
    """
    left = hi - _GOLDEN_RATIO * (hi - lo)
    right = lo + _GOLDEN_RATIO * (hi - lo)
    left_value = evaluate(left)
    right_value = evaluate(right)
    for _ in range(_GOLDEN_MAX_ITERATIONS):
        if hi - lo < _GOLDEN_TOLERANCE:
            break
        if left_value < right_value:
            hi, right, right_value = right, left, left_value
            left = hi - _GOLDEN_RATIO * (hi - lo)
            left_value = evaluate(left)
        else:
            lo, left, left_value = left, right, right_value
            right = lo + _GOLDEN_RATIO * (hi - lo)
            right_value = evaluate(right)
    if left_value < right_value:
        return left, left_value
    return right, right_value


def fit(
    dataset: Sequence[PreparedSeries],
    *,
    sigma_v0: float,
) -> FitResult:
    """Fit ``(sigma_obs, sigma_accel)`` by maximum likelihood, holding ``sigma_v0`` fixed.

    A coarse grid over the whole search box, then one Nelder-Mead refinement from its best
    point. The grid exists because the likelihood in ``sigma_accel`` can be very flat over
    orders of magnitude on short series, and a simplex started in the wrong basin of such a
    surface will converge confidently to the wrong place. Starting from the grid's best
    point costs 117 evaluations and removes the failure mode.

    ``sigma_v0`` is a parameter of the analysis, not of the fit. One series realises one
    initial velocity; the spread of the distribution that velocity was drawn from is not
    estimable from it, and pretending otherwise would produce an estimate whose sampling
    distribution had nothing to do with the quantity named.
    """
    objective = _Objective(dataset, sigma_v0)

    obs_grid = [
        SEARCH_BOX[0][0] + (SEARCH_BOX[0][1] - SEARCH_BOX[0][0]) * index / (_GRID_OBS_POINTS - 1)
        for index in range(_GRID_OBS_POINTS)
    ]
    accel_grid = [
        SEARCH_BOX[1][0] + (SEARCH_BOX[1][1] - SEARCH_BOX[1][0]) * index / (_GRID_ACCEL_POINTS - 1)
        for index in range(_GRID_ACCEL_POINTS)
    ]
    best_point = (obs_grid[0], accel_grid[0])
    best_value = math.inf
    for log_obs in obs_grid:
        for log_accel in accel_grid:
            value = objective(log_obs, log_accel)
            if value < best_value:
                best_value = value
                best_point = (log_obs, log_accel)

    point, value = nelder_mead(objective, best_point)
    return FitResult(
        log10_sigma_obs=point[0],
        log10_sigma_accel=point[1],
        sigma_v0=sigma_v0,
        loglik=-value,
        at_lower_bound=(
            point[0] - SEARCH_BOX[0][0] <= BOUNDARY_MARGIN,
            point[1] - SEARCH_BOX[1][0] <= BOUNDARY_MARGIN,
        ),
        at_upper_bound=(
            SEARCH_BOX[0][1] - point[0] <= BOUNDARY_MARGIN,
            SEARCH_BOX[1][1] - point[1] <= BOUNDARY_MARGIN,
        ),
        n_evaluations=objective.n_evaluations,
    )


def _profile_loglik(
    objective: _Objective,
    index: int,
    value: float,
) -> float:
    """Return the log-likelihood maximised over the nuisance parameter, with one fixed."""
    nuisance_bounds = SEARCH_BOX[1 - index]
    if index == 0:
        _, negative = _golden_section_min(
            lambda nuisance: objective(value, nuisance), *nuisance_bounds
        )
    else:
        _, negative = _golden_section_min(
            lambda nuisance: objective(nuisance, value), *nuisance_bounds
        )
    return -negative


def profile_ci(
    dataset: Sequence[PreparedSeries],
    index: int,
    fitted: FitResult,
    *,
    threshold: float,
) -> ProfileCI:
    """Return the profile-likelihood interval for parameter ``index``.

    Steps outward from the optimum in ``log10`` units until twice the drop in profile
    log-likelihood exceeds ``threshold``, then bisects the bracket. If a bound is reached
    without crossing, that endpoint is censored and reported at the bound.

    The threshold is a chi-square quantile with one degree of freedom, which is the right
    reference for inverting a two-sided test of an interior value -- the coverage question
    E3 measures. It is emphatically *not* the right reference for asking whether
    ``sigma_accel`` is zero, a hypothesis on the boundary of the parameter space; that is
    what :func:`q_zero_statistic` is for, with the mixture cutoff it requires.
    """
    objective = _Objective(dataset, fitted.sigma_v0)
    bounds = SEARCH_BOX[index]
    centre = fitted.theta[index]
    peak = _profile_loglik(objective, index, centre)

    def exceeds(value: float) -> bool:
        return 2.0 * (peak - _profile_loglik(objective, index, value)) > threshold

    endpoints: list[float] = []
    censored: list[bool] = []
    for direction in (-1.0, 1.0):
        limit = bounds[0] if direction < 0 else bounds[1]
        inner = centre
        outer: float | None = None
        for stride in range(1, _PROFILE_MAX_STEPS + 1):
            candidate = centre + direction * stride * _PROFILE_STEP
            if (direction < 0 and candidate <= limit) or (direction > 0 and candidate >= limit):
                if exceeds(limit):
                    outer = limit
                break
            if exceeds(candidate):
                outer = candidate
                break
            inner = candidate

        if outer is None:
            endpoints.append(limit)
            censored.append(True)
            continue

        for _ in range(_PROFILE_BISECTIONS):
            if abs(outer - inner) < _PROFILE_TOLERANCE:
                break
            middle = 0.5 * (inner + outer)
            if exceeds(middle):
                outer = middle
            else:
                inner = middle
        endpoints.append(0.5 * (inner + outer))
        censored.append(False)

    return ProfileCI(
        lo=endpoints[0],
        hi=endpoints[1],
        lo_censored=censored[0],
        hi_censored=censored[1],
    )


def q_zero_statistic(dataset: Sequence[PreparedSeries], fitted: FitResult) -> float:
    """Return the likelihood-ratio statistic for "the trend never drifts".

    ``W = 2 (l_max - sup_{sigma_obs} l(sigma_accel = floor))``, where the floor is the
    bottom of :data:`SEARCH_BOX` and stands in for zero.

    Compared against :data:`evaluation.constants.CHI2_MIX_95` rather than the usual
    chi-square quantile. Under ``sigma_accel = 0`` the parameter sits on the boundary of its
    space, so the statistic is distributed as a 50:50 mixture of a point mass at zero and a
    chi-square with one degree of freedom, and the 5% critical value is 2.71 rather than
    3.84. Using the larger cutoff would make the test conservative and understate how often
    the data can detect process noise at all -- which is precisely the quantity of interest.
    """
    objective = _Objective(dataset, fitted.sigma_v0)
    floor = SEARCH_BOX[1][0]
    restricted = _profile_loglik(objective, 1, floor)
    return max(0.0, 2.0 * (fitted.loglik - restricted))


def objective_discrepancy(
    observations: Sequence[Observation],
    log10_sigma_obs: float,
    log10_sigma_accel: float,
    sigma_v0: float,
    *,
    time_axis: TimeAxis = DEFAULT_TIME_AXIS,
) -> float:
    """Return ``|innovations_loglik - run_filter().loglik|`` at one parameter point.

    Called by E3 and E4 at every fitted optimum, and the maximum is published. Speed is the
    only reason the fitting objective is not simply :func:`app.core.filter.run_filter`, so
    the claim that the two agree is checked at the exact points the estimates came from
    rather than assumed from E1's battery. Measured maximum across the whole grid is
    reported in ``e34_estimation.json``.
    """
    from app.core.filter import run_filter
    from app.core.types import ModelParams

    params = ModelParams(
        sigma_obs_kg=10.0**log10_sigma_obs,
        sigma_accel=10.0**log10_sigma_accel,
        sigma_v0=sigma_v0,
    )
    filtered = run_filter(observations, params, time_axis=time_axis).loglik
    lean = innovations_loglik(
        prepare_series(observations, time_axis=time_axis),
        params.sigma_obs_kg,
        params.sigma_accel,
        params.sigma_v0,
    )
    return abs(filtered - lean)
