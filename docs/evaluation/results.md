<!-- GENERATED FILE - DO NOT EDIT.

Regenerate with, from `backend/`:

    uv run python -m evaluation.run tables

The numbers come from `backend/evaluation/results/*.json`, which are themselves produced
by `uv run python -m evaluation.run all`. Interpretation lives in `report.md`; this file
is only the measurements.
-->

# M6 evaluation results

Every figure below comes from synthetic data. No real health data has been used for any
evaluation. See [report.md](report.md) for what these numbers do and do not establish.

## E1 - independent exact likelihood verification

Three computations of the same log-likelihood compared across every combination of 27 parameter settings, five gap patterns and six series lengths: the shipped filter, the lean recursion the fits optimise, and an independent `O(n^3)` joint-Gaussian oracle.

| Quantity | Value |
|---|---|
| Cases | 810 |
| Well conditioned (oracle usable) | 781 |
| Ill conditioned (oracle not arbiter) | 29 |
| Max filter-vs-lean relative difference | 2.07e-14 |
| Max filter-vs-oracle relative difference (well conditioned) | 4.28e-10 |
| Max lean-vs-oracle relative difference (well conditioned) | 4.28e-10 |
| Max forecast mean difference, kg | 1.22e-08 |
| Max forecast variance relative difference | 9.08e-10 |
| Max condition number encountered | 1.62e+10 |
| Recursions agree | yes |
| Oracle agrees where conditioned | yes |
| **Gate passed** | **yes** |

Tolerances: `1e-10` between the two recursions, `1e-08` against the oracle on cases whose covariance condition number is at or below `1e+08`.

## E2 - calibration on model-consistent data

Data drawn from the estimator's own assumptions, so the posterior is the exact conditional distribution and every nominal value below must be met. Intervals are clustered by series: the mean across series plus or minus the Student-t interval on that mean.

### daily (500 series, 60 readings, 59.0 days)

| Statistic | Nominal | Mean | 95% CI | Deviation (SE) | Contains |
|---|---|---|---|---|---|
| `coverage_w` | 0.95 | 0.9490 | [0.9434, 0.9546] | -0.35 | yes |
| `coverage_v` | 0.95 | 0.9497 | [0.9439, 0.9554] | -0.11 | yes |
| `anis` | 1.00 | 1.0060 | [0.9900, 1.0220] | +0.73 | yes |
| `anees` | 2.00 | 1.9955 | [1.9235, 2.0675] | -0.12 | yes |

### irregular (500 series, 23 readings, 112.5 days)

| Statistic | Nominal | Mean | 95% CI | Deviation (SE) | Contains |
|---|---|---|---|---|---|
| `coverage_w` | 0.95 | 0.9490 | [0.9433, 0.9548] | -0.33 | yes |
| `coverage_v` | 0.95 | 0.9491 | [0.9425, 0.9558] | -0.26 | yes |
| `anis` | 1.00 | 1.0022 | [0.9745, 1.0298] | +0.15 | yes |
| `anees` | 2.00 | 2.0126 | [1.9389, 2.0862] | +0.33 | yes |

### Verdict

| Check | Value |
|---|---|
| Interval checks | 8 |
| Interval misses | 0 |
| Statistics beyond 4 SE | 0 |
| Investigation triggered | no |

## E3 - identifiability across calendar span and observation count

Interval widths are in orders of magnitude (`log10`). *Censored* means the profile never crossed the threshold before reaching the bottom of the search space, so the interval was reported at the bound. *Floor* means the point estimate itself came to rest there. *Detect drift* is the share of replicates rejecting `sigma_accel = 0` at the boundary-corrected 5% cutoff of `2.706`.

The two *CI covers* columns are the profile interval's coverage of the true value, against a nominal 95%. A censored endpoint is counted at the search bound rather than dropped, which can only make coverage look better than it is, so those columns are read alongside *Censored low* and not instead of it. *Redrawn* is how many of the cell's replicates were resampled because a model-consistent draw wandered to a non-positive weight, which `Observation` refuses.

| Span (d) | n | dt (d) | sigma_obs CI width | sigma_accel CI width | Censored low | At floor | Detect drift | sigma_obs CI covers | sigma_accel CI covers | Redrawn |
|---|---|---|---|---|---|---|---|---|---|---|
| 29 | 30 | 1.000 | 0.237 | 4.738 | 96.5% | 53.5% | 6.0% | 94.5% | 97.5% | 0/200 |
| 30 | 30 | 1.034 | 0.236 | 4.806 | 100.0% | 64.0% | 0.0% | 94.0% | 100.0% | 0/50 |
| 30 | 120 | 0.252 | 0.112 | 3.892 | 80.0% | 34.0% | 24.0% | 94.0% | 98.0% | 0/50 |
| 30 | 300 | 0.100 | 0.070 | 3.376 | 68.0% | 30.0% | 36.0% | 96.0% | 98.0% | 0/50 |
| 90 | 30 | 3.103 | 0.245 | 2.353 | 42.0% | 16.0% | 64.0% | 96.0% | 94.0% | 0/50 |
| 90 | 120 | 0.756 | 0.114 | 1.596 | 22.0% | 2.0% | 82.0% | 92.0% | 94.0% | 0/50 |
| 90 | 300 | 0.301 | 0.071 | 1.004 | 8.0% | 2.0% | 94.0% | 86.0% | 98.0% | 0/50 |
| 119 | 120 | 1.000 | 0.114 | 0.984 | 8.0% | 2.0% | 94.0% | 93.0% | 92.5% | 0/200 |
| 299 | 300 | 1.000 | 0.072 | 0.414 | 0.0% | 0.0% | 100.0% | 97.0% | 98.0% | 11/200 |
| 365 | 30 | 12.586 | 0.304 | 0.551 | 0.0% | 0.0% | 100.0% | 96.0% | 94.0% | 6/50 |
| 365 | 120 | 3.067 | 0.119 | 0.423 | 0.0% | 0.0% | 100.0% | 88.0% | 94.0% | 8/50 |
| 365 | 300 | 1.221 | 0.072 | 0.370 | 0.0% | 0.0% | 100.0% | 98.0% | 92.0% | 7/50 |

## E4 - parameter recovery on daily data

Bias and error in orders of magnitude, each with its Monte Carlo standard error over 200 replicates. *Median ratio* is the median estimate divided by the truth, on the natural scale.

| n | Parameter | Bias (log10) | Distinguishable from 0 | RMSE (log10) | Median ratio | CI coverage |
|---|---|---|---|---|---|---|
| 30 | `sigma_obs` | -0.0122 +- 0.0047 | yes | 0.0675 | 0.990 | 94.5% |
| 30 | `sigma_accel` | -1.9548 +- 0.1497 | yes | 2.8778 | 0.000 | 97.5% |
| 120 | `sigma_obs` | -0.0016 +- 0.0023 | no | 0.0321 | 1.002 | 93.0% |
| 120 | `sigma_accel` | -0.1419 +- 0.0420 | yes | 0.6097 | 0.937 | 92.5% |
| 300 | `sigma_obs` | -0.0014 +- 0.0012 | no | 0.0173 | 0.997 | 97.0% |
| 300 | `sigma_accel` | -0.0256 +- 0.0070 | yes | 0.1019 | 0.969 | 98.0% |

### sigma_v0 sensitivity - effect on the other two estimates

Fitted on 200 series of 30 daily readings, with `sigma_v0` held at each multiple of its shipped value.

| Factor | sigma_v0 | Bias in sigma_obs | Bias in sigma_accel |
|---|---|---|---|
| x0.5 | 0.07143 | -0.0083 | -1.4559 |
| x1 | 0.14286 | -0.0094 | -2.1492 |
| x2 | 0.28571 | -0.0099 | -2.1143 |

### sigma_v0 sensitivity - effect on what the user sees

The shipped estimator run with the shipped priors and only `sigma_v0` varied. Widths are full 95% interval widths in kg.

| Readings | Factor | Weight interval | Weekly-rate interval | 30-day forecast interval |
|---|---|---|---|---|
| 2 | x0.5 | 1.393 | 1.963 | 9.17 |
| 2 | x1 | 1.413 | 3.848 | 17.09 |
| 2 | x2 | 1.480 | 7.272 | 31.86 |
| 5 | x0.5 | 1.017 | 1.832 | 8.93 |
| 5 | x1 | 1.209 | 2.930 | 13.75 |
| 5 | x2 | 1.395 | 3.807 | 17.68 |
| 10 | x0.5 | 0.999 | 1.287 | 6.99 |
| 10 | x1 | 1.102 | 1.471 | 7.83 |
| 10 | x2 | 1.140 | 1.537 | 8.13 |
| 30 | x0.5 | 0.803 | 0.726 | 4.78 |
| 30 | x1 | 0.804 | 0.726 | 4.78 |
| 30 | x2 | 0.804 | 0.726 | 4.78 |

## E5 - comparison against simpler methods

Every baseline is tuned on a disjoint training split drawn from the same regime; the shipped estimator is not tuned at all. *Better* and *worse* mean the paired per-series difference against the shipped estimator has a 95% interval entirely below or above zero.

| Quantity | Value |
|---|---|
| Comparisons | 80 |
| Methods beating the shipped estimator | 31 |
| ...of which are not Kalman variants | 20 |
| Methods losing to the shipped estimator | 44 |
| Regimes where a simple baseline wins | flat, irregular, jump, outliers, plateau, steady_loss |

### Tuned parameters

| Regime | MA window | EWMA tau | Holt level / trend tau | Fitted sigma_obs | Fitted sigma_accel |
|---|---|---|---|---|---|
| `model_correct` | 3 d | 1 d | 4 / 7 d | 0.4925 | 0.008663 |
| `flat` | 28 d | 14 d | 14 / 480 d | 0.5041 | 0.000685 |
| `steady_loss` | 7 d | 2 d | 7 / 14 d | 0.5002 | 0.000316 |
| `plateau` | 7 d | 4 d | 7 / 7 d | 0.4880 | 0.006774 |
| `curvature` | 7 d | 4 d | 4 / 28 d | 0.4990 | 0.004376 |
| `jump` | 3 d | 2 d | 2 / 28 d | 0.5617 | 0.031747 |
| `irregular` | 14 d | 2 d | 28 / 28 d | 0.4931 | 0.000072 |
| `outliers` | 7 d | 4 d | 14 / 14 d | 0.9899 | 0.000001 (floor) |

### One-step-ahead mean absolute error, observed space (kg)

Scored against noisy readings, so no method can do better than the measurement noise itself: about 0.40 kg here. The methods are closer together than they are different.

**`model_correct`**

| Method | MAE (kg) | Difference vs shipped [95% CI] | Verdict |
|---|---|---|---|
| LOCF | 0.5732 | +0.1368 [+0.1301, +0.1434] | worse |
| Moving avg | 0.5132 | +0.0768 [+0.0634, +0.0901] | worse |
| EWMA | 0.5137 | +0.0772 [+0.0688, +0.0856] | worse |
| Holt | 0.4433 | +0.0068 [+0.0052, +0.0083] | worse |
| Kalman (shipped) | 0.4365 | reference | - |
| Kalman (fitted) | 0.4364 | -0.0000 [-0.0003, +0.0002] | unclear |

**`flat`**

| Method | MAE (kg) | Difference vs shipped [95% CI] | Verdict |
|---|---|---|---|
| LOCF | 0.5758 | +0.1424 [+0.1354, +0.1495] | worse |
| Moving avg | 0.4097 | -0.0237 [-0.0256, -0.0217] | better |
| EWMA | 0.4125 | -0.0209 [-0.0228, -0.0190] | better |
| Holt | 0.4124 | -0.0210 [-0.0229, -0.0191] | better |
| Kalman (shipped) | 0.4334 | reference | - |
| Kalman (fitted) | 0.4208 | -0.0126 [-0.0141, -0.0112] | better |

**`steady_loss`**

| Method | MAE (kg) | Difference vs shipped [95% CI] | Verdict |
|---|---|---|---|
| LOCF | 0.5686 | +0.1386 [+0.1328, +0.1444] | worse |
| Moving avg | 0.4564 | +0.0263 [+0.0239, +0.0288] | worse |
| EWMA | 0.4579 | +0.0278 [+0.0255, +0.0302] | worse |
| Holt | 0.4279 | -0.0021 [-0.0038, -0.0004] | better |
| Kalman (shipped) | 0.4300 | reference | - |
| Kalman (fitted) | 0.4176 | -0.0124 [-0.0140, -0.0108] | better |

**`plateau`**

| Method | MAE (kg) | Difference vs shipped [95% CI] | Verdict |
|---|---|---|---|
| LOCF | 0.5649 | +0.1307 [+0.1240, +0.1373] | worse |
| Moving avg | 0.4512 | +0.0170 [+0.0146, +0.0194] | worse |
| EWMA | 0.4524 | +0.0182 [+0.0158, +0.0205] | worse |
| Holt | 0.4375 | +0.0032 [+0.0015, +0.0050] | worse |
| Kalman (shipped) | 0.4342 | reference | - |
| Kalman (fitted) | 0.4341 | -0.0002 [-0.0004, +0.0000] | unclear |

**`curvature`**

| Method | MAE (kg) | Difference vs shipped [95% CI] | Verdict |
|---|---|---|---|
| LOCF | 0.5642 | +0.1329 [+0.1270, +0.1388] | worse |
| Moving avg | 0.4525 | +0.0212 [+0.0187, +0.0236] | worse |
| EWMA | 0.4570 | +0.0257 [+0.0231, +0.0282] | worse |
| Holt | 0.4359 | +0.0046 [+0.0030, +0.0061] | worse |
| Kalman (shipped) | 0.4313 | reference | - |
| Kalman (fitted) | 0.4285 | -0.0028 [-0.0036, -0.0021] | better |

**`jump`**

| Method | MAE (kg) | Difference vs shipped [95% CI] | Verdict |
|---|---|---|---|
| LOCF | 0.5795 | +0.0661 [+0.0583, +0.0739] | worse |
| Moving avg | 0.4989 | -0.0144 [-0.0195, -0.0093] | better |
| EWMA | 0.4917 | -0.0216 [-0.0255, -0.0178] | better |
| Holt | 0.4833 | -0.0300 [-0.0335, -0.0266] | better |
| Kalman (shipped) | 0.5134 | reference | - |
| Kalman (fitted) | 0.4999 | -0.0134 [-0.0163, -0.0106] | better |

**`irregular`**

| Method | MAE (kg) | Difference vs shipped [95% CI] | Verdict |
|---|---|---|---|
| LOCF | 0.6449 | +0.1536 [+0.1436, +0.1636] | worse |
| Moving avg | 0.6108 | +0.1195 [+0.1114, +0.1277] | worse |
| EWMA | 0.6180 | +0.1267 [+0.1181, +0.1354] | worse |
| Holt | 0.4917 | +0.0004 [-0.0090, +0.0098] | unclear |
| Kalman (shipped) | 0.4913 | reference | - |
| Kalman (fitted) | 0.4225 | -0.0688 [-0.0748, -0.0628] | better |

**`outliers`**

| Method | MAE (kg) | Difference vs shipped [95% CI] | Verdict |
|---|---|---|---|
| LOCF | 0.8874 | +0.2363 [+0.2279, +0.2447] | worse |
| Moving avg | 0.6740 | +0.0229 [+0.0192, +0.0266] | worse |
| EWMA | 0.6718 | +0.0207 [+0.0174, +0.0240] | worse |
| Holt | 0.6336 | -0.0175 [-0.0229, -0.0121] | better |
| Kalman (shipped) | 0.6511 | reference | - |
| Kalman (fitted) | 0.6046 | -0.0464 [-0.0500, -0.0429] | better |

### Thirty-day forecast mean absolute error against latent truth (kg)

What the product claims to do, and only measurable because the truth is known.

**`model_correct`**

| Method | MAE (kg) | Difference vs shipped [95% CI] | Verdict |
|---|---|---|---|
| LOCF | 3.8949 | +2.8931 [+2.3808, +3.4053] | worse |
| Moving avg | 4.0642 | +3.0624 [+2.5282, +3.5965] | worse |
| EWMA | 3.9587 | +2.9569 [+2.4374, +3.4764] | worse |
| Holt | 1.0738 | +0.0720 [+0.0156, +0.1285] | worse |
| Kalman (shipped) | 1.0018 | reference | - |
| Kalman (fitted) | 1.0025 | +0.0007 [-0.0052, +0.0066] | unclear |

**`flat`**

| Method | MAE (kg) | Difference vs shipped [95% CI] | Verdict |
|---|---|---|---|
| LOCF | 0.4104 | -0.0667 [-0.1152, -0.0181] | better |
| Moving avg | 0.0700 | -0.4071 [-0.4469, -0.3673] | better |
| EWMA | 0.0738 | -0.4033 [-0.4414, -0.3651] | better |
| Holt | 0.0831 | -0.3940 [-0.4318, -0.3562] | better |
| Kalman (shipped) | 0.4771 | reference | - |
| Kalman (fitted) | 0.1565 | -0.3206 [-0.3603, -0.2809] | better |

**`steady_loss`**

| Method | MAE (kg) | Difference vs shipped [95% CI] | Verdict |
|---|---|---|---|
| LOCF | 1.5192 | +1.0597 [+0.9910, +1.1284] | worse |
| Moving avg | 1.6788 | +1.2193 [+1.1698, +1.2687] | worse |
| EWMA | 1.5902 | +1.1307 [+1.0769, +1.1845] | worse |
| Holt | 0.3405 | -0.1190 [-0.1378, -0.1001] | better |
| Kalman (shipped) | 0.4595 | reference | - |
| Kalman (fitted) | 0.1669 | -0.2926 [-0.3382, -0.2469] | better |

**`plateau`**

| Method | MAE (kg) | Difference vs shipped [95% CI] | Verdict |
|---|---|---|---|
| LOCF | 0.3655 | -0.7421 [-0.8010, -0.6832] | better |
| Moving avg | 0.1920 | -0.9156 [-0.9662, -0.8650] | better |
| EWMA | 0.1832 | -0.9243 [-0.9764, -0.8722] | better |
| Holt | 1.0587 | -0.0489 [-0.0722, -0.0256] | better |
| Kalman (shipped) | 1.1076 | reference | - |
| Kalman (fitted) | 1.1313 | +0.0237 [+0.0167, +0.0308] | worse |

**`curvature`**

| Method | MAE (kg) | Difference vs shipped [95% CI] | Verdict |
|---|---|---|---|
| LOCF | 0.7366 | +0.2235 [+0.1446, +0.3025] | worse |
| Moving avg | 0.8033 | +0.2903 [+0.2315, +0.3491] | worse |
| EWMA | 0.8097 | +0.2967 [+0.2363, +0.3570] | worse |
| Holt | 0.6403 | +0.1272 [+0.0987, +0.1558] | worse |
| Kalman (shipped) | 0.5131 | reference | - |
| Kalman (fitted) | 0.5519 | +0.0388 [+0.0166, +0.0610] | worse |

**`jump`**

| Method | MAE (kg) | Difference vs shipped [95% CI] | Verdict |
|---|---|---|---|
| LOCF | 2.3880 | +0.0563 [-0.0291, +0.1417] | unclear |
| Moving avg | 2.4106 | +0.0789 [+0.0096, +0.1482] | worse |
| EWMA | 2.4273 | +0.0956 [+0.0253, +0.1658] | worse |
| Holt | 1.7850 | -0.5468 [-0.5812, -0.5123] | better |
| Kalman (shipped) | 2.3317 | reference | - |
| Kalman (fitted) | 1.7622 | -0.5695 [-0.6735, -0.4655] | better |

**`irregular`**

| Method | MAE (kg) | Difference vs shipped [95% CI] | Verdict |
|---|---|---|---|
| LOCF | 1.6377 | +1.0360 [+0.9726, +1.0993] | worse |
| Moving avg | 1.7199 | +1.1181 [+1.0607, +1.1756] | worse |
| EWMA | 1.6540 | +1.0522 [+0.9921, +1.1123] | worse |
| Holt | 0.3637 | -0.2381 [-0.2818, -0.1944] | better |
| Kalman (shipped) | 0.6018 | reference | - |
| Kalman (fitted) | 0.1814 | -0.4203 [-0.4644, -0.3763] | better |

**`outliers`**

| Method | MAE (kg) | Difference vs shipped [95% CI] | Verdict |
|---|---|---|---|
| LOCF | 1.6657 | +0.8829 [+0.7711, +0.9947] | worse |
| Moving avg | 1.6928 | +0.9100 [+0.8148, +1.0053] | worse |
| EWMA | 1.6914 | +0.9086 [+0.8149, +1.0023] | worse |
| Holt | 0.4390 | -0.3438 [-0.4206, -0.2670] | better |
| Kalman (shipped) | 0.7828 | reference | - |
| Kalman (fitted) | 0.2233 | -0.5595 [-0.6474, -0.4717] | better |

### Interval coverage, nominal 95%

Only the two Kalman variants state an interval. LOCF, moving average, EWMA and Holt produce point predictions with no error model, so no coverage is reported for them rather than one being invented.

| Regime | One-step (shipped) | One-step (fitted) | 30-day (shipped) | 30-day (fitted) | Achieved horizon (d) |
|---|---|---|---|---|---|
| `model_correct` | 95.0% | 94.8% | 94.3% | 95.7% | 30.0-30.0 |
| `flat` | 95.3% | 95.1% | 100.0% | 98.7% | 30.0-30.0 |
| `steady_loss` | 95.5% | 95.1% | 100.0% | 94.3% | 30.0-30.0 |
| `plateau` | 95.2% | 94.5% | 93.7% | 86.0% | 30.0-30.0 |
| `curvature` | 95.4% | 94.9% | 100.0% | 99.3% | 30.0-30.0 |
| `jump` | 90.7% | 95.5% | 48.0% | 100.0% | 30.0-30.0 |
| `irregular` | 96.6% | 95.3% | 100.0% | 91.3% | 30.8-33.5 |
| `outliers` | 87.7% | 95.0% | 94.3% | 99.7% | 30.0-30.0 |
