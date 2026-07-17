import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { postDoctorAction } from './postDoctorAction';
import { ReopenModal } from './ReopenModal';
import type { DoctorReopenableRow } from '@core/types';

vi.mock('./postDoctorAction', () => ({ postDoctorAction: vi.fn() }));

const mockedPost = vi.mocked(postDoctorAction);

const target: DoctorReopenableRow = {
  id: 44,
  display_name: 'Ama Owusu',
  pubpid: 'MRN044',
  queue_number: '9',
  row_version: 2,
} as DoctorReopenableRow;

function baseProps() {
  return {
    open: true,
    target,
    ajaxUrl: '/ajax.php',
    csrfToken: 'tok',
    facilityId: 1,
    blocked: false,
    onClose: vi.fn(),
    onReopened: vi.fn(),
    onConflict: vi.fn(),
  };
}

describe('ReopenModal', () => {
  beforeEach(() => {
    mockedPost.mockReset();
  });

  it('renders nothing when there is no target', () => {
    const { container } = render(<ReopenModal {...baseProps()} target={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('keeps confirm disabled until a reason of at least 10 characters is entered', () => {
    render(<ReopenModal {...baseProps()} />);
    const confirmBtn = screen.getByRole('button', { name: 'Reopen consult' });
    expect(confirmBtn).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: 'too short' } });
    expect(confirmBtn).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: 'now ten chars+' } });
    expect(confirmBtn).toBeEnabled();
    expect(mockedPost).not.toHaveBeenCalled();
  });

  it('calls onReopened with the returned payload on success', async () => {
    mockedPost.mockResolvedValue({ ok: true, data: { visit: { id: 44 } } } as never);
    const onReopened = vi.fn();
    render(<ReopenModal {...baseProps()} onReopened={onReopened} />);

    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: 'need to add a lab order' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reopen consult' }));

    await waitFor(() => {
      expect(onReopened).toHaveBeenCalledWith({ visit: { id: 44 } });
    });
    expect(mockedPost).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'doctor.reopen',
        body: { visit_id: 44, row_version: 2, reason: 'need to add a lab order' },
      }),
    );
  });

  it('routes stale/conflict failures to onConflict and closes the modal', async () => {
    mockedPost.mockResolvedValue({ ok: false, status: 409, message: 'Visit was updated elsewhere' } as never);
    const onConflict = vi.fn();
    const onClose = vi.fn();
    render(<ReopenModal {...baseProps()} onConflict={onConflict} onClose={onClose} />);

    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: 'need to add a lab order' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reopen consult' }));

    await waitFor(() => {
      expect(onConflict).toHaveBeenCalledWith('Visit was updated elsewhere');
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('shows a plain error message for non-conflict failures without closing', async () => {
    mockedPost.mockResolvedValue({ ok: false, status: 400, message: 'Reason required' } as never);
    const onClose = vi.fn();
    render(<ReopenModal {...baseProps()} onClose={onClose} />);

    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: 'need to add a lab order' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reopen consult' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Reason required');
    expect(onClose).not.toHaveBeenCalled();
  });
});
