import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VitalsTrendsPanel } from './VitalsTrendsPanel';
import type { VitalsSeriesData } from './patientChartTypes';

const sample: VitalsSeriesData = {
  enabled: true,
  measures: [
    {
      key: 'bp',
      label: 'Blood pressure',
      unit: 'mmHg',
      series: [
        { name: 'Systolic', points: [{ iso: '2026-01-01', label: '1 Jan 2026', value: 120 }, { iso: '2026-02-01', label: '1 Feb 2026', value: 118 }] },
        { name: 'Diastolic', points: [{ iso: '2026-01-01', label: '1 Jan 2026', value: 80 }, { iso: '2026-02-01', label: '1 Feb 2026', value: 78 }] },
      ],
      readings: [
        { iso: '2026-01-01', label: '1 Jan 2026', display: '120/80' },
        { iso: '2026-02-01', label: '1 Feb 2026', display: '118/78' },
      ],
    },
    {
      key: 'weight',
      label: 'Weight',
      unit: 'kg',
      series: [{ name: 'Weight', points: [{ iso: '2026-01-01', label: '1 Jan 2026', value: 70 }] }],
      readings: [{ iso: '2026-01-01', label: '1 Jan 2026', display: '70 kg' }],
    },
  ],
};

describe('VitalsTrendsPanel', () => {
  it('renders nothing when disabled', () => {
    const { container } = render(<VitalsTrendsPanel data={{ enabled: false, measures: [] }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when there are no measures', () => {
    const { container } = render(<VitalsTrendsPanel data={{ enabled: true, measures: [] }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the first measure chart + readings and switches on picker change', () => {
    render(<VitalsTrendsPanel data={sample} />);

    expect(screen.getByText('Vitals trends')).toBeInTheDocument();
    // BP is first: legend + a combined reading
    expect(screen.getByText('Systolic')).toBeInTheDocument();
    expect(screen.getByText('120/80')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Choose a vital to chart'), { target: { value: 'weight' } });
    expect(screen.getByText('70 kg')).toBeInTheDocument();
    // BP legend gone once weight (single series) is selected
    expect(screen.queryByText('Systolic')).not.toBeInTheDocument();
  });

  it('shows a growth-chart deep link only when the patient is pediatric', () => {
    const { rerender } = render(<VitalsTrendsPanel data={sample} />);
    expect(screen.queryByRole('link', { name: /Growth chart/i })).not.toBeInTheDocument();

    rerender(
      <VitalsTrendsPanel
        data={{ ...sample, growth_chart_url: '/interface/forms/vitals/growthchart/chart.php?pid=42&csrf_token_form=tok' }}
      />
    );
    const link = screen.getByRole('link', { name: /Growth chart/i });
    expect(link).toHaveAttribute('href', '/interface/forms/vitals/growthchart/chart.php?pid=42&csrf_token_form=tok');
    expect(link).toHaveAttribute('target', '_blank');
  });
});
