import { useCallback, useState } from 'react';
import { ChevronDown, ChevronUp, Activity } from 'lucide-react';
import { oeFetch } from '@core/oeFetch';
import type { FrontDeskFlowChartsData } from '@core/types';

interface FrontDeskFlowChartsProps {
  ajaxUrl: string;
  csrfToken: string;
  facilityId: number;
}

// ── Sparkline (area chart) ───────────────────────────────────────────────────

function Sparkline({ data, color = '#2563eb' }: { data: { hour: number; count: number }[]; color?: string }) {
  const W = 200;
  const H = 48;
  const pad = 4;

  if (data.length < 2) {
    return <svg width={W} height={H} aria-hidden="true" />;
  }

  const counts = data.map((d) => d.count);
  const maxVal = Math.max(...counts, 1);

  const pts = data.map((d, i) => {
    const x = pad + (i / (data.length - 1)) * (W - pad * 2);
    const y = H - pad - ((d.count / maxVal) * (H - pad * 2));
    return { x, y, d };
  });

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPath = [
    `M${pts[0].x.toFixed(1)},${H - pad}`,
    ...pts.map((p) => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`),
    `L${pts[pts.length - 1].x.toFixed(1)},${H - pad}`,
    'Z',
  ].join(' ');

  const peakIdx = counts.indexOf(maxVal);
  const peak = pts[peakIdx];

  return (
    <svg width={W} height={H} aria-label="Hourly visit volume" role="img">
      <defs>
        <linearGradient id="nc-spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#nc-spark-fill)" />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      {peak && maxVal > 0 && (
        <circle cx={peak.x} cy={peak.y} r="3" fill={color} />
      )}
    </svg>
  );
}

// ── Adherence donut ──────────────────────────────────────────────────────────

function AdherenceDonut({ data }: { data: FrontDeskFlowChartsData['adherence'] }) {
  const R = 26;
  const cx = 32;
  const cy = 32;
  const circumference = 2 * Math.PI * R;

  const { arrived, no_show, pending, scheduled } = data;
  const total = Math.max(scheduled, 1);

  type Segment = { label: string; value: number; color: string };
  const segments: Segment[] = [
    { label: 'Arrived',  value: arrived,  color: '#10b981' },
    { label: 'Pending',  value: pending,  color: '#60a5fa' },
    { label: 'No-show',  value: no_show,  color: '#f59e0b' },
  ];

  let offset = 0;
  const arcs = segments.map((seg) => {
    const fraction = seg.value / total;
    const dash = fraction * circumference;
    const gap  = circumference - dash;
    const rotation = (offset / total) * 360 - 90;
    offset += seg.value;
    return { ...seg, dash, gap, rotation };
  });

  return (
    <svg width={64} height={64} aria-label="Appointment adherence donut" role="img">
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--oe-nc-border,#e5e7eb)" strokeWidth="8" />
      {arcs.map((arc) => (
        <circle
          key={arc.label}
          cx={cx}
          cy={cy}
          r={R}
          fill="none"
          stroke={arc.color}
          strokeWidth="8"
          strokeDasharray={`${arc.dash} ${arc.gap}`}
          transform={`rotate(${arc.rotation} ${cx} ${cy})`}
          strokeLinecap="butt"
        />
      ))}
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--oe-nc-text,#111)">
        {arrived}
      </text>
      <text x={cx} y={cy + 8} textAnchor="middle" fontSize="8" fill="var(--oe-nc-text-muted,#6b7280)">
        arrived
      </text>
    </svg>
  );
}

// ── Wait trend pill ──────────────────────────────────────────────────────────

function WaitTrendPill({ today, yesterday }: { today: number; yesterday: number }) {
  const diff = today - yesterday;
  const better = diff <= 0;
  const noData = today === 0 && yesterday === 0;

  if (noData) {
    return (
      <span className="nc-flow-wait-pill nc-flow-wait-pill--neutral">
        —
      </span>
    );
  }

  const arrow = diff === 0 ? '→' : better ? '↓' : '↑';
  const tone  = diff === 0 ? 'neutral' : better ? 'better' : 'worse';

  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`nc-flow-wait-pill nc-flow-wait-pill--${tone}`}>
        {today} min <span aria-hidden="true">{arrow}</span>
      </span>
      {yesterday > 0 && (
        <span className="text-[0.6875rem] text-[var(--oe-nc-text-muted)]">
          yesterday {yesterday} min
        </span>
      )}
    </div>
  );
}

// ── Legend ───────────────────────────────────────────────────────────────────

function AdherenceLegend({ data }: { data: FrontDeskFlowChartsData['adherence'] }) {
  const items = [
    { label: 'Arrived',  value: data.arrived,  color: '#10b981' },
    { label: 'Pending',  value: data.pending,  color: '#60a5fa' },
    { label: 'No-show',  value: data.no_show,  color: '#f59e0b' },
  ] as const;

  return (
    <div className="flex flex-col gap-0.5 text-xs">
      {items.map(({ label, value, color }) => (
        <div key={label} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: color }} />
          <span className="text-[var(--oe-nc-text-muted)]">{label}</span>
          <span className="font-semibold tabular-nums text-[var(--oe-nc-text)] ml-auto">{value}</span>
        </div>
      ))}
      <div className="flex items-center gap-1.5 mt-0.5 border-t border-[var(--oe-nc-border)] pt-0.5">
        <span className="h-2 w-2 shrink-0" />
        <span className="text-[var(--oe-nc-text-muted)]">Scheduled</span>
        <span className="font-semibold tabular-nums text-[var(--oe-nc-text)] ml-auto">{data.scheduled}</span>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function FrontDeskFlowCharts({ ajaxUrl, csrfToken, facilityId }: FrontDeskFlowChartsProps) {
  const [open,    setOpen]    = useState(false);
  const [data,    setData]    = useState<FrontDeskFlowChartsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    if (data) return;
    setLoading(true);
    setError(null);
    try {
      const result = await oeFetch<FrontDeskFlowChartsData>('front_desk.flow_charts', {
        ajaxUrl,
        csrfToken,
        params: facilityId > 0 ? { facility_id: facilityId } : undefined,
      });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load charts');
    } finally {
      setLoading(false);
    }
  }, [ajaxUrl, csrfToken, data, facilityId]);

  const handleToggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      if (next) void load();
      return next;
    });
  }, [load]);

  const hourLabels = (data?.hourly_visits ?? []).filter((_, i) => i % 3 === 0);
  const peakHour   = data?.hourly_visits.reduce(
    (best, cur) => cur.count > best.count ? cur : best,
    { hour: -1, count: 0 },
  );

  return (
    <div className="nc-flow-charts" id="nc-flow-charts">
      <button
        type="button"
        className="nc-flow-charts-toggle"
        aria-expanded={open}
        aria-controls="nc-flow-charts-body"
        onClick={handleToggle}
      >
        <Activity className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>Today&apos;s flow</span>
        <span className="nc-flow-charts-live-dot" aria-hidden="true" title="Live — updated on load" />
        {open
          ? <ChevronUp   className="h-3.5 w-3.5 ml-auto shrink-0" aria-hidden="true" />
          : <ChevronDown className="h-3.5 w-3.5 ml-auto shrink-0" aria-hidden="true" />
        }
      </button>

      {open && (
        <div className="nc-flow-charts-body" id="nc-flow-charts-body">
          {loading && (
            <div className="nc-flow-charts-placeholder" aria-live="polite">
              Loading chart data…
            </div>
          )}

          {error && (
            <div className="nc-flow-charts-placeholder text-red-600" role="alert">
              {error}
            </div>
          )}

          {data && (
            <div className="nc-flow-charts-grid">
              {/* ── Hourly sparkline ────────────────────────── */}
              <div className="nc-flow-chart-card">
                <p className="nc-flow-chart-title">Visits by hour</p>
                <Sparkline data={data.hourly_visits} />
                <div className="nc-flow-sparkline-axis">
                  {hourLabels.map((d) => (
                    <span key={d.hour} className="nc-flow-sparkline-label">
                      {d.hour < 12 ? `${d.hour}am` : d.hour === 12 ? '12pm' : `${d.hour - 12}pm`}
                    </span>
                  ))}
                </div>
                {peakHour && peakHour.hour >= 0 && peakHour.count > 0 && (
                  <p className="nc-flow-chart-hint">
                    Peak: {peakHour.hour < 12 ? `${peakHour.hour}:00 am` : `${peakHour.hour - 12 || 12}:00 pm`}
                    {' '}({peakHour.count} visits)
                  </p>
                )}
              </div>

              {/* ── Adherence donut ─────────────────────────── */}
              <div className="nc-flow-chart-card">
                <p className="nc-flow-chart-title">Appointment adherence</p>
                {data.adherence.scheduled === 0 ? (
                  <p className="nc-flow-chart-hint">No appointments scheduled today.</p>
                ) : (
                  <div className="flex items-center gap-4">
                    <AdherenceDonut data={data.adherence} />
                    <AdherenceLegend data={data.adherence} />
                  </div>
                )}
              </div>

              {/* ── Wait time trend ──────────────────────────── */}
              <div className="nc-flow-chart-card">
                <p className="nc-flow-chart-title">Avg visit duration</p>
                <div className="flex items-center justify-center flex-1">
                  <WaitTrendPill
                    today={data.wait_avg_today_mins}
                    yesterday={data.wait_avg_yesterday_mins}
                  />
                </div>
                <p className="nc-flow-chart-hint">
                  Start → completion (completed visits only)
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
