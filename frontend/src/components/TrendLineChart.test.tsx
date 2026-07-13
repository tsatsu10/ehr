import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TrendLineChart } from './TrendLineChart';

describe('TrendLineChart', () => {
  it('shows the empty label when there are no points', () => {
    render(<TrendLineChart series={[{ name: 'Weight', points: [] }]} emptyLabel="No readings yet." />);
    expect(screen.getByText('No readings yet.')).toBeInTheDocument();
  });

  it('renders an accessible summary and a point per reading', () => {
    render(
      <TrendLineChart
        unit="kg"
        series={[
          {
            name: 'Weight',
            points: [
              { label: '1 Jan 2026', value: 70 },
              { label: '1 Feb 2026', value: 72 },
              { label: '1 Mar 2026', value: 71 },
            ],
          },
        ]}
      />
    );
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('aria-label', expect.stringContaining('3 readings'));
    expect(img).toHaveAttribute('aria-label', expect.stringContaining('latest 71 kg'));
    // one <circle> per point
    expect(img.querySelectorAll('circle')).toHaveLength(3);
    // a connecting line for >1 point
    expect(img.querySelector('polyline')).not.toBeNull();
  });

  it('renders a legend for multi-series (e.g. BP)', () => {
    render(
      <TrendLineChart
        unit="mmHg"
        series={[
          { name: 'Systolic', points: [{ label: 'a', value: 120 }, { label: 'b', value: 122 }] },
          { name: 'Diastolic', points: [{ label: 'a', value: 80 }, { label: 'b', value: 78 }] },
        ]}
      />
    );
    expect(screen.getByText('Systolic')).toBeInTheDocument();
    expect(screen.getByText('Diastolic')).toBeInTheDocument();
    expect(screen.getByRole('img').querySelectorAll('circle')).toHaveLength(4);
  });

  it('handles a single point without a connecting line', () => {
    render(<TrendLineChart series={[{ name: 'BMI', points: [{ label: 'x', value: 24 }] }]} />);
    const img = screen.getByRole('img');
    expect(img.querySelectorAll('circle')).toHaveLength(1);
    expect(img.querySelector('polyline')).toBeNull();
  });
});
