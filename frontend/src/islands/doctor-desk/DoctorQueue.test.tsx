import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DoctorQueue, DoctorQueueBody } from './DoctorQueue';
import type { DoctorQueueCard, DoctorReopenableRow } from '@core/types';

function card(overrides: Partial<DoctorQueueCard> = {}): DoctorQueueCard {
  return {
    id: 1,
    queue_number: '3',
    display_name: 'Kwame Mensah',
    sex: 'M',
    age_years: '45',
    wait_minutes: 5,
    wait_label: '5m',
    is_urgent: 0,
    ...overrides,
  } as DoctorQueueCard;
}

function baseProps() {
  return {
    cards: [card()],
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

describe('DoctorQueue', () => {
  it('shows the waiting count in the panel title', () => {
    render(<DoctorQueue {...baseProps()} />);
    expect(screen.getByText('Waiting for doctor')).toBeInTheDocument();
  });

  it('takes a patient when their card is clicked', () => {
    const onTakePatient = vi.fn();
    render(<DoctorQueue {...baseProps()} onTakePatient={onTakePatient} />);
    fireEvent.click(screen.getByRole('button', { name: /Kwame Mensah/ }));
    expect(onTakePatient).toHaveBeenCalledWith(card());
  });

  it('disables every card and shows a hint when a consult is already active', () => {
    render(<DoctorQueue {...baseProps()} hasActiveConsult />);
    expect(screen.getByRole('button', { name: /Kwame Mensah/ })).toBeDisabled();
    expect(screen.getByText(/Finish your current consult/)).toBeInTheDocument();
  });

  it('does not take a claim-lost card and shows who took it', () => {
    const onTakePatient = vi.fn();
    render(
      <DoctorQueue
        {...baseProps()}
        onTakePatient={onTakePatient}
        cards={[card({ claim_lost: true, claim_lost_by: { role_label: 'Dr.', display_name: 'Owusu' } as never })]}
      />,
    );
    const btn = screen.getByRole('button', { name: /Kwame Mensah/ });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onTakePatient).not.toHaveBeenCalled();
  });

  it('shows an empty state when there are no waiting patients', () => {
    render(<DoctorQueue {...baseProps()} cards={[]} />);
    expect(screen.getByText('No patients waiting.')).toBeInTheDocument();
  });

  it('shows a loading state only while the queue is empty and loading', () => {
    render(<DoctorQueue {...baseProps()} cards={[]} loading />);
    expect(screen.getByText('Loading queue…')).toBeInTheDocument();
  });

  it('surfaces a queue error', () => {
    render(<DoctorQueue {...baseProps()} error="Queue load failed" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Queue load failed');
  });

  it('renders the reopen-today section only when canReopenConsult is true, and reopens a row', () => {
    const onReopenClick = vi.fn();
    const row: DoctorReopenableRow = {
      id: 9,
      queue_number: '4',
      display_name: 'Ama Owusu',
      state: 'ready_for_payment',
    } as DoctorReopenableRow;

    render(<DoctorQueue {...baseProps()} canReopenConsult reopenableToday={[row]} onReopenClick={onReopenClick} />);
    expect(screen.getByText('Reopen today (1)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reopen' }));
    expect(onReopenClick).toHaveBeenCalledWith(row);
  });

  it('lists done-today rows', () => {
    render(
      <DoctorQueue
        {...baseProps()}
        doneToday={[{ id: 3, queue_number: '1', display_name: 'Kojo Boateng' } as never]}
      />,
    );
    expect(screen.getByText('Done today (1)')).toBeInTheDocument();
    expect(screen.getByText(/Kojo Boateng/)).toBeInTheDocument();
  });
});

describe('DoctorQueueBody', () => {
  it('renders queueHeaderExtra above the list', () => {
    render(<DoctorQueueBody {...baseProps()} queueHeaderExtra={<div>Extra header</div>} />);
    expect(screen.getByText('Extra header')).toBeInTheDocument();
  });
});
