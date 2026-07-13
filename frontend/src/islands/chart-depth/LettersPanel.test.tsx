import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { LettersPanel } from './LettersPanel';

vi.mock('@core/oeFetch', () => ({
  oeFetch: vi.fn(),
}));

import { oeFetch } from '@core/oeFetch';
const mockFetch = oeFetch as ReturnType<typeof vi.fn>;

const baseProps = {
  ajaxUrl: '/ajax.php',
  csrfToken: 'tok',
  pid: 3,
  letterPrintUrl: '/letter-print.php',
};

describe('LettersPanel', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('loads templates and directory contacts into the pickers', async () => {
    mockFetch.mockResolvedValueOnce({
      templates: [{ name: 'referral_letter' }, { name: 'sample' }],
      contacts: [{ id: 21, label: 'Dr. Mensah — Korle Bu (Specialist)' }],
    });

    render(<LettersPanel {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Template')).toBeInTheDocument();
    });
    expect(mockFetch).toHaveBeenCalledWith(
      'letters.templates',
      expect.objectContaining({ params: { pid: 3 } })
    );
    expect(screen.getByText('referral_letter')).toBeInTheDocument();
    expect(screen.getByText('Dr. Mensah — Korle Bu (Specialist)')).toBeInTheDocument();
  });

  it('shows an empty-state callout when no templates exist', async () => {
    mockFetch.mockResolvedValueOnce({ templates: [], contacts: [] });

    render(<LettersPanel {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByText(/No letter templates found/)).toBeInTheDocument();
    });
  });

  it('fills the body from the selected template and recipient', async () => {
    mockFetch
      .mockResolvedValueOnce({
        templates: [{ name: 'referral_letter' }],
        contacts: [{ id: 21, label: 'Dr. Mensah' }],
      })
      .mockResolvedValueOnce({ body: 'Dear Dr. Mensah,\nRe: Ama Boateng' });

    render(<LettersPanel {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Template')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText('Template'), { target: { value: 'referral_letter' } });
    fireEvent.change(screen.getByLabelText('To (directory contact)'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Fill from template' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Letter body')).toHaveValue('Dear Dr. Mensah,\nRe: Ama Boateng');
    });
    expect(mockFetch).toHaveBeenLastCalledWith(
      'letters.render',
      expect.objectContaining({
        method: 'POST',
        json: { pid: 3, template: 'referral_letter', to_contact_id: 21 },
      })
    );
  });

  it('keeps Print disabled until there is a body, then submits the hidden print form', async () => {
    mockFetch.mockResolvedValueOnce({ templates: [{ name: 'sample' }], contacts: [] });

    const { container } = render(<LettersPanel {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Print letter' })).toBeDisabled();
    });

    fireEvent.change(screen.getByLabelText('Letter body'), { target: { value: 'Hello' } });
    const printButton = screen.getByRole('button', { name: 'Print letter' });
    expect(printButton).toBeEnabled();

    const form = container.querySelector('form') as HTMLFormElement;
    const submitSpy = vi.spyOn(form, 'submit').mockImplementation(() => {});
    fireEvent.click(printButton);
    expect(submitSpy).toHaveBeenCalled();
    expect(form.action).toContain('/letter-print.php');
    expect((form.elements.namedItem('body') as HTMLTextAreaElement).value).toBe('Hello');
    expect((form.elements.namedItem('csrf_token_form') as HTMLInputElement).value).toBe('tok');
  });
});
