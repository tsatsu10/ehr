import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PatientImportPanel } from './PatientImportPanel';

const oeFetchMock = vi.hoisted(() => vi.fn());
vi.mock('@core/oeFetch', () => ({ oeFetch: oeFetchMock }));

const CSV = 'First Name,Surname,Date of Birth\nAma,Mensah,12/03/1988\nKwame,Boateng,01/01/1970\n';

describe('PatientImportPanel', () => {
  it('walks upload → match → check → import', async () => {
    oeFetchMock.mockResolvedValue({
      results: [
        { row_number: 2, status: 'ok', reason: '', name: 'Ama Mensah', pid: null },
        { row_number: 3, status: 'ok', reason: '', name: 'Kwame Boateng', pid: null },
      ],
      summary: { processed: 2, ok: 2, duplicates: 0, errors: 0 },
    });

    render(<PatientImportPanel ajaxUrl="/ajax" csrfToken="tok" facilityId={3} initialCsvText={CSV} />);

    // Auto-matched columns are shown on the match step.
    expect(await screen.findByText(/match columns/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /check file/i }));

    await waitFor(() => expect(screen.getByText(/2/)).toBeInTheDocument());
    expect(oeFetchMock).toHaveBeenCalledWith(
      'admin.patient_import.chunk',
      expect.objectContaining({ json: expect.objectContaining({ dry_run: 1 }) })
    );
  });

  it('blocks Continue until first and last name are mapped', async () => {
    render(<PatientImportPanel ajaxUrl="/ajax" csrfToken="tok" facilityId={3} initialCsvText={'a,b\n1,2\n'} />);
    const btn = await screen.findByRole('button', { name: /check file/i });
    expect(btn).toBeDisabled();
    expect(screen.getByText(/first name and last name/i)).toBeInTheDocument();
  });
});
