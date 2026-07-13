import { useMemo, useState } from 'react';
import { Baby, LineChart } from 'lucide-react';
import { TrendLineChart } from '@components/TrendLineChart';
import { ncShadcnTableClass } from '@components/ncTableStyles';
import { Button } from '@components/ui/button';
import { NativeSelect } from '@components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@components/ui/table';
import { ChartSection } from './chartUi';
import type { VitalsSeriesData } from './patientChartTypes';

interface VitalsTrendsPanelProps {
  data: VitalsSeriesData | null;
}

/**
 * B2 (G9) — Trends panel on the chart Clinical tab. Charts historical vitals
 * from existing visit records (read-only); a measure picker switches which
 * series is shown. Hidden entirely when the feature is off or there is no
 * vitals history to plot.
 */
export function VitalsTrendsPanel({ data }: VitalsTrendsPanelProps) {
  const measures = data?.measures ?? [];
  const [selectedKey, setSelectedKey] = useState<string>('');

  const selected = useMemo(() => {
    if (measures.length === 0) return null;
    return measures.find((m) => m.key === selectedKey) ?? measures[0];
  }, [measures, selectedKey]);

  if (!data?.enabled || measures.length === 0 || !selected) {
    return null;
  }

  const chartSeries = selected.series.map((line) => ({
    name: line.name,
    points: line.points.map((p) => ({ label: p.label, value: p.value })),
  }));

  return (
    <ChartSection
      id="clinical-vitals-trends"
      title="Vitals trends"
      description="How this patient’s vitals have changed over time"
      icon={<LineChart className="h-4 w-4" aria-hidden />}
      variant="muted"
      action={
        <div className="flex flex-wrap items-center gap-2">
          {data.growth_chart_url && (
            <Button variant="outline" size="sm" asChild>
              <a href={data.growth_chart_url} target="_blank" rel="noopener noreferrer">
                <Baby className="mr-1.5 h-4 w-4" aria-hidden />
                Growth chart
              </a>
            </Button>
          )}
          {measures.length > 1 && (
            <NativeSelect
              aria-label="Choose a vital to chart"
              className="w-auto"
              value={selected.key}
              onChange={(e) => setSelectedKey(e.target.value)}
            >
              {measures.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </NativeSelect>
          )}
        </div>
      }
      bodyClassName="py-3"
    >
      <div className="mb-3">
        <TrendLineChart
          series={chartSeries}
          unit={selected.unit || undefined}
          emptyLabel="No readings for this measure yet."
        />
      </div>
      {selected.readings.length > 0 && (
        <div className="overflow-x-auto max-h-64 overflow-y-auto">
          <Table className={ncShadcnTableClass({ className: 'mb-0' })}>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>{selected.label}{selected.unit ? ` (${selected.unit})` : ''}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selected.readings.slice().reverse().map((r, idx) => (
                <TableRow key={`${r.iso}-${idx}`}>
                  <TableCell className="text-[var(--oe-nc-text-muted)] text-sm">{r.label || '—'}</TableCell>
                  <TableCell>{r.display}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </ChartSection>
  );
}
