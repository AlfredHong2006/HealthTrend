The single largest number on a HealthTrend screen — the estimated trajectory, never a raw scale reading.

\`\`\`jsx
<HeroMetric label="Estimated trend weight" value="81.4" unit="kg"
  interval="±0.28 kg (68%)" asOf="as of today, 06:40" />
\`\`\`

Rules: one per view; always carry an interval when the model produces one; never render a measured value here.
