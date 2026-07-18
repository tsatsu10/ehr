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
  thread_html: '<p>Hello</p>',
};

describe('CommunicationsDetail', () => {
  it('shows a Mark done action on an active message (no status dropdown)', () => {
    render(
      <CommunicationsDetail
        loading={false}
        error={null}
        message={baseMessage}
        reminder={null}
        webroot="/openemr"
        onMarkDone={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText('Message status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark done' })).toBeInTheDocument();
  });

  it('calls onMarkDone when Mark done is clicked', () => {
    const onMarkDone = vi.fn();

    render(
      <CommunicationsDetail
        loading={false}
        error={null}
        message={baseMessage}
        reminder={null}
        webroot="/openemr"
        onMarkDone={onMarkDone}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mark done' }));
    expect(onMarkDone).toHaveBeenCalledWith(12);
  });

  it('shows Reopen (not Mark done) on a done message and reopens it', () => {
    const onStatusChange = vi.fn();

    render(
      <CommunicationsDetail
        loading={false}
        error={null}
        message={{ ...baseMessage, status: 'Done' }}
        reminder={null}
        webroot="/openemr"
        onMarkDone={vi.fn()}
        onStatusChange={onStatusChange}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Mark done' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reopen' }));
    expect(onStatusChange).toHaveBeenCalledWith(12, 'Read');
  });

  it('shows no done/reopen action for supervisory read', () => {
    render(
      <CommunicationsDetail
        loading={false}
        error={null}
        message={{
          ...baseMessage,
          can_mark_done: false,
          can_change_status: false,
          is_supervisory_read: true,
          supervisory_banner: 'Admin read only',
        }}
        reminder={null}
        webroot="/openemr"
      />,
    );

    expect(screen.queryByLabelText('Message status')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark done' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reopen' })).not.toBeInTheDocument();
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

  it('shows Mark completed in the reminder reader header', () => {
    const onCompleteReminder = vi.fn();

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
        onCompleteReminder={onCompleteReminder}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mark completed' }));
    expect(onCompleteReminder).toHaveBeenCalledWith(9);
  });

  it('quick-reply chip fills the composer without sending', () => {
    const onSendReply = vi.fn();

    render(
      <CommunicationsDetail
        loading={false}
        error={null}
        message={baseMessage}
        reminder={null}
        webroot="/openemr"
        onSendReply={onSendReply}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'On my way' }));

    expect(screen.getByLabelText('Reply')).toHaveValue('On my way');
    // Filling must not send — posting to the record stays explicit.
    expect(onSendReply).not.toHaveBeenCalled();
  });

  it('quick-reply chip appends to a typed draft instead of wiping it', () => {
    render(
      <CommunicationsDetail
        loading={false}
        error={null}
        message={baseMessage}
        reminder={null}
        webroot="/openemr"
        onSendReply={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('Reply'), { target: { value: 'Seen — ' } });
    fireEvent.click(screen.getByRole('button', { name: 'On my way' }));

    expect(screen.getByLabelText('Reply')).toHaveValue('Seen — On my way');
  });
});
