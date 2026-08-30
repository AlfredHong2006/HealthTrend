Tier 1. The model's estimated trajectory value — exactly one per screen, and the only element allowed at 112px. The current rate rides along in `rate` so it stays adjacent to the trajectory instead of sinking into the statistics group.

```jsx
<HeroMetric
  label="ESTIMATED TREND WEIGHT"
  value={HTFormat.trendWeight(76.2, { confidence: 'ok' })}
  unit="kg" digits={HTFormat.digitSlots('kg')}
  interval={HTFormat.plusMinus(0.70, { level: 68 })}
  asOf={HTFormat.asOf(new Date())}
  rate={<TrendDelta value="−0.27 kg/week" direction="down"
          interval="95% CI −0.34 to −0.19" />} />
```

Confidence changes the treatment, not the wording: `wide` steps the numeral back one ink step and expects `HTFormat` to have dropped a decimal; `insufficient` replaces the number with a tier-2 statement (or use `InsufficientData` for the whole region); `stale` keeps the number and adds the amber clause to the qualifier row.

Always pass `digits` on any surface where the unit can change — `168.0 lb` is a slot wider than `76.2 kg`, and at 112px with −0.035em tracking the shift is visible.
