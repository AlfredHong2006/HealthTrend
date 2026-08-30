The hero-slot replacement for a user whose readings cannot yet support a trajectory estimate. Use it instead of `HeroMetric` whenever `HTFormat.confidence()` returns `insufficient` — never a hero number with a caveat next to it.

```jsx
<InsufficientData
  label="ESTIMATED TREND WEIGHT"
  statement="Not enough readings to estimate a trajectory"
  readings={4} needed={10}
  detail="the filter needs about two weeks of history"
  latest="last reading 82.1 kg, yesterday" />
```

The tick row is a reading count, not a progress meter — no percentage, no fill animation, no completion language. Below three readings a week the estimate is mostly prior, so say that in `detail` rather than showing a weak line.

Pair with `TrajectoryChart confidence="insufficient"`, which plots the raw readings and draws no trajectory, no bands and no projection.
