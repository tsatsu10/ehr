import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DoctorWalkInModal } from './DoctorWalkInModal';
import type { VisitType } from '@core/types';

const visitTypes: VisitType[] = [
  { id: 1, label: 'General OPD' } as VisitType,
  { id: 2, label: 'Follow-up' } as VisitType,
];

function baseProps() {
  return {
    open: true,
    patientName: 'Kwame Mensah',
    patientMrn: 'MRN012',
    visitTypes,
    submitting: false,
    error: null,
    onConfirm: vi.fn(),
    onClose: vi.fn(),
  };
}

describe('DoctorWalkInModal', () => {
  it('defaults the visit type to the first option and confirms with it', () => {
    const onConfirm = vi.fn();
    render(<DoctorWalkInModal {...baseProps()} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start consult' }));
    expect(onConfirm).toHaveBeenCalledWith(1);
  });

  it('confirms with the selected visit type after changing it', () => {
    const onConfirm = vi.fn();
    render(<DoctorWalkInModal {...baseProps()} onConfirm={onConfirm} />);
    fireEvent.change(screen.getByLabelText('Visit type'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start consult' }));
    expect(onConfirm).toHaveBeenCalledWith(2);
  });

  it('shows a warning and disables Start consult when there are no visit types', () => {
    render(<DoctorWalkInModal {...baseProps()} visitTypes={[]} />);
    expect(screen.getByText('No visit types configured')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start consult' })).toBeDisabled();
  });

  it('shows the error message when provided', () => {
    render(<DoctorWalkInModal {...baseProps()} error="Could not start visit" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not start visit');
  });

  it('disables both buttons while submitting', () => {
    render(<DoctorWalkInModal {...baseProps()} submitting />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Starting…' })).toBeDisabled();
  });

  it('calls onClose from the Cancel button', () => {
    const onClose = vi.fn();
    render(<DoctorWalkInModal {...baseProps()} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });
});
