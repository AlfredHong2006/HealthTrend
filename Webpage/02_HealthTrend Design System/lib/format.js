/* HealthTrend — precision, units, locale. THE single source for how a model
   quantity becomes a string. Load it before the bundle; it publishes
   window.HTFormat. Components stay presentational and take pre-formatted
   strings (see HeroMetric.d.ts) — formatting happens once, here, at the
   boundary, so the rules cannot drift between a chart, a table and a hero.

   Two rules the whole file exists to enforce:
     1. Precision is a claim. Never print a digit the model cannot support.
     2. The minus sign is U+2212, never a hyphen. */
(function () {
  var MINUS = '\u2212';       /* − */
  var EN_DASH = '\u2013';     /* – for ranges */
  var MIDDOT = '\u00b7';      /* · separator */
  var KG_PER_LB = 0.45359237;

  /* ── Unit table ──────────────────────────────────────────────────────────
     decimals            trend weight, confident estimate
     decimalsWide        trend weight when the estimate is weak: one digit less
     rateDecimals        rate of change, per week
     rateDecimalsWide    rate when the interval is wide
     intervalDecimals    half-width of an interval. FINER than the estimate: a
                         half-width is a small number, and ±0.70 vs ±0.74 is a
                         real difference at that scale. Never reuses
                         decimalsWide — rounding ±0.82 to ±1 destroys exactly
                         the information the wide state exists to convey.
     intervalDecimalsWide
     digitSlots          character slots to RESERVE at hero scale, so switching
                         units never reflows the composition (see HeroMetric
                         `digits`). "168.0" and "76.2" both fit 5.
     rawDecimals         a single scale reading — always 1, it is what the
                         instrument said, not an estimate */
  var UNITS = {
    kg: {
      label: 'kg', rate: 'kg/week', rateFortnight: 'kg/fortnight',
      decimals: 1, decimalsWide: 0, rateDecimals: 2, rateDecimalsWide: 1,
      intervalDecimals: 2, intervalDecimalsWide: 1,
      rawDecimals: 1, digitSlots: 5
    },
    lb: {
      label: 'lb', rate: 'lb/week', rateFortnight: 'lb/fortnight',
      decimals: 1, decimalsWide: 0, rateDecimals: 2, rateDecimalsWide: 1,
      intervalDecimals: 2, intervalDecimalsWide: 1,
      rawDecimals: 1, digitSlots: 5
    }
  };

  var locale = {
    unit: 'kg',        /* display unit — the model always works in kg */
    clock: '24h',      /* '24h' | '12h' */
    dateOrder: 'DMY',  /* 'DMY' | 'MDY' */
    decimal: '.'       /* ',' for de/fr; applied last, to the finished string */
  };

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function setLocale(next) { for (var k in next) if (next.hasOwnProperty(k)) locale[k] = next[k]; return locale; }
  function getLocale() { return locale; }
  function unitDef(u) { return UNITS[u || locale.unit] || UNITS.kg; }

  /* kg is the model's unit. Everything displayed converts from it. */
  function toUnit(kg, u) { return (u || locale.unit) === 'lb' ? kg / KG_PER_LB : kg; }
  function fromUnit(v, u) { return (u || locale.unit) === 'lb' ? v * KG_PER_LB : v; }

  /* Fixed-decimal string with a real minus and the locale decimal mark. */
  function num(v, decimals) {
    if (v == null || isNaN(v)) return EN_DASH;
    var s = Math.abs(v).toFixed(decimals);
    if (locale.decimal !== '.') s = s.replace('.', locale.decimal);
    return (v < 0 ? MINUS : '') + s;
  }
  function signed(v, decimals) {
    if (v == null || isNaN(v)) return EN_DASH;
    return (v > 0 ? '+' : '') + num(v, decimals);
  }

  /* ── Confidence ──────────────────────────────────────────────────────────
     One function decides the state; every component reads it rather than
     inventing its own thresholds.
       insufficient  fewer than 10 readings, or fewer than 3/week over 14 days
       wide          68% half-width at or above wideHalfWidth68Kg
       stale         no reading for 5+ days
       ok            everything else

     Uncertainty is PHYSICAL. There is exactly one wide threshold, held in kg,
     and the display unit cannot move it: 0.5 kg IS 1.10 lb, so the same
     estimate must classify identically whichever unit the user reads. */
  var THRESHOLDS = { minReadings: 10, minPerWeek: 3, staleDays: 5, wideHalfWidth68Kg: 0.5 };

  /* The one threshold, expressed in a display unit — for copy and specimens. */
  function wideThreshold(u) { return toUnit(THRESHOLDS.wideHalfWidth68Kg, u); }

  function confidence(m) {
    m = m || {};
    if (m.n != null && m.n < THRESHOLDS.minReadings) return 'insufficient';
    if (m.perWeek != null && m.perWeek < THRESHOLDS.minPerWeek) return 'insufficient';
    if (m.daysSinceReading != null && m.daysSinceReading >= THRESHOLDS.staleDays) return 'stale';
    /* halfWidth68 is in kg, per this module's contract — so compare in kg. */
    if (m.halfWidth68 != null && m.halfWidth68 >= THRESHOLDS.wideHalfWidth68Kg) return 'wide';
    return 'ok';
  }

  /* ── Trend weight (tier 1) ───────────────────────────────────────────────
     Precision REDUCES when confidence is low: an estimate whose 68% interval
     is ±0.6 kg has no business printing a tenth. Returns null when no estimate
     may be shown at all — the caller renders the insufficient-data state. */
  function trendWeight(kg, opts) {
    opts = opts || {};
    var u = opts.unit || locale.unit, d = unitDef(u);
    var c = opts.confidence || 'ok';
    if (c === 'insufficient') return null;
    var dec = c === 'wide' ? d.decimalsWide : d.decimals;
    return num(toUnit(kg, u), dec);
  }

  /* A single scale reading (tier 3). Never rounded by confidence — it is a
     measurement, not a claim. */
  function reading(kg, opts) {
    opts = opts || {};
    var u = opts.unit || locale.unit;
    return num(toUnit(kg, u), unitDef(u).rawDecimals);
  }

  /* ── Rate of change (tier 2, but always adjacent to the hero) ────────────
     Always signed — the sign IS the information — and always per a named
     window. Two decimals in kg/week: one decimal hides a 0.05 kg/week change,
     which is 2.6 kg a year. */
  function rate(kgPerWeek, opts) {
    opts = opts || {};
    var u = opts.unit || locale.unit, d = unitDef(u);
    var per = opts.per || 'week';
    var v = toUnit(kgPerWeek, u) * (per === 'fortnight' ? 2 : 1);
    var dec = opts.confidence === 'wide' ? d.rateDecimalsWide : d.rateDecimals;
    return signed(v, dec) + ' ' + (per === 'fortnight' ? d.rateFortnight : d.rate);
  }

  /* ── Uncertainty ─────────────────────────────────────────────────────────
     Symmetric intervals print as ±half-width; asymmetric ones print both
     bounds. Both carry their level, because "±0.7" without "(68%)" is not a
     statement.

     A half-width is printed FINER than the estimate it qualifies (2 decimals,
     1 when wide) because it is a different order of magnitude: ±0.70 against
     76.2 is not false precision, it is the resolution that scale needs.
     Interval BOUNDS, by contrast, are magnitudes like the estimate, so
     `interval()` and `range()` use the estimate's own precision. */
  function plusMinus(halfWidthKg, opts) {
    opts = opts || {};
    var u = opts.unit || locale.unit, d = unitDef(u);
    var dec = opts.decimals != null ? opts.decimals
      : (opts.confidence === 'wide' ? d.intervalDecimalsWide : d.intervalDecimals);
    return '\u00b1' + num(toUnit(halfWidthKg, u), dec) + ' ' + d.label +
      (opts.level ? ' (' + opts.level + '%)' : '');
  }

  function interval(loKg, hiKg, opts) {
    opts = opts || {};
    var u = opts.unit || locale.unit, d = unitDef(u);
    var dec = opts.decimals != null ? opts.decimals
      : (opts.confidence === 'wide' ? d.decimalsWide : d.decimals);
    var head = opts.level ? opts.level + '% CI ' : '';
    return head + num(toUnit(loKg, u), dec) + ' to ' + num(toUnit(hiKg, u), dec) +
      (opts.unitLabel === false ? '' : ' ' + d.label);
  }

  function rateInterval(loKgWk, hiKgWk, opts) {
    opts = opts || {};
    var u = opts.unit || locale.unit, d = unitDef(u);
    var per = opts.per || 'week', mult = per === 'fortnight' ? 2 : 1;
    var dec = opts.confidence === 'wide' ? d.rateDecimalsWide : d.rateDecimals;
    var head = opts.level ? opts.level + '% CI ' : '';
    return head + num(toUnit(loKgWk, u) * mult, dec) + ' to ' + num(toUnit(hiKgWk, u) * mult, dec) +
      ' ' + (per === 'fortnight' ? d.rateFortnight : d.rate);
  }

  /* A range of values (not an interval): "76.2–78.9 kg". */
  function range(loKg, hiKg, opts) {
    opts = opts || {};
    var u = opts.unit || locale.unit, d = unitDef(u);
    var dec = opts.confidence === 'wide' ? d.decimalsWide : d.decimals;
    return num(toUnit(loKg, u), dec) + EN_DASH + num(toUnit(hiKg, u), dec) + ' ' + d.label;
  }

  /* ── Sample and model quantities ─────────────────────────────────────────
     Notation stays in mathematical form: n = 103, σ = 0.71 kg, R² = 0.91. */
  function n(count) { return 'n = ' + count; }
  function sigma(kg, opts) {
    var u = (opts && opts.unit) || locale.unit;
    return '\u03c3 = ' + num(toUnit(kg, u), 2) + ' ' + unitDef(u).label;
  }
  function rSquared(v) { return 'R\u00b2 = ' + num(v, 2); }
  function pValue(p) {
    if (p == null) return EN_DASH;
    if (p < 0.001) return 'p < 0.001';
    return 'p = ' + num(p, 3);
  }
  function percent(frac, decimals) { return num(frac * 100, decimals == null ? 1 : decimals) + '%'; }

  /* ── Dates and times ─────────────────────────────────────────────────────
     Short by default: the ledger is scanned, not read. Time is shown only
     where it matters (a weigh-in is a time of day; a projection is not). */
  function two(v) { return (v < 10 ? '0' : '') + v; }

  function time(date) {
    var h = date.getHours(), m = two(date.getMinutes());
    if (locale.clock === '12h') {
      var ampm = h < 12 ? 'am' : 'pm', h12 = h % 12 || 12;
      return h12 + ':' + m + ' ' + ampm;
    }
    return two(h) + ':' + m;
  }

  function dateShort(date) {
    var d = date.getDate(), mo = MONTHS[date.getMonth()];
    return locale.dateOrder === 'MDY' ? mo + ' ' + d : d + ' ' + mo;
  }
  function dateLong(date) { return dateShort(date) + ' ' + date.getFullYear(); }
  function monthTick(date) { return MONTHS[date.getMonth()]; }

  function daysBetween(a, b) { return Math.round((b - a) / 86400000); }

  /* "as of today, 06:40" / "as of 4 days ago, 07:10" — relative up to a week,
     absolute beyond it, because "as of 23 days ago" is arithmetic homework. */
  function asOf(date, now) {
    now = now || new Date();
    var days = daysBetween(new Date(date.getFullYear(), date.getMonth(), date.getDate()),
      new Date(now.getFullYear(), now.getMonth(), now.getDate()));
    var when = days === 0 ? 'today' : days === 1 ? 'yesterday'
      : days < 7 ? days + ' days ago' : dateShort(date);
    return 'as of ' + when + ', ' + time(date);
  }

  function staleness(daysSince) {
    if (daysSince < THRESHOLDS.staleDays) return null;
    return 'No reading for ' + daysSince + ' days \u2014 interval widening';
  }

  /* ── Hero composition helper ──────────────────────────────────────────────
     Character slots to reserve at hero scale for a given unit, so kg → lb does
     not shift the page. Pass the result to HeroMetric `digits`. */
  function digitSlots(u) { return unitDef(u).digitSlots; }

  window.HTFormat = {
    MINUS: MINUS, EN_DASH: EN_DASH, MIDDOT: MIDDOT, KG_PER_LB: KG_PER_LB,
    UNITS: UNITS, THRESHOLDS: THRESHOLDS,
    setLocale: setLocale, getLocale: getLocale,
    toUnit: toUnit, fromUnit: fromUnit, num: num, signed: signed,
    confidence: confidence, wideThreshold: wideThreshold,
    trendWeight: trendWeight, reading: reading, rate: rate,
    plusMinus: plusMinus, interval: interval, rateInterval: rateInterval, range: range,
    n: n, sigma: sigma, rSquared: rSquared, pValue: pValue, percent: percent,
    time: time, dateShort: dateShort, dateLong: dateLong, monthTick: monthTick,
    asOf: asOf, staleness: staleness, daysBetween: daysBetween,
    digitSlots: digitSlots
  };
})();
