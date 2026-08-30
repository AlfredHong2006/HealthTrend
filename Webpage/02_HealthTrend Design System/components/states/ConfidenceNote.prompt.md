The one-clause statement of what uncertainty is doing to the estimate. Use it directly beneath any metric whose `HTFormat.confidence()` is not `ok`.

```jsx
<HeroMetric label="ESTIMATED TREND WEIGHT" value="76" unit="kg"
  confidence="wide" interval="±0.8 kg (68%)" digits={5} />
<ConfidenceNote level="wide" />
```

Levels carry default copy: `wide` → "The interval is wide enough that the direction is not yet established."; `stale` → "Gaps widen the band; they do not move the line."; `insufficient` → "Below three readings a week, the estimate is mostly prior." `ok` renders nothing.

Override the copy only with another sentence that traces to a model quantity — `"99.7% of the posterior mass for velocity sits below zero."` is allowed; `"Keep going!"` is not. Use `Qualifier` instead for plain intervals, counts and windows; `ConfidenceNote` is specifically for the confidence claim.
