<!-- GENERATED FILE - DO NOT EDIT.

Regenerate with, from `backend/`:

    uv run python -m evaluation.run tables

The numbers come from `backend/evaluation/results/e6_plan_alignment.json` and
`e7_departure.json`, produced by `uv run python -m evaluation.run m7a`. The rules and
thresholds are in `m7a_preregistration.md`; interpretation lives in `m7a_report.md`.
-->

# M7A evaluation results: plan alignment and departure detection

Every figure below comes from synthetic data. No real health data has been used for any
evaluation, and nothing here is a product capability. See
[m7a_preregistration.md](m7a_preregistration.md) for the rules and
[m7a_report.md](m7a_report.md) for what the numbers do and do not establish.

## E6 - on-plan probability

1000 series per configuration. Primary check-ins are days 28 to 84. The shipped probability is computed only once the trend-established gate is open.

### Pre-registered verdict

**Gated filter (experimental): eligible = yes** (0 failed)

| Criterion | Value | Result | Note |
|---|---|---|---|
| E6-A model_consistent/daily citl contains 0 | 0.0017 | pass |  |
| E6-A model_consistent/daily ece | 0.0069 | pass |  |
| E6-A model_consistent/irregular citl contains 0 | -0.0010 | pass |  |
| E6-A model_consistent/irregular ece | 0.0105 | pass |  |
| E6-B steady/daily departure tail | 0.0000 | pass | upper 0.0113 |
| E6-B steady/daily consistency tail | 0.8910 | pass | mean pi 0.6795 |
| E6-B steady_irregular/irregular departure tail | 0.0000 | pass | upper 0.0155 |
| E6-B steady_irregular/irregular consistency tail | 0.8490 | pass | mean pi 0.6336 |
| E6-B steady_missing/missing departure tail | 0.0000 | pass | upper 0.0112 |
| E6-B steady_missing/missing consistency tail | 0.8945 | pass | mean pi 0.6594 |
| E6-C plateau/daily departure tail | 0.0160 | pass | upper 0.0210 |
| E6-C gradual_rate_change/daily departure tail | 0.0048 | pass | upper 0.0082 |
| E6-C curved/daily departure tail | 0.0004 | pass | upper 0.0013 |

**Kalman posterior (shipped): eligible = yes** (0 failed)

| Criterion | Value | Result | Note |
|---|---|---|---|
| E6-A model_consistent/daily citl contains 0 | 0.0017 | pass |  |
| E6-A model_consistent/daily ece | 0.0066 | pass |  |
| E6-A model_consistent/irregular citl contains 0 | -0.0005 | pass |  |
| E6-A model_consistent/irregular ece | 0.0092 | pass |  |
| E6-B steady/daily departure tail | 0.0000 | pass | upper 0.0113 |
| E6-B steady/daily consistency tail | 0.8919 | pass | mean pi 0.6793 |
| E6-B steady_irregular/irregular departure tail | 0.0000 | pass | upper 0.0156 |
| E6-B steady_irregular/irregular consistency tail | 0.8487 | pass | mean pi 0.6336 |
| E6-B steady_missing/missing departure tail | 0.0000 | pass | upper 0.0113 |
| E6-B steady_missing/missing consistency tail | 0.8929 | pass | mean pi 0.6597 |
| E6-C plateau/daily departure tail | 0.0160 | pass | upper 0.0210 |
| E6-C gradual_rate_change/daily departure tail | 0.0048 | pass | upper 0.0082 |
| E6-C curved/daily departure tail | 0.0004 | pass | upper 0.0013 |

### Calibration and sharpness

| Configuration | Method | Assessable | CITL [95% CI] | ECE | Brier | In band when pi <= 0.05 | In band when pi >= 0.6 (mean pi) | Share pi <= 0.05 | Share pi >= 0.8 |
|---|---|---|---|---|---|---|---|---|---|
| curved/daily | Gated filter (experimental) | 100.0% | -0.0470 [-0.0621, -0.0319] | 0.0987 | 0.1108 | 0.0% [0.0%, 0.1%] (n=2297) | 89.0% (0.679) | 25.5% | 0.0% |
| curved/daily | Kalman posterior (shipped) | 100.0% | -0.0467 [-0.0618, -0.0316] | 0.0993 | 0.1107 | 0.0% [0.0%, 0.1%] (n=2295) | 89.0% (0.679) | 25.5% | 0.0% |
| curved/daily | OLS 28-day | 100.0% | -0.0132 [-0.0245, -0.0018] | 0.0232 | 0.0932 | 1.4% [1.0%, 1.8%] (n=3831) | 85.5% (0.870) | 42.6% | 25.1% |
| curved/daily | Weekly means | 100.0% | -0.1084 [-0.1297, -0.0872] | 0.1103 | 0.2017 | 6.6% [5.2%, 8.0%] (n=1756) | 66.9% (0.657) | 19.5% | 0.1% |
| curved/daily | Weekly means, point (0/1) | 100.0% | -0.0687 [-0.0878, -0.0496] | 0.3009 | 0.3009 | 26.8% [24.4%, 29.1%] (n=6215) | 62.5% (1.000) | 69.1% | 30.9% |
| gradual_rate_change/daily | Gated filter (experimental) | 100.0% | 0.0132 [0.0044, 0.0220] | 0.0349 | 0.1424 | 0.5% [0.1%, 0.8%] (n=1653) | 71.6% (0.679) | 18.4% | 0.0% |
| gradual_rate_change/daily | Kalman posterior (shipped) | 100.0% | 0.0129 [0.0041, 0.0217] | 0.0353 | 0.1420 | 0.5% [0.1%, 0.8%] (n=1655) | 71.5% (0.679) | 18.4% | 0.0% |
| gradual_rate_change/daily | OLS 28-day | 100.0% | 0.0369 [0.0267, 0.0472] | 0.1049 | 0.1655 | 5.4% [4.5%, 6.2%] (n=3568) | 66.3% (0.866) | 39.6% | 24.5% |
| gradual_rate_change/daily | Weekly means | 100.0% | -0.0572 [-0.0680, -0.0463] | 0.0697 | 0.1971 | 6.0% [4.8%, 7.3%] (n=1612) | 53.1% (0.655) | 17.9% | 0.0% |
| gradual_rate_change/daily | Weekly means, point (0/1) | 100.0% | -0.0116 [-0.0235, 0.0004] | 0.3180 | 0.3180 | 24.2% [22.7%, 25.7%] (n=6131) | 51.9% (1.000) | 68.1% | 31.9% |
| level_shift/daily | Gated filter (experimental) | 100.0% | -0.0879 [-0.1128, -0.0630] | 0.1177 | 0.2162 | 31.9% [28.8%, 35.0%] (n=2334) | 75.9% (0.678) | 25.9% | 0.0% |
| level_shift/daily | Kalman posterior (shipped) | 100.0% | -0.0891 [-0.1144, -0.0637] | 0.1043 | 0.2224 | 30.4% [27.3%, 33.4%] (n=2425) | 72.0% (0.678) | 26.9% | 0.0% |
| level_shift/daily | OLS 28-day | 100.0% | -0.0923 [-0.1135, -0.0712] | 0.1518 | 0.2118 | 25.2% [22.7%, 27.8%] (n=4145) | 76.2% (0.849) | 46.1% | 17.2% |
| level_shift/daily | Weekly means | 100.0% | -0.1224 [-0.1501, -0.0946] | 0.1276 | 0.2464 | 26.8% [24.1%, 29.5%] (n=1764) | 56.0% (0.656) | 19.6% | 0.1% |
| level_shift/daily | Weekly means, point (0/1) | 100.0% | -0.0792 [-0.1053, -0.0532] | 0.3677 | 0.3677 | 32.3% [29.4%, 35.1%] (n=6230) | 53.1% (1.000) | 69.2% | 30.8% |
| model_consistent/daily | Gated filter (experimental) | 100.0% | 0.0017 [-0.0047, 0.0081] | 0.0069 | 0.0656 | 0.4% [0.2%, 0.5%] (n=6045) | 65.7% (0.678) | 67.2% | 0.0% |
| model_consistent/daily | Kalman posterior (shipped) | 100.0% | 0.0017 [-0.0046, 0.0081] | 0.0066 | 0.0653 | 0.4% [0.2%, 0.5%] (n=6044) | 66.1% (0.678) | 67.2% | 0.0% |
| model_consistent/daily | OLS 28-day | 100.0% | 0.0025 [-0.0033, 0.0083] | 0.0578 | 0.0798 | 2.3% [1.9%, 2.7%] (n=6966) | 61.2% (0.868) | 77.4% | 8.5% |
| model_consistent/daily | Weekly means | 100.0% | -0.0032 [-0.0130, 0.0066] | 0.0143 | 0.0853 | 0.9% [0.6%, 1.2%] (n=5149) | 58.3% (0.656) | 57.2% | 0.0% |
| model_consistent/daily | Weekly means, point (0/1) | 100.0% | 0.0012 [-0.0082, 0.0106] | 0.1446 | 0.1446 | 8.3% [7.2%, 9.3%] (n=7816) | 44.6% (1.000) | 86.8% | 13.2% |
| model_consistent/irregular | Gated filter (experimental) | 100.0% | -0.0010 [-0.0092, 0.0072] | 0.0105 | 0.0718 | 0.6% [0.3%, 0.8%] (n=5804) | 61.2% (0.634) | 64.5% | 0.0% |
| model_consistent/irregular | Kalman posterior (shipped) | 100.0% | -0.0005 [-0.0087, 0.0076] | 0.0092 | 0.0712 | 0.5% [0.2%, 0.7%] (n=5802) | 61.3% (0.634) | 64.5% | 0.0% |
| model_consistent/irregular | OLS 28-day | 44.4% | 0.0010 [-0.0085, 0.0105] | 0.0262 | 0.0773 | 1.7% [1.2%, 2.2%] (n=2667) | 57.7% (0.758) | 66.7% | 2.5% |
| model_consistent/irregular | Weekly means | 22.2% | -0.0286 [-0.0470, -0.0102] | 0.0359 | 0.1048 | 3.7% [2.3%, 5.0%] (n=792) | 50.0% (0.743) | 39.6% | 0.0% |
| model_consistent/irregular | Weekly means, point (0/1) | 22.2% | -0.0180 [-0.0396, 0.0036] | 0.1750 | 0.1750 | 10.8% [9.0%, 12.7%] (n=1780) | 28.6% (1.000) | 89.0% | 11.0% |
| plateau/daily | Gated filter (experimental) | 100.0% | 0.0617 [0.0478, 0.0756] | 0.0640 | 0.1361 | 1.6% [1.1%, 2.1%] (n=2692) | 57.4% (0.680) | 29.9% | 0.0% |
| plateau/daily | Kalman posterior (shipped) | 100.0% | 0.0619 [0.0481, 0.0758] | 0.0645 | 0.1357 | 1.6% [1.1%, 2.1%] (n=2694) | 57.4% (0.680) | 29.9% | 0.0% |
| plateau/daily | OLS 28-day | 100.0% | 0.0842 [0.0699, 0.0984] | 0.1382 | 0.1690 | 5.1% [4.2%, 5.9%] (n=4285) | 53.9% (0.869) | 47.6% | 21.2% |
| plateau/daily | Weekly means | 100.0% | 0.0116 [-0.0030, 0.0262] | 0.0341 | 0.1575 | 4.4% [3.4%, 5.4%] (n=2271) | 44.3% (0.664) | 25.2% | 0.1% |
| plateau/daily | Weekly means, point (0/1) | 100.0% | 0.0390 [0.0238, 0.0542] | 0.2743 | 0.2743 | 16.1% [14.6%, 17.6%] (n=6575) | 41.9% (1.000) | 73.1% | 26.9% |
| steady/daily | Gated filter (experimental) | 100.0% | -0.0168 [-0.0377, 0.0040] | 0.1278 | 0.1286 | 0.0% [0.0%, 1.1%] (n=606) | 89.1% (0.679) | 6.7% | 0.0% |
| steady/daily | Kalman posterior (shipped) | 100.0% | -0.0166 [-0.0374, 0.0042] | 0.1290 | 0.1281 | 0.0% [0.0%, 1.1%] (n=605) | 89.2% (0.679) | 6.7% | 0.0% |
| steady/daily | OLS 28-day | 100.0% | 0.0022 [-0.0127, 0.0172] | 0.0099 | 0.0931 | 0.9% [0.5%, 1.3%] (n=2836) | 86.5% (0.867) | 31.5% | 27.3% |
| steady/daily | Weekly means | 100.0% | -0.1001 [-0.1275, -0.0726] | 0.1050 | 0.2308 | 10.4% [8.0%, 12.9%] (n=807) | 59.0% (0.659) | 9.0% | 0.1% |
| steady/daily | Weekly means, point (0/1) | 100.0% | -0.0457 [-0.0710, -0.0203] | 0.3612 | 0.3612 | 32.1% [29.2%, 34.9%] (n=5712) | 56.8% (1.000) | 63.5% | 36.5% |
| steady_irregular/irregular | Gated filter (experimental) | 100.0% | -0.0275 [-0.0506, -0.0044] | 0.1153 | 0.1542 | 0.0% [0.0%, 1.6%] (n=451) | 84.9% (0.634) | 5.0% | 0.0% |
| steady_irregular/irregular | Kalman posterior (shipped) | 100.0% | -0.0271 [-0.0502, -0.0040] | 0.1155 | 0.1543 | 0.0% [0.0%, 1.6%] (n=446) | 84.9% (0.634) | 5.0% | 0.0% |
| steady_irregular/irregular | OLS 28-day | 44.4% | -0.0467 [-0.0706, -0.0228] | 0.0707 | 0.1887 | 6.8% [4.6%, 9.0%] (n=560) | 72.1% (0.754) | 14.0% | 6.9% |
| steady_irregular/irregular | Weekly means | 22.2% | -0.2484 [-0.2788, -0.2180] | 0.2504 | 0.3074 | 37.0% [30.5%, 43.5%] (n=262) | 50.0% (0.747) | 13.1% | 0.1% |
| steady_irregular/irregular | Weekly means, point (0/1) | 22.2% | -0.2065 [-0.2411, -0.1719] | 0.4335 | 0.4335 | 40.0% [36.8%, 43.2%] (n=1601) | 43.1% (1.000) | 80.0% | 20.0% |
| steady_missing/missing | Gated filter (experimental) | 100.0% | -0.0237 [-0.0452, -0.0022] | 0.1274 | 0.1356 | 0.0% [0.0%, 1.1%] (n=552) | 89.4% (0.659) | 6.1% | 0.0% |
| steady_missing/missing | Kalman posterior (shipped) | 100.0% | -0.0236 [-0.0451, -0.0021] | 0.1274 | 0.1355 | 0.0% [0.0%, 1.1%] (n=550) | 89.3% (0.660) | 6.1% | 0.0% |
| steady_missing/missing | OLS 28-day | 98.7% | -0.0213 [-0.0407, -0.0018] | 0.0251 | 0.1419 | 2.7% [1.8%, 3.5%] (n=1849) | 80.5% (0.792) | 20.8% | 14.8% |
| steady_missing/missing | Weekly means | 73.0% | -0.1625 [-0.1915, -0.1334] | 0.1700 | 0.2642 | 21.8% [18.0%, 25.7%] (n=632) | 58.0% (0.672) | 9.6% | 0.1% |
| steady_missing/missing | Weekly means, point (0/1) | 73.0% | -0.1022 [-0.1316, -0.0729] | 0.4110 | 0.4103 | 37.0% [34.0%, 40.1%] (n=4568) | 49.6% (1.000) | 69.6% | 30.4% |

### Brier score against the shipped posterior

Per-series difference `method - kalman` on check-ins where both are assessable. Negative means the method scored better.

| Configuration | Method | Difference [95% CI] |
|---|---|---|
| curved/daily | Gated filter (experimental) | 0.0001 [-0.0003, 0.0005] |
| curved/daily | OLS 28-day | -0.0176 [-0.0205, -0.0147] |
| curved/daily | Weekly means | 0.0910 [0.0845, 0.0975] |
| curved/daily | Weekly means, point (0/1) | 0.1902 [0.1801, 0.2002] |
| gradual_rate_change/daily | Gated filter (experimental) | 0.0004 [-0.0001, 0.0008] |
| gradual_rate_change/daily | OLS 28-day | 0.0235 [0.0202, 0.0268] |
| gradual_rate_change/daily | Weekly means | 0.0551 [0.0508, 0.0594] |
| gradual_rate_change/daily | Weekly means, point (0/1) | 0.1760 [0.1671, 0.1848] |
| level_shift/daily | Gated filter (experimental) | -0.0062 [-0.0078, -0.0047] |
| level_shift/daily | OLS 28-day | -0.0107 [-0.0138, -0.0076] |
| level_shift/daily | Weekly means | 0.0240 [0.0186, 0.0294] |
| level_shift/daily | Weekly means, point (0/1) | 0.1452 [0.1366, 0.1538] |
| model_consistent/daily | Gated filter (experimental) | 0.0004 [0.0001, 0.0006] |
| model_consistent/daily | OLS 28-day | 0.0145 [0.0117, 0.0173] |
| model_consistent/daily | Weekly means | 0.0200 [0.0165, 0.0234] |
| model_consistent/daily | Weekly means, point (0/1) | 0.0793 [0.0711, 0.0874] |
| model_consistent/irregular | Gated filter (experimental) | 0.0005 [-0.0002, 0.0013] |
| model_consistent/irregular | OLS 28-day | 0.0078 [0.0047, 0.0108] |
| model_consistent/irregular | Weekly means | 0.0335 [0.0240, 0.0430] |
| model_consistent/irregular | Weekly means, point (0/1) | 0.1037 [0.0882, 0.1191] |
| plateau/daily | Gated filter (experimental) | 0.0003 [-0.0001, 0.0008] |
| plateau/daily | OLS 28-day | 0.0333 [0.0298, 0.0368] |
| plateau/daily | Weekly means | 0.0218 [0.0172, 0.0263] |
| plateau/daily | Weekly means, point (0/1) | 0.1386 [0.1307, 0.1466] |
| steady/daily | Gated filter (experimental) | 0.0004 [0.0001, 0.0007] |
| steady/daily | OLS 28-day | -0.0351 [-0.0383, -0.0319] |
| steady/daily | Weekly means | 0.1027 [0.0946, 0.1108] |
| steady/daily | Weekly means, point (0/1) | 0.2331 [0.2231, 0.2430] |
| steady_irregular/irregular | Gated filter (experimental) | -0.0001 [-0.0005, 0.0003] |
| steady_irregular/irregular | OLS 28-day | 0.0359 [0.0311, 0.0408] |
| steady_irregular/irregular | Weekly means | 0.1574 [0.1390, 0.1758] |
| steady_irregular/irregular | Weekly means, point (0/1) | 0.2835 [0.2606, 0.3064] |
| steady_missing/missing | Gated filter (experimental) | 0.0001 [-0.0003, 0.0004] |
| steady_missing/missing | OLS 28-day | 0.0064 [0.0038, 0.0091] |
| steady_missing/missing | Weekly means | 0.1286 [0.1163, 0.1408] |
| steady_missing/missing | Weekly means, point (0/1) | 0.2747 [0.2611, 0.2883] |

### Sharpness ceiling from the priors

Deterministic, from the covariance recursion on a regular schedule. Max pi is the largest on-plan probability the posterior can report at tolerance delta, reached only when its mean sits exactly on the target.

| Schedule | History, days | Rate sd, kg/wk | Prior weight | Gate open | Max pi, delta 0.1 | Max pi, delta 0.2 | Max pi, delta 0.3 | delta needed for pi 0.8 |
|---|---|---|---|---|---|---|---|---|
| every 1 d | 7 | 0.485 | 0.222 | no | 0.163 | 0.320 | 0.463 | 0.622 |
| every 1 d | 14 | 0.242 | 0.0356 | yes | 0.321 | 0.592 | 0.785 | 0.310 |
| every 1 d | 21 | 0.193 | 0.00581 | yes | 0.396 | 0.701 | 0.881 | 0.247 |
| every 1 d | 28 | 0.185 | 0.00179 | yes | 0.410 | 0.719 | 0.894 | 0.238 |
| every 1 d | 42 | 0.185 | 0.00204 | yes | 0.411 | 0.720 | 0.895 | 0.237 |
| every 1 d | 56 | 0.185 | 0.000209 | yes | 0.412 | 0.721 | 0.895 | 0.237 |
| every 1 d | 84 | 0.185 | 3.9e-05 | yes | 0.412 | 0.721 | 0.895 | 0.237 |
| every 1 d | 1000 | 0.185 | 1.73e-41 | yes | 0.412 | 0.721 | 0.895 | 0.237 |
| every 2 d | 7 | 0.624 | 0.376 | no | 0.127 | 0.251 | 0.369 | 0.800 |
| every 2 d | 14 | 0.291 | 0.0611 | no | 0.269 | 0.508 | 0.697 | 0.373 |
| every 2 d | 21 | 0.223 | 0.0185 | yes | 0.346 | 0.629 | 0.821 | 0.286 |
| every 2 d | 28 | 0.201 | 0.00126 | yes | 0.381 | 0.679 | 0.864 | 0.258 |
| every 2 d | 42 | 0.199 | 0.00344 | yes | 0.385 | 0.685 | 0.868 | 0.255 |
| every 2 d | 56 | 0.199 | 0.0013 | yes | 0.385 | 0.686 | 0.869 | 0.255 |
| every 2 d | 84 | 0.199 | 0.000147 | yes | 0.385 | 0.686 | 0.869 | 0.254 |
| every 2 d | 1000 | 0.199 | 1.28e-34 | yes | 0.385 | 0.686 | 0.869 | 0.254 |
| every 3.5 d | 7 | 0.587 | 0.329 | no | 0.135 | 0.267 | 0.391 | 0.752 |
| every 3.5 d | 14 | 0.328 | 0.0836 | no | 0.239 | 0.458 | 0.639 | 0.421 |
| every 3.5 d | 21 | 0.241 | 0.025 | yes | 0.321 | 0.593 | 0.786 | 0.309 |
| every 3.5 d | 28 | 0.216 | 0.00559 | yes | 0.357 | 0.646 | 0.836 | 0.276 |
| every 3.5 d | 42 | 0.209 | 0.00398 | yes | 0.367 | 0.661 | 0.848 | 0.268 |
| every 3.5 d | 56 | 0.209 | 0.00269 | yes | 0.367 | 0.661 | 0.848 | 0.268 |
| every 3.5 d | 84 | 0.209 | 0.000106 | yes | 0.368 | 0.662 | 0.849 | 0.268 |
| every 3.5 d | 1000 | 0.209 | 2.07e-30 | yes | 0.368 | 0.662 | 0.849 | 0.268 |
| every 7 d | 7 | 0.587 | 0.329 | no | 0.135 | 0.267 | 0.391 | 0.752 |
| every 7 d | 14 | 0.357 | 0.103 | no | 0.220 | 0.424 | 0.599 | 0.458 |
| every 7 d | 21 | 0.267 | 0.0371 | yes | 0.292 | 0.547 | 0.740 | 0.342 |
| every 7 d | 28 | 0.233 | 0.0121 | yes | 0.332 | 0.609 | 0.802 | 0.299 |
| every 7 d | 42 | 0.220 | 0.00355 | yes | 0.350 | 0.636 | 0.826 | 0.283 |
| every 7 d | 56 | 0.220 | 0.00452 | yes | 0.350 | 0.636 | 0.827 | 0.282 |
| every 7 d | 84 | 0.220 | 0.000503 | yes | 0.351 | 0.637 | 0.828 | 0.282 |
| every 7 d | 1000 | 0.220 | 5.78e-26 | yes | 0.351 | 0.637 | 0.828 | 0.282 |

| Schedule | First day the gate opens | Steady state converged |
|---|---|---|
| every 1 d | 13.00 | yes |
| every 2 d | 16.00 | yes |
| every 3.5 d | 17.50 | yes |
| every 7 d | 21.00 | yes |

### A single bad reading

One reading at day 56 displaced upwards, target at the true rate, paired with the clean twin. Absolute change in pi, and mean shift of the estimated rate.

| Reading | Method | Check-in | Median |dpi| | 90th pct |dpi| | Max |dpi| | Mean rate shift, kg/wk |
|---|---|---|---|---|---|---|
| +2 kg | Gated filter (experimental) | 56 | 0.030 | 0.231 | 0.556 | 0.041 |
| +2 kg | Gated filter (experimental) | 63 | 0.003 | 0.022 | 0.222 | 0.004 |
| +2 kg | Gated filter (experimental) | 70 | 0.006 | 0.053 | 0.140 | -0.009 |
| +2 kg | Kalman posterior (shipped) | 56 | 0.241 | 0.375 | 0.384 | 0.207 |
| +2 kg | Kalman posterior (shipped) | 63 | 0.016 | 0.032 | 0.036 | 0.018 |
| +2 kg | Kalman posterior (shipped) | 70 | 0.036 | 0.077 | 0.086 | -0.043 |
| +3 kg | Gated filter (experimental) | 56 | 0.023 | 0.094 | 0.643 | 0.004 |
| +3 kg | Gated filter (experimental) | 63 | 0.002 | 0.008 | 0.197 | 0.000 |
| +3 kg | Gated filter (experimental) | 70 | 0.005 | 0.020 | 0.173 | -0.001 |
| +3 kg | Kalman posterior (shipped) | 56 | 0.430 | 0.525 | 0.528 | 0.311 |
| +3 kg | Kalman posterior (shipped) | 63 | 0.024 | 0.049 | 0.054 | 0.027 |
| +3 kg | Kalman posterior (shipped) | 70 | 0.056 | 0.117 | 0.128 | -0.065 |
| +5 kg | Gated filter (experimental) | 56 | 0.023 | 0.093 | 0.689 | 0.004 |
| +5 kg | Gated filter (experimental) | 63 | 0.002 | 0.008 | 0.197 | 0.000 |
| +5 kg | Gated filter (experimental) | 70 | 0.005 | 0.020 | 0.225 | -0.001 |
| +5 kg | Kalman posterior (shipped) | 56 | 0.644 | 0.683 | 0.685 | 0.518 |
| +5 kg | Kalman posterior (shipped) | 63 | 0.042 | 0.081 | 0.090 | 0.045 |
| +5 kg | Kalman posterior (shipped) | 70 | 0.102 | 0.199 | 0.210 | -0.108 |

### History: assessable share and departure share by check-in (shipped posterior)

| Configuration | day 14 | day 21 | day 28 | day 35 | day 42 | day 49 | day 56 | day 63 | day 70 | day 77 | day 84 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| curved/daily | 100.0% / 10.0% | 100.0% / 10.9% | 100.0% / 11.6% | 100.0% / 15.4% | 100.0% / 19.9% | 100.0% / 24.4% | 100.0% / 25.8% | 100.0% / 29.4% | 100.0% / 32.7% | 100.0% / 33.4% | 100.0% / 36.9% |
| gradual_rate_change/daily | 100.0% / 8.4% | 100.0% / 8.3% | 100.0% / 7.2% | 100.0% / 6.1% | 100.0% / 6.7% | 100.0% / 6.4% | 100.0% / 8.4% | 100.0% / 15.4% | 100.0% / 27.7% | 100.0% / 40.3% | 100.0% / 47.3% |
| level_shift/daily | 100.0% / 9.8% | 100.0% / 9.6% | 100.0% / 7.5% | 100.0% / 8.2% | 100.0% / 21.9% | 100.0% / 80.8% | 100.0% / 62.9% | 100.0% / 33.3% | 100.0% / 12.5% | 100.0% / 8.2% | 100.0% / 7.2% |
| model_consistent/daily | 100.0% / 61.2% | 100.0% / 67.4% | 100.0% / 66.6% | 100.0% / 66.9% | 100.0% / 67.2% | 100.0% / 67.0% | 100.0% / 66.8% | 100.0% / 67.0% | 100.0% / 67.0% | 100.0% / 67.8% | 100.0% / 68.1% |
| model_consistent/irregular | 0.0% | 100.0% / 63.0% | 100.0% / 62.7% | 100.0% / 62.7% | 100.0% / 62.7% | 100.0% / 65.2% | 100.0% / 65.1% | 100.0% / 64.6% | 100.0% / 64.6% | 100.0% / 66.7% | 100.0% / 65.9% |
| plateau/daily | 100.0% / 9.3% | 100.0% / 7.4% | 100.0% / 6.3% | 100.0% / 7.3% | 100.0% / 7.4% | 100.0% / 13.9% | 100.0% / 33.2% | 100.0% / 44.7% | 100.0% / 52.8% | 100.0% / 51.9% | 100.0% / 51.9% |
| steady/daily | 100.0% / 8.5% | 100.0% / 7.8% | 100.0% / 7.8% | 100.0% / 5.5% | 100.0% / 6.5% | 100.0% / 6.9% | 100.0% / 6.4% | 100.0% / 6.7% | 100.0% / 6.4% | 100.0% / 7.1% | 100.0% / 7.2% |
| steady_irregular/irregular | 0.0% | 100.0% / 8.0% | 100.0% / 6.3% | 100.0% / 6.3% | 100.0% / 6.3% | 100.0% / 3.7% | 100.0% / 3.4% | 100.0% / 4.6% | 100.0% / 4.6% | 100.0% / 5.9% | 100.0% / 3.5% |
| steady_missing/missing | 31.1% / 8.0% | 99.9% / 8.5% | 100.0% / 7.9% | 100.0% / 6.3% | 100.0% / 5.9% | 100.0% / 6.1% | 100.0% / 6.1% | 100.0% / 6.6% | 100.0% / 5.6% | 100.0% / 5.2% | 100.0% / 5.3% |

### What the gate prevents

The shipped probability on check-ins where the gate was closed. A diagnostic, never a candidate.

| Configuration | Gate-closed check-ins | In band when pi <= 0.05 | ECE |
|---|---|---|---|
| curved/daily | 0 | none | n/a |
| gradual_rate_change/daily | 0 | none | n/a |
| level_shift/daily | 0 | none | n/a |
| model_consistent/daily | 0 | none | n/a |
| model_consistent/irregular | 1000 | 1.5% [0.0%, 3.2%] (n=201) | 0.0335 |
| plateau/daily | 0 | none | n/a |
| steady/daily | 0 | none | n/a |
| steady_irregular/irregular | 1000 | 18.4% [5.5%, 31.3%] (n=38) | 0.2325 |
| steady_missing/missing | 690 | 15.9% [4.7%, 27.2%] (n=44) | 0.1084 |

### Experimental gate activity

| Configuration | Held per series | Discarded per series |
|---|---|---|
| curved/daily | 0.195 | 0.187 |
| gradual_rate_change/daily | 0.221 | 0.215 |
| level_shift/daily | 1.669 | 0.905 |
| model_consistent/daily | 0.224 | 0.214 |
| model_consistent/irregular | 0.042 | 0.037 |
| plateau/daily | 0.246 | 0.241 |
| steady/daily | 0.196 | 0.189 |
| steady_irregular/irregular | 0.022 | 0.022 |
| steady_missing/missing | 0.077 | 0.076 |

## E7 - departure claims

1000 series per configuration. Rates are per series with Wilson 95% intervals. A phase is the nine primary check-ins, days 28 to 84.

### Pre-registered verdict

| Rule | Family | Eligible (daily) | Failed checks | Holds at 3.5 d | Holds weekly |
|---|---|---|---|---|---|
| gated_plan_bonf | plan | **no** | 4 | no | no |
| innov_chi2_bonf | innovation | **no** | 5 | no | no |
| innov_mean_bonf | innovation | **no** | 4 | no | no |
| innov_robust_bonf | innovation | **no** | 4 | no | no |
| kalman_plan_05 | plan | **no** | 8 | no | no |
| kalman_plan_bonf | plan | **no** | 7 | no | no |
| kalman_plan_confirmed | plan | **no** | 4 | no | no |
| ols28_plan_bonf | plan | **no** | 1 | no | no |
| weekly_means_point | plan | **no** | 18 | no | no |

#### gated_plan_bonf

| Criterion | Value | Result | Note |
|---|---|---|---|
| R-A steady/daily@centre phase false-claim rate | 0.0000 | pass | Wilson upper 0.0038 |
| R-A steady/daily@upper_edge phase false-claim rate | 0.0000 | pass | Wilson upper 0.0038 |
| R-A steady/daily@lower_edge phase false-claim rate | 0.0000 | pass | Wilson upper 0.0038 |
| R-A steady_irregular/irregular@centre phase false-claim rate | 0.0000 | pass | Wilson upper 0.0038 |
| R-A steady_irregular/irregular@upper_edge phase false-claim rate | 0.0000 | pass | Wilson upper 0.0038 |
| R-A steady_irregular/irregular@lower_edge phase false-claim rate | 0.0000 | pass | Wilson upper 0.0038 |
| R-A steady_missing/missing@centre phase false-claim rate | 0.0000 | pass | Wilson upper 0.0038 |
| R-A steady_missing/missing@upper_edge phase false-claim rate | 0.0000 | pass | Wilson upper 0.0038 |
| R-A steady_missing/missing@lower_edge phase false-claim rate | 0.0000 | pass | Wilson upper 0.0038 |
| R-B bad_reading/+2kg@centre attributable claim rate | 0.0000 | pass |  |
| R-B bad_reading/+2kg@upper_edge attributable claim rate | 0.0000 | pass |  |
| R-B bad_reading/+2kg@lower_edge attributable claim rate | 0.0000 | pass |  |
| R-B bad_reading/+3kg@centre attributable claim rate | 0.0000 | pass |  |
| R-B bad_reading/+3kg@upper_edge attributable claim rate | 0.0000 | pass |  |
| R-B bad_reading/+3kg@lower_edge attributable claim rate | 0.0000 | pass |  |
| R-B bad_reading/+5kg@centre attributable claim rate | 0.0000 | pass |  |
| R-B bad_reading/+5kg@upper_edge attributable claim rate | 0.0010 | pass |  |
| R-B bad_reading/+5kg@lower_edge attributable claim rate | 0.0000 | pass |  |
| R-C plateau/daily detected within 28 days | 0.0620 | **FAIL** |  |
| R-C plateau/daily median delay | n/a | **FAIL** |  |
| R-C gradual_rate_change/daily@centre detected by day 84 | 0.0350 | **FAIL** |  |
| R-C curved/daily@centre detected by day 84 | 0.0010 | **FAIL** |  |

#### innov_chi2_bonf

| Criterion | Value | Result | Note |
|---|---|---|---|
| R-A model_consistent/daily phase false-claim rate | 0.0400 | pass | Wilson upper 0.0540 |
| R-A steady/daily phase false-claim rate | 0.0240 | pass | Wilson upper 0.0355 |
| R-A steady_irregular/irregular phase false-claim rate | 0.0140 | pass | Wilson upper 0.0234 |
| R-A steady_missing/missing phase false-claim rate | 0.0250 | pass | Wilson upper 0.0366 |
| R-B bad_reading/+2kg attributable claim rate | 0.4370 | **FAIL** |  |
| R-B bad_reading/+3kg attributable claim rate | 0.9330 | **FAIL** |  |
| R-B bad_reading/+5kg attributable claim rate | 1.0000 | **FAIL** |  |
| R-C level_shift/daily detected within 14 days | 0.9640 | pass |  |
| R-C plateau/daily detected within 28 days | 0.0400 | **FAIL** |  |
| R-C plateau/daily median delay | n/a | **FAIL** |  |

#### innov_mean_bonf

| Criterion | Value | Result | Note |
|---|---|---|---|
| R-A model_consistent/daily phase false-claim rate | 0.0500 | pass | Wilson upper 0.0653 |
| R-A steady/daily phase false-claim rate | 0.0000 | pass | Wilson upper 0.0038 |
| R-A steady_irregular/irregular phase false-claim rate | 0.0070 | pass | Wilson upper 0.0144 |
| R-A steady_missing/missing phase false-claim rate | 0.0020 | pass | Wilson upper 0.0073 |
| R-B bad_reading/+2kg attributable claim rate | 0.0130 | pass |  |
| R-B bad_reading/+3kg attributable claim rate | 0.0890 | **FAIL** |  |
| R-B bad_reading/+5kg attributable claim rate | 0.6460 | **FAIL** |  |
| R-C level_shift/daily detected within 14 days | 0.9480 | pass |  |
| R-C plateau/daily detected within 28 days | 0.0770 | **FAIL** |  |
| R-C plateau/daily median delay | n/a | **FAIL** |  |

#### innov_robust_bonf

| Criterion | Value | Result | Note |
|---|---|---|---|
| R-A model_consistent/daily phase false-claim rate | 0.0130 | pass | Wilson upper 0.0221 |
| R-A steady/daily phase false-claim rate | 0.0000 | pass | Wilson upper 0.0038 |
| R-A steady_irregular/irregular phase false-claim rate | 0.0000 | pass | Wilson upper 0.0038 |
| R-A steady_missing/missing phase false-claim rate | 0.0000 | pass | Wilson upper 0.0038 |
| R-B bad_reading/+2kg attributable claim rate | 0.0020 | pass |  |
| R-B bad_reading/+3kg attributable claim rate | 0.0130 | pass |  |
| R-B bad_reading/+5kg attributable claim rate | 0.2670 | **FAIL** |  |
| R-C level_shift/daily detected within 14 days | 0.3120 | **FAIL** |  |
| R-C plateau/daily detected within 28 days | 0.0100 | **FAIL** |  |
| R-C plateau/daily median delay | n/a | **FAIL** |  |

#### kalman_plan_05

| Criterion | Value | Result | Note |
|---|---|---|---|
| R-A steady/daily@centre phase false-claim rate | 0.0000 | pass | Wilson upper 0.0038 |
| R-A steady/daily@upper_edge phase false-claim rate | 0.0060 | pass | Wilson upper 0.0130 |
| R-A steady/daily@lower_edge phase false-claim rate | 0.0040 | pass | Wilson upper 0.0102 |
| R-A steady_irregular/irregular@centre phase false-claim rate | 0.0000 | pass | Wilson upper 0.0038 |
| R-A steady_irregular/irregular@upper_edge phase false-claim rate | 0.0050 | pass | Wilson upper 0.0117 |
| R-A steady_irregular/irregular@lower_edge phase false-claim rate | 0.0110 | pass | Wilson upper 0.0196 |
| R-A steady_missing/missing@centre phase false-claim rate | 0.0000 | pass | Wilson upper 0.0038 |
| R-A steady_missing/missing@upper_edge phase false-claim rate | 0.0020 | pass | Wilson upper 0.0073 |
| R-A steady_missing/missing@lower_edge phase false-claim rate | 0.0040 | pass | Wilson upper 0.0102 |
| R-B bad_reading/+2kg@centre attributable claim rate | 0.0020 | pass |  |
| R-B bad_reading/+2kg@upper_edge attributable claim rate | 0.1100 | **FAIL** |  |
| R-B bad_reading/+2kg@lower_edge attributable claim rate | 0.0020 | pass |  |
| R-B bad_reading/+3kg@centre attributable claim rate | 0.0200 | pass |  |
| R-B bad_reading/+3kg@upper_edge attributable claim rate | 0.4460 | **FAIL** |  |
| R-B bad_reading/+3kg@lower_edge attributable claim rate | 0.0050 | pass |  |
| R-B bad_reading/+5kg@centre attributable claim rate | 0.5620 | **FAIL** |  |
| R-B bad_reading/+5kg@upper_edge attributable claim rate | 0.9800 | **FAIL** |  |
| R-B bad_reading/+5kg@lower_edge attributable claim rate | 0.0540 | **FAIL** |  |
| R-C plateau/daily detected within 28 days | 0.6710 | **FAIL** |  |
| R-C plateau/daily median delay | 28.0000 | **FAIL** |  |
| R-C gradual_rate_change/daily@centre detected by day 84 | 0.5330 | pass |  |
| R-C curved/daily@centre detected by day 84 | 0.1230 | **FAIL** |  |

#### kalman_plan_bonf

| Criterion | Value | Result | Note |
|---|---|---|---|
| R-A steady/daily@centre phase false-claim rate | 0.0000 | pass | Wilson upper 0.0038 |
| R-A steady/daily@upper_edge phase false-claim rate | 0.0000 | pass | Wilson upper 0.0038 |
| R-A steady/daily@lower_edge phase false-claim rate | 0.0000 | pass | Wilson upper 0.0038 |
| R-A steady_irregular/irregular@centre phase false-claim rate | 0.0000 | pass | Wilson upper 0.0038 |
| R-A steady_irregular/irregular@upper_edge phase false-claim rate | 0.0000 | pass | Wilson upper 0.0038 |
| R-A steady_irregular/irregular@lower_edge phase false-claim rate | 0.0000 | pass | Wilson upper 0.0038 |
| R-A steady_missing/missing@centre phase false-claim rate | 0.0000 | pass | Wilson upper 0.0038 |
| R-A steady_missing/missing@upper_edge phase false-claim rate | 0.0000 | pass | Wilson upper 0.0038 |
| R-A steady_missing/missing@lower_edge phase false-claim rate | 0.0000 | pass | Wilson upper 0.0038 |
| R-B bad_reading/+2kg@centre attributable claim rate | 0.0000 | pass |  |
| R-B bad_reading/+2kg@upper_edge attributable claim rate | 0.0020 | pass |  |
| R-B bad_reading/+2kg@lower_edge attributable claim rate | 0.0000 | pass |  |
| R-B bad_reading/+3kg@centre attributable claim rate | 0.0000 | pass |  |
| R-B bad_reading/+3kg@upper_edge attributable claim rate | 0.0270 | **FAIL** |  |
| R-B bad_reading/+3kg@lower_edge attributable claim rate | 0.0000 | pass |  |
| R-B bad_reading/+5kg@centre attributable claim rate | 0.0580 | **FAIL** |  |
| R-B bad_reading/+5kg@upper_edge attributable claim rate | 0.6100 | **FAIL** |  |
| R-B bad_reading/+5kg@lower_edge attributable claim rate | 0.0000 | pass |  |
| R-C plateau/daily detected within 28 days | 0.0590 | **FAIL** |  |
| R-C plateau/daily median delay | n/a | **FAIL** |  |
| R-C gradual_rate_change/daily@centre detected by day 84 | 0.0310 | **FAIL** |  |
| R-C curved/daily@centre detected by day 84 | 0.0010 | **FAIL** |  |

#### kalman_plan_confirmed

| Criterion | Value | Result | Note |
|---|---|---|---|
| R-A steady/daily@centre phase false-claim rate | 0.0000 | pass | Wilson upper 0.0038 |
| R-A steady/daily@upper_edge phase false-claim rate | 0.0000 | pass | Wilson upper 0.0038 |
| R-A steady/daily@lower_edge phase false-claim rate | 0.0000 | pass | Wilson upper 0.0038 |
| R-A steady_irregular/irregular@centre phase false-claim rate | 0.0000 | pass | Wilson upper 0.0038 |
| R-A steady_irregular/irregular@upper_edge phase false-claim rate | 0.0020 | pass | Wilson upper 0.0073 |
| R-A steady_irregular/irregular@lower_edge phase false-claim rate | 0.0070 | pass | Wilson upper 0.0144 |
| R-A steady_missing/missing@centre phase false-claim rate | 0.0000 | pass | Wilson upper 0.0038 |
| R-A steady_missing/missing@upper_edge phase false-claim rate | 0.0010 | pass | Wilson upper 0.0056 |
| R-A steady_missing/missing@lower_edge phase false-claim rate | 0.0000 | pass | Wilson upper 0.0038 |
| R-B bad_reading/+2kg@centre attributable claim rate | 0.0000 | pass |  |
| R-B bad_reading/+2kg@upper_edge attributable claim rate | 0.0010 | pass |  |
| R-B bad_reading/+2kg@lower_edge attributable claim rate | 0.0000 | pass |  |
| R-B bad_reading/+3kg@centre attributable claim rate | 0.0000 | pass |  |
| R-B bad_reading/+3kg@upper_edge attributable claim rate | 0.0020 | pass |  |
| R-B bad_reading/+3kg@lower_edge attributable claim rate | 0.0000 | pass |  |
| R-B bad_reading/+5kg@centre attributable claim rate | 0.0000 | pass |  |
| R-B bad_reading/+5kg@upper_edge attributable claim rate | 0.0030 | pass |  |
| R-B bad_reading/+5kg@lower_edge attributable claim rate | 0.0010 | pass |  |
| R-C plateau/daily detected within 28 days | 0.1980 | **FAIL** |  |
| R-C plateau/daily median delay | 42.0000 | **FAIL** |  |
| R-C gradual_rate_change/daily@centre detected by day 84 | 0.0930 | **FAIL** |  |
| R-C curved/daily@centre detected by day 84 | 0.0030 | **FAIL** |  |

#### ols28_plan_bonf

| Criterion | Value | Result | Note |
|---|---|---|---|
| R-A steady/daily@centre phase false-claim rate | 0.0000 | pass | Wilson upper 0.0038 |
| R-A steady/daily@upper_edge phase false-claim rate | 0.0310 | pass | Wilson upper 0.0437 |
| R-A steady/daily@lower_edge phase false-claim rate | 0.0250 | pass | Wilson upper 0.0366 |
| R-A steady_irregular/irregular@centre phase false-claim rate | 0.0050 | pass | Wilson upper 0.0117 |
| R-A steady_irregular/irregular@upper_edge phase false-claim rate | 0.0200 | pass | Wilson upper 0.0307 |
| R-A steady_irregular/irregular@lower_edge phase false-claim rate | 0.0230 | pass | Wilson upper 0.0343 |
| R-A steady_missing/missing@centre phase false-claim rate | 0.0000 | pass | Wilson upper 0.0038 |
| R-A steady_missing/missing@upper_edge phase false-claim rate | 0.0300 | pass | Wilson upper 0.0425 |
| R-A steady_missing/missing@lower_edge phase false-claim rate | 0.0330 | pass | Wilson upper 0.0460 |
| R-B bad_reading/+2kg@centre attributable claim rate | 0.0000 | pass |  |
| R-B bad_reading/+2kg@upper_edge attributable claim rate | 0.0120 | pass |  |
| R-B bad_reading/+2kg@lower_edge attributable claim rate | 0.0030 | pass |  |
| R-B bad_reading/+3kg@centre attributable claim rate | 0.0000 | pass |  |
| R-B bad_reading/+3kg@upper_edge attributable claim rate | 0.0100 | pass |  |
| R-B bad_reading/+3kg@lower_edge attributable claim rate | 0.0010 | pass |  |
| R-B bad_reading/+5kg@centre attributable claim rate | 0.0000 | pass |  |
| R-B bad_reading/+5kg@upper_edge attributable claim rate | 0.0030 | pass |  |
| R-B bad_reading/+5kg@lower_edge attributable claim rate | 0.0000 | pass |  |
| R-C plateau/daily detected within 28 days | 0.8690 | pass |  |
| R-C plateau/daily median delay | 21.0000 | pass |  |
| R-C gradual_rate_change/daily@centre detected by day 84 | 0.7540 | pass |  |
| R-C curved/daily@centre detected by day 84 | 0.4230 | **FAIL** |  |

#### weekly_means_point

| Criterion | Value | Result | Note |
|---|---|---|---|
| R-A steady/daily@centre phase false-claim rate | 0.9910 | **FAIL** | Wilson upper 0.9953 |
| R-A steady/daily@upper_edge phase false-claim rate | 1.0000 | **FAIL** | Wilson upper 1.0000 |
| R-A steady/daily@lower_edge phase false-claim rate | 1.0000 | **FAIL** | Wilson upper 1.0000 |
| R-A steady_irregular/irregular@centre phase false-claim rate | 0.9170 | **FAIL** | Wilson upper 0.9325 |
| R-A steady_irregular/irregular@upper_edge phase false-claim rate | 0.9300 | **FAIL** | Wilson upper 0.9442 |
| R-A steady_irregular/irregular@lower_edge phase false-claim rate | 0.9310 | **FAIL** | Wilson upper 0.9451 |
| R-A steady_missing/missing@centre phase false-claim rate | 0.9940 | **FAIL** | Wilson upper 0.9972 |
| R-A steady_missing/missing@upper_edge phase false-claim rate | 0.9990 | **FAIL** | Wilson upper 0.9998 |
| R-A steady_missing/missing@lower_edge phase false-claim rate | 0.9990 | **FAIL** | Wilson upper 0.9998 |
| R-B bad_reading/+2kg@centre attributable claim rate | 0.6220 | **FAIL** |  |
| R-B bad_reading/+2kg@upper_edge attributable claim rate | 0.5890 | **FAIL** |  |
| R-B bad_reading/+2kg@lower_edge attributable claim rate | 0.5800 | **FAIL** |  |
| R-B bad_reading/+3kg@centre attributable claim rate | 0.7830 | **FAIL** |  |
| R-B bad_reading/+3kg@upper_edge attributable claim rate | 0.7520 | **FAIL** |  |
| R-B bad_reading/+3kg@lower_edge attributable claim rate | 0.7370 | **FAIL** |  |
| R-B bad_reading/+5kg@centre attributable claim rate | 0.7830 | **FAIL** |  |
| R-B bad_reading/+5kg@upper_edge attributable claim rate | 0.7520 | **FAIL** |  |
| R-B bad_reading/+5kg@lower_edge attributable claim rate | 0.7370 | **FAIL** |  |
| R-C plateau/daily detected within 28 days | 1.0000 | pass |  |
| R-C plateau/daily median delay | 7.0000 | pass |  |
| R-C gradual_rate_change/daily@centre detected by day 84 | 1.0000 | pass |  |
| R-C curved/daily@centre detected by day 84 | 1.0000 | pass |  |

### Plan-relative rules: nulls and nuisances

Share of series with any claim over the phase. For a null every claim is false; for a nuisance the table reports what happens.

| Configuration | gated_plan_bonf | kalman_plan_05 | kalman_plan_bonf | kalman_plan_confirmed | ols28_plan_bonf | weekly_means_point |
|---|---|---|---|---|---|---|
| level_shift/3.5d@centre (nuisance) | 12.0% [10.1%, 14.2%] | 79.3% [76.7%, 81.7%] | 12.9% [11.0%, 15.1%] | 37.7% [34.7%, 40.7%] | 21.3% [18.9%, 23.9%] | 100.0% [99.6%, 100.0%] |
| level_shift/daily@centre (nuisance) | 92.2% [90.4%, 93.7%] | 100.0% [99.6%, 100.0%] | 94.1% [92.5%, 95.4%] | 90.8% [88.8%, 92.4%] | 99.5% [98.8%, 99.8%] | 100.0% [99.6%, 100.0%] |
| level_shift/weekly@centre (nuisance) | 1.6% [1.0%, 2.6%] | 44.2% [41.1%, 47.3%] | 1.6% [1.0%, 2.6%] | 12.1% [10.2%, 14.3%] | 6.3% [5.0%, 8.0%] | 0.0% [0.0%, 0.4%] |
| steady/3.5d@centre (null) | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 0.2% [0.1%, 0.7%] | 100.0% [99.6%, 100.0%] |
| steady/3.5d@lower_edge (null) | 0.0% [0.0%, 0.4%] | 0.7% [0.3%, 1.4%] | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 3.8% [2.8%, 5.2%] | 100.0% [99.6%, 100.0%] |
| steady/3.5d@upper_edge (null) | 0.0% [0.0%, 0.4%] | 0.9% [0.5%, 1.7%] | 0.0% [0.0%, 0.4%] | 0.1% [0.0%, 0.6%] | 4.2% [3.1%, 5.6%] | 100.0% [99.6%, 100.0%] |
| steady/daily@centre (null, gating) | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 99.1% [98.3%, 99.5%] |
| steady/daily@lower_edge (null, gating) | 0.0% [0.0%, 0.4%] | 0.4% [0.2%, 1.0%] | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 2.5% [1.7%, 3.7%] | 100.0% [99.6%, 100.0%] |
| steady/daily@upper_edge (null, gating) | 0.0% [0.0%, 0.4%] | 0.6% [0.3%, 1.3%] | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 3.1% [2.2%, 4.4%] | 100.0% [99.6%, 100.0%] |
| steady/weekly@centre (null) | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 2.5% [1.7%, 3.7%] | 0.0% [0.0%, 0.4%] |
| steady/weekly@lower_edge (null) | 0.0% [0.0%, 0.4%] | 1.2% [0.7%, 2.1%] | 0.0% [0.0%, 0.4%] | 0.2% [0.1%, 0.7%] | 6.0% [4.7%, 7.6%] | 0.0% [0.0%, 0.4%] |
| steady/weekly@upper_edge (null) | 0.0% [0.0%, 0.4%] | 1.8% [1.1%, 2.8%] | 0.0% [0.0%, 0.4%] | 0.2% [0.1%, 0.7%] | 4.7% [3.6%, 6.2%] | 0.0% [0.0%, 0.4%] |
| steady_irregular/irregular@centre (null, gating) | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 0.5% [0.2%, 1.2%] | 91.7% [89.8%, 93.3%] |
| steady_irregular/irregular@lower_edge (null, gating) | 0.0% [0.0%, 0.4%] | 1.1% [0.6%, 2.0%] | 0.0% [0.0%, 0.4%] | 0.7% [0.3%, 1.4%] | 2.3% [1.5%, 3.4%] | 93.1% [91.4%, 94.5%] |
| steady_irregular/irregular@upper_edge (null, gating) | 0.0% [0.0%, 0.4%] | 0.5% [0.2%, 1.2%] | 0.0% [0.0%, 0.4%] | 0.2% [0.1%, 0.7%] | 2.0% [1.3%, 3.1%] | 93.0% [91.2%, 94.4%] |
| steady_missing/missing@centre (null, gating) | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 99.4% [98.7%, 99.7%] |
| steady_missing/missing@lower_edge (null, gating) | 0.0% [0.0%, 0.4%] | 0.4% [0.2%, 1.0%] | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 3.3% [2.4%, 4.6%] | 99.9% [99.4%, 100.0%] |
| steady_missing/missing@upper_edge (null, gating) | 0.0% [0.0%, 0.4%] | 0.2% [0.1%, 0.7%] | 0.0% [0.0%, 0.4%] | 0.1% [0.0%, 0.6%] | 3.0% [2.1%, 4.3%] | 99.9% [99.4%, 100.0%] |

### Plan-relative rules: a single bad reading

Series with a claim from day 56 on that the clean twin does not make.

| Configuration | gated_plan_bonf | kalman_plan_05 | kalman_plan_bonf | kalman_plan_confirmed | ols28_plan_bonf | weekly_means_point |
|---|---|---|---|---|---|---|
| bad_reading/+2kg@centre | 0.0% [0.0%, 0.4%] | 0.2% [0.1%, 0.7%] | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 62.2% [59.2%, 65.2%] |
| bad_reading/+2kg@lower_edge | 0.0% [0.0%, 0.4%] | 0.2% [0.1%, 0.7%] | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 0.3% [0.1%, 0.9%] | 58.0% [54.9%, 61.0%] |
| bad_reading/+2kg@upper_edge | 0.0% [0.0%, 0.4%] | 11.0% [9.2%, 13.1%] | 0.2% [0.1%, 0.7%] | 0.1% [0.0%, 0.6%] | 1.2% [0.7%, 2.1%] | 58.9% [55.8%, 61.9%] |
| bad_reading/+3kg@centre | 0.0% [0.0%, 0.4%] | 2.0% [1.3%, 3.1%] | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 78.3% [75.6%, 80.7%] |
| bad_reading/+3kg@lower_edge | 0.0% [0.0%, 0.4%] | 0.5% [0.2%, 1.2%] | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 0.1% [0.0%, 0.6%] | 73.7% [70.9%, 76.3%] |
| bad_reading/+3kg@upper_edge | 0.0% [0.0%, 0.4%] | 44.6% [41.5%, 47.7%] | 2.7% [1.9%, 3.9%] | 0.2% [0.1%, 0.7%] | 1.0% [0.5%, 1.8%] | 75.2% [72.4%, 77.8%] |
| bad_reading/+5kg@centre | 0.0% [0.0%, 0.4%] | 56.2% [53.1%, 59.2%] | 5.8% [4.5%, 7.4%] | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 78.3% [75.6%, 80.7%] |
| bad_reading/+5kg@lower_edge | 0.0% [0.0%, 0.4%] | 5.4% [4.2%, 7.0%] | 0.0% [0.0%, 0.4%] | 0.1% [0.0%, 0.6%] | 0.0% [0.0%, 0.4%] | 73.7% [70.9%, 76.3%] |
| bad_reading/+5kg@upper_edge | 0.1% [0.0%, 0.6%] | 98.0% [96.9%, 98.7%] | 61.0% [57.9%, 64.0%] | 0.3% [0.1%, 0.9%] | 0.3% [0.1%, 0.9%] | 75.2% [72.4%, 77.8%] |

### Plan-relative rules: alternatives

| Configuration | Rule | Onset day | Pre-onset claim | Within 14 d | Within 28 d | By day 84 | Median delay, d | Censored |
|---|---|---|---|---|---|---|---|---|
| curved/daily@centre (gating) | gated_plan_bonf | 31.0 | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 0.1% [0.0%, 0.6%] | n/a | 99.9% |
| curved/daily@centre (gating) | kalman_plan_05 | 31.0 | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 0.7% [0.3%, 1.4%] | 12.3% [10.4%, 14.5%] | n/a | 87.7% |
| curved/daily@centre (gating) | kalman_plan_bonf | 31.0 | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 0.1% [0.0%, 0.6%] | n/a | 99.9% |
| curved/daily@centre (gating) | kalman_plan_confirmed | 31.0 | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 0.3% [0.1%, 0.9%] | n/a | 99.7% |
| curved/daily@centre (gating) | ols28_plan_bonf | 31.0 | 0.0% [0.0%, 0.4%] | 0.5% [0.2%, 1.2%] | 4.0% [3.0%, 5.4%] | 42.3% [39.3%, 45.4%] | n/a | 57.7% |
| curved/daily@centre (gating) | weekly_means_point | 31.0 | 52.4% [49.3%, 55.5%] | 86.3% [84.0%, 88.3%] | 99.8% [99.3%, 99.9%] | 100.0% [99.6%, 100.0%] | 4.0 | 0.0% |
| gradual_rate_change/daily@centre (gating) | gated_plan_bonf | 54.0 | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 0.2% [0.1%, 0.7%] | 3.5% [2.5%, 4.8%] | n/a | 96.5% |
| gradual_rate_change/daily@centre (gating) | kalman_plan_05 | 54.0 | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 20.4% [18.0%, 23.0%] | 53.3% [50.2%, 56.4%] | 30.0 | 46.7% |
| gradual_rate_change/daily@centre (gating) | kalman_plan_bonf | 54.0 | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 0.2% [0.1%, 0.7%] | 3.1% [2.2%, 4.4%] | n/a | 96.9% |
| gradual_rate_change/daily@centre (gating) | kalman_plan_confirmed | 54.0 | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 0.6% [0.3%, 1.3%] | 9.3% [7.7%, 11.3%] | n/a | 90.7% |
| gradual_rate_change/daily@centre (gating) | ols28_plan_bonf | 54.0 | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 32.4% [29.6%, 35.4%] | 75.4% [72.6%, 78.0%] | 30.0 | 24.6% |
| gradual_rate_change/daily@centre (gating) | weekly_means_point | 54.0 | 87.1% [84.9%, 89.0%] | 83.4% [81.0%, 85.6%] | 100.0% [99.6%, 100.0%] | 100.0% [99.6%, 100.0%] | 9.0 | 0.0% |
| plateau/3.5d@centre | gated_plan_bonf | 42.0 | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 1.0% [0.5%, 1.8%] | 6.1% [4.8%, 7.8%] | n/a | 93.9% |
| plateau/3.5d@centre | kalman_plan_05 | 42.0 | 0.1% [0.0%, 0.6%] | 0.4% [0.2%, 1.0%] | 27.3% [24.6%, 30.1%] | 69.8% [66.9%, 72.6%] | 35.0 | 30.2% |
| plateau/3.5d@centre | kalman_plan_bonf | 42.0 | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 1.1% [0.6%, 2.0%] | 6.0% [4.7%, 7.6%] | n/a | 94.0% |
| plateau/3.5d@centre | kalman_plan_confirmed | 42.0 | 0.1% [0.0%, 0.6%] | 0.0% [0.0%, 0.4%] | 2.1% [1.4%, 3.2%] | 26.2% [23.6%, 29.0%] | n/a | 73.8% |
| plateau/3.5d@centre | ols28_plan_bonf | 42.0 | 0.0% [0.0%, 0.4%] | 2.1% [1.4%, 3.2%] | 22.0% [19.5%, 24.7%] | 40.4% [37.4%, 43.5%] | n/a | 59.6% |
| plateau/3.5d@centre | weekly_means_point | 42.0 | 89.2% [87.1%, 91.0%] | 99.6% [99.0%, 99.8%] | 100.0% [99.6%, 100.0%] | 100.0% [99.6%, 100.0%] | 0.0 | 0.0% |
| plateau/daily@centre (gating) | gated_plan_bonf | 42.0 | 0.0% [0.0%, 0.4%] | 0.1% [0.0%, 0.6%] | 6.2% [4.9%, 7.9%] | 18.8% [16.5%, 21.3%] | n/a | 81.2% |
| plateau/daily@centre (gating) | kalman_plan_05 | 42.0 | 0.0% [0.0%, 0.4%] | 4.2% [3.1%, 5.6%] | 67.1% [64.1%, 69.9%] | 95.4% [93.9%, 96.5%] | 28.0 | 4.6% |
| plateau/daily@centre (gating) | kalman_plan_bonf | 42.0 | 0.0% [0.0%, 0.4%] | 0.1% [0.0%, 0.6%] | 5.9% [4.6%, 7.5%] | 18.1% [15.8%, 20.6%] | n/a | 81.9% |
| plateau/daily@centre (gating) | kalman_plan_confirmed | 42.0 | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 19.8% [17.4%, 22.4%] | 58.0% [54.9%, 61.0%] | 42.0 | 42.0% |
| plateau/daily@centre (gating) | ols28_plan_bonf | 42.0 | 0.0% [0.0%, 0.4%] | 3.1% [2.2%, 4.4%] | 86.9% [84.7%, 88.9%] | 99.3% [98.6%, 99.7%] | 21.0 | 0.7% |
| plateau/daily@centre (gating) | weekly_means_point | 42.0 | 70.5% [67.6%, 73.2%] | 99.6% [99.0%, 99.8%] | 100.0% [99.6%, 100.0%] | 100.0% [99.6%, 100.0%] | 7.0 | 0.0% |
| plateau/weekly@centre | gated_plan_bonf | 42.0 | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 0.2% [0.1%, 0.7%] | 2.7% [1.9%, 3.9%] | n/a | 97.3% |
| plateau/weekly@centre | kalman_plan_05 | 42.0 | 0.1% [0.0%, 0.6%] | 0.3% [0.1%, 0.9%] | 16.9% [14.7%, 19.3%] | 56.1% [53.0%, 59.1%] | 42.0 | 43.9% |
| plateau/weekly@centre | kalman_plan_bonf | 42.0 | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 0.2% [0.1%, 0.7%] | 2.8% [1.9%, 4.0%] | n/a | 97.2% |
| plateau/weekly@centre | kalman_plan_confirmed | 42.0 | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 1.4% [0.8%, 2.3%] | 19.9% [17.5%, 22.5%] | n/a | 80.1% |
| plateau/weekly@centre | ols28_plan_bonf | 42.0 | 0.5% [0.2%, 1.2%] | 2.5% [1.7%, 3.7%] | 10.1% [8.4%, 12.1%] | 16.9% [14.7%, 19.3%] | n/a | 83.1% |
| plateau/weekly@centre | weekly_means_point | 42.0 | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | n/a | 100.0% |

### Innovation rules: nulls and nuisances

Share of series with any claim over the phase. For a null every claim is false; for a nuisance the table reports what happens.

| Configuration | innov_chi2_bonf | innov_mean_bonf | innov_robust_bonf |
|---|---|---|---|
| model_consistent/3.5d (null) | 3.6% [2.6%, 4.9%] | 5.0% [3.8%, 6.5%] | 0.3% [0.1%, 0.9%] |
| model_consistent/daily (null, gating) | 4.0% [3.0%, 5.4%] | 5.0% [3.8%, 6.5%] | 1.3% [0.8%, 2.2%] |
| model_consistent/weekly (null) | 3.7% [2.7%, 5.1%] | 4.9% [3.7%, 6.4%] | 0.0% [0.0%, 0.4%] |
| steady/3.5d (null) | 2.3% [1.5%, 3.4%] | 1.0% [0.5%, 1.8%] | 0.0% [0.0%, 0.4%] |
| steady/daily (null, gating) | 2.4% [1.6%, 3.5%] | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] |
| steady/weekly (null) | 1.8% [1.1%, 2.8%] | 0.7% [0.3%, 1.4%] | 0.0% [0.0%, 0.4%] |
| steady_irregular/irregular (null, gating) | 1.4% [0.8%, 2.3%] | 0.7% [0.3%, 1.4%] | 0.0% [0.0%, 0.4%] |
| steady_missing/missing (null, gating) | 2.5% [1.7%, 3.7%] | 0.2% [0.1%, 0.7%] | 0.0% [0.0%, 0.4%] |

### Innovation rules: a single bad reading

Series with a claim from day 56 on that the clean twin does not make.

| Configuration | innov_chi2_bonf | innov_mean_bonf | innov_robust_bonf |
|---|---|---|---|
| bad_reading/+2kg | 43.7% [40.7%, 46.8%] | 1.3% [0.8%, 2.2%] | 0.2% [0.1%, 0.7%] |
| bad_reading/+3kg | 93.3% [91.6%, 94.7%] | 8.9% [7.3%, 10.8%] | 1.3% [0.8%, 2.2%] |
| bad_reading/+5kg | 100.0% [99.6%, 100.0%] | 64.6% [61.6%, 67.5%] | 26.7% [24.1%, 29.5%] |

### Innovation rules: alternatives

| Configuration | Rule | Onset day | Pre-onset claim | Within 14 d | Within 28 d | By day 84 | Median delay, d | Censored |
|---|---|---|---|---|---|---|---|---|
| gradual_rate_change/daily | innov_chi2_bonf | 42.0 | 0.8% [0.4%, 1.6%] | 0.9% [0.5%, 1.7%] | 2.1% [1.4%, 3.2%] | 3.4% [2.4%, 4.7%] | n/a | 96.6% |
| gradual_rate_change/daily | innov_mean_bonf | 42.0 | 0.3% [0.1%, 0.9%] | 0.0% [0.0%, 0.4%] | 1.1% [0.6%, 2.0%] | 2.4% [1.6%, 3.5%] | n/a | 97.6% |
| gradual_rate_change/daily | innov_robust_bonf | 42.0 | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 0.1% [0.0%, 0.6%] | 0.1% [0.0%, 0.6%] | n/a | 99.9% |
| level_shift/3.5d | innov_chi2_bonf | 42.0 | 0.8% [0.4%, 1.6%] | 63.1% [60.1%, 66.0%] | 63.8% [60.8%, 66.7%] | 64.4% [61.4%, 67.3%] | 7.0 | 35.6% |
| level_shift/3.5d | innov_mean_bonf | 42.0 | 0.6% [0.3%, 1.3%] | 54.4% [51.3%, 57.5%] | 55.6% [52.5%, 58.7%] | 57.0% [53.9%, 60.0%] | 7.0 | 43.0% |
| level_shift/3.5d | innov_robust_bonf | 42.0 | 0.1% [0.0%, 0.6%] | 2.0% [1.3%, 3.1%] | 2.3% [1.5%, 3.4%] | 2.4% [1.6%, 3.5%] | n/a | 97.6% |
| level_shift/daily (gating) | innov_chi2_bonf | 42.0 | 0.8% [0.4%, 1.6%] | 96.4% [95.1%, 97.4%] | 96.6% [95.3%, 97.6%] | 96.7% [95.4%, 97.6%] | 7.0 | 3.3% |
| level_shift/daily (gating) | innov_mean_bonf | 42.0 | 0.2% [0.1%, 0.7%] | 94.8% [93.2%, 96.0%] | 95.5% [94.0%, 96.6%] | 95.7% [94.3%, 96.8%] | 7.0 | 4.3% |
| level_shift/daily (gating) | innov_robust_bonf | 42.0 | 0.1% [0.0%, 0.6%] | 31.2% [28.4%, 34.1%] | 41.5% [38.5%, 44.6%] | 41.9% [38.9%, 45.0%] | n/a | 58.1% |
| level_shift/weekly | innov_chi2_bonf | 42.0 | 0.8% [0.4%, 1.6%] | 39.7% [36.7%, 42.8%] | 40.9% [37.9%, 44.0%] | 41.2% [38.2%, 44.3%] | n/a | 58.8% |
| level_shift/weekly | innov_mean_bonf | 42.0 | 0.5% [0.2%, 1.2%] | 36.2% [33.3%, 39.2%] | 37.2% [34.3%, 40.2%] | 38.3% [35.3%, 41.4%] | n/a | 61.7% |
| level_shift/weekly | innov_robust_bonf | 42.0 | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | n/a | 100.0% |
| plateau/3.5d | innov_chi2_bonf | 42.0 | 0.8% [0.4%, 1.6%] | 2.8% [1.9%, 4.0%] | 3.8% [2.8%, 5.2%] | 4.2% [3.1%, 5.6%] | n/a | 95.8% |
| plateau/3.5d | innov_mean_bonf | 42.0 | 0.3% [0.1%, 0.9%] | 2.8% [1.9%, 4.0%] | 6.0% [4.7%, 7.6%] | 6.0% [4.7%, 7.6%] | n/a | 94.0% |
| plateau/3.5d | innov_robust_bonf | 42.0 | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 0.1% [0.0%, 0.6%] | 0.1% [0.0%, 0.6%] | n/a | 99.9% |
| plateau/daily (gating) | innov_chi2_bonf | 42.0 | 0.5% [0.2%, 1.2%] | 2.2% [1.5%, 3.3%] | 4.0% [3.0%, 5.4%] | 5.1% [3.9%, 6.6%] | n/a | 94.9% |
| plateau/daily (gating) | innov_mean_bonf | 42.0 | 0.5% [0.2%, 1.2%] | 4.0% [3.0%, 5.4%] | 7.7% [6.2%, 9.5%] | 7.7% [6.2%, 9.5%] | n/a | 92.3% |
| plateau/daily (gating) | innov_robust_bonf | 42.0 | 0.0% [0.0%, 0.4%] | 0.5% [0.2%, 1.2%] | 1.0% [0.5%, 1.8%] | 1.0% [0.5%, 1.8%] | n/a | 99.0% |
| plateau/weekly | innov_chi2_bonf | 42.0 | 0.5% [0.2%, 1.2%] | 1.8% [1.1%, 2.8%] | 3.0% [2.1%, 4.3%] | 3.8% [2.8%, 5.2%] | n/a | 96.2% |
| plateau/weekly | innov_mean_bonf | 42.0 | 0.4% [0.2%, 1.0%] | 2.2% [1.5%, 3.3%] | 3.7% [2.7%, 5.1%] | 4.6% [3.5%, 6.1%] | n/a | 95.4% |
| plateau/weekly | innov_robust_bonf | 42.0 | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | 0.0% [0.0%, 0.4%] | n/a | 100.0% |

### Innovation rules: descriptive

| Configuration | Rule | Any claim over the phase |
|---|---|---|
| curved/daily | innov_chi2_bonf | 3.5% [2.5%, 4.8%] |
| curved/daily | innov_mean_bonf | 0.2% [0.1%, 0.7%] |
| curved/daily | innov_robust_bonf | 0.0% [0.0%, 0.4%] |
