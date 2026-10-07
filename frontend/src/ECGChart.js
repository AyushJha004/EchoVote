import React, { useMemo } from "react";

const ECGChart = ({
  signal,
  height = 260,
  sensitivity = null,
  accentColor = "#2b44d6",
}) => {
  const W = 900;
  const HEAT_H = 22;
  const chartH = sensitivity ? height - HEAT_H - 8 : height;

  const { pathD, points } = useMemo(() => {
    if (!signal || signal.length === 0) return { pathD: "", points: "" };
    const min = Math.min(...signal);
    const max = Math.max(...signal);
    const range = max - min || 1;
    const padX = 0,
      padY = 20;
    const pts = signal.map((val, i) => {
      const x = padX + (i / (signal.length - 1)) * (W - padX * 2);
      const y = padY + (1 - (val - min) / range) * (chartH - padY * 2);
      return [x, y];
    });
    const points = pts
      .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
      .join(" ");
    const pathD = pts.reduce(
      (d, [x, y], i) =>
        i === 0
          ? `M${x.toFixed(2)},${y.toFixed(2)}`
          : `${d} L${x.toFixed(2)},${y.toFixed(2)}`,
      "",
    );
    return { pathD, points };
  }, [signal, chartH]);

  const heatRects = useMemo(() => {
    if (!sensitivity || sensitivity.length === 0) return [];
    const step = W / sensitivity.length;
    return sensitivity.map((val, i) => {
      let r, g, b;
      if (val < 0.5) {
        const t = val * 2;
        r = Math.round(43 + t * (217 - 43));
        g = Math.round(68 + t * (131 - 68));
        b = Math.round(214 + t * (36 - 214));
      } else {
        const t = (val - 0.5) * 2;
        r = Math.round(217 + t * (194 - 217));
        g = Math.round(131 + t * (54 - 131));
        b = Math.round(36 + t * (43 - 36));
      }
      return {
        x: i * step,
        w: step + 0.5,
        color: `rgb(${r},${g},${b})`,
        opacity: 0.15 + val * 0.55,
      };
    });
  }, [sensitivity]);

  // Per-sample signal points for overlay positioning
  const signalPts = useMemo(() => {
    if (!signal || signal.length === 0) return [];
    const min = Math.min(...signal);
    const max = Math.max(...signal);
    const range = max - min || 1;
    const padY = 20;
    return signal.map((val, i) => ({
      x: (i / (signal.length - 1)) * W,
      y: padY + (1 - (val - min) / range) * (chartH - padY * 2),
    }));
  }, [signal, chartH]);

  // Clinical ECG grid — major every 25%, minor every 5%
  const majorYs = [0.25, 0.5, 0.75].map((f) => f * chartH);
  const minorYs = [0.1, 0.2, 0.3, 0.4, 0.6, 0.7, 0.8, 0.9].map(
    (f) => f * chartH,
  );
  const majorXs = [0.25, 0.5, 0.75].map((f) => f * W);
  const minorXs = [0.1, 0.2, 0.3, 0.4, 0.6, 0.7, 0.8, 0.9].map((f) => f * W);
  const heatY = chartH + 8;

  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      style={{ width: "100%", height, display: "block" }}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="ecgLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#2b44d6" />
          <stop offset="50%" stopColor={accentColor} />
          <stop offset="100%" stopColor="#2b44d6" />
        </linearGradient>
        <linearGradient id="ecgAreaFill" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={accentColor} stopOpacity="0.10" />
          <stop offset="100%" stopColor={accentColor} stopOpacity="0.01" />
        </linearGradient>
        <filter id="ecgGlow">
          <feGaussianBlur stdDeviation="1.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id="chartClip">
          <rect x="0" y="0" width={W} height={chartH} />
        </clipPath>
      </defs>

      {/* Chart background — clinical white */}
      <rect width={W} height={chartH} fill="#ffffff" rx="6" />
      <rect
        width={W}
        height={chartH}
        fill="none"
        stroke="#e4dfd3"
        strokeWidth="1"
        rx="6"
      />

      {/* Minor grid */}
      {minorYs.map((y, i) => (
        <line
          key={`my${i}`}
          x1={0}
          y1={y}
          x2={W}
          y2={y}
          stroke="#efc4bf"
          strokeWidth="0.5"
          opacity="0.5"
        />
      ))}
      {minorXs.map((x, i) => (
        <line
          key={`mx${i}`}
          x1={x}
          y1={0}
          x2={x}
          y2={chartH}
          stroke="#efc4bf"
          strokeWidth="0.5"
          opacity="0.5"
        />
      ))}

      {/* Major grid — classic ECG pink/red */}
      {majorYs.map((y, i) => (
        <line
          key={`gy${i}`}
          x1={0}
          y1={y}
          x2={W}
          y2={y}
          stroke="#efc4bf"
          strokeWidth="0.8"
        />
      ))}
      {majorXs.map((x, i) => (
        <line
          key={`gx${i}`}
          x1={x}
          y1={0}
          x2={x}
          y2={chartH}
          stroke="#efc4bf"
          strokeWidth="0.8"
        />
      ))}

      {/* Baseline */}
      <line
        x1={0}
        y1={chartH / 2}
        x2={W}
        y2={chartH / 2}
        stroke="#e3a9a2"
        strokeWidth="1"
        strokeDasharray="6,4"
      />

      {/* Area fill */}
      {pathD && (
        <path
          clipPath="url(#chartClip)"
          d={`${pathD} L${W},${chartH} L0,${chartH} Z`}
          fill="url(#ecgAreaFill)"
        />
      )}

      {/* ECG signal — glow layer */}
      {points && (
        <polyline
          clipPath="url(#chartClip)"
          points={points}
          fill="none"
          stroke={accentColor}
          strokeWidth="3.5"
          strokeOpacity="0.15"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      {/* ECG signal — main line */}
      {points && (
        <polyline
          clipPath="url(#chartClip)"
          points={points}
          fill="none"
          stroke="url(#ecgLineGrad)"
          strokeWidth="1.8"
          strokeLinejoin="round"
          strokeLinecap="round"
          filter="url(#ecgGlow)"
        />
      )}

      {/* Corner labels */}
      <text
        x="10"
        y="15"
        fill="#cfc8b8"
        fontSize="9"
        fontFamily="IBM Plex Mono, monospace"
        fontWeight="600"
      >
        ECG SIGNAL
      </text>
      <text
        x={W - 10}
        y="15"
        fill="#cfc8b8"
        fontSize="9"
        fontFamily="IBM Plex Mono, monospace"
        textAnchor="end"
      >
        {signal?.length || 0} samples · 360 Hz
      </text>

      {/* ── Sensitivity overlay — vertical bands on the signal ── */}
      {sensitivity && signalPts.length > 0 && (
        <g clipPath="url(#chartClip)">
          {heatRects.map((r, i) => {
            const pt = signalPts[i];
            if (!pt) return null;
            const bandH = chartH - pt.y;
            return (
              <rect
                key={i}
                x={r.x}
                y={pt.y - 6}
                width={r.w}
                height={Math.max(bandH + 6, 12)}
                fill={r.color}
                opacity={r.opacity}
              />
            );
          })}
        </g>
      )}

      {/* ── Heatmap Ribbon below chart ── */}
      {sensitivity && (
        <>
          <rect
            x={0}
            y={heatY}
            width={W}
            height={HEAT_H}
            fill="#faf8f3"
            rx="4"
          />
          {heatRects.map((r, i) => (
            <rect
              key={i}
              x={r.x}
              y={heatY}
              width={r.w}
              height={HEAT_H}
              fill={r.color}
              opacity={r.opacity}
            />
          ))}
          <rect
            x={0}
            y={heatY}
            width={W}
            height={HEAT_H}
            fill="none"
            stroke="#e4dfd3"
            strokeWidth="1"
            rx="4"
          />
          <text
            x="6"
            y={heatY + 14}
            fill="#8a8c9c"
            fontSize="8"
            fontFamily="IBM Plex Mono, monospace"
            fontWeight="600"
          >
            SENSITIVITY
          </text>
          <text
            x={W - 6}
            y={heatY + 14}
            fill="#dc4a3e"
            fontSize="8"
            fontFamily="IBM Plex Mono, monospace"
            textAnchor="end"
          >
            HIGH IMPACT →
          </text>
        </>
      )}
    </svg>
  );
};

export default ECGChart;
