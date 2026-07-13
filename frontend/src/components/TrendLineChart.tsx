import { useId } from 'react';

export interface TrendPoint {
  label: string;
  value: number;
}

export interface TrendSeries {
  name: string;
  points: TrendPoint[];
}

interface TrendLineChartProps {
  series: TrendSeries[];
  unit?: string;
  /** Accessible summary; falls back to a generated one. */
  ariaLabel?: string;
  emptyLabel?: string;
}

// Token-based palette (up to 2 series today: e.g. systolic/diastolic).
// Fallback hexes only apply if the token is ever missing — both resolve normally.
const SERIES_COLORS = ['var(--oe-nc-primary, #2563eb)', 'var(--oe-nc-text-muted, #64748b)'];

const VIEW_W = 320;
const VIEW_H = 132;
const PAD = { top: 12, right: 12, bottom: 22, left: 34 };

/**
 * Dependency-free SVG line chart for small clinical series (vitals trends, labs).
 * Auto-scales to the combined min/max across series, renders line + points, and
 * labels the y-range and first/last x. Responsive via viewBox; theme via tokens.
 */
export function TrendLineChart({
  series,
  unit,
  ariaLabel,
  emptyLabel = 'No readings yet.',
}: TrendLineChartProps) {
  const gradId = useId();
  const allValues = series.flatMap((s) => s.points.map((p) => p.value));
  const maxLen = Math.max(0, ...series.map((s) => s.points.length));

  if (allValues.length === 0 || maxLen === 0) {
    return <p className="text-sm text-[var(--oe-nc-text-muted)] mb-0">{emptyLabel}</p>;
  }

  let min = Math.min(...allValues);
  let max = Math.max(...allValues);
  if (min === max) {
    // Flat series — pad so the line sits mid-height rather than on an edge.
    min -= 1;
    max += 1;
  }

  const plotW = VIEW_W - PAD.left - PAD.right;
  const plotH = VIEW_H - PAD.top - PAD.bottom;

  // Single point → center it; otherwise spread across the plot width.
  const xAt = (i: number) => (maxLen === 1 ? PAD.left + plotW / 2 : PAD.left + (i / (maxLen - 1)) * plotW);
  const yAt = (v: number) => PAD.top + (1 - (v - min) / (max - min)) * plotH;

  const firstLabel = series[0]?.points[0]?.label ?? '';
  const lastLabel = series[0]?.points[series[0].points.length - 1]?.label ?? '';
  const latest = series[0]?.points[series[0].points.length - 1]?.value;

  const generatedLabel =
    ariaLabel ??
    `Trend of ${maxLen} reading${maxLen === 1 ? '' : 's'}${
      firstLabel ? ` from ${firstLabel} to ${lastLabel}` : ''
    }${latest !== undefined ? `, latest ${latest}${unit ? ' ' + unit : ''}` : ''}.`;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        width="100%"
        role="img"
        aria-label={generatedLabel}
        preserveAspectRatio="xMidYMid meet"
        style={{ maxWidth: '100%', height: 'auto' }}
      >
        {/* y-axis min/max guide labels */}
        <text x={PAD.left - 4} y={PAD.top + 4} textAnchor="end" fontSize="9" fill="var(--oe-nc-text-muted, #64748b)">
          {round(max)}
        </text>
        <text x={PAD.left - 4} y={PAD.top + plotH + 3} textAnchor="end" fontSize="9" fill="var(--oe-nc-text-muted, #64748b)">
          {round(min)}
        </text>
        {/* baseline + top gridlines */}
        <line
          x1={PAD.left}
          y1={PAD.top + plotH}
          x2={PAD.left + plotW}
          y2={PAD.top + plotH}
          stroke="var(--oe-nc-border, #e2e8f0)"
          strokeWidth="1"
        />

        {series.map((s, si) => {
          const color = SERIES_COLORS[si % SERIES_COLORS.length];
          const pts = s.points.map((p, i) => `${xAt(i)},${yAt(p.value)}`).join(' ');
          return (
            <g key={s.name}>
              {s.points.length > 1 && (
                <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              )}
              {s.points.map((p, i) => (
                <circle key={`${gradId}-${si}-${i}`} cx={xAt(i)} cy={yAt(p.value)} r="2.5" fill={color}>
                  <title>{`${p.label}: ${p.value}${unit ? ' ' + unit : ''}${series.length > 1 ? ` (${s.name})` : ''}`}</title>
                </circle>
              ))}
            </g>
          );
        })}

        {/* x-axis first/last labels */}
        {firstLabel && (
          <text x={PAD.left} y={VIEW_H - 6} textAnchor="start" fontSize="9" fill="var(--oe-nc-text-muted, #64748b)">
            {firstLabel}
          </text>
        )}
        {lastLabel && lastLabel !== firstLabel && (
          <text x={PAD.left + plotW} y={VIEW_H - 6} textAnchor="end" fontSize="9" fill="var(--oe-nc-text-muted, #64748b)">
            {lastLabel}
          </text>
        )}
      </svg>

      {series.length > 1 && (
        <div className="mt-1 flex flex-wrap gap-3">
          {series.map((s, si) => (
            <span key={s.name} className="inline-flex items-center gap-1 text-xs text-[var(--oe-nc-text-muted)]">
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: SERIES_COLORS[si % SERIES_COLORS.length] }}
              />
              {s.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function round(v: number): number {
  return Math.round(v * 10) / 10;
}
