/* @ds-bundle: {"format":4,"namespace":"HealthTrendDesignSystem_5b333a","components":[{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Icon","sourcePath":"components/core/Icon.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"Input","sourcePath":"components/core/Input.jsx"},{"name":"SegmentedControl","sourcePath":"components/core/SegmentedControl.jsx"},{"name":"Select","sourcePath":"components/core/Select.jsx"},{"name":"Switch","sourcePath":"components/core/Switch.jsx"},{"name":"TextLink","sourcePath":"components/core/TextLink.jsx"},{"name":"Tooltip","sourcePath":"components/core/Tooltip.jsx"},{"name":"ChartLegend","sourcePath":"components/data/ChartLegend.jsx"},{"name":"MeasurementTable","sourcePath":"components/data/MeasurementTable.jsx"},{"name":"RangeStrip","sourcePath":"components/data/RangeStrip.jsx"},{"name":"Sparkline","sourcePath":"components/data/Sparkline.jsx"},{"name":"TrajectoryChart","sourcePath":"components/data/TrajectoryChart.jsx"},{"name":"HeroMetric","sourcePath":"components/metrics/HeroMetric.jsx"},{"name":"Qualifier","sourcePath":"components/metrics/Qualifier.jsx"},{"name":"RawReading","sourcePath":"components/metrics/RawReading.jsx"},{"name":"SupportingMetric","sourcePath":"components/metrics/SupportingMetric.jsx"},{"name":"TrendDelta","sourcePath":"components/metrics/TrendDelta.jsx"},{"name":"Reveal","sourcePath":"components/motion/Reveal.jsx"},{"name":"Citation","sourcePath":"components/prose/Citation.jsx"},{"name":"Equation","sourcePath":"components/prose/Equation.jsx"},{"name":"FigureCaption","sourcePath":"components/prose/FigureCaption.jsx"},{"name":"MarginNote","sourcePath":"components/prose/MarginNote.jsx"},{"name":"Prose","sourcePath":"components/prose/Prose.jsx"},{"name":"SectionHeading","sourcePath":"components/prose/SectionHeading.jsx"},{"name":"ConfidenceNote","sourcePath":"components/states/ConfidenceNote.jsx"},{"name":"InsufficientData","sourcePath":"components/states/InsufficientData.jsx"},{"name":"OutlierFlag","sourcePath":"components/states/OutlierFlag.jsx"}],"sourceHashes":{"components/core/Badge.jsx":"0c0fb5530193","components/core/Button.jsx":"a2d5c593ff74","components/core/Icon.jsx":"fbf6eb1653e7","components/core/IconButton.jsx":"9675755aafb4","components/core/Input.jsx":"6ac9bbc231dd","components/core/SegmentedControl.jsx":"cda47298e230","components/core/Select.jsx":"a3be0bfc799b","components/core/Switch.jsx":"bfb83c450a02","components/core/TextLink.jsx":"3f16d10531b4","components/core/Tooltip.jsx":"0f2696b143e3","components/data/ChartLegend.jsx":"c0d998f7a406","components/data/MeasurementTable.jsx":"87db56f1cc4c","components/data/RangeStrip.jsx":"2e1c1dd16e6e","components/data/Sparkline.jsx":"cdc0987bac5a","components/data/TrajectoryChart.jsx":"b47b8337c443","components/metrics/HeroMetric.jsx":"0f100158af58","components/metrics/Qualifier.jsx":"62ad70ae16da","components/metrics/RawReading.jsx":"ed73632e0c02","components/metrics/SupportingMetric.jsx":"89559ffbcb84","components/metrics/TrendDelta.jsx":"cf6ca4de326e","components/motion/Reveal.jsx":"f7ae8a4e7360","components/prose/Citation.jsx":"968d37ab619d","components/prose/Equation.jsx":"e596ad4ef2ce","components/prose/FigureCaption.jsx":"72e03998dfa0","components/prose/MarginNote.jsx":"df06a46121c7","components/prose/Prose.jsx":"8a9b411ced14","components/prose/SectionHeading.jsx":"078f0b78894b","components/states/ConfidenceNote.jsx":"73f9e9853339","components/states/InsufficientData.jsx":"0daf91c57b57","components/states/OutlierFlag.jsx":"2c2a6a7e111e","lib/format.js":"9f29ca1c262e","ui_kits/app/AppShell.jsx":"ba0df0031624","ui_kits/app/EvidenceScreen.jsx":"7f12e260f2e4","ui_kits/app/LogWeighIn.jsx":"ad8f79ff827a","ui_kits/app/MeasurementsScreen.jsx":"7108092bb80c","ui_kits/app/SettingsScreen.jsx":"8b39b8c43243","ui_kits/app/TrendScreen.jsx":"60915e69c006","ui_kits/app/fixtures.js":"5c82e54bd57a","ui_kits/method/MethodBody.jsx":"a26085951336","ui_kits/method/MethodHeader.jsx":"ea0756c5ab81"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.HealthTrendDesignSystem_5b333a = window.HealthTrendDesignSystem_5b333a || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Badge.jsx
try { (() => {
const htBadgeSkins = {
  neutral: {
    background: 'var(--surface-hover)',
    color: 'var(--text-secondary)'
  },
  accent: {
    background: 'var(--surface-accent-tint)',
    color: 'var(--azure-700)'
  },
  stale: {
    background: 'var(--surface-stale)',
    color: 'var(--data-stale)'
  },
  outline: {
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-control)'
  }
};
function Badge({
  children,
  variant = 'neutral',
  style
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      height: 19,
      padding: '0 6px',
      borderRadius: 'var(--radius-1)',
      fontFamily: 'var(--font-numeric)',
      fontSize: 'var(--size-qualifier)',
      fontWeight: 'var(--weight-ui-strong)',
      letterSpacing: '0.02em',
      fontVariantNumeric: 'tabular-nums',
      whiteSpace: 'nowrap',
      ...htBadgeSkins[variant],
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Icon.jsx
try { (() => {
// Lucide (1.5px stroke) is HealthTrend's icon set — loaded from CDN, see readme ICONOGRAPHY.
const LUCIDE_SRC = 'https://unpkg.com/lucide@0.475.0/dist/umd/lucide.min.js';
let pending;
function loadLucide() {
  if (pending) return pending;
  pending = new Promise(resolve => {
    if (window.lucide) return resolve(window.lucide);
    const s = document.createElement('script');
    s.src = LUCIDE_SRC;
    s.onload = () => resolve(window.lucide);
    document.head.appendChild(s);
  });
  return pending;
}
function Icon({
  name,
  size = 16,
  strokeWidth,
  color = 'currentColor',
  style
}) {
  const host = React.useRef(null);
  React.useEffect(() => {
    let alive = true;
    loadLucide().then(lucide => {
      if (!alive || !host.current || !lucide) return;
      host.current.innerHTML = '';
      const el = document.createElement('i');
      el.setAttribute('data-lucide', name);
      host.current.appendChild(el);
      lucide.createIcons({
        nameAttr: 'data-lucide',
        attrs: {
          width: size,
          height: size,
          stroke: color,
          'stroke-width': strokeWidth || 1.5
        }
      });
    });
    return () => {
      alive = false;
    };
  }, [name, size, color, strokeWidth]);
  return /*#__PURE__*/React.createElement("span", {
    ref: host,
    "aria-hidden": "true",
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      width: size,
      height: size,
      flex: '0 0 auto',
      ...style
    }
  });
}
Object.assign(__ds_scope, { Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Icon.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const htButtonBase = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 'var(--space-3)',
  fontFamily: 'var(--font-numeric)',
  fontWeight: 'var(--weight-ui-strong)',
  letterSpacing: '0.005em',
  borderRadius: 'var(--radius-1)',
  cursor: 'pointer',
  transition: 'var(--transition-control)',
  whiteSpace: 'nowrap',
  border: '1px solid transparent',
  textDecoration: 'none'
};
const htButtonSizes = {
  sm: {
    height: 28,
    padding: '0 10px',
    fontSize: 'var(--size-ui-sm)'
  },
  md: {
    height: 34,
    padding: '0 14px',
    fontSize: 'var(--size-ui)'
  }
};
function htButtonSkin(variant, hover, active) {
  if (variant === 'primary') return {
    background: active ? 'var(--azure-700)' : hover ? 'var(--surface-accent-hover)' : 'var(--surface-accent)',
    color: 'var(--text-inverse)'
  };
  if (variant === 'secondary') return {
    background: hover ? 'var(--surface-hover)' : 'var(--surface-page)',
    color: 'var(--text-body)',
    borderColor: hover ? 'var(--border-control-hover)' : 'var(--border-control)'
  };
  return {
    background: hover ? 'var(--surface-hover)' : 'transparent',
    color: active ? 'var(--text-display)' : 'var(--text-secondary)'
  };
}
function Button({
  children,
  variant = 'secondary',
  size = 'md',
  icon,
  iconRight,
  disabled,
  onClick,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const [active, setActive] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    disabled: disabled,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setActive(false);
    },
    onMouseDown: () => setActive(true),
    onMouseUp: () => setActive(false),
    style: {
      ...htButtonBase,
      ...htButtonSizes[size],
      ...htButtonSkin(variant, hover && !disabled, active && !disabled),
      opacity: disabled ? 0.45 : 1,
      cursor: disabled ? 'not-allowed' : 'pointer',
      ...style
    }
  }, rest), icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: size === 'sm' ? 13 : 15
  }) : null, children, iconRight ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: iconRight,
    size: size === 'sm' ? 13 : 15
  }) : null);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
function IconButton({
  icon,
  label,
  size = 30,
  onClick,
  active,
  style
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": label,
    title: label,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      width: size,
      height: size,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: active || hover ? 'var(--surface-hover)' : 'transparent',
      color: active ? 'var(--text-accent)' : hover ? 'var(--text-display)' : 'var(--text-secondary)',
      border: '1px solid transparent',
      borderRadius: 'var(--radius-1)',
      cursor: 'pointer',
      transition: 'var(--transition-control)',
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: Math.round(size * 0.54)
  }));
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/core/Input.jsx
try { (() => {
function Input({
  value,
  onChange,
  label,
  unit,
  placeholder,
  width = 160,
  numeric = true,
  hint,
  align = 'left'
}) {
  const [focus, setFocus] = React.useState(false);
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'inline-flex',
      flexDirection: 'column',
      gap: 'var(--space-3)'
    }
  }, label ? /*#__PURE__*/React.createElement("span", {
    className: "ht-eyebrow"
  }, label) : null, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      width,
      border: '1px solid ' + (focus ? 'var(--border-accent)' : 'var(--border-control)'),
      borderRadius: 'var(--radius-1)',
      background: 'var(--surface-page)',
      transition: 'var(--transition-control)',
      height: 34,
      padding: '0 10px',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: value,
    placeholder: placeholder,
    onChange: e => onChange && onChange(e.target.value),
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    inputMode: numeric ? 'decimal' : 'text',
    style: {
      border: 0,
      outline: 'none',
      background: 'transparent',
      width: '100%',
      fontFamily: numeric ? 'var(--font-numeric)' : 'var(--font-prose)',
      fontSize: numeric ? '16px' : 'var(--size-body-sm)',
      fontVariantNumeric: numeric ? 'tabular-nums' : 'normal',
      color: 'var(--text-display)',
      textAlign: align
    }
  }), unit ? /*#__PURE__*/React.createElement("span", {
    className: "ht-qualifier",
    style: {
      flex: '0 0 auto'
    }
  }, unit) : null), hint ? /*#__PURE__*/React.createElement("span", {
    className: "ht-qualifier"
  }, hint) : null);
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Input.jsx", error: String((e && e.message) || e) }); }

// components/core/SegmentedControl.jsx
try { (() => {
function SegmentedControl({
  options,
  value,
  onChange,
  variant = 'pill',
  size = 'md'
}) {
  const pill = variant === 'pill';
  const h = size === 'sm' ? 26 : 30;
  return /*#__PURE__*/React.createElement("div", {
    role: "tablist",
    style: pill ? {
      display: 'inline-flex',
      gap: 2,
      padding: 2,
      background: 'var(--surface-hover)',
      borderRadius: 'var(--radius-pill)'
    } : {
      display: 'inline-flex',
      gap: 'var(--space-7)',
      borderBottom: 'var(--line-hair)'
    }
  }, options.map(o => {
    const key = typeof o === 'string' ? o : o.value;
    const label = typeof o === 'string' ? o : o.label;
    const on = key === value;
    return /*#__PURE__*/React.createElement("button", {
      key: key,
      role: "tab",
      "aria-selected": on,
      onClick: () => onChange && onChange(key),
      style: pill ? {
        height: h,
        padding: '0 12px',
        border: 0,
        cursor: 'pointer',
        borderRadius: 'var(--radius-pill)',
        background: on ? 'var(--surface-page)' : 'transparent',
        boxShadow: on ? '0 1px 1px rgba(14,20,28,.07)' : 'none',
        color: on ? 'var(--text-display)' : 'var(--text-secondary)',
        fontFamily: 'var(--font-numeric)',
        fontSize: 'var(--size-ui-sm)',
        fontWeight: on ? 'var(--weight-ui-strong)' : 'var(--weight-ui)',
        fontVariantNumeric: 'tabular-nums',
        transition: 'var(--transition-control)'
      } : {
        height: h + 6,
        padding: '0 0 8px',
        border: 0,
        background: 'transparent',
        cursor: 'pointer',
        color: on ? 'var(--text-display)' : 'var(--text-secondary)',
        borderBottom: on ? 'var(--line-accent)' : '2px solid transparent',
        marginBottom: -1,
        fontFamily: 'var(--font-numeric)',
        fontSize: 'var(--size-ui)',
        fontWeight: on ? 'var(--weight-ui-strong)' : 'var(--weight-ui)',
        transition: 'var(--transition-control)'
      }
    }, label);
  }));
}
Object.assign(__ds_scope, { SegmentedControl });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/SegmentedControl.jsx", error: String((e && e.message) || e) }); }

// components/core/Select.jsx
try { (() => {
function Select({
  options,
  value,
  onChange,
  label,
  width = 168,
  size = 'md'
}) {
  const h = size === 'sm' ? 28 : 34;
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'inline-flex',
      flexDirection: 'column',
      gap: 'var(--space-3)'
    }
  }, label ? /*#__PURE__*/React.createElement("span", {
    className: "ht-eyebrow"
  }, label) : null, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'relative',
      display: 'inline-flex',
      width
    }
  }, /*#__PURE__*/React.createElement("select", {
    value: value,
    onChange: e => onChange && onChange(e.target.value),
    style: {
      appearance: 'none',
      width: '100%',
      height: h,
      padding: '0 30px 0 10px',
      background: 'var(--surface-page)',
      color: 'var(--text-body)',
      border: '1px solid var(--border-control)',
      borderRadius: 'var(--radius-1)',
      fontFamily: 'var(--font-numeric)',
      fontSize: size === 'sm' ? 'var(--size-ui-sm)' : 'var(--size-ui)',
      fontVariantNumeric: 'tabular-nums',
      cursor: 'pointer'
    }
  }, options.map(o => {
    const v = typeof o === 'string' ? o : o.value;
    const l = typeof o === 'string' ? o : o.label;
    return /*#__PURE__*/React.createElement("option", {
      key: v,
      value: v
    }, l);
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      right: 9,
      top: 0,
      height: h,
      display: 'flex',
      alignItems: 'center',
      color: 'var(--text-qualifier)',
      pointerEvents: 'none'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-down",
    size: 14
  }))));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Select.jsx", error: String((e && e.message) || e) }); }

// components/core/Switch.jsx
try { (() => {
function Switch({
  checked,
  onChange,
  label,
  hint,
  disabled
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'inline-flex',
      alignItems: 'flex-start',
      gap: 'var(--space-5)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    onClick: () => !disabled && onChange && onChange(!checked),
    style: {
      width: 32,
      height: 18,
      flex: '0 0 auto',
      marginTop: 2,
      borderRadius: 'var(--radius-pill)',
      background: checked ? 'var(--surface-accent)' : 'var(--rule-2)',
      transition: 'background-color var(--dur-2) var(--ease-standard)',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 2,
      left: checked ? 16 : 2,
      width: 14,
      height: 14,
      borderRadius: 'var(--radius-pill)',
      background: 'var(--surface-page)',
      boxShadow: '0 1px 1.5px rgba(14,20,28,.25)',
      transition: 'left var(--dur-2) var(--ease-standard)'
    }
  })), label ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ht-ui"
  }, label), hint ? /*#__PURE__*/React.createElement("span", {
    className: "ht-qualifier"
  }, hint) : null) : null);
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Switch.jsx", error: String((e && e.message) || e) }); }

// components/core/TextLink.jsx
try { (() => {
function TextLink({
  children,
  href = '#',
  variant = 'prose',
  onClick,
  style
}) {
  const [hover, setHover] = React.useState(false);
  const prose = variant === 'prose';
  return /*#__PURE__*/React.createElement("a", {
    href: href,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      fontFamily: prose ? 'inherit' : 'var(--font-numeric)',
      fontSize: prose ? 'inherit' : 'var(--size-ui)',
      color: hover ? 'var(--azure-600)' : 'var(--text-accent)',
      textDecoration: 'none',
      borderBottom: '1px solid ' + (hover ? 'var(--azure-500)' : 'var(--azure-300)'),
      transition: 'var(--transition-control)',
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { TextLink });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/TextLink.jsx", error: String((e && e.message) || e) }); }

// components/core/Tooltip.jsx
try { (() => {
function Tooltip({
  children,
  content,
  side = 'top'
}) {
  const [open, setOpen] = React.useState(false);
  const pos = side === 'top' ? {
    bottom: '100%',
    left: '50%',
    transform: 'translate(-50%, -6px)'
  } : {
    top: '100%',
    left: '50%',
    transform: 'translate(-50%, 6px)'
  };
  return /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'relative',
      display: 'inline-flex'
    },
    onMouseEnter: () => setOpen(true),
    onMouseLeave: () => setOpen(false)
  }, children, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      ...pos,
      zIndex: 40,
      pointerEvents: 'none',
      opacity: open ? 1 : 0,
      transition: 'opacity var(--dur-2) var(--ease-standard)',
      background: 'var(--surface-page)',
      border: '1px solid var(--border-divider)',
      borderRadius: 'var(--radius-2)',
      boxShadow: 'var(--shadow-tooltip)',
      padding: '7px 10px',
      minWidth: 120,
      maxWidth: 260,
      whiteSpace: 'normal',
      fontFamily: 'var(--font-numeric)',
      fontSize: 'var(--size-qualifier)',
      lineHeight: 'var(--lh-qualifier)',
      color: 'var(--text-body)',
      fontVariantNumeric: 'tabular-nums'
    }
  }, content));
}
Object.assign(__ds_scope, { Tooltip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Tooltip.jsx", error: String((e && e.message) || e) }); }

// components/data/ChartLegend.jsx
try { (() => {
const htLegendMarks = {
  trend: /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "8"
  }, /*#__PURE__*/React.createElement("line", {
    x1: "0",
    y1: "4",
    x2: "20",
    y2: "4",
    stroke: "var(--data-trend)",
    strokeWidth: "2.25",
    strokeLinecap: "round"
  })),
  band: /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "10"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "0",
    y: "1",
    width: "20",
    height: "8",
    fill: "var(--data-band-68)"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "0",
    y: "0",
    width: "20",
    height: "10",
    fill: "var(--data-band-95)"
  })),
  projection: /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "8"
  }, /*#__PURE__*/React.createElement("line", {
    x1: "0",
    y1: "4",
    x2: "20",
    y2: "4",
    stroke: "var(--data-projection)",
    strokeWidth: "1.75",
    strokeDasharray: "4 4"
  })),
  raw: /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "8"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "4",
    cy: "4",
    r: "1.7",
    fill: "var(--data-raw-fill)"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "10",
    cy: "4",
    r: "1.7",
    fill: "var(--data-raw-fill)"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "16",
    cy: "4",
    r: "1.7",
    fill: "var(--data-raw-fill)"
  })),
  reference: /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "8"
  }, /*#__PURE__*/React.createElement("line", {
    x1: "0",
    y1: "4",
    x2: "20",
    y2: "4",
    stroke: "var(--data-reference)",
    strokeWidth: "1",
    strokeDasharray: "3 3"
  }))
};
function ChartLegend({
  items,
  layout = 'row'
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: layout === 'row' ? 'row' : 'column',
      gap: layout === 'row' ? 'var(--space-7)' : 'var(--space-4)',
      flexWrap: 'wrap',
      alignItems: layout === 'row' ? 'center' : 'flex-start'
    }
  }, items.map(it => /*#__PURE__*/React.createElement("span", {
    key: it.role,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 'var(--space-4)'
    }
  }, htLegendMarks[it.role], /*#__PURE__*/React.createElement("span", {
    className: "ht-qualifier"
  }, it.label))));
}
Object.assign(__ds_scope, { ChartLegend });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/ChartLegend.jsx", error: String((e && e.message) || e) }); }

// components/data/RangeStrip.jsx
try { (() => {
// Full-history context strip with the active window highlighted (Oura Trends pattern).
function RangeStrip({
  series = [],
  from = 0,
  to = 1,
  height = 56,
  ticks = [],
  onChange
}) {
  const ref = React.useRef(null);
  const [w, setW] = React.useState(900);
  const clipId = React.useMemo(() => 'htclip' + Math.random().toString(36).slice(2, 8), []);
  React.useEffect(() => {
    if (!ref.current || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(e => setW(e[0].contentRect.width));
    ro.observe(ref.current);
    setW(ref.current.clientWidth);
    return () => ro.disconnect();
  }, []);
  if (series.length < 2) return /*#__PURE__*/React.createElement("div", {
    ref: ref,
    style: {
      height
    }
  });
  const min = Math.min.apply(null, series),
    max = Math.max.apply(null, series);
  const sx = i => i / (series.length - 1) * w;
  const sy = v => height - 6 - (v - min) / (max - min || 1) * (height - 14);
  const area = series.map((v, i) => (i ? 'L' : 'M') + sx(i).toFixed(1) + ' ' + sy(v).toFixed(1)).join(' ') + ' L' + w + ' ' + height + ' L0 ' + height + ' Z';
  const x0 = from * w,
    x1 = to * w;
  const winW = Math.max(2, x1 - x0);
  return /*#__PURE__*/React.createElement("div", {
    ref: ref,
    style: {
      width: '100%'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "100%",
    height: height,
    viewBox: '0 0 ' + wv + ' ' + height,
    style: {
      display: 'block',
      cursor: onChange ? 'pointer' : 'default'
    },
    onClick: e => {
      if (!onChange) return;
      const box = e.currentTarget.getBoundingClientRect();
      const c = (e.clientX - box.left) / box.width,
        half = (to - from) / 2;
      onChange([Math.max(0, c - half), Math.min(1, c + half)]);
    }
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("clipPath", {
    id: clipId
  }, /*#__PURE__*/React.createElement("rect", {
    x: x0,
    y: "0",
    width: winW,
    height: height
  }))), /*#__PURE__*/React.createElement("path", {
    d: area,
    fill: "var(--data-raw-fill)",
    opacity: "0.45"
  }), /*#__PURE__*/React.createElement("rect", {
    x: x0,
    y: "0",
    width: winW,
    height: height,
    fill: "var(--data-selection)"
  }), /*#__PURE__*/React.createElement("path", {
    d: area,
    fill: "var(--data-trend)",
    opacity: "0.85",
    clipPath: 'url(#' + clipId + ')'
  }), /*#__PURE__*/React.createElement("rect", {
    x: x0,
    y: "0.5",
    width: winW,
    height: height - 1,
    fill: "none",
    stroke: "var(--rule-3)",
    strokeWidth: "1"
  })), ticks.length ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      marginTop: 'var(--space-3)'
    }
  }, ticks.map(t => /*#__PURE__*/React.createElement("span", {
    key: t,
    className: "ht-axis"
  }, t))) : null);
}
Object.assign(__ds_scope, { RangeStrip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/RangeStrip.jsx", error: String((e && e.message) || e) }); }

// components/data/Sparkline.jsx
try { (() => {
function Sparkline({
  trend = [],
  width = 120,
  height = 40,
  showBand = true,
  strokeWidth = 1.75
}) {
  if (trend.length < 2) return /*#__PURE__*/React.createElement("svg", {
    width: width,
    height: height
  });
  const ys = [];
  trend.forEach(p => {
    ys.push(p.y);
    if (showBand && p.lo68 != null) {
      ys.push(p.lo68);
      ys.push(p.hi68);
    }
  });
  const min = Math.min.apply(null, ys),
    max = Math.max.apply(null, ys);
  const sx = i => i / (trend.length - 1) * (width - 2) + 1;
  const sy = v => height - 2 - (v - min) / (max - min || 1) * (height - 4);
  const line = trend.map((p, i) => (i ? 'L' : 'M') + sx(i).toFixed(1) + ' ' + sy(p.y).toFixed(1)).join(' ');
  const area = showBand && trend[0].lo68 != null ? trend.map((p, i) => (i ? 'L' : 'M') + sx(i).toFixed(1) + ' ' + sy(p.hi68).toFixed(1)).join(' ') + ' ' + trend.slice().reverse().map((p, i) => 'L' + sx(trend.length - 1 - i).toFixed(1) + ' ' + sy(p.lo68).toFixed(1)).join(' ') + ' Z' : null;
  return /*#__PURE__*/React.createElement("svg", {
    width: width,
    height: height,
    style: {
      display: 'block',
      overflow: 'visible'
    }
  }, area ? /*#__PURE__*/React.createElement("path", {
    d: area,
    fill: "var(--data-band-68)"
  }) : null, /*#__PURE__*/React.createElement("path", {
    d: line,
    fill: "none",
    stroke: "var(--data-trend)",
    strokeWidth: strokeWidth,
    strokeLinecap: "round"
  }));
}
Object.assign(__ds_scope, { Sparkline });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Sparkline.jsx", error: String((e && e.message) || e) }); }

// components/data/TrajectoryChart.jsx
try { (() => {
// THE hero object of HealthTrend. Layer order, bottom to top:
// grid -> stale region -> 95% band -> 68% band -> raw measurements -> outlier
// rings -> projection -> trajectory -> readout.
//
// Confidence drives the ratio between band and line, which is how the chart
// states its own reliability:
//   ok            band at rest opacity, trend at 2.25px
//   wide          band gains presence, trend drops to 1.75px and 62% alpha —
//                 the band, not the line, is the honest headline
//   insufficient  raw readings only. No trend, no bands, no projection: the
//                 model has not produced a trajectory, so none is drawn.
function htScale(domain, range) {
  const d = domain[1] - domain[0] || 1;
  return v => range[0] + (v - domain[0]) / d * (range[1] - range[0]);
}
function htPath(pts) {
  return pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(2) + ' ' + p[1].toFixed(2)).join(' ');
}
function TrajectoryChart({
  raw = [],
  trend = [],
  projection = [],
  unit = 'kg',
  height = 420,
  showRaw = true,
  showBands = true,
  showProjection = true,
  reference,
  xTicks = [],
  onHoverIndex,
  confidence = 'ok',
  staleAfterIndex,
  outlierIndices,
  decimals = 1,
  readoutDecimals = 2
}) {
  const wrap = React.useRef(null);
  const [w, setW] = React.useState(900);
  const [hover, setHover] = React.useState(null);
  const hatchId = React.useMemo(() => 'ht-stale-' + Math.random().toString(36).slice(2, 8), []);
  // A zero measurement is "not measured yet", never a width: the host may be
  // display:contents, and a 0 here would silently pick the tight density.
  React.useEffect(() => {
    if (!wrap.current) return;
    const read = () => {
      const el = wrap.current;
      if (!el) return;
      const m = el.getBoundingClientRect().width || el.clientWidth;
      if (m > 0) setW(m);
    };
    read();
    const f = requestAnimationFrame(read);
    const t = setTimeout(read, 120);
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', read);
      return () => { cancelAnimationFrame(f); clearTimeout(t); window.removeEventListener('resize', read); };
    }
    const ro = new ResizeObserver(entries => {
      const m = entries[0].contentRect.width;
      if (m > 0) setW(m);else read();
    });
    ro.observe(wrap.current);
    return () => { cancelAnimationFrame(f); clearTimeout(t); ro.disconnect(); };
  }, []);
  const insufficient = confidence === 'insufficient';
  const wide = confidence === 'wide';
  const drawTrend = !insufficient && trend.length > 1;
  const drawBands = showBands && !insufficient;
  const drawProjection = showProjection && !insufficient;
  const outliers = outlierIndices || [];
  // Chart furniture scales with the chart's OWN measured width. No caller prop,
  // no new tokens, and one invariant: the y-axis never leaves the plot.
  //   0 full (>=640)  padL 52 / padR 92, 5 ticks at 1 decimal, boxed terminal flag
  //   1 compact (360-639) padL 40 / padR 16, 3 ticks at 0 decimals, flag inline on the axis
  //   2 tight (<360)      padL 34 / padR 12, 3 ticks at 0 decimals, no flag (the hero has it)
  // The break sits at 360 so a full-bleed 390 screen keeps the flag and a 320 loses it.
  const wv = w > 0 ? w : 900;
  const dense = wv < 360 ? 2 : wv < 640 ? 1 : 0;
  const tickDecimals = dense ? 0 : decimals;
  const tickGap = dense ? 8 : 12;
  const yTickCount = dense ? 3 : 5;
  const flagMode = dense === 2 ? 'none' : dense === 1 ? 'inline' : 'boxed';
  const padL = dense === 2 ? 34 : dense === 1 ? 40 : 52,
    padR = flagMode === 'boxed' ? 92 : dense === 2 ? 12 : 16,
    padT = 18,
    padB = dense ? 26 : 30;
  const innerW = Math.max(120, wv - padL - padR);
  const innerH = height - padT - padB;
  const n = Math.max(1, (drawProjection ? trend.length + projection.length : Math.max(trend.length, raw.length)) - 1);
  const ys = [];
  raw.forEach(p => ys.push(p.y));
  if (!insufficient) {
    trend.forEach(p => {
      ys.push(p.hi95 != null ? p.hi95 : p.y);
      ys.push(p.lo95 != null ? p.lo95 : p.y);
    });
    if (drawProjection) projection.forEach(p => {
      ys.push(p.hi != null ? p.hi : p.y);
      ys.push(p.lo != null ? p.lo : p.y);
    });
  }
  if (reference) ys.push(reference.y);
  const min = Math.min.apply(null, ys),
    max = Math.max.apply(null, ys);
  const padY = (max - min) * 0.12 || 1;
  const x = htScale([0, n], [padL, padL + innerW]);
  const y = htScale([min - padY, max + padY], [padT + innerH, padT]);
  const yTickVals = [];
  for (let k = 0; k < yTickCount; k++) yTickVals.push(min - padY + k / (yTickCount - 1) * (max - min + 2 * padY));
  // Thin the month ticks by the space they actually have, so no caller has to
  // guess a step: labels are dropped, never overlapped, never truncated.
  const xLabelPx = dense ? 40 : 52;
  const xGap = xTicks.length > 1 ? Math.abs(htScale([0, n], [padL, padL + innerW])(xTicks[1].i) - htScale([0, n], [padL, padL + innerW])(xTicks[0].i)) : Infinity;
  const xKeep = Math.max(1, Math.ceil(xLabelPx / (xGap || 1)));
  // Thinning can leave two ticks with the same label (two 21-day steps inside one
  // month). A repeated label is furniture, not data: drop it.
  let xPrev = null;
  const xT = xTicks.filter((t, i) => {
    if (i % xKeep !== 0) return false;
    if (dense && t.label === xPrev) return false;
    xPrev = t.label;
    return true;
  });
  const band = (pts, lo, hi) => htPath(pts.map(p => [x(p.i), y(p[hi])])) + ' ' + pts.slice().reverse().map(p => 'L' + x(p.i).toFixed(2) + ' ' + y(p[lo]).toFixed(2)).join(' ') + ' Z';
  const trendPts = trend.map((p, i) => Object.assign({}, p, {
    i
  }));
  const projPts = projection.map((p, i) => Object.assign({}, p, {
    i: trend.length - 1 + i
  }));
  const last = trend[trend.length - 1];
  const staleX = staleAfterIndex != null ? x(staleAfterIndex) : null;
  // The terminal flag is the one piece of furniture that can cost 78px of plot.
  // Boxed at full width; on the axis (leader + azure value, no box) at compact;
  // absent at tight, where the hero already states the same number.
  const flagText = last && drawTrend ? last.y.toFixed(decimals) + ' ' + unit : '';
  const flagEl = last && drawTrend && flagMode !== 'none' ? flagMode === 'boxed' ? /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("line", {
    x1: x(trend.length - 1),
    x2: padL + innerW + 8,
    y1: y(last.y),
    y2: y(last.y),
    stroke: "var(--data-trend)",
    strokeWidth: "1",
    opacity: "0.35"
  }), /*#__PURE__*/React.createElement("rect", {
    x: padL + innerW + 8,
    y: y(last.y) - 11,
    width: "70",
    height: "22",
    rx: "2",
    fill: wide ? 'var(--data-trend-provisional)' : 'var(--data-trend)'
  }), /*#__PURE__*/React.createElement("text", {
    x: padL + innerW + 43,
    y: y(last.y) + 4.5,
    textAnchor: "middle",
    style: {
      font: 'var(--weight-ui-strong) var(--size-qualifier)/1 var(--font-numeric)',
      letterSpacing: 'var(--tracking-qualifier)',
      fill: 'var(--text-inverse)',
      fontVariantNumeric: 'tabular-nums'
    }
  }, flagText)) : /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("line", {
    x1: x(trend.length - 1),
    x2: padL + innerW,
    y1: y(last.y),
    y2: y(last.y),
    stroke: "var(--data-trend)",
    strokeWidth: "1",
    opacity: "0.35"
  }), /*#__PURE__*/React.createElement("text", {
    x: padL + innerW,
    y: y(last.y) - 9,
    textAnchor: "end",
    style: {
      font: 'var(--weight-ui-strong) var(--size-qualifier)/1 var(--font-numeric)',
      letterSpacing: 'var(--tracking-qualifier)',
      fill: wide ? 'var(--data-trend-provisional)' : 'var(--data-trend)',
      fontVariantNumeric: 'tabular-nums'
    }
  }, flagText)) : null;
  const move = e => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - box.left;
    const idx = Math.round((px - padL) / innerW * n);
    const clamped = Math.max(0, Math.min(trend.length - 1, idx));
    setHover(clamped);
    if (onHoverIndex) onHoverIndex(clamped);
  };
  const hp = hover != null && !insufficient ? trend[hover] : null;
  return /*#__PURE__*/React.createElement("div", {
    ref: wrap,
    style: {
      width: '100%',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "100%",
    height: height,
    viewBox: '0 0 ' + wv + ' ' + height,
    onMouseMove: insufficient ? undefined : move,
    onMouseLeave: () => {
      setHover(null);
      if (onHoverIndex) onHoverIndex(null);
    },
    style: {
      display: 'block',
      overflow: 'visible',
      cursor: insufficient ? 'default' : 'crosshair'
    }
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("pattern", {
    id: hatchId,
    width: "6",
    height: "6",
    patternTransform: "rotate(45)",
    patternUnits: "userSpaceOnUse"
  }, /*#__PURE__*/React.createElement("rect", {
    width: "6",
    height: "6",
    fill: "var(--data-stale-hatch)"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "0",
    y1: "0",
    x2: "0",
    y2: "6",
    stroke: "var(--data-stale-rule)",
    strokeWidth: "0.6",
    opacity: "0.45"
  }))), yTickVals.map((v, i) => /*#__PURE__*/React.createElement("g", {
    key: 'g' + i
  }, /*#__PURE__*/React.createElement("line", {
    x1: padL,
    x2: padL + innerW,
    y1: y(v),
    y2: y(v),
    stroke: "var(--data-grid)",
    strokeWidth: "1"
  }), /*#__PURE__*/React.createElement("text", {
    x: padL - tickGap,
    y: y(v) + 3.5,
    textAnchor: "end",
    style: {
      font: '400 var(--size-axis) var(--font-notation)',
      fill: 'var(--data-axis-text)',
      fontVariantNumeric: 'tabular-nums'
    }
  }, v.toFixed(tickDecimals)))), staleX != null ? /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("rect", {
    x: staleX,
    y: padT,
    width: Math.max(0, padL + innerW - staleX),
    height: innerH,
    fill: 'url(#' + hatchId + ')'
  }), /*#__PURE__*/React.createElement("line", {
    x1: staleX,
    x2: staleX,
    y1: padT,
    y2: padT + innerH,
    stroke: "var(--data-stale-rule)",
    strokeWidth: "1"
  })) : null, drawBands && trendPts.length > 1 && trendPts[0].lo95 != null ? /*#__PURE__*/React.createElement("path", {
    d: band(trendPts, 'lo95', 'hi95'),
    fill: wide ? 'var(--data-band-95-wide)' : 'var(--data-band-95)'
  }) : null, drawBands && trendPts.length > 1 && trendPts[0].lo68 != null ? /*#__PURE__*/React.createElement("path", {
    d: band(trendPts, 'lo68', 'hi68'),
    fill: wide ? 'var(--data-band-68-wide)' : 'var(--data-band-68)'
  }) : null, drawProjection && projPts.length > 1 && projPts[0].lo != null ? /*#__PURE__*/React.createElement("path", {
    d: band(projPts, 'lo', 'hi'),
    fill: "var(--data-projection-band)"
  }) : null, showRaw ? raw.map((p, i) => {
    const ix = p.i != null ? p.i : i;
    const isOut = p.outlier || outliers.indexOf(ix) !== -1;
    return isOut ?
    /*#__PURE__*/
    // Kept, visible, not dramatised: a hollow ink ring at the reading.
    React.createElement("circle", {
      key: 'r' + i,
      cx: x(ix),
      cy: y(p.y),
      r: "3.6",
      fill: "var(--data-outlier-fill)",
      stroke: "var(--data-outlier)",
      strokeWidth: "var(--stroke-outlier)"
    }) : /*#__PURE__*/React.createElement("circle", {
      key: 'r' + i,
      cx: x(ix),
      cy: y(p.y),
      r: "1.7",
      fill: "var(--data-raw-fill)"
    });
  }) : null, reference ? /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("line", {
    x1: padL,
    x2: padL + innerW,
    y1: y(reference.y),
    y2: y(reference.y),
    stroke: "var(--data-reference)",
    strokeWidth: "1",
    strokeDasharray: "3 3"
  }), /*#__PURE__*/React.createElement("text", {
    x: dense ? padL + 2 : padL + innerW,
    y: y(reference.y) - 7,
    textAnchor: dense ? 'start' : 'end',
    style: {
      font: '400 var(--size-axis) var(--font-notation)',
      fill: 'var(--data-axis-text)'
    }
  }, reference.label)) : null, drawProjection && projPts.length > 1 ? /*#__PURE__*/React.createElement("path", {
    d: htPath(projPts.map(p => [x(p.i), y(p.y)])),
    fill: "none",
    stroke: "var(--data-projection)",
    strokeWidth: "var(--stroke-projection)",
    strokeDasharray: "4 4",
    opacity: "0.85"
  }) : null, drawTrend ? /*#__PURE__*/React.createElement("path", {
    d: htPath(trendPts.map(p => [x(p.i), y(p.y)])),
    fill: "none",
    stroke: wide ? 'var(--data-trend-provisional)' : 'var(--data-trend)',
    strokeWidth: wide ? 'var(--stroke-trend-provisional)' : 'var(--stroke-trend)',
    strokeLinecap: "round"
  }) : null, /*#__PURE__*/React.createElement("line", {
    x1: padL,
    x2: padL + innerW,
    y1: padT + innerH,
    y2: padT + innerH,
    stroke: "var(--data-grid-zero)",
    strokeWidth: "1"
  }), xT.map((t, i) => /*#__PURE__*/React.createElement("text", {
    key: 'x' + i,
    x: x(t.i),
    y: height - 8,
    textAnchor: "middle",
    style: {
      font: '400 var(--size-axis) var(--font-notation)',
      fill: 'var(--data-axis-text)'
    }
  }, t.label)), flagEl, hp ? /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("line", {
    x1: x(hover),
    x2: x(hover),
    y1: padT,
    y2: padT + innerH,
    stroke: "var(--data-crosshair)",
    strokeWidth: "1",
    strokeDasharray: "2 3"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: x(hover),
    cy: y(hp.y),
    r: "3.5",
    fill: "var(--surface-page)",
    stroke: "var(--data-trend)",
    strokeWidth: "2"
  })) : null), hp ? /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 0,
      left: Math.min(Math.max(x(hover) - 70, 0), Math.max(0, wv - 156)),
      pointerEvents: 'none',
      background: 'var(--surface-page)',
      border: '1px solid var(--border-divider)',
      borderRadius: 'var(--radius-2)',
      boxShadow: 'var(--shadow-tooltip)',
      padding: '8px 10px',
      minWidth: 140
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "ht-qualifier",
    style: {
      color: 'var(--text-qualifier)'
    }
  }, hp.label || ''), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 5,
      marginTop: 3
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ht-metric-readout"
  }, hp.y.toFixed(readoutDecimals)), /*#__PURE__*/React.createElement("span", {
    className: "ht-qualifier"
  }, unit, " trend")), hp.lo68 != null ? /*#__PURE__*/React.createElement("div", {
    className: "ht-qualifier",
    style: {
      marginTop: 2
    }
  }, "68% ", hp.lo68.toFixed(readoutDecimals), "\u2013", hp.hi68.toFixed(readoutDecimals)) : null, hp.rawY != null ? /*#__PURE__*/React.createElement("div", {
    className: "ht-qualifier",
    style: {
      marginTop: 4,
      color: 'var(--data-raw-hover)'
    }
  }, "measured ", hp.rawY.toFixed(decimals)) : null) : null);
}
Object.assign(__ds_scope, { TrajectoryChart });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/TrajectoryChart.jsx", error: String((e && e.message) || e) }); }

// components/metrics/HeroMetric.jsx
try { (() => {
// TIER 1 — the estimated trajectory. One per view, and nothing else may use this size.
//
// Confidence is a first-class prop, not a caller's styling decision:
//   ok            ink-1, full precision
//   wide          ink-2 (one step back) — the estimate is real but weak; the
//                 caller must also reduce precision via HTFormat.trendWeight
//   insufficient  no hero number at all; a tier-2 statement takes the slot
//   stale         ink-1, but the qualifier row carries the staleness in amber
//
// `digits` reserves character slots so switching kg -> lb (76.2 -> 168.0) does
// not shift the composition. Unit is part of that composition — it sits on the
// hero baseline at tier-2 size, never as a superscript or a small-caps suffix.
const HT_HERO_INK = {
  ok: 'var(--ink-1)',
  stale: 'var(--ink-1)',
  wide: 'var(--ink-2)',
  insufficient: 'var(--ink-3)'
};
function HeroMetric({
  label,
  value,
  unit,
  interval,
  asOf,
  align = 'left',
  confidence = 'ok',
  digits,
  insufficientNote = 'Not enough readings to estimate a trajectory',
  stale,
  rate
}) {
  const alignItems = align === 'left' ? 'flex-start' : 'center';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-4)',
      alignItems
    }
  }, label ? /*#__PURE__*/React.createElement("span", {
    className: "ht-eyebrow"
  }, label) : null, confidence === 'insufficient' ? /*#__PURE__*/React.createElement("span", {
    className: "ht-metric-support",
    style: {
      color: 'var(--text-secondary)',
      letterSpacing: '-0.01em',
      maxWidth: 'var(--measure-prose)'
    }
  }, insufficientNote) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ht-metric-hero",
    style: {
      color: HT_HERO_INK[confidence] || HT_HERO_INK.ok,
      minWidth: digits ? digits + 'ch' : undefined,
      display: digits ? 'inline-block' : undefined,
      textAlign: digits ? align === 'center' ? 'center' : 'right' : undefined
    }
  }, value), unit ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-numeric)',
      fontSize: 'var(--size-metric-support)',
      fontWeight: 'var(--weight-ui)',
      color: 'var(--text-secondary)',
      letterSpacing: '-0.01em'
    }
  }, unit) : null), rate ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline'
    }
  }, rate) : null, interval || asOf || stale ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--space-5)',
      alignItems: 'baseline',
      flexWrap: 'wrap'
    }
  }, interval ? /*#__PURE__*/React.createElement("span", {
    className: "ht-qualifier"
  }, interval) : null, interval && asOf ? /*#__PURE__*/React.createElement("span", {
    className: "ht-qualifier",
    style: {
      color: 'var(--ink-5)'
    }
  }, "/") : null, asOf ? /*#__PURE__*/React.createElement("span", {
    className: "ht-qualifier"
  }, asOf) : null, stale ? /*#__PURE__*/React.createElement("span", {
    className: "ht-qualifier",
    style: {
      color: 'var(--data-stale)'
    }
  }, stale) : null) : null);
}
Object.assign(__ds_scope, { HeroMetric });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/metrics/HeroMetric.jsx", error: String((e && e.message) || e) }); }

// components/metrics/Qualifier.jsx
try { (() => {
const htQualifierColor = {
  default: 'var(--text-qualifier)',
  stale: 'var(--data-stale)',
  accent: 'var(--azure-700)'
};
function Qualifier({
  children,
  icon,
  tone = 'default',
  style
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 'var(--space-3)',
      fontFamily: 'var(--font-numeric)',
      fontSize: 'var(--size-qualifier)',
      lineHeight: 'var(--lh-qualifier)',
      letterSpacing: 'var(--tracking-qualifier)',
      fontVariantNumeric: 'tabular-nums',
      color: htQualifierColor[tone],
      maxWidth: 'var(--measure-qualifier)',
      ...style
    }
  }, icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 12.5
  }) : null, children);
}
Object.assign(__ds_scope, { Qualifier });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/metrics/Qualifier.jsx", error: String((e && e.message) || e) }); }

// components/metrics/RawReading.jsx
try { (() => {
// TIER 3 — a measured value. Small, neutral, never competing with the estimate.
function RawReading({
  date,
  value,
  unit,
  delta,
  muted
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 'var(--space-5)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ht-qualifier",
    style: {
      minWidth: 74,
      color: 'var(--text-qualifier)'
    }
  }, date), /*#__PURE__*/React.createElement("span", {
    className: "ht-metric-raw",
    style: {
      color: muted ? 'var(--text-qualifier)' : 'var(--text-body)'
    }
  }, value, unit ? /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-qualifier)'
    }
  }, " ", unit) : null), delta ? /*#__PURE__*/React.createElement("span", {
    className: "ht-qualifier",
    style: {
      color: 'var(--data-raw)'
    }
  }, delta) : null);
}
Object.assign(__ds_scope, { RawReading });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/metrics/RawReading.jsx", error: String((e && e.message) || e) }); }

// components/metrics/SupportingMetric.jsx
try { (() => {
// TIER 2 — statistical context beside the trajectory: rate, projection, n, fit.
function SupportingMetric({
  label,
  value,
  unit,
  qualifier,
  emphasis = 'normal'
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-2)',
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ht-eyebrow"
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 'var(--space-2)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ht-metric-support",
    style: {
      color: emphasis === 'accent' ? 'var(--text-accent)' : 'var(--text-display)'
    }
  }, value), unit ? /*#__PURE__*/React.createElement("span", {
    className: "ht-qualifier",
    style: {
      fontSize: 'var(--size-ui-sm)',
      color: 'var(--text-secondary)'
    }
  }, unit) : null), qualifier ? /*#__PURE__*/React.createElement("span", {
    className: "ht-qualifier"
  }, qualifier) : null);
}
Object.assign(__ds_scope, { SupportingMetric });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/metrics/SupportingMetric.jsx", error: String((e && e.message) || e) }); }

// components/metrics/TrendDelta.jsx
try { (() => {
// Direction is shown by a glyph, never by red/green.
function TrendDelta({
  value,
  unit = 'kg/week',
  direction = 'down',
  interval,
  size = 'md'
}) {
  const glyph = direction === 'flat' ? 'move-horizontal' : direction === 'up' ? 'arrow-up-right' : 'arrow-down-right';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-2)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: glyph,
    size: size === 'sm' ? 15 : 20,
    color: "var(--text-secondary)"
  }), /*#__PURE__*/React.createElement("span", {
    className: size === 'sm' ? 'ht-ui' : 'ht-metric-support',
    style: {
      fontWeight: size === 'sm' ? 'var(--weight-ui-strong)' : undefined
    }
  }, value), /*#__PURE__*/React.createElement("span", {
    className: "ht-qualifier",
    style: {
      fontSize: 'var(--size-ui-sm)',
      color: 'var(--text-secondary)'
    }
  }, unit)), interval ? /*#__PURE__*/React.createElement("span", {
    className: "ht-qualifier"
  }, interval) : null);
}
Object.assign(__ds_scope, { TrendDelta });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/metrics/TrendDelta.jsx", error: String((e && e.message) || e) }); }

// components/motion/Reveal.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// Headless scroll-linked reveal. Renders ONE element and nothing else — no
// wrapper chrome, no layout opinion. Reads its easing, duration, offset,
// stagger and threshold from the motion tokens, so a sequence is composed from
// the system rather than hand-tuned per surface.
//
// Three guarantees, from the brief:
//   1. It never gates information — content is in the DOM and the a11y tree
//      from first paint, and it self-reveals if IntersectionObserver is absent.
//   2. It fires once. Scrolling back up does not replay it.
//   3. It never drives scroll. No pinning, no scrubbing, no scroll-jacking.
// Under prefers-reduced-motion it reveals immediately with no transition.
function htTokenNumber(el, name, fallback) {
  if (typeof getComputedStyle === 'undefined' || !el) return fallback;
  const v = parseFloat(getComputedStyle(el).getPropertyValue(name));
  return isNaN(v) ? fallback : v;
}
function Reveal({
  children,
  as = 'div',
  index = 0,
  scale = 'md',
  stagger = 'stagger-1',
  delay = 0,
  threshold,
  once = true,
  style,
  className,
  ...rest
}) {
  const ref = React.useRef(null);
  const [shown, setShown] = React.useState(false);
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
    if (mq && mq.matches) {
      setReduced(true);
      setShown(true);
      return;
    }
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const th = threshold != null ? threshold : htTokenNumber(el, '--reveal-threshold', 0.28);
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          setShown(true);
          if (once) io.disconnect();
        } else if (!once) setShown(false);
      });
    }, {
      threshold: Math.min(0.99, Math.max(0, th)),
      rootMargin: '0px 0px -12% 0px'
    });
    io.observe(el);
    return () => io.disconnect();
  }, [once, threshold]);

  // Stagger flattens past --stagger-cap so a long list never makes the reader wait.
  const cap = htTokenNumber(ref.current, '--stagger-cap', 6);
  const step = htTokenNumber(ref.current, '--' + stagger, stagger === 'stagger-2' ? 70 : 40);
  const total = delay + Math.min(index, cap) * step;
  const Tag = as;
  return /*#__PURE__*/React.createElement(Tag, _extends({
    ref: ref,
    "data-scale": scale === 'lg' ? 'lg' : undefined,
    "data-revealed": shown ? '' : undefined,
    className: className ? 'ht-reveal ' + className : 'ht-reveal',
    style: reduced ? {
      ...style
    } : {
      transitionDelay: total + 'ms',
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Reveal });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/motion/Reveal.jsx", error: String((e && e.message) || e) }); }

// components/prose/Citation.jsx
try { (() => {
function Citation({
  children,
  marker,
  href = '#'
}) {
  const [hover, setHover] = React.useState(false);
  if (marker && !children) {
    return /*#__PURE__*/React.createElement("sup", null, /*#__PURE__*/React.createElement("a", {
      href: href,
      style: {
        border: 0,
        color: 'var(--text-accent)',
        fontFamily: 'var(--font-numeric)',
        fontSize: '0.72em',
        padding: '0 1px'
      }
    }, "[", marker, "]"));
  }
  return /*#__PURE__*/React.createElement("div", {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'grid',
      gridTemplateColumns: '28px 1fr',
      gap: 'var(--space-5)',
      padding: 'var(--space-5) 0',
      borderBottom: 'var(--line-hair)',
      background: hover ? 'var(--surface-hover)' : 'transparent',
      transition: 'var(--transition-control)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ht-qualifier",
    style: {
      fontFamily: 'var(--font-notation)'
    }
  }, "[", marker, "]"), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--weight-prose) var(--size-body-sm)/1.5 var(--font-prose)',
      color: 'var(--text-secondary)'
    }
  }, children));
}
Object.assign(__ds_scope, { Citation });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/prose/Citation.jsx", error: String((e && e.message) || e) }); }

// components/prose/Equation.jsx
try { (() => {
function Equation({
  children,
  number,
  display = true
}) {
  if (!display) {
    return /*#__PURE__*/React.createElement("span", {
      className: "ht-notation",
      style: {
        fontSize: '0.94em',
        color: 'var(--text-display)'
      }
    }, children);
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: 'var(--space-8)',
      padding: 'var(--space-7) 0',
      maxWidth: 'var(--measure-prose)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ht-notation",
    style: {
      color: 'var(--text-display)',
      fontSize: '16px'
    }
  }, children), number ? /*#__PURE__*/React.createElement("span", {
    className: "ht-qualifier",
    style: {
      fontFamily: 'var(--font-notation)'
    }
  }, "(", number, ")") : null);
}
Object.assign(__ds_scope, { Equation });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/prose/Equation.jsx", error: String((e && e.message) || e) }); }

// components/prose/FigureCaption.jsx
try { (() => {
function FigureCaption({
  label,
  children,
  source
}) {
  return /*#__PURE__*/React.createElement("figcaption", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-3)',
      maxWidth: 'var(--measure-narrow)',
      marginTop: 'var(--space-6)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-numeric)',
      fontSize: 'var(--size-qualifier)',
      fontWeight: 'var(--weight-ui-strong)',
      letterSpacing: 'var(--tracking-eyebrow)',
      textTransform: 'uppercase',
      color: 'var(--text-qualifier)'
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--weight-prose) var(--size-body-sm)/1.5 var(--font-prose)',
      color: 'var(--text-secondary)',
      textWrap: 'pretty'
    }
  }, children), source ? /*#__PURE__*/React.createElement("span", {
    className: "ht-qualifier",
    style: {
      fontSize: 'var(--size-qualifier-sm)'
    }
  }, source) : null);
}
Object.assign(__ds_scope, { FigureCaption });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/prose/FigureCaption.jsx", error: String((e && e.message) || e) }); }

// components/prose/MarginNote.jsx
try { (() => {
// Geometry lives in .ht-margin-note (tokens/layout.css) so it can collapse out of
// the gutter below 1180px, where --col-margin is 0.
function MarginNote({
  children,
  marker,
  side = 'right'
}) {
  return /*#__PURE__*/React.createElement("aside", {
    className: "ht-margin-note",
    "data-side": side
  }, marker ? /*#__PURE__*/React.createElement("span", {
    className: "ht-qualifier",
    style: {
      color: 'var(--text-accent)'
    }
  }, marker) : null, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--weight-prose) 14.5px/1.5 var(--font-prose)',
      color: 'var(--text-qualifier)',
      textWrap: 'pretty'
    }
  }, children));
}
Object.assign(__ds_scope, { MarginNote });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/prose/MarginNote.jsx", error: String((e && e.message) || e) }); }

// components/prose/Prose.jsx
try { (() => {
// Pins body copy to the prose measure so a paragraph never leaves orphaned space.
function Prose({
  children,
  size = 'body',
  width = 'prose',
  align = 'start',
  style
}) {
  const cls = size === 'lede' ? 'ht-lede' : size === 'sm' ? 'ht-body-sm' : 'ht-body';
  const max = width === 'narrow' ? 'var(--measure-narrow)' : width === 'wide' ? 'var(--measure-wide)' : 'var(--measure-prose)';
  return /*#__PURE__*/React.createElement("div", {
    className: cls,
    style: {
      maxWidth: max,
      marginInline: align === 'center' ? 'auto' : undefined,
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Prose });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/prose/Prose.jsx", error: String((e && e.message) || e) }); }

// components/prose/SectionHeading.jsx
try { (() => {
function SectionHeading({
  eyebrow,
  children,
  level = 2,
  note,
  rule = false
}) {
  const cls = level === 1 ? 'ht-display' : level === 2 ? 'ht-title' : 'ht-subtitle';
  return /*#__PURE__*/React.createElement("header", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-5)',
      maxWidth: 'var(--measure-wide)',
      paddingTop: rule ? 'var(--space-7)' : 0,
      borderTop: rule ? 'var(--line-divider)' : 'none'
    }
  }, eyebrow ? /*#__PURE__*/React.createElement("span", {
    className: "ht-eyebrow"
  }, eyebrow) : null, /*#__PURE__*/React.createElement("h2", {
    className: cls,
    style: {
      font: 'inherit'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: cls
  }, children)), note ? /*#__PURE__*/React.createElement("span", {
    className: "ht-qualifier"
  }, note) : null);
}
Object.assign(__ds_scope, { SectionHeading });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/prose/SectionHeading.jsx", error: String((e && e.message) || e) }); }

// components/states/ConfidenceNote.jsx
try { (() => {
// The qualifier-tier sentence that states what confidence is doing to the
// estimate. Sits BESIDE the number it qualifies — never in a footnote, never in
// a modal, never behind an info icon. Carries the canonical copy per level so
// the same state reads the same everywhere in the product.
const HT_LEVELS = {
  ok: {
    icon: null,
    tone: 'var(--text-qualifier)',
    copy: null
  },
  wide: {
    icon: 'circle-slash',
    tone: 'var(--text-secondary)',
    copy: 'The interval is wide enough that the direction is not yet established.'
  },
  stale: {
    icon: 'clock',
    tone: 'var(--data-stale)',
    copy: 'Gaps widen the band; they do not move the line.'
  },
  insufficient: {
    icon: 'minus',
    tone: 'var(--text-secondary)',
    copy: 'Below three readings a week, the estimate is mostly prior.'
  }
};
function ConfidenceNote({
  level = 'ok',
  children,
  icon,
  showIcon = true,
  style
}) {
  const spec = HT_LEVELS[level] || HT_LEVELS.ok;
  const text = children != null ? children : spec.copy;
  if (!text) return null;
  const glyph = icon !== undefined ? icon : spec.icon;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'flex-start',
      gap: 'var(--space-3)',
      fontFamily: 'var(--font-numeric)',
      fontSize: 'var(--size-qualifier)',
      lineHeight: 'var(--lh-qualifier)',
      letterSpacing: 'var(--tracking-qualifier)',
      fontVariantNumeric: 'tabular-nums',
      color: spec.tone,
      maxWidth: 'var(--measure-qualifier)',
      ...style
    }
  }, showIcon && glyph ? /*#__PURE__*/React.createElement("span", {
    style: {
      paddingTop: 1,
      flex: '0 0 auto'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: glyph,
    size: 12.5
  })) : null, /*#__PURE__*/React.createElement("span", null, text));
}
Object.assign(__ds_scope, { ConfidenceNote });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/states/ConfidenceNote.jsx", error: String((e && e.message) || e) }); }

// components/states/InsufficientData.jsx
try { (() => {
// The new-user state. Not an error, not an empty dashboard: a statement of what
// the model needs before it will make a claim. Occupies the hero region so the
// composition does not collapse, but at TIER 2 — there is no number to be huge.
function InsufficientData({
  label = 'ESTIMATED TREND WEIGHT',
  statement = 'Not enough readings to estimate a trajectory',
  detail,
  readings,
  needed,
  latest,
  align = 'left'
}) {
  const marks = readings != null && needed != null ? Array.from({
    length: needed
  }, (_, i) => i < readings) : null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-6)',
      alignItems: align === 'left' ? 'flex-start' : 'center',
      maxWidth: 'var(--measure-prose)'
    }
  }, label ? /*#__PURE__*/React.createElement("span", {
    className: "ht-eyebrow"
  }, label) : null, /*#__PURE__*/React.createElement("span", {
    className: "ht-metric-support",
    style: {
      color: 'var(--text-secondary)',
      letterSpacing: '-0.01em'
    }
  }, statement), marks ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 'var(--space-2)',
      height: 14
    }
  }, marks.map((on, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      width: 3,
      height: on ? 14 : 7,
      background: on ? 'var(--data-raw)' : 'var(--data-insufficient-frame)'
    }
  }))) : null, readings != null && needed != null ? /*#__PURE__*/React.createElement("span", {
    className: "ht-qualifier"
  }, readings, " of ", needed, " readings", detail ? ' \u00b7 ' + detail : '') : detail ? /*#__PURE__*/React.createElement("span", {
    className: "ht-qualifier"
  }, detail) : null, latest ? /*#__PURE__*/React.createElement("span", {
    className: "ht-qualifier",
    style: {
      color: 'var(--ink-5)'
    }
  }, latest) : null);
}
Object.assign(__ds_scope, { InsufficientData });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/states/InsufficientData.jsx", error: String((e && e.message) || e) }); }

// components/states/OutlierFlag.jsx
try { (() => {
// A reading the filter down-weighted. Hollow ring, ink-coloured: it is a
// measurement that was KEPT, not an error that was caught. Never red, never an
// exclamation, never removed from the series.
function OutlierFlag({
  residual,
  size = 9,
  children,
  showRing = true,
  style
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 'var(--space-3)',
      fontFamily: 'var(--font-numeric)',
      fontSize: 'var(--size-qualifier)',
      lineHeight: 'var(--lh-qualifier)',
      letterSpacing: 'var(--tracking-qualifier)',
      fontVariantNumeric: 'tabular-nums',
      color: 'var(--text-secondary)',
      ...style
    }
  }, showRing ? /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    style: {
      flex: '0 0 auto',
      display: 'block'
    },
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: size / 2,
    cy: size / 2,
    r: (size - 2.5) / 2,
    fill: "var(--data-outlier-fill)",
    stroke: "var(--data-outlier)",
    strokeWidth: "var(--stroke-outlier)"
  })) : null, children != null ? children : residual != null ? 'residual ' + residual : null);
}
Object.assign(__ds_scope, { OutlierFlag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/states/OutlierFlag.jsx", error: String((e && e.message) || e) }); }

// components/data/MeasurementTable.jsx
try { (() => {
function MeasurementTable({
  rows,
  unit = 'kg',
  columns = ['date', 'reading', 'trend', 'residual'],
  dense
}) {
  const [hover, setHover] = React.useState(-1);
  const head = {
    date: 'Date',
    reading: 'Reading',
    trend: 'Trend',
    residual: 'vs trend'
  };
  const pad = dense ? '6px 0' : '9px 0';
  return /*#__PURE__*/React.createElement("table", {
    style: {
      fontFamily: 'var(--font-numeric)',
      fontVariantNumeric: 'tabular-nums'
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, columns.map((c, i) => /*#__PURE__*/React.createElement("th", {
    key: c,
    style: {
      textAlign: i === 0 ? 'left' : 'right',
      padding: pad,
      borderBottom: 'var(--line-divider)',
      whiteSpace: 'nowrap',
      font: 'var(--weight-ui-strong) var(--size-eyebrow)/1 var(--font-numeric)',
      letterSpacing: 'var(--tracking-eyebrow)',
      textTransform: 'uppercase',
      color: 'var(--text-qualifier)'
    }
  }, head[c], c === 'reading' || c === 'trend' ? ' (' + unit + ')' : '')))), /*#__PURE__*/React.createElement("tbody", null, rows.map((r, i) => /*#__PURE__*/React.createElement("tr", {
    key: i,
    onMouseEnter: () => setHover(i),
    onMouseLeave: () => setHover(-1),
    style: {
      background: hover === i ? 'var(--surface-hover)' : 'transparent',
      transition: 'var(--transition-control)'
    }
  }, columns.map((c, ci) => /*#__PURE__*/React.createElement("td", {
    key: c,
    style: {
      textAlign: ci === 0 ? 'left' : 'right',
      padding: pad,
      borderBottom: 'var(--line-hair)',
      whiteSpace: 'nowrap',
      fontSize: c === 'date' ? 'var(--size-qualifier)' : 'var(--size-metric-raw)',
      color: c === 'date' ? 'var(--text-qualifier)' : c === 'trend' ? 'var(--text-display)' : c === 'residual' ? 'var(--data-raw)' : 'var(--text-body)',
      fontWeight: c === 'trend' ? 'var(--weight-ui-strong)' : 'var(--weight-ui)'
    }
  }, c === 'reading' && r.outlier ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 'var(--space-3)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.OutlierFlag, {
    size: 8,
    showRing: true
  }, r[c] != null ? r[c] : '\u2014')) : r[c] != null ? r[c] : '\u2014'))))));
}
Object.assign(__ds_scope, { MeasurementTable });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/MeasurementTable.jsx", error: String((e && e.message) || e) }); }

// lib/format.js
try { (() => {
/* HealthTrend — precision, units, locale. THE single source for how a model
   quantity becomes a string. Load it before the bundle; it publishes
   window.HTFormat. Components stay presentational and take pre-formatted
   strings (see HeroMetric.d.ts) — formatting happens once, here, at the
   boundary, so the rules cannot drift between a chart, a table and a hero.

   Two rules the whole file exists to enforce:
     1. Precision is a claim. Never print a digit the model cannot support.
     2. The minus sign is U+2212, never a hyphen. */
(function () {
  var MINUS = '\u2212'; /* − */
  var EN_DASH = '\u2013'; /* – for ranges */
  var MIDDOT = '\u00b7'; /* · separator */
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
      label: 'kg',
      rate: 'kg/week',
      rateFortnight: 'kg/fortnight',
      decimals: 1,
      decimalsWide: 0,
      rateDecimals: 2,
      rateDecimalsWide: 1,
      intervalDecimals: 2,
      intervalDecimalsWide: 1,
      rawDecimals: 1,
      digitSlots: 5
    },
    lb: {
      label: 'lb',
      rate: 'lb/week',
      rateFortnight: 'lb/fortnight',
      decimals: 1,
      decimalsWide: 0,
      rateDecimals: 2,
      rateDecimalsWide: 1,
      intervalDecimals: 2,
      intervalDecimalsWide: 1,
      rawDecimals: 1,
      digitSlots: 5
    }
  };
  var locale = {
    unit: 'kg',
    /* display unit — the model always works in kg */
    clock: '24h',
    /* '24h' | '12h' */
    dateOrder: 'DMY',
    /* 'DMY' | 'MDY' */
    decimal: '.' /* ',' for de/fr; applied last, to the finished string */
  };
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function setLocale(next) {
    for (var k in next) if (next.hasOwnProperty(k)) locale[k] = next[k];
    return locale;
  }
  function getLocale() {
    return locale;
  }
  function unitDef(u) {
    return UNITS[u || locale.unit] || UNITS.kg;
  }

  /* kg is the model's unit. Everything displayed converts from it. */
  function toUnit(kg, u) {
    return (u || locale.unit) === 'lb' ? kg / KG_PER_LB : kg;
  }
  function fromUnit(v, u) {
    return (u || locale.unit) === 'lb' ? v * KG_PER_LB : v;
  }

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
  var THRESHOLDS = {
    minReadings: 10,
    minPerWeek: 3,
    staleDays: 5,
    wideHalfWidth68Kg: 0.5
  };

  /* The one threshold, expressed in a display unit — for copy and specimens. */
  function wideThreshold(u) {
    return toUnit(THRESHOLDS.wideHalfWidth68Kg, u);
  }
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
    var u = opts.unit || locale.unit,
      d = unitDef(u);
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
    var u = opts.unit || locale.unit,
      d = unitDef(u);
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
    var u = opts.unit || locale.unit,
      d = unitDef(u);
    var dec = opts.decimals != null ? opts.decimals : opts.confidence === 'wide' ? d.intervalDecimalsWide : d.intervalDecimals;
    return '\u00b1' + num(toUnit(halfWidthKg, u), dec) + ' ' + d.label + (opts.level ? ' (' + opts.level + '%)' : '');
  }
  function interval(loKg, hiKg, opts) {
    opts = opts || {};
    var u = opts.unit || locale.unit,
      d = unitDef(u);
    var dec = opts.decimals != null ? opts.decimals : opts.confidence === 'wide' ? d.decimalsWide : d.decimals;
    var head = opts.level ? opts.level + '% CI ' : '';
    return head + num(toUnit(loKg, u), dec) + ' to ' + num(toUnit(hiKg, u), dec) + (opts.unitLabel === false ? '' : ' ' + d.label);
  }
  function rateInterval(loKgWk, hiKgWk, opts) {
    opts = opts || {};
    var u = opts.unit || locale.unit,
      d = unitDef(u);
    var per = opts.per || 'week',
      mult = per === 'fortnight' ? 2 : 1;
    var dec = opts.confidence === 'wide' ? d.rateDecimalsWide : d.rateDecimals;
    var head = opts.level ? opts.level + '% CI ' : '';
    return head + num(toUnit(loKgWk, u) * mult, dec) + ' to ' + num(toUnit(hiKgWk, u) * mult, dec) + ' ' + (per === 'fortnight' ? d.rateFortnight : d.rate);
  }

  /* A range of values (not an interval): "76.2–78.9 kg". */
  function range(loKg, hiKg, opts) {
    opts = opts || {};
    var u = opts.unit || locale.unit,
      d = unitDef(u);
    var dec = opts.confidence === 'wide' ? d.decimalsWide : d.decimals;
    return num(toUnit(loKg, u), dec) + EN_DASH + num(toUnit(hiKg, u), dec) + ' ' + d.label;
  }

  /* ── Sample and model quantities ─────────────────────────────────────────
     Notation stays in mathematical form: n = 103, σ = 0.71 kg, R² = 0.91. */
  function n(count) {
    return 'n = ' + count;
  }
  function sigma(kg, opts) {
    var u = opts && opts.unit || locale.unit;
    return '\u03c3 = ' + num(toUnit(kg, u), 2) + ' ' + unitDef(u).label;
  }
  function rSquared(v) {
    return 'R\u00b2 = ' + num(v, 2);
  }
  function pValue(p) {
    if (p == null) return EN_DASH;
    if (p < 0.001) return 'p < 0.001';
    return 'p = ' + num(p, 3);
  }
  function percent(frac, decimals) {
    return num(frac * 100, decimals == null ? 1 : decimals) + '%';
  }

  /* ── Dates and times ─────────────────────────────────────────────────────
     Short by default: the ledger is scanned, not read. Time is shown only
     where it matters (a weigh-in is a time of day; a projection is not). */
  function two(v) {
    return (v < 10 ? '0' : '') + v;
  }
  function time(date) {
    var h = date.getHours(),
      m = two(date.getMinutes());
    if (locale.clock === '12h') {
      var ampm = h < 12 ? 'am' : 'pm',
        h12 = h % 12 || 12;
      return h12 + ':' + m + ' ' + ampm;
    }
    return two(h) + ':' + m;
  }
  function dateShort(date) {
    var d = date.getDate(),
      mo = MONTHS[date.getMonth()];
    return locale.dateOrder === 'MDY' ? mo + ' ' + d : d + ' ' + mo;
  }
  function dateLong(date) {
    return dateShort(date) + ' ' + date.getFullYear();
  }
  function monthTick(date) {
    return MONTHS[date.getMonth()];
  }
  function daysBetween(a, b) {
    return Math.round((b - a) / 86400000);
  }

  /* "as of today, 06:40" / "as of 4 days ago, 07:10" — relative up to a week,
     absolute beyond it, because "as of 23 days ago" is arithmetic homework. */
  function asOf(date, now) {
    now = now || new Date();
    var days = daysBetween(new Date(date.getFullYear(), date.getMonth(), date.getDate()), new Date(now.getFullYear(), now.getMonth(), now.getDate()));
    var when = days === 0 ? 'today' : days === 1 ? 'yesterday' : days < 7 ? days + ' days ago' : dateShort(date);
    return 'as of ' + when + ', ' + time(date);
  }
  function staleness(daysSince) {
    if (daysSince < THRESHOLDS.staleDays) return null;
    return 'No reading for ' + daysSince + ' days \u2014 interval widening';
  }

  /* ── Hero composition helper ──────────────────────────────────────────────
     Character slots to reserve at hero scale for a given unit, so kg → lb does
     not shift the page. Pass the result to HeroMetric `digits`. */
  function digitSlots(u) {
    return unitDef(u).digitSlots;
  }
  window.HTFormat = {
    MINUS: MINUS,
    EN_DASH: EN_DASH,
    MIDDOT: MIDDOT,
    KG_PER_LB: KG_PER_LB,
    UNITS: UNITS,
    THRESHOLDS: THRESHOLDS,
    setLocale: setLocale,
    getLocale: getLocale,
    toUnit: toUnit,
    fromUnit: fromUnit,
    num: num,
    signed: signed,
    confidence: confidence,
    wideThreshold: wideThreshold,
    trendWeight: trendWeight,
    reading: reading,
    rate: rate,
    plusMinus: plusMinus,
    interval: interval,
    rateInterval: rateInterval,
    range: range,
    n: n,
    sigma: sigma,
    rSquared: rSquared,
    pValue: pValue,
    percent: percent,
    time: time,
    dateShort: dateShort,
    dateLong: dateLong,
    monthTick: monthTick,
    asOf: asOf,
    staleness: staleness,
    daysBetween: daysBetween,
    digitSlots: digitSlots
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "lib/format.js", error: String((e && e.message) || e) }); }

// ui_kits/app/AppShell.jsx
try { (() => {
const {
  Icon,
  Button,
  Badge,
  Sparkline
} = window.HealthTrendDesignSystem_5b333a;
function NavItem({
  icon,
  label,
  active,
  onClick
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      width: '100%',
      padding: '7px 10px',
      border: 0,
      borderRadius: 'var(--radius-1)',
      cursor: 'pointer',
      background: active ? 'var(--surface-hover)' : hover ? 'var(--surface-hover)' : 'transparent',
      color: active ? 'var(--text-display)' : 'var(--text-secondary)',
      font: (active ? '600' : '450') + ' var(--size-ui)/1.2 var(--font-numeric)',
      transition: 'var(--transition-control)',
      textAlign: 'left'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 16
  }), label);
}
function AppShell({
  view,
  setView,
  onLog,
  children
}) {
  const f = window.HT_FIXTURES;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'var(--shell-nav-w) 1fr',
      minHeight: '100vh',
      background: 'var(--surface-page)'
    }
  }, /*#__PURE__*/React.createElement("nav", {
    style: {
      borderRight: '1px solid var(--rule-1)',
      padding: '20px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 26
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 10px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 21px var(--font-prose)',
      letterSpacing: '-0.02em',
      color: 'var(--ink-1)'
    }
  }, "HealthTrend")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, /*#__PURE__*/React.createElement(NavItem, {
    icon: "trending-down",
    label: "Trend",
    active: view === 'trend',
    onClick: () => setView('trend')
  }), /*#__PURE__*/React.createElement(NavItem, {
    icon: "table-2",
    label: "Measurements",
    active: view === 'measurements',
    onClick: () => setView('measurements')
  }), /*#__PURE__*/React.createElement(NavItem, {
    icon: "sigma",
    label: "Evidence",
    active: view === 'evidence',
    onClick: () => setView('evidence')
  }), /*#__PURE__*/React.createElement(NavItem, {
    icon: "book-open",
    label: "Method",
    active: view === 'method',
    onClick: () => setView('method')
  }), /*#__PURE__*/React.createElement(NavItem, {
    icon: "sliders-horizontal",
    label: "Settings",
    active: view === 'settings',
    onClick: () => setView('settings')
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      padding: '0 10px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ht-eyebrow"
  }, "Last 30 days"), /*#__PURE__*/React.createElement(Sparkline, {
    trend: f.trend.slice(-30),
    width: 160,
    height: 38
  }), /*#__PURE__*/React.createElement("span", {
    className: "ht-qualifier"
  }, "Sample data, not a real person"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      height: 'var(--shell-header-h)',
      display: 'flex',
      alignItems: 'center',
      gap: 18,
      padding: '0 var(--shell-pad-x)',
      borderBottom: '1px solid var(--rule-1)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ht-qualifier"
  }, "Synced from Withings \xB7 today, 06:40"), /*#__PURE__*/React.createElement(Badge, {
    variant: "accent"
  }, "Local linear trend, v2"), /*#__PURE__*/React.createElement(Badge, {
    variant: "outline"
  }, "Fixture series \u2014 invented data"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: 'auto',
      display: 'flex',
      gap: 10,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "quiet",
    size: "sm",
    iconRight: "download"
  }, "Export CSV"), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "sm",
    icon: "plus",
    onClick: onLog
  }, "Log a weigh-in"))), /*#__PURE__*/React.createElement("main", {
    style: {
      padding: 'var(--space-10) var(--shell-pad-x) var(--space-12)',
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 'var(--col-screen)'
    }
  }, children))));
}
Object.assign(window, {
  AppShell,
  NavItem
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/AppShell.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/EvidenceScreen.jsx
try { (() => {
const {
  SectionHeading,
  Prose,
  Equation,
  Qualifier,
  SupportingMetric,
  MeasurementTable,
  TrajectoryChart,
  ChartLegend,
  TextLink,
  Tooltip,
  Icon,
  Badge
} = window.HealthTrendDesignSystem_5b333a;
function EvidenceScreen({
  goMethod
}) {
  const f = window.HT_FIXTURES;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-10)'
    }
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ht-eyebrow"
  }, "Evidence"), /*#__PURE__*/React.createElement("h1", {
    className: "ht-title",
    style: {
      maxWidth: '28em'
    }
  }, "What the data supports, and how strongly"), /*#__PURE__*/React.createElement(Qualifier, null, "Fixture series \u2014 invented values. In the product every figure below is produced by the fitted model, and nothing is inferred by hand.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--space-10)',
      flexWrap: 'wrap',
      paddingBottom: 'var(--space-7)',
      borderBottom: '1px solid var(--rule-1)'
    }
  }, /*#__PURE__*/React.createElement(SupportingMetric, {
    label: "Velocity estimate",
    value: "\u22120.27",
    unit: "kg/week",
    qualifier: "95% CI \u22120.34 to \u22120.19",
    emphasis: "accent"
  }), /*#__PURE__*/React.createElement(SupportingMetric, {
    label: "Posterior P(declining)",
    value: "0.997",
    qualifier: "mass of velocity below zero"
  }), /*#__PURE__*/React.createElement(SupportingMetric, {
    label: "Measurement noise \u03C3",
    value: "0.71",
    unit: "kg",
    qualifier: "fixed model parameter, revision v2"
  }), /*#__PURE__*/React.createElement(SupportingMetric, {
    label: "Process noise \u03C3",
    value: "0.043",
    unit: "kg/day",
    qualifier: "fixed model parameter, revision v2"
  }), /*#__PURE__*/React.createElement(SupportingMetric, {
    label: "One-step MAE",
    value: "0.54",
    unit: "kg",
    qualifier: "held-out, last 30 days"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 'var(--space-11)',
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-8)',
      flex: '1 1 460px',
      minWidth: 380,
      maxWidth: 'var(--col-body)'
    }
  }, /*#__PURE__*/React.createElement(Prose, null, /*#__PURE__*/React.createElement("p", null, "The claim on the Trend screen is narrow: the state-space model puts your current trajectory at 76.2 kg, moving at \u22120.27 kg per week, and 99.7% of the posterior mass for that velocity sits below zero."), /*#__PURE__*/React.createElement("p", null, "That is a statement about the model\u2019s belief given 103 readings \u2014 not a prediction about your body, and not a claim that the decline will continue. ", /*#__PURE__*/React.createElement(TextLink, {
    onClick: goMethod
  }, "Read the method"), ".")), /*#__PURE__*/React.createElement(Equation, {
    number: "1"
  }, "v\u0302\u209C | y\u2081\u2026\u209C ~ N(\u22120.038, 0.011\xB2) kg/day"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ht-eyebrow"
  }, "Model parameters"), /*#__PURE__*/React.createElement(Badge, {
    variant: "accent"
  }, "Local linear trend, v2")), /*#__PURE__*/React.createElement(MeasurementTable, {
    dense: true,
    columns: ['date', 'reading', 'trend', 'residual'],
    rows: [{
      date: 'Level \u03c3',
      reading: '0.043',
      trend: '0.031',
      residual: '0.058'
    }, {
      date: 'Velocity \u03c3',
      reading: '0.004',
      trend: '0.002',
      residual: '0.007'
    }, {
      date: 'Observation \u03c3',
      reading: '0.710',
      trend: '0.641',
      residual: '0.789'
    }, {
      date: 'Init level',
      reading: '92.40',
      trend: '91.02',
      residual: '93.71'
    }]
  }), /*#__PURE__*/React.createElement(Qualifier, {
    style: {
      marginTop: 10
    }
  }, "Columns: shipped value, and the range spanned by the evaluation set. Fixture values."))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-8)',
      flex: '1 1 320px',
      minWidth: 300
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface-well)',
      padding: 'var(--space-7)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ht-eyebrow"
  }, "One-step-ahead residuals"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement(TrajectoryChart, {
    height: 190,
    unit: "kg",
    showBands: false,
    showProjection: false,
    trend: f.trend.slice(-60).map((p, i) => ({
      y: (p.rawY == null ? p.y : p.rawY) - p.y,
      label: p.label
    })),
    raw: []
  })), /*#__PURE__*/React.createElement(Qualifier, {
    style: {
      marginTop: 10
    }
  }, "No visible autocorrelation; Ljung\u2013Box p = 0.41 at lag 10.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ht-eyebrow"
  }, "Claims the model does not make"), ['Why the trajectory changed', 'Body composition', 'Whether the rate is healthy', 'What will happen if you change nothing'].map(t => /*#__PURE__*/React.createElement("div", {
    key: t,
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'baseline',
      paddingBottom: 8,
      borderBottom: '1px solid var(--rule-1)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "minus",
    size: 13,
    color: "var(--ink-5)"
  }), /*#__PURE__*/React.createElement("span", {
    className: "ht-body-sm",
    style: {
      color: 'var(--text-secondary)'
    }
  }, t))), /*#__PURE__*/React.createElement(Tooltip, {
    content: "If a screen shows a claim, it must trace to a quantity in this table."
  }, /*#__PURE__*/React.createElement("span", {
    className: "ht-qualifier",
    style: {
      display: 'inline-flex',
      gap: 5,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "info",
    size: 13
  }), " provenance rule"))))));
}
Object.assign(window, {
  EvidenceScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/EvidenceScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/LogWeighIn.jsx
try { (() => {
const {
  Input,
  Button,
  Qualifier,
  Icon
} = window.HealthTrendDesignSystem_5b333a;
function LogWeighIn({
  open,
  onClose
}) {
  const [w, setW] = React.useState('76.4');
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(14,20,28,.18)',
      display: 'flex',
      justifyContent: 'flex-end',
      zIndex: 60
    },
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      width: 380,
      background: 'var(--surface-page)',
      borderLeft: '1px solid var(--rule-2)',
      boxShadow: 'var(--shadow-overlay)',
      padding: 'var(--space-8)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-7)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ht-subtitle"
  }, "Log a weigh-in"), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    "aria-label": "Close",
    style: {
      marginLeft: 'auto',
      border: 0,
      background: 'transparent',
      cursor: 'pointer',
      color: 'var(--text-secondary)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "x",
    size: 18
  }))), /*#__PURE__*/React.createElement(Qualifier, null, "Morning readings, before eating, same scale. Consistency reduces the band faster than frequency."), /*#__PURE__*/React.createElement(Input, {
    label: "Weight",
    value: w,
    onChange: setW,
    unit: "kg",
    width: 180,
    hint: "last reading 75.9 kg, yesterday 06:38 (fixture)"
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Date",
    value: "30 Aug 2026",
    numeric: false,
    width: 220
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      paddingTop: 'var(--space-5)',
      borderTop: '1px solid var(--rule-1)'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    onClick: onClose
  }, "Add reading"), /*#__PURE__*/React.createElement(Button, {
    variant: "quiet",
    onClick: onClose
  }, "Cancel")), /*#__PURE__*/React.createElement(Qualifier, {
    tone: "accent",
    icon: "info"
  }, "One reading moves the estimate by about 0.1 kg at your current data density.")));
}
Object.assign(window, {
  LogWeighIn
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/LogWeighIn.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/MeasurementsScreen.jsx
try { (() => {
const {
  MeasurementTable,
  SegmentedControl,
  Select,
  Qualifier,
  SupportingMetric,
  Sparkline,
  TrajectoryChart,
  Prose,
  Badge
} = window.HealthTrendDesignSystem_5b333a;
function MeasurementsScreen() {
  const f = window.HT_FIXTURES;
  const [scope, setScope] = React.useState('All readings');
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-9)'
    }
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 'var(--space-8)',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ht-eyebrow"
  }, "Measurements"), /*#__PURE__*/React.createElement("h1", {
    className: "ht-title"
  }, "103 readings, 120 days"), /*#__PURE__*/React.createElement(Qualifier, null, "Fixture series \xB7 morning readings \xB7 17 days without a reading")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: 'auto',
      display: 'flex',
      gap: 'var(--space-6)',
      alignItems: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement(SegmentedControl, {
    options: ['All readings', 'Gaps', 'Outliers'],
    value: scope,
    onChange: setScope
  }), /*#__PURE__*/React.createElement(Select, {
    label: "Unit",
    options: ['kg', 'lb', 'st'],
    value: "kg",
    width: 96,
    size: "sm"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 'var(--space-11)',
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-6)',
      flex: '1 1 420px',
      minWidth: 380,
      maxWidth: 560
    }
  }, /*#__PURE__*/React.createElement(MeasurementTable, {
    rows: f.rows,
    unit: "kg"
  }), /*#__PURE__*/React.createElement(Qualifier, null, "Trend column is the model\u2019s estimate for that day, including days you did not weigh in.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-9)',
      flex: '1 1 420px',
      minWidth: 360
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--space-9)',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(SupportingMetric, {
    label: "Mean residual",
    value: "+0.02",
    unit: "kg",
    qualifier: "readings sit symmetrically around the line"
  }), /*#__PURE__*/React.createElement(SupportingMetric, {
    label: "Residual \u03C3",
    value: "0.71",
    unit: "kg",
    qualifier: "n = 103"
  }), /*#__PURE__*/React.createElement(SupportingMetric, {
    label: "Longest gap",
    value: "6",
    unit: "days",
    qualifier: "12\u201318 Jul"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface-well)',
      padding: 'var(--space-7)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ht-eyebrow"
  }, "Readings against the estimate"), /*#__PURE__*/React.createElement(Badge, {
    variant: "outline"
  }, "last 60 days")), /*#__PURE__*/React.createElement(TrajectoryChart, {
    trend: f.trend.slice(-60),
    raw: f.raw.filter(p => p.i >= f.trend.length - 60).map(p => ({
      i: p.i - (f.trend.length - 60),
      y: p.y
    })),
    projection: [],
    showProjection: false,
    height: 200,
    unit: "kg"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--space-8)',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ht-eyebrow"
  }, "Readings per week"), /*#__PURE__*/React.createElement(Sparkline, {
    trend: f.trend.slice(-84).filter((_, i) => i % 7 === 0),
    width: 180,
    height: 36,
    showBand: false
  })), /*#__PURE__*/React.createElement(Prose, {
    size: "sm",
    width: "narrow"
  }, /*#__PURE__*/React.createElement("p", null, "Six or seven readings a week keep the band near its floor. Below three, the estimate is mostly prior."))))));
}
Object.assign(window, {
  MeasurementsScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/MeasurementsScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/SettingsScreen.jsx
try { (() => {
const {
  Select,
  Switch,
  Input,
  Button,
  Qualifier,
  Badge,
  Prose
} = window.HealthTrendDesignSystem_5b333a;
function Row({
  label,
  hint,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '260px 1fr',
      gap: 'var(--space-9)',
      alignItems: 'start',
      padding: 'var(--space-7) 0',
      borderBottom: '1px solid var(--rule-1)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 5
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ht-body-sm",
    style: {
      color: 'var(--text-display)'
    }
  }, label), hint ? /*#__PURE__*/React.createElement(Qualifier, null, hint) : null), /*#__PURE__*/React.createElement("div", null, children));
}
function SettingsScreen() {
  const [unit, setUnit] = React.useState('kg');
  const [window_, setWindow] = React.useState('Adaptive');
  const [goal, setGoal] = React.useState('74.0');
  const [proj, setProj] = React.useState(true);
  const [gaps, setGaps] = React.useState(true);
  const [raw, setRaw] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-9)',
      maxWidth: 'var(--col-page)'
    }
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ht-eyebrow"
  }, "Settings"), /*#__PURE__*/React.createElement("h1", {
    className: "ht-title"
  }, "Model and display"), /*#__PURE__*/React.createElement(Prose, {
    size: "sm"
  }, /*#__PURE__*/React.createElement("p", null, "Display settings change what you see. Model settings change what is estimated \u2014 and are shown on every screen that depends on them."))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Row, {
    label: "Unit",
    hint: "Applied to every value, including intervals"
  }, /*#__PURE__*/React.createElement(Select, {
    options: ['kg', 'lb', 'st'],
    value: unit,
    onChange: setUnit,
    width: 110
  })), /*#__PURE__*/React.createElement(Row, {
    label: "Smoothing",
    hint: "Adaptive lets the filter choose its own process noise"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14,
      alignItems: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement(Select, {
    options: ['Adaptive', '7 days', '14 days', '21 days', '28 days'],
    value: window_,
    onChange: setWindow
  }), /*#__PURE__*/React.createElement(Badge, {
    variant: "accent"
  }, "affects every figure"))), /*#__PURE__*/React.createElement(Row, {
    label: "Goal weight",
    hint: "Drawn as a neutral dashed reference. The model never uses it."
  }, /*#__PURE__*/React.createElement(Input, {
    value: goal,
    onChange: setGoal,
    unit: unit,
    width: 140
  })), /*#__PURE__*/React.createElement(Row, {
    label: "Chart layers"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(Switch, {
    checked: proj,
    onChange: setProj,
    label: "30-day projection",
    hint: "dashed, with its own widening band"
  }), /*#__PURE__*/React.createElement(Switch, {
    checked: gaps,
    onChange: setGaps,
    label: "Mark days without a reading"
  }), /*#__PURE__*/React.createElement(Switch, {
    checked: raw,
    onChange: setRaw,
    label: "Raw readings on by default",
    hint: "tier 3: small, grey, behind the estimate"
  }))), /*#__PURE__*/React.createElement(Row, {
    label: "Data source",
    hint: "Connected scale \xB7 fixture connection, 4 Mar 2025"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "sm",
    iconRight: "refresh-cw"
  }, "Re-sync"), /*#__PURE__*/React.createElement(Button, {
    variant: "quiet",
    size: "sm"
  }, "Disconnect")))));
}
Object.assign(window, {
  SettingsScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/SettingsScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/TrendScreen.jsx
try { (() => {
const {
  HeroMetric,
  SupportingMetric,
  TrendDelta,
  Qualifier,
  TrajectoryChart,
  ChartLegend,
  RangeStrip,
  SegmentedControl,
  Switch,
  Prose,
  TextLink,
  Tooltip,
  Icon
} = window.HealthTrendDesignSystem_5b333a;
function TrendScreen({
  goMethod
}) {
  const f = window.HT_FIXTURES;
  const F = window.HTFormat;
  const [range, setRange] = React.useState('120d');
  const [showRaw, setShowRaw] = React.useState(true);
  const [showProj, setShowProj] = React.useState(true);
  const [win, setWin] = React.useState([0.68, 1]);
  const cut = {
    '30d': 30,
    '90d': 90,
    '120d': 120,
    'All': 120
  }[range];
  const trend = f.trend.slice(-cut);
  const raw = f.raw.filter(p => p.i >= f.trend.length - cut).map(p => ({
    i: p.i - (f.trend.length - cut),
    y: p.y
  }));
  const last = trend[trend.length - 1];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-10)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: 'var(--space-9)',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(HeroMetric, {
    label: "Estimated trend weight",
    value: F.trendWeight(last.y),
    unit: F.getLocale().unit,
    digits: F.digitSlots(),
    interval: F.plusMinus(last.hi68 - last.y, {
      level: 68
    }),
    asOf: "as of today, 06:40"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--space-9)',
      alignItems: 'flex-end',
      paddingBottom: 6
    }
  }, /*#__PURE__*/React.createElement(TrendDelta, {
    value: F.signed(-0.27, 2),
    unit: F.UNITS[F.getLocale().unit].rate,
    direction: "down",
    interval: F.rateInterval(-0.34, -0.19, {
      level: 95
    })
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--space-10)',
      paddingTop: 'var(--space-7)',
      borderTop: '1px solid var(--rule-1)',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(SupportingMetric, {
    label: "Projected 30 Sep",
    value: f.projection[29].y.toFixed(1),
    unit: "kg",
    qualifier: '\u00b1' + (f.projection[29].hi - f.projection[29].y).toFixed(1) + ' kg (68%)'
  }), /*#__PURE__*/React.createElement(SupportingMetric, {
    label: "Change, 90 days",
    value: "\u22123.4",
    unit: "kg",
    qualifier: "95% CI \u22124.1 to \u22122.7"
  }), /*#__PURE__*/React.createElement(SupportingMetric, {
    label: "Measurements used",
    value: "103",
    qualifier: "of 120 days \xB7 17 days without a reading"
  }), /*#__PURE__*/React.createElement(SupportingMetric, {
    label: "Residual scatter",
    value: "0.71",
    unit: "kg",
    qualifier: "\u03C3 of readings around the estimate"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 6,
      paddingTop: 2
    }
  }, /*#__PURE__*/React.createElement(Tooltip, {
    content: "Every interval on this screen is the filter's posterior credible interval, not a sample confidence interval."
  }, /*#__PURE__*/React.createElement("span", {
    className: "ht-qualifier",
    style: {
      display: 'inline-flex',
      gap: 5,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "info",
    size: 13
  }), " how to read intervals")))), /*#__PURE__*/React.createElement("section", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-6)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-7)',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ht-eyebrow"
  }, "Trajectory"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: 'auto',
      display: 'flex',
      gap: 'var(--space-7)',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Switch, {
    checked: showRaw,
    onChange: setShowRaw,
    label: "Raw measurements"
  }), /*#__PURE__*/React.createElement(Switch, {
    checked: showProj,
    onChange: setShowProj,
    label: "Projection"
  }), /*#__PURE__*/React.createElement(SegmentedControl, {
    options: ['30d', '90d', '120d', 'All'],
    value: range,
    onChange: setRange
  }))), /*#__PURE__*/React.createElement(TrajectoryChart, {
    trend: trend,
    raw: raw,
    projection: showProj ? f.projection : [],
    showRaw: showRaw,
    showProjection: showProj,
    height: 420,
    unit: "kg",
    xTicks: f.xTicks.filter(t => t.i >= f.trend.length - cut).map(t => ({
      i: t.i - (f.trend.length - cut),
      label: t.label
    })),
    reference: {
      y: 74,
      label: 'goal 74.0'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: 'var(--space-9)',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(ChartLegend, {
    items: [{
      role: 'trend',
      label: 'Estimated trajectory'
    }, {
      role: 'band',
      label: '68% / 95% credible interval'
    }, {
      role: 'raw',
      label: 'Scale measurements'
    }, {
      role: 'projection',
      label: 'Projection, 30 days'
    }, {
      role: 'reference',
      label: 'Your goal'
    }]
  }), /*#__PURE__*/React.createElement(Qualifier, null, "Updated 06:40 \xB7 fixture series, shown for layout only"))), /*#__PURE__*/React.createElement("section", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-5)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ht-eyebrow"
  }, "Whole history"), /*#__PURE__*/React.createElement(RangeStrip, {
    series: f.history,
    from: win[0],
    to: win[1],
    onChange: setWin,
    height: 64,
    ticks: ['Sep 2024', 'Mar 2025', 'Sep 2025', 'today']
  })), /*#__PURE__*/React.createElement("section", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 'var(--space-10)',
      paddingTop: 'var(--space-8)',
      borderTop: '1px solid var(--rule-1)'
    }
  }, /*#__PURE__*/React.createElement(Prose, {
    size: "sm",
    style: {
      flex: '1 1 380px'
    }
  }, /*#__PURE__*/React.createElement("p", null, "The line above is not your weight. It is the model\u2019s estimate of the weight underneath 103 noisy readings \u2014 and the band is how much that estimate could still move."), /*#__PURE__*/React.createElement("p", null, "Over the last 90 days this fixture estimate fell 3.4 kg, and the 95% interval on that change does not include zero \u2014 so in this sample the decline is resolved by the data rather than by the smoothing. Every figure here is invented fixture data. ", /*#__PURE__*/React.createElement(TextLink, {
    onClick: goMethod
  }, "How this is calculated"), ".")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      paddingTop: 4,
      flex: '1 1 260px',
      minWidth: 260
    }
  }, /*#__PURE__*/React.createElement(Qualifier, {
    icon: "circle-slash"
  }, "17 days have no reading. Gaps widen the band; they do not move the line."), /*#__PURE__*/React.createElement(Qualifier, {
    icon: "sigma"
  }, "Rate is the filter\u2019s velocity state, not a difference of two readings."))));
}
Object.assign(window, {
  TrendScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/TrendScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/fixtures.js
try { (() => {
// FIXTURE DATA — deterministic, invented, for layout only.
// These numbers are not model output and must never be shown as product copy.
(function () {
  function rand(seed) {
    let s = seed;
    return () => (s = s * 16807 % 2147483647) / 2147483647;
  }
  const r = rand(20260830);
  const N = 420;
  const trend = [],
    raw = [],
    history = [];
  let v = 92.4;
  const months = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
  for (let i = 0; i < N; i++) {
    const slope = i < 120 ? -0.03 : i < 260 ? -0.052 : -0.038;
    v += slope + Math.sin(i / 40) * 0.012;
    history.push(v);
  }
  const win = 120;
  for (let i = 0; i < win; i++) {
    const gi = N - win + i;
    const s = 0.13 + 0.42 * Math.exp(-(win - i) / 60) + 0.18 * Math.exp(-(win - i) / 8);
    const day = new Date(2026, 4, 3 + i);
    const measured = i % 7 === 3 && i > 40 ? null : history[gi] + (r() - 0.5) * 2.1;
    trend.push({
      y: history[gi],
      lo68: history[gi] - s,
      hi68: history[gi] + s,
      lo95: history[gi] - s * 1.96,
      hi95: history[gi] + s * 1.96,
      label: day.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
      }),
      rawY: measured == null ? undefined : measured,
      date: day
    });
    if (measured != null) raw.push({
      i,
      y: measured
    });
  }
  const projection = [];
  let p = history[N - 1],
    sp = 0.2;
  for (let j = 0; j < 30; j++) {
    p -= 0.038;
    sp += 0.035;
    projection.push({
      y: p,
      lo: p - sp,
      hi: p + sp
    });
  }
  const rows = trend.slice().reverse().slice(0, 14).map(t => ({
    date: t.label,
    reading: t.rawY == null ? null : t.rawY.toFixed(1),
    trend: t.y.toFixed(2),
    residual: t.rawY == null ? null : Math.abs(t.rawY - t.y) < 0.005 ? '0.00' : (t.rawY - t.y > 0 ? '+' : '\u2212') + Math.abs(t.rawY - t.y).toFixed(2)
  }));
  const xTicks = [];
  for (let i = 0; i < win; i += 30) xTicks.push({
    i,
    label: trend[i].label.split(' ').slice(-1)[0]
  });
  window.HT_FIXTURES = {
    trend,
    raw,
    projection,
    history,
    rows,
    xTicks,
    months
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/fixtures.js", error: String((e && e.message) || e) }); }

// ui_kits/method/MethodBody.jsx
try { (() => {
const {
  Prose,
  SectionHeading,
  Equation,
  MarginNote,
  FigureCaption,
  Citation,
  TextLink,
  TrajectoryChart,
  ChartLegend,
  Qualifier,
  SegmentedControl,
  Switch,
  Sparkline
} = window.HealthTrendDesignSystem_5b333a;
function Figure({
  label,
  caption,
  source,
  children
}) {
  return /*#__PURE__*/React.createElement("figure", {
    style: {
      margin: 'var(--gap-block) 0',
      maxWidth: 'var(--col-page)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface-well)',
      padding: 'var(--space-7)'
    }
  }, children), /*#__PURE__*/React.createElement(FigureCaption, {
    label: label,
    source: source
  }, caption));
}
function InteractiveFigure() {
  const f = window.HT_FIXTURES;
  const [win, setWin] = React.useState('14 days');
  const [showRaw, setShowRaw] = React.useState(true);
  const k = {
    '7 days': 7,
    '14 days': 14,
    '28 days': 28
  }[win];
  const trend = React.useMemo(() => {
    const src = f.trend.slice(-90);
    return src.map((p, i) => {
      const from = Math.max(0, i - k),
        slice = src.slice(from, i + 1).filter(q => q.rawY != null);
      const mean = slice.length ? slice.reduce((a, q) => a + q.rawY, 0) / slice.length : p.y;
      const s = 0.13 + 1.1 / Math.sqrt(Math.max(1, slice.length));
      return {
        y: mean,
        lo68: mean - s,
        hi68: mean + s,
        lo95: mean - s * 1.96,
        hi95: mean + s * 1.96,
        label: p.label
      };
    });
  }, [k]);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 24,
      alignItems: 'center',
      marginBottom: 14,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ht-eyebrow"
  }, "Window"), /*#__PURE__*/React.createElement(SegmentedControl, {
    size: "sm",
    options: ['7 days', '14 days', '28 days'],
    value: win,
    onChange: setWin
  }), /*#__PURE__*/React.createElement(Switch, {
    checked: showRaw,
    onChange: setShowRaw,
    label: "Readings"
  }), /*#__PURE__*/React.createElement(Qualifier, {
    style: {
      marginLeft: 'auto'
    }
  }, "Widen the window and the line lags; narrow it and the noise returns.")), /*#__PURE__*/React.createElement(TrajectoryChart, {
    height: 260,
    unit: "kg",
    showProjection: false,
    showRaw: showRaw,
    trend: trend,
    raw: f.raw.filter(p => p.i >= f.trend.length - 90).map(p => ({
      i: p.i - (f.trend.length - 90),
      y: p.y
    }))
  }));
}
function MethodBody() {
  const f = window.HT_FIXTURES;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      paddingBottom: 'var(--gap-chapter)'
    }
  }, /*#__PURE__*/React.createElement(Prose, {
    size: "lede",
    style: {
      marginTop: 'var(--gap-block)'
    }
  }, /*#__PURE__*/React.createElement("p", null, "A bathroom scale is an honest instrument answering a question you did not ask. It reports the mass of a body at one moment, including its water, its last meal and the hour of the morning. What you want to know is the slow quantity underneath: where the trajectory sits today, and how fast it is moving.")), /*#__PURE__*/React.createElement(SectionHeading, {
    eyebrow: "Section 1",
    level: 2,
    rule: true,
    note: "Why the average is the wrong tool",
    style: {
      marginTop: 'var(--gap-block)'
    }
  }, "The measurement is not the state"), /*#__PURE__*/React.createElement(Prose, {
    style: {
      marginTop: 'var(--space-7)'
    }
  }, /*#__PURE__*/React.createElement("p", null, "Write the thing you care about as a hidden state and the number on the scale as a noisy view of it. On day ", /*#__PURE__*/React.createElement("em", null, "t"), " the state has a level and a velocity; the reading adds independent measurement error on top.")), /*#__PURE__*/React.createElement(Equation, {
    number: "1"
  }, "x\u209C = x\u209C\u208B\u2081 + v\u209C\u208B\u2081 + \u03B7\u209C,   v\u209C = v\u209C\u208B\u2081 + \u03B6\u209C,   y\u209C = x\u209C + \u03B5\u209C"), /*#__PURE__*/React.createElement(Prose, null, /*#__PURE__*/React.createElement(MarginNote, {
    marker: "1"
  }, "Hydration, glycogen and gut contents dominate day-to-day variance, which is why a single morning can move by more than a fortnight of real change."), /*#__PURE__*/React.createElement("p", null, "Here ", /*#__PURE__*/React.createElement("em", null, "x"), " is trend weight, ", /*#__PURE__*/React.createElement("em", null, "v"), " its daily velocity, and the three noise terms carry three different admissions of ignorance: how fast the level may wander, how fast the velocity may change, and how badly a single reading may mislead", /*#__PURE__*/React.createElement(Citation, {
    marker: "1"
  }), "."), /*#__PURE__*/React.createElement("p", null, "A seven-day mean is a special case of this with the velocity term deleted and the noise assumed constant. That is why it lags: it estimates the average of a window, and the average of a falling window is a value from the middle of it.")), /*#__PURE__*/React.createElement(Figure, {
    label: "Figure 1",
    source: "Fixture series, 90 days; window length varied",
    caption: "A moving average is a choice between lag and noise. The filter does not require that choice \u2014 it infers how much of each reading to believe."
  }, /*#__PURE__*/React.createElement(InteractiveFigure, null)), /*#__PURE__*/React.createElement(SectionHeading, {
    eyebrow: "Section 2",
    level: 2,
    rule: true
  }, "What the filter actually computes"), /*#__PURE__*/React.createElement(Prose, {
    style: {
      marginTop: 'var(--space-7)'
    }
  }, /*#__PURE__*/React.createElement("p", null, "Each morning the model carries a belief forward one day, widening it by the process noise; then it sees a reading and narrows it in proportion to how trustworthy that reading is relative to the belief.")), /*#__PURE__*/React.createElement(Equation, {
    number: "2"
  }, "K\u209C = P\u209C\u208B / (P\u209C\u208B + \u03C3\xB2\u2096),   x\u0302\u209C = x\u0302\u209C\u208B + K\u209C(y\u209C \u2212 x\u0302\u209C\u208B)"), /*#__PURE__*/React.createElement(Prose, null, /*#__PURE__*/React.createElement(MarginNote, {
    marker: "2"
  }, "When you skip a day, only the first step runs: the band widens and the line continues on its last velocity. Absence of data never moves the estimate \u2014 it only makes it less certain."), /*#__PURE__*/React.createElement("p", null, "The gain ", /*#__PURE__*/React.createElement("em", null, "K"), " is the whole argument in one line. When your readings are consistent, ", /*#__PURE__*/React.createElement("em", null, "K"), " is large and the estimate tracks them closely. When they scatter, ", /*#__PURE__*/React.createElement("em", null, "K"), " falls and a single 2 kg morning barely registers."), /*#__PURE__*/React.createElement("p", null, "The shaded bands on every chart in the product are this belief\u2019s posterior standard deviation, at 68% and 95%. They are credible intervals for the state \u2014 not the range in which tomorrow\u2019s reading will fall, which is wider.")), /*#__PURE__*/React.createElement(Figure, {
    label: "Figure 2",
    source: "Fixture series, 120 days, n = 103 readings \u2014 invented data",
    caption: "The posterior mean with its 68% and 95% bands, the readings it saw, and a 30-day projection whose band widens because velocity itself is uncertain."
  }, /*#__PURE__*/React.createElement(TrajectoryChart, {
    trend: f.trend,
    raw: f.raw,
    projection: f.projection,
    height: 300,
    unit: "kg",
    xTicks: f.xTicks
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement(ChartLegend, {
    items: [{
      role: 'trend',
      label: 'Posterior mean'
    }, {
      role: 'band',
      label: '68% / 95% credible interval'
    }, {
      role: 'raw',
      label: 'Measurements'
    }, {
      role: 'projection',
      label: 'Projection'
    }]
  }))), /*#__PURE__*/React.createElement(SectionHeading, {
    eyebrow: "Section 3",
    level: 2,
    rule: true
  }, "Where the variances come from"), /*#__PURE__*/React.createElement(Prose, {
    style: {
      marginTop: 'var(--space-7)'
    }
  }, /*#__PURE__*/React.createElement("p", null, "Three variances govern everything above. HealthTrend ships them as fixed, documented parameters, calibrated once on our evaluation set and published with each model revision", /*#__PURE__*/React.createElement(Citation, {
    marker: "2"
  }), "."), /*#__PURE__*/React.createElement("p", null, "We do not fit them to a single person\u2019s short history: with a few weeks of readings, per-user maximum likelihood is not justified by the evaluation \u2014 it moves the variances more than the data supports. The band still tightens over the first weeks of use, because the filter\u2019s posterior narrows as readings accumulate, not because the parameters change.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--space-9)',
      alignItems: 'center',
      margin: 'var(--space-8) 0',
      maxWidth: 'var(--col-body)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ht-eyebrow"
  }, "Band width, first 90 days"), /*#__PURE__*/React.createElement(Sparkline, {
    trend: f.trend.slice(0, 90).map(p => ({
      y: -(p.hi68 - p.y)
    })),
    width: 220,
    height: 44,
    showBand: false
  })), /*#__PURE__*/React.createElement(Qualifier, null, "In this fixture the 68% half-width falls from 0.55 kg to 0.13 kg as readings accumulate.")), /*#__PURE__*/React.createElement(SectionHeading, {
    eyebrow: "Section 4",
    level: 2,
    rule: true
  }, "What we refuse to say"), /*#__PURE__*/React.createElement(Prose, {
    style: {
      marginTop: 'var(--space-7)'
    }
  }, /*#__PURE__*/React.createElement("p", null, "The model produces a level, a velocity, their uncertainties, and a forecast that assumes the current velocity persists. It does not produce causes, body composition, or a judgement about the rate."), /*#__PURE__*/React.createElement("p", null, "So the product does not state them. If a screen shows a claim, that claim traces to one of the quantities on the ", /*#__PURE__*/React.createElement(TextLink, {
    href: "../app/index.html"
  }, "Evidence screen"), ". Where the model is uncertain, the interface says so in the same breath as the number \u2014 never in a footnote.")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'var(--gap-block)',
      paddingTop: 'var(--space-7)',
      borderTop: '1px solid var(--rule-2)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ht-eyebrow"
  }, "References"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'var(--space-6)',
      maxWidth: 'var(--col-body)'
    }
  }, /*#__PURE__*/React.createElement(Citation, {
    marker: "1"
  }, "Harvey, A. C. Forecasting, Structural Time Series Models and the Kalman Filter. Cambridge University Press, 1989."), /*#__PURE__*/React.createElement(Citation, {
    marker: "2"
  }, "Durbin, J. & Koopman, S. J. Time Series Analysis by State Space Methods. 2nd ed., Oxford University Press, 2012."), /*#__PURE__*/React.createElement(Citation, {
    marker: "3"
  }, "Kalman, R. E. A New Approach to Linear Filtering and Prediction Problems. Journal of Basic Engineering, 1960."))));
}
Object.assign(window, {
  MethodBody,
  Figure,
  InteractiveFigure
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/method/MethodBody.jsx", error: String((e && e.message) || e) }); }

// ui_kits/method/MethodHeader.jsx
try { (() => {
const {
  TextLink,
  Qualifier
} = window.HealthTrendDesignSystem_5b333a;
function MethodHeader() {
  return /*#__PURE__*/React.createElement("header", {
    style: {
      borderBottom: '1px solid var(--rule-1)',
      position: 'sticky',
      top: 0,
      background: 'var(--surface-page)',
      zIndex: 30
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 'var(--col-screen)',
      margin: '0 auto',
      padding: '0 var(--space-10)',
      height: 'var(--shell-header-h)',
      display: 'flex',
      alignItems: 'center',
      gap: 18
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '400 19px var(--font-prose)',
      letterSpacing: '-0.02em',
      color: 'var(--ink-1)'
    }
  }, "HealthTrend"), /*#__PURE__*/React.createElement("span", {
    className: "ht-qualifier",
    style: {
      color: 'var(--ink-5)'
    }
  }, "/"), /*#__PURE__*/React.createElement("span", {
    className: "ht-qualifier"
  }, "Method"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: 'auto',
      display: 'flex',
      gap: 20,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Qualifier, null, "Revision 2.4 \xB7 12 Aug 2026 \xB7 figures use fixture data"), /*#__PURE__*/React.createElement(TextLink, {
    variant: "ui",
    href: "../app/index.html"
  }, "Back to the app"))));
}
function MethodTitle() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-8)',
      paddingTop: 'var(--space-12)'
    }
  }, /*#__PURE__*/React.createElement("h1", {
    className: "ht-display",
    style: {
      maxWidth: '22em'
    }
  }, "Estimating a weight trajectory from noisy daily measurements"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--space-9)',
      flexWrap: 'wrap',
      paddingTop: 'var(--space-6)',
      borderTop: '1px solid var(--rule-2)'
    }
  }, [['Model', 'Local linear trend'], ['Estimator', 'Kalman filter, fixed documented parameters'], ['Revision', '2.4 — 12 Aug 2026'], ['Reading time', '≈ 14 min']].map(p => /*#__PURE__*/React.createElement("div", {
    key: p[0],
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ht-eyebrow"
  }, p[0]), /*#__PURE__*/React.createElement("span", {
    className: "ht-qualifier",
    style: {
      color: 'var(--text-body)'
    }
  }, p[1])))));
}
Object.assign(window, {
  MethodHeader,
  MethodTitle
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/method/MethodHeader.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.SegmentedControl = __ds_scope.SegmentedControl;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.TextLink = __ds_scope.TextLink;

__ds_ns.Tooltip = __ds_scope.Tooltip;

__ds_ns.ChartLegend = __ds_scope.ChartLegend;

__ds_ns.MeasurementTable = __ds_scope.MeasurementTable;

__ds_ns.RangeStrip = __ds_scope.RangeStrip;

__ds_ns.Sparkline = __ds_scope.Sparkline;

__ds_ns.TrajectoryChart = __ds_scope.TrajectoryChart;

__ds_ns.HeroMetric = __ds_scope.HeroMetric;

__ds_ns.Qualifier = __ds_scope.Qualifier;

__ds_ns.RawReading = __ds_scope.RawReading;

__ds_ns.SupportingMetric = __ds_scope.SupportingMetric;

__ds_ns.TrendDelta = __ds_scope.TrendDelta;

__ds_ns.Reveal = __ds_scope.Reveal;

__ds_ns.Citation = __ds_scope.Citation;

__ds_ns.Equation = __ds_scope.Equation;

__ds_ns.FigureCaption = __ds_scope.FigureCaption;

__ds_ns.MarginNote = __ds_scope.MarginNote;

__ds_ns.Prose = __ds_scope.Prose;

__ds_ns.SectionHeading = __ds_scope.SectionHeading;

__ds_ns.ConfidenceNote = __ds_scope.ConfidenceNote;

__ds_ns.InsufficientData = __ds_scope.InsufficientData;

__ds_ns.OutlierFlag = __ds_scope.OutlierFlag;

})();
