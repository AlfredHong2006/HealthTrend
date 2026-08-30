Marks an anomalous reading without hiding it or dramatising it. The hollow ink ring is the same mark `TrajectoryChart` draws via `outlierIndices`.

```jsx
<OutlierFlag residual="+2.8σ" />
<MeasurementTable rows={rows} unit="kg" />   {/* rows[i].outlier = true */}
```

Rules: the reading is never deleted, never greyed out of the table, and never coloured red — an outlier is information about the measurement, not a verdict. State the residual in σ so the reader can judge it. If several consecutive readings are flagged, that is a data problem to describe in prose, not more rings.
