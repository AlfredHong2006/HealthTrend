# UI kit — HealthTrend web app

Click-through recreation of the product's application surface, composed entirely from this
design system's components (no re-implemented primitives).

| File | Surface |
| --- | --- |
| `index.html` | Entry: shell + view switching + weigh-in panel. Open this. |
| `AppShell.jsx` | Left nav (with 30-day sparkline), header (sync qualifier, model badge, actions). |
| `TrendScreen.jsx` | **Hero view.** Tier-1 estimate, tier-2 context row, the trajectory chart, legend, whole-history range strip, and a short prose block. |
| `MeasurementsScreen.jsx` | Tier-3 ledger: measurement table, residual summary, readings-vs-estimate figure. |
| `EvidenceScreen.jsx` | Fitted parameters, posterior statements, residual diagnostics, and an explicit "claims the model does not make" list. |
| `SettingsScreen.jsx` | Display vs model settings, hairline rows, no cards. |
| `LogWeighIn.jsx` | Right-hand entry panel — the only floating surface in the app. |
| `fixtures.js` | Deterministic 420-day series, 103 readings, 30-day projection. `window.HT_FIXTURES`. |

Interactions: nav switches views; range switcher re-scales the chart; raw/projection layers toggle;
hovering the chart shows the crosshair readout; the range strip moves the window; "Log a weigh-in"
opens the panel.

Not recreated (absent from the brief): auth, onboarding, notifications, mobile layout.
