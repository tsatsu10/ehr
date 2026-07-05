import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { VisitDetailDrawer } from './VisitDetailDrawer';
import type { VisitDetailData } from '@core/types';

const detailData: VisitDetailData = {
  visit: {
    id: 42,
    pid: 5,
    queue_number: '1',
    state: 'waiting',
    chief_complaint: 'Persistent cough',
  },
  preview: {
    identity: {
      pid: 5,
      display_name: 'Kwame Mensah',
      sex: 'M',
      age_years: '28',
      pubpid: 'MRN999',
    },
    completion: {
      score: 80,
      billing_threshold: 70,
      chart_url: '/chart/5',
    },
  },
  visit_summary: {
    state: 'waiting',
    state_label: 'Waiting',
    queue_number: 1,
    visit_type_label: 'General OPD',
    wait_minutes: 10,
    wait_label: '10m',
    visit_date: '2099-06-27',
    provider_hint: 'Unassigned',
    chief_complaint: 'Persistent cough',
  },
  audit_timeline: [{ type: 'state', label: 'Checked in', at: '2099-06-27T10:00:00Z' }],
  chart_history_url: '/history/5',
};

describe('VisitDetailDrawer', () => {
  it('renders patient banner, CC line, and audit timeline', () => {
    render(
      <VisitDetailDrawer open data={detailData} onClose={vi.fn()} />,
    );

    expect(screen.getByText(/Kwame Mensah/)).toBeInTheDocument();
    expect(screen.getByText(/Reason for visit:/)).toBeInTheDocument();
    expect(screen.getByText(/Persistent cough/)).toBeInTheDocument();
    expect(screen.getByText('Checked in')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View full history' })).toHaveAttribute(
      'href',
      '/history/5',
    );
  });
});
