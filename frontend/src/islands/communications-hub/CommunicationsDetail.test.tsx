import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CommunicationsDetail } from './CommunicationsDetail';
import type { MessageDetail } from './communicationsTypes';

vi.mock('@components/PatientSearchDropdown', () => ({
  PatientSearchDropdown: ({
    onSelectPatient,
  }: {
    onSelectPatient: (pid: number, row?: { display_name: string }) => void;
  }) => (
    <button
      type="button"
      onClick={() => onSelectPatient(55, { display_name: 'Kofi Asante' })}
    >
      Pick patient
    </button>
  ),
}));

const baseMessage: MessageDetail = {
  id: 12,
  patient_name: 'Jane Doe',
  type: 'Note',
  from_name: 'Dr Smith',
  date: '2026-06-27',
  date_display: 'Jun 27',
  status: 'New',
  can_reply: true,
  can_mark_done: true,
  can_change_status: true,
  message_statuses: [
    { id: 'New', label: 'New' },
    { id: 'Done', label: 'Done' },
  ],
  thread_html: '<p>Hello</p>',
};

describe('CommunicationsDetail', () => {
  it('renders status dropdown when user can change status', () => {
    render(
      <CommunicationsDetail
        loading={false}
        error={null}
        message={baseMessage}
        reminder={null}
        webroot="/openemr"
        onStatusChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Message status')).toBeInTheDocument();
    expect(screen.getByLabelText('Message status')).toHaveValue('New');
  });

  it('calls onStatusChange when status is updated', () => {
    const onStatusChange = vi.fn();

    render(
      <CommunicationsDetail
        loading={false}
        error={null}
        message={baseMessage}
        reminder={null}
        webroot="/openemr"
        onStatusChange={onStatusChange}
      />,
    );

    fireEvent.change(screen.getByLabelText('Message status'), { target: { value: 'Done' } });
    expect(onStatusChange).toHaveBeenCalledWith(12, 'Done');
  });

  it('shows read-only status for supervisory read', () => {
    render(
      <CommunicationsDetail
        loading={false}
        error={null}
        message={{
          ...baseMessage,
          can_change_status: false,
          message_statuses: [],
          is_supervisory_read: true,
          supervisory_banner: 'Admin read only',
        }}
        reminder={null}
        webroot="/openemr"
      />,
    );

    expect(screen.queryByLabelText('Message status')).not.toBeInTheDocument();
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('shows assign patient flow for orphan messages', () => {
    const onAssignPatient = vi.fn();

    render(
      <CommunicationsDetail
        loading={false}
        error={null}
        message={{
          ...baseMessage,
          patient_name: '',
          can_assign_patient: true,
          patient_unassigned: true,
        }}
        reminder={null}
        webroot="/openemr"
        ajaxUrl="/ajax"
        csrfToken="token"
        onAssignPatient={onAssignPatient}
      />,
    );

    expect(screen.getByText(/No patient linked/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Pick patient' }));
    fireEvent.click(screen.getByRole('button', { name: 'Assign patient' }));
    expect(onAssignPatient).toHaveBeenCalledWith(12, 55);
  });

  it('shows forward action on reminder detail', () => {
    const onForwardReminder = vi.fn();

    render(
      <CommunicationsDetail
        loading={false}
        error={null}
        message={null}
        reminder={{
          id: 9,
          pid: 42,
          patient_name: 'Jane Doe',
          from_name: 'Dr Smith',
          due_date: '2026-06-28',
          due_display: 'Jun 28',
          urgency: 'today',
          urgency_label: 'Due today',
          preview: 'Follow up on labs',
        }}
        webroot="/openemr"
        onForwardReminder={onForwardReminder}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Forward' }));
    expect(onForwardReminder).toHaveBeenCalledWith(9);
  });
});
