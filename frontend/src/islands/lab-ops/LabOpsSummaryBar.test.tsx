import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LabOpsSummaryBar } from './LabOpsSummaryBar';

describe('LabOpsSummaryBar', () => {
  it('shows counts, median turnaround and rejection rate', () => {
    render(
      <LabOpsSummaryBar
        summary={{
          total_orders: 20,
          released: 12,
          rejections: 1,
          rejection_rate_pct: 5,
          median_tat_minutes: 135,
          median_tat_label: '2h 15m',
        }}
      />
    );

    expect(screen.getByText('Orders today')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('2h 15m')).toBeInTheDocument();
    // Rejection rate at 5% carries the danger tone class.
    const rate = screen.getByText(/5%/);
    expect(rate.className).toContain('danger');
  });

  it('falls back to a dash when no order has been released yet', () => {
    render(
      <LabOpsSummaryBar
        summary={{
          total_orders: 3,
          released: 0,
          rejections: 0,
          rejection_rate_pct: 0,
          median_tat_minutes: null,
          median_tat_label: null,
        }}
      />
    );

    expect(screen.getByText('Median turnaround').nextSibling?.textContent).toBe('—');
  });
});
