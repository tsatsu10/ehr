import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

    render(<PatientImportPanel ajaxUrl="/ajax" csrfToken="tok" initialCsvText={CSV} />);

    // Auto-matched columns are shown on the match step.
    expect(await screen.findByText(/match columns/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /check file/i }));

    const willImportTile = (await screen.findByText('Will import')).closest('.nc-import-stat-tile');
    expect(willImportTile).not.toBeNull();
    await waitFor(() => expect(within(willImportTile as HTMLElement).getByText('2')).toBeInTheDocument());
    expect(oeFetchMock).toHaveBeenCalledWith(
      'admin.patient_import.chunk',
      expect.objectContaining({ json: expect.objectContaining({ dry_run: 1 }) })
    );
    // The client no longer decides which facility to import into — the
    // session on the server side is the sole source of truth (Task B).
    expect(oeFetchMock).toHaveBeenCalledWith(
      'admin.patient_import.chunk',
      expect.objectContaining({ json: expect.not.objectContaining({ facility_id: expect.anything() }) })
    );
  });

  it('blocks Continue until first and last name are mapped', async () => {
    render(<PatientImportPanel ajaxUrl="/ajax" csrfToken="tok" initialCsvText={'a,b\n1,2\n'} />);
    const btn = await screen.findByRole('button', { name: /check file/i });
    expect(btn).toBeDisabled();
    expect(screen.getByText(/first name and last name/i)).toBeInTheDocument();
  });

  it('shows the real partial results — not the stale dry-run preview — after a commit failure', async () => {
    // The dry-run ("Check file") call succeeds and predicts 2 importable rows.
    // The real commit call (after confirming "Import") then fails outright,
    // so nothing was actually imported.
    oeFetchMock
      .mockResolvedValueOnce({
        results: [
          { row_number: 2, status: 'ok', reason: '', name: 'Ama Mensah', pid: null },
          { row_number: 3, status: 'ok', reason: '', name: 'Kwame Boateng', pid: null },
        ],
        summary: { processed: 2, ok: 2, duplicates: 0, errors: 0 },
      })
      .mockRejectedValueOnce(new Error('Connection lost'));

    render(<PatientImportPanel ajaxUrl="/ajax" csrfToken="tok" initialCsvText={CSV} />);

    fireEvent.click(await screen.findByRole('button', { name: /check file/i }));

    const importTrigger = await screen.findByRole('button', { name: /import 2 patients/i });
    fireEvent.click(importTrigger);

    const confirmButton = await screen.findByRole('button', { name: /^import$/i });
    fireEvent.click(confirmButton);

    // The failure is surfaced...
    expect(await screen.findByRole('alert')).toHaveTextContent(/connection lost/i);

    // ...and the Done screen reflects that ZERO rows actually committed before
    // the failure, not the dry-run's "2 will import" prediction.
    const importedTile = (await screen.findByText('Imported')).closest('.nc-import-stat-tile');
    expect(importedTile).not.toBeNull();
    expect(within(importedTile as HTMLElement).getByText('0')).toBeInTheDocument();
  });
});
