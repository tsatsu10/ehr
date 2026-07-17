import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DoctorMobileQueueBar, DoctorMobileQueueSheet } from './DoctorMobileQueueSheet';
import type { DoctorQueueCard } from '@core/types';

describe('DoctorMobileQueueBar', () => {
  it('renders nothing while a consult is active', () => {
    const { container } = render(
      <DoctorMobileQueueBar waitingCount={2} hasActiveConsult onOpen={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a pluralized waiting count', () => {
    render(<DoctorMobileQueueBar waitingCount={3} hasActiveConsult={false} onOpen={vi.fn()} />);
    expect(screen.getByText('3 patients ready')).toBeInTheDocument();
  });

  it('uses singular phrasing for exactly one patient', () => {
    render(<DoctorMobileQueueBar waitingCount={1} hasActiveConsult={false} onOpen={vi.fn()} />);
    expect(screen.getByText('1 patient ready')).toBeInTheDocument();
  });

  it('falls back to "Doctor queue" when nobody is waiting', () => {
    render(<DoctorMobileQueueBar waitingCount={0} hasActiveConsult={false} onOpen={vi.fn()} />);
    expect(screen.getByText('Doctor queue')).toBeInTheDocument();
  });

  it('calls onOpen when clicked', () => {
    const onOpen = vi.fn();
    render(<DoctorMobileQueueBar waitingCount={1} hasActiveConsult={false} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onOpen).toHaveBeenCalled();
  });
});

describe('DoctorMobileQueueSheet', () => {
  function baseProps() {
    return {
      open: true,
      onClose: vi.fn(),
      waitingCount: 1,
      cards: [{ id: 1, queue_number: '3', display_name: 'Kwame Mensah', sex: 'M', age_years: '45' } as DoctorQueueCard],
      doneToday: [],
      reopenableToday: [],
      canReopenConsult: false,
      hasActiveConsult: false,
      loading: false,
      error: null,
      onTakePatient: vi.fn(),
      onReopenClick: vi.fn(),
    };
  }

  it('shows the waiting count in the sheet title', () => {
    render(<DoctorMobileQueueSheet {...baseProps()} />);
    expect(screen.getByText('My queue (1 waiting)')).toBeInTheDocument();
  });

  it('taking a patient both fires onTakePatient and closes the sheet', () => {
    const onTakePatient = vi.fn();
    const onClose = vi.fn();
    render(<DoctorMobileQueueSheet {...baseProps()} onTakePatient={onTakePatient} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /Kwame Mensah/ }));
    expect(onTakePatient).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
