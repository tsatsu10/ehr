import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const oeFetchMock = vi.fn();
vi.mock('@core/oeFetch', async () => {
  const actual = await vi.importActual<typeof import('@core/oeFetch')>('@core/oeFetch');
  return { ...actual, oeFetch: (...args: unknown[]) => oeFetchMock(...args) };
});

const toastMock = vi.fn();
vi.mock('@components/deskToast', () => ({ showDeskToast: (...args: unknown[]) => toastMock(...args) }));

import { clearInstructionsCachesForTest, ClinicalInstructionsDrawer } from './ClinicalInstructionsDrawer';

const baseProps = {
  open: true,
  onClose: vi.fn(),
  ajaxUrl: '/ajax.php',
  csrfToken: 'tok',
  visitId: 72,
  patientLabel: 'Test Patient · PT-12',
  onSaved: vi.fn(),
};

function getPayload() {
  return {
    enabled: true,
    visit_id: 72,
    form_id: 9,
    instruction: 'Rest at home.',
    snippets: ['Drink plenty of fluids.'],
  };
}

describe('ClinicalInstructionsDrawer', () => {
  beforeEach(() => {
    oeFetchMock.mockReset();
    toastMock.mockReset();
    baseProps.onSaved = vi.fn();
    baseProps.onClose = vi.fn();
    clearInstructionsCachesForTest();
  });

  it('enables Print only when a saved note exists', async () => {
    oeFetchMock.mockResolvedValueOnce({ ...getPayload(), form_id: null, instruction: '' });
    render(<ClinicalInstructionsDrawer {...baseProps} />);
    await screen.findByPlaceholderText(/What the patient should do/i);
    expect(screen.getByRole('button', { name: 'Print' })).toBeDisabled();
  });

  it('loads the existing instruction and snippet chips', async () => {
    oeFetchMock.mockResolvedValueOnce(getPayload());
    render(<ClinicalInstructionsDrawer {...baseProps} />);
    expect(await screen.findByDisplayValue('Rest at home.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Print' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Drink plenty of fluids.' })).toBeInTheDocument();
    expect(oeFetchMock).toHaveBeenCalledWith('clinical_doc.instructions_get', expect.objectContaining({
      params: { visit_id: 72 },
    }));
  });

  it('appends a snippet to the textarea on chip click', async () => {
    oeFetchMock.mockResolvedValueOnce(getPayload());
    render(<ClinicalInstructionsDrawer {...baseProps} />);
    const textarea = await screen.findByPlaceholderText<HTMLTextAreaElement>(/What the patient should do/i);
    fireEvent.click(screen.getByRole('button', { name: 'Drink plenty of fluids.' }));
    expect(textarea.value).toBe('Rest at home.\nDrink plenty of fluids.');
  });

  it('saves and calls onSaved with a success toast', async () => {
    oeFetchMock.mockResolvedValueOnce(getPayload());
    oeFetchMock.mockResolvedValueOnce({ saved: true, form_id: 9, instruction: 'Rest at home.' });
    render(<ClinicalInstructionsDrawer {...baseProps} />);
    await screen.findByDisplayValue('Rest at home.');
    fireEvent.click(screen.getByRole('button', { name: /Save instructions/i }));
    await waitFor(() => expect(baseProps.onSaved).toHaveBeenCalled());
    expect(oeFetchMock).toHaveBeenLastCalledWith('clinical_doc.instructions_save', expect.objectContaining({
      method: 'POST',
      json: { visit_id: 72, instruction: 'Rest at home.' },
    }));
    expect(toastMock).toHaveBeenCalledWith('Instructions saved', 'success');
  });

  it('blocks saving when the note is empty, showing the hint only after typing', async () => {
    oeFetchMock.mockResolvedValueOnce({ ...getPayload(), instruction: '' });
    render(<ClinicalInstructionsDrawer {...baseProps} />);
    const textarea = await screen.findByPlaceholderText<HTMLTextAreaElement>(/What the patient should do/i);
    // Untouched empty form: disabled save, but no shouty error yet.
    expect(screen.getByRole('button', { name: /Save instructions/i })).toBeDisabled();
    expect(screen.queryByText('Enter at least one instruction.')).not.toBeInTheDocument();
    // Type then clear -> now the inline hint appears.
    fireEvent.change(textarea, { target: { value: 'x' } });
    fireEvent.change(textarea, { target: { value: '' } });
    expect(screen.getByText('Enter at least one instruction.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save instructions/i })).toBeDisabled();
  });
});
