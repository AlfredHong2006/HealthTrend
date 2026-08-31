# HealthTrend 1B Editorial — Implementation Notes

These notes override any conflicting wording in the exported Claude Design artefacts.

## 1. No fake down-weighting

The current shipped HealthTrend model is a fixed-parameter linear-Gaussian state-space model.

It does NOT currently implement robust observation weighting or an outlier/down-weighting rule.

Therefore:

- do not implement the fixture's 0.93 kg threshold
- do not show rings meaning "down-weighted"
- do not claim any reading was down-weighted
- remove any fixture-only down-weighting markers when real data is connected

If robust observation handling is implemented in the future, it requires a separate statistical/product decision.

## 2. Residual terminology

Do not call an arbitrary difference between a measurement and the displayed posterior estimate a Kalman residual or innovation.

The true innovation is a model diagnostic and is not necessarily part of the current public analysis contract.

If the UI transparently computes:

measurement - displayed estimated trajectory

call it something plain such as:

"difference from estimate"

A derived RMS may only be shown if it is clearly described as measurement scatter around the estimated trajectory, not as model innovation variance.

Do not manufacture statistical diagnostics.

## 3. Velocity/rate uncertainty

Do not substitute an OLS slope standard error or any other approximation for uncertainty in the velocity state.

Only display a rate interval if the real HealthTrend model/API exposes the appropriate posterior velocity uncertainty.

If the posterior velocity uncertainty exists internally but is not currently exposed through the API contract, stop and report the exact data-contract gap before changing backend/API behaviour.

Do not silently invent the interval.

## 4. Evaluation claims

Do not add made-up evaluation figures to Method.

M6 supports the qualitative conclusion that short-history per-user/per-request parameter fitting is not justified and that fixed documented priors remain the production default for now.

No numerical M6 figure is required in the V2 frontend.

Any future numerical evaluation claim must come directly from the committed M6 evaluation results/docs.

## 5. First-deployment navigation

Ship only real destinations:

- Analysis
- Method

Do not leave dead Measurements or Settings navigation items.

They can return when those product surfaces actually exist.

## 6. Fixture removal

All fixture-generated values, dates, badges, labels, thresholds and generator logic in the Claude Design export are layout references only.

Implementation must use the real HealthTrend analysis output.

If a designed slot requires data the current product does not actually produce, omit the slot or stop and report the contract gap rather than approximating it.