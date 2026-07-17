import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LabOpsWorklist } from './LabOpsWorklist';
import type { WorklistRow } from './labOpsTypes';

function row(overrides: Partial<WorklistRow> = {}): WorklistRow {
  return {
    procedure_order_id: 5,
    patient_name: 'Ama Owusu',
    test_names: 'Full blood count',
    fulfillment: 'in_house',
    fulfillment_label: 'In-house',
    status_label: 'Collected · awaiting release',
    collected: true,
    review_status: '',
    tat_label: 'In lab 45m',
    ...overrides,
  };
}

const handlers = {
  onCollect: vi.fn(),
  onEnter: vi.fn(),
  onSendOut: vi.fn(),
  onReject: vi.fn(),
};

describe('LabOpsWorklist', () => {
  it('shows the turnaround-time label and a Reject specimen action on a collected in-house row', () => {
    const onReject = vi.fn();
    render(
      <LabOpsWorklist tab="in_progress" rows={[row()]} canEnter {...handlers} onReject={onReject} />,
    );

    expect(screen.getByText(/In lab 45m/)).toBeInTheDocument();
    const reject = screen.getByRole('button', { name: 'Reject specimen' });
    fireEvent.click(reject);
    expect(onReject).toHaveBeenCalledWith(5);
  });

  it('hides Reject once results are released', () => {
    render(
      <LabOpsWorklist
        tab="in_progress"
        rows={[row({ review_status: 'reviewed', status_label: 'Released', tat_label: 'TAT 2h 10m' })]}
        canEnter
        {...handlers}
      />,
    );
    expect(screen.getByText(/TAT 2h 10m/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reject specimen' })).not.toBeInTheDocument();
  });

  it('shows a rejected specimen with its reason and offers re-collection', () => {
    render(
      <LabOpsWorklist
        tab="pending"
        rows={[row({ collected: false, rejected: true, rejection_reason: 'Haemolysed', status_label: 'Specimen rejected (Haemolysed) · recollect' })]}
        canEnter
        {...handlers}
      />,
    );
    expect(screen.getByText(/Specimen rejected \(Haemolysed\)/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark collected' })).toBeInTheDocument();
  });
});
